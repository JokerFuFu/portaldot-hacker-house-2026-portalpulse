import {validateNetworkConfig} from '../core/config.js';
import {open,mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createRpc,collectSample,analyzeSamples,createReport,importReport,RpcError} from '../core/index.js';
import type {NetworkConfig,Sample,SessionReport,MonitorSummary} from '../core/index.js';
import {makeDemoSession} from '../demo/session.js';

const help=[
  'PortalPulse readonly CLI (Node >=22.12)',
  '  demo [--out path]                                  Explicit simulated local data',
  '  collect --config path [--samples N] [--interval-ms ms] [--out path]',
  '  inspect --input path                              Offline schema + digest inspection',
  'Defaults: samples=4 (1..2000), interval-ms=10000 (1..3600000), request timeout=8000 ms.',
  'Output: one compact JSON summary; --out saves the complete local report without overwrite.',
  'Exit: demo/valid offline import=0 (not current network verification); collect normal=0,',
  '      collect unverified=2; abnormal collection/invalid input/tampering/output error=1.',
  'No default live endpoint. SIGINT stops collection and preserves completed/failed evidence.','',
].join('\n');
interface Args {command:'demo'|'collect'|'inspect';options:Map<string,string>;samples:number;intervalMs:number;}
function boundedInteger(value:string|undefined,fallback:number,max:number,label:string):number {
  if(value===undefined)return fallback;
  if(!/^[0-9]+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<1||Number(value)>max)throw new Error('Invalid '+label+' range: 1..'+max);
  return Number(value);
}
function parse(args:string[]):Args|null {
  if(args.length===0||args.length===1&&['--help','-h'].includes(args[0]!))return null;
  const command=args[0];
  if(command!=='demo'&&command!=='collect'&&command!=='inspect')throw new Error('Unknown command; use --help');
  const allowed=command==='demo'?['--out']:command==='inspect'?['--input']:['--config','--samples','--interval-ms','--out'];
  const options=new Map<string,string>();
  for(let i=1;i<args.length;i+=2){
    const key=args[i]!;
    if(!allowed.includes(key))throw new Error('Unknown option: '+key);
    if(options.has(key))throw new Error('Duplicate option: '+key);
    const value=args[i+1];if(!value||value.startsWith('--'))throw new Error('Missing value for '+key);
    options.set(key,value);
  }
  if(command==='collect'&&!options.has('--config'))throw new Error('--config is required');
  if(command==='inspect'&&!options.has('--input'))throw new Error('--input is required');
  return {command,options,samples:boundedInteger(options.get('--samples'),4,2000,'samples'),intervalMs:boundedInteger(options.get('--interval-ms'),10000,3600000,'interval-ms')};
}
async function readBounded(path:string,max:number):Promise<string> {
  const file=await open(path,'r');
  try {const stat=await file.stat();if(!stat.isFile()||stat.size>max)throw new Error('Invalid input file or size limit');return await file.readFile({encoding:'utf8'});}finally{await file.close();}
}
async function readConfig(path:string):Promise<NetworkConfig> {
  let value: unknown;
  try {
    value = JSON.parse(await readBounded(path, 65536));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Invalid config JSON');
    throw error;
  }
  return validateNetworkConfig(value);
}
function checks(monitoring:MonitorSummary){return [monitoring.reachability,monitoring.identity,monitoring.freshness,monitoring.bestProgress,monitoring.finalizedProgress];}
function outputSummary(report:SessionReport,mode:'simulated'|'live'|'offline',interrupted=false,setupUnconfigured=false) {
  const p=report.payload;
  // Demo analysis uses its openly simulated clock; imports use the real clock and stay offline.
  const monitoring=analyzeSamples(p.samples,mode==='simulated'?Date.parse(p.endedAt):Date.now(),p.intervalMs);
  const {latest,...compactMonitoring}=monitoring;
  const failed=p.samples.some(sample=>sample.identity.state==='abnormal'||sample.rpc.some(record=>record.status==='abnormal'||record.error));
  const status=setupUnconfigured?'unverified':failed||checks(monitoring).some(c=>c.state==='abnormal')?'abnormal':checks(monitoring).every(c=>c.state==='normal')?'normal':'unverified';
  return {origin:p.origin,mode,status,verifiedNetwork:mode==='live'&&status==='normal'&&!interrupted,interrupted,integrity:'schema-and-sha256-valid; not source authenticity',report:{schemaVersion:report.schemaVersion,sha256:report.sha256,network:p.network,sampleCount:p.samples.length,intervalMs:p.intervalMs,startedAt:p.startedAt,endedAt:p.endedAt,droppedSamples:p.droppedSamples},monitoring:compactMonitoring};
}
async function save(report:SessionReport,path:string|undefined):Promise<void> {
  if(path===undefined)return;
  await mkdir(dirname(path),{recursive:true});
  try{await writeFile(path,JSON.stringify(report),{encoding:'utf8',flag:'wx'});}catch(error){if((error as NodeJS.ErrnoException).code==='EEXIST')throw new Error('Output exists; refusing overwrite');throw error;}
}
async function collect(args:Args):Promise<number> {
  const config=await readConfig(args.options.get('--config')!);
  const controller=new AbortController();
  const rpc=config.endpoint===null?{async request():Promise<never>{throw new RpcError('unconfigured','Endpoint unconfigured; no request attempted');},close(){}}:createRpc(config.endpoint);
  let interrupted=false;
  const interrupt=()=>{interrupted=true;controller.abort();rpc.close();};
  process.on('SIGINT',interrupt);
  const samples:Sample[]=[];
  try{
    if(config.endpoint===null)process.stderr.write('Unverified setup: endpoint unconfigured; no network requests attempted. Configure a trusted readonly endpoint and expected genesis.\n');
    const count=config.endpoint===null?1:args.samples;
    for(let i=0;i<count;i++){
      samples.push(await collectSample(rpc,config,{signal:controller.signal}));
      if(interrupted||i===count-1)break;
      try{await delay(args.intervalMs,undefined,{signal:controller.signal});}catch(error){if(!controller.signal.aborted)throw error;break;}
    }
  }finally{rpc.close();process.removeListener('SIGINT',interrupt);}
  const report=await createReport(config,samples,{intervalMs:args.intervalMs});
  await save(report,args.options.get('--out'));
  const summary=outputSummary(report,'live',interrupted,config.endpoint===null);
  process.stdout.write(JSON.stringify(summary)+'\n');
  if(summary.status==='abnormal'){process.stderr.write('Abnormal readonly collection; inspect preserved RPC and monitoring evidence.\n');return 1;}
  if(summary.status!=='normal'||interrupted){if(config.endpoint!==null)process.stderr.write('Unverified readonly collection; identity or progress evidence is incomplete.\n');return 2;}
  return 0;
}
async function main():Promise<number> {
  const args=parse(process.argv.slice(2));
  if(!args){process.stdout.write(help);return 0;}
  if(args.command==='collect')return collect(args);
  if(args.command==='inspect'){
    const report=await importReport(await readBounded(args.options.get('--input')!,16*1024*1024));
    process.stdout.write(JSON.stringify(outputSummary(report,'offline'))+'\n');return 0;
  }
  const {config,samples}=makeDemoSession();
  const report=await createReport(config,samples,{origin:'simulated'});
  await save(report,args.options.get('--out'));
  process.stdout.write(JSON.stringify(outputSummary(report,'simulated'))+'\n');return 0;
}
try{process.exitCode=await main();}catch(error){process.stderr.write('Error: '+(error instanceof Error?error.message:'CLI failed')+'\n');process.exitCode=1;}
