import {open,lstat,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createRpc} from '../dist/core/rpc.js';
import {collectNativeObservation} from './native-observation.mjs';
const HELP=[
  'PortalPulse native readonly observation (Node >=22.12; npm ci and npm run build:core first)',
  'node scripts/observe-native.mjs --config PATH --block-hash H256 --tx-hash H256 --out PATH',
  'Observes one raw native extrinsic hash and its system dispatch outcome at a supplied block.',
  'Normal is single-RPC dispatch correlation only; signer, probe semantics, finality and state remain unverified.',
  'No signing, transaction submission, deployment, wallet access or automatic retry.',
  'Exit0=normal dispatch observation; 1=abnormal/invalid/output failure; 2=incomplete/unverified.',
  'Output is a nativeObservationVersion1 JSON, not an ExecutionReport or deployment receipt.',
  'Output is created exclusively; existing files are never overwritten.',
  '',
].join('\n');
function parse(args) {
  if(args.length===0||(args.length===1&&['--help','-h'].includes(args[0])))return null;
  const values=new Map(),allowed=['--config','--block-hash','--tx-hash','--out'];
  for(let i=0;i<args.length;i+=2){
    const key=args[i],value=args[i+1];
    if(!allowed.includes(key))throw new Error('Unknown native observation option');
    if(values.has(key))throw new Error('Duplicate native observation option');
    if(!value||value.startsWith('--'))throw new Error('Missing native observation value');
    values.set(key,value);
  }
  if(allowed.some(k=>!values.has(k)))throw new Error('All four native observation options are required');
  for(const key of ['--block-hash','--tx-hash'])if(!/^0x[0-9a-fA-F]{64}$/.test(values.get(key)))throw new Error('Invalid native H256 argument');
  return values;
}
async function readConfig(path) {
  const file=await open(path,'r');
  try{
    const stat=await file.stat();
    if(!stat.isFile()||stat.size>65536)throw new Error('Invalid config file or size limit');
    const data=await file.readFile();
    if(data.length>65536)throw new Error('Config size limit');
    try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));}
    catch{throw new Error('Invalid native observation config JSON');}
  }finally{await file.close();}
}
async function main() {
  const args=parse(process.argv.slice(2));
  if(!args){process.stdout.write(HELP);return 0;}
  const out=resolve(args.get('--out'));
  try{await lstat(out);throw new Error('Output exists; refusing overwrite');}
  catch(error){if(error.code!=='ENOENT')throw error;}
  const config=await readConfig(args.get('--config'));
  // No default endpoint; collector validates the complete event-testnet identity profile.
  const rpc=createRpc(config.endpoint),controller=new AbortController();
  let interrupted=false;
  const interrupt=()=>{interrupted=true;controller.abort();rpc.close();};
  process.on('SIGINT',interrupt);
  let observation;
  try{
    observation=await collectNativeObservation(rpc,config,{blockHash:args.get('--block-hash'),transactionHash:args.get('--tx-hash'),signal:controller.signal});
  }finally{rpc.close();process.removeListener('SIGINT',interrupt);}
  observation.interrupted=interrupted;
  if(interrupted){
    observation.status='abnormal';
    observation.error??={code:'aborted',message:'Native observation interrupted'};
  }
  await mkdir(dirname(out),{recursive:true});
  try{await writeFile(out,JSON.stringify(observation,null,2)+'\n',{flag:'wx'});}
  catch(error){if(error.code==='EEXIST')throw new Error('Output exists; refusing overwrite');throw error;}
  process.stdout.write(JSON.stringify({
    nativeObservationVersion:1,mode:observation.mode,status:observation.status,target:observation.target,
    transactionIndex:observation.inclusion?.transactionIndex??null,dispatchOutcome:observation.dispatch?.outcome??null,
    verifiedNetwork:false,writeAllowed:false,fullVerification:false,finalityVerified:false,
    contractStateVerified:false,signerVerified:false,interrupted,out,
  })+'\n');
  return observation.status==='normal'?0:observation.status==='abnormal'?1:2;
}
try{process.exitCode=await main();}
catch(error){process.stderr.write('Error: '+(error instanceof Error?error.message:'Native observation failed')+'\n');process.exitCode=1;}
