import {validateNetworkConfig} from './config.js';
import type {BlockRef,CheckStatus,EvidenceOrigin,MonitorCheck,NetworkConfig} from './types.js';

export interface ExecutionEvidence {
  executionSchemaVersion:1;
  origin:EvidenceOrigin;
  network:Omit<NetworkConfig,'endpoint'> & {observedGenesis:string|null};
  intent:{vm:'revive'|'evm'|'wasm';contract:string;caller:string;expectedSequence:string};
  submitted:{transactionHash:string;observedAt:string}|null;
  inclusion:{transactionHash:string;block:BlockRef;transactionIndex:number;transactions:string[];observedAt:string}|null;
  execution:{transactionHash:string;blockHash:string;transactionIndex:number;outcome:'success'|'failure';failureReason:string|null;observedAt:string}|null;
  finality:{genesisHash:string;finalized:BlockRef;ancestry:BlockRef[];observedAt:string}|null;
  readback:{genesisHash:string;blockHash:string;contract:string;caller:string;sequence:string;observedAt:string}|null;
}
export interface ExecutionSummary {
  mode:'offline';origin:EvidenceOrigin;verifiedNetwork:false;writeAllowed:false;fullVerification:false;
  evidenceComplete:boolean;status:CheckStatus;trust:string;
  checks:{network:MonitorCheck;submission:MonitorCheck;inclusion:MonitorCheck;execution:MonitorCheck;finality:MonitorCheck;state:MonitorCheck};
  expectedSequence:string;observedSequence:string|null;
}
const MAX_BYTES=1024*1024;
// Historical mainnet observation, documented in docs/network-preflight.md. Never a V3 allowlist.
const KNOWN_MAINNET='0x83b5212c69f85f3996f8696bb35bf913af51b176a5f53d0a74fd3a83dc0b8a54';
function invalid(field:string):never {throw new Error('Invalid execution evidence: '+field);}
function object(value:unknown,keys:string[],field:string):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)invalid(field);
  const own=Reflect.ownKeys(value);
  if(own.length!==keys.length||keys.some(key=>!Object.hasOwn(value,key)))invalid(field+' fields');
  const clone:Record<string,unknown>={};
  for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(value,key)!;if(!descriptor.enumerable||!Object.hasOwn(descriptor,'value'))invalid(field+' fields');clone[key]=descriptor.value;}
  return clone;
}
function string(value:unknown,max:number,field:string):string {
  if(typeof value!=='string'||value.length===0||value.length>max||/[\u0000-\u001f\u007f-\u009f]/.test(value))invalid(field);
  return value;
}
function hash(value:unknown,field:string):string {
  if(typeof value!=='string'||!/^0x[\da-fA-F]{64}$/.test(value))invalid(field);
  return value;
}
function nullableHash(value:unknown,field:string):string|null {return value===null?null:hash(value,field);}
function address(value:unknown,field:string):string {
  const text=string(value,128,field);
  if(/[a-z][a-z\d+.-]*:/i.test(text))invalid(field+' URL');
  return text;
}
function decimal(value:unknown,max:number,field:string):string {
  if(typeof value!=='string'||value.length>max||!/^(0|[1-9]\d*)$/.test(value))invalid(field);
  return value;
}
function sequence(value:unknown,field:string):string {
  const text=decimal(value,20,field);
  if(BigInt(text)>18446744073709551615n)invalid(field);
  return text;
}
function index(value:unknown,field:string):number {
  if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0)invalid(field);
  return value;
}
function timestamp(value:unknown,field:string):string {
  if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)invalid(field);
  return value;
}
function array<T>(value:unknown,max:number,field:string,read:(item:unknown,field:string)=>T):T[] {
  if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max||Reflect.ownKeys(value).length!==value.length+1)invalid(field);
  const clone:T[]=[];
  for(let i=0;i<value.length;i++){const descriptor=Object.getOwnPropertyDescriptor(value,String(i));if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))invalid(field+' dense values');clone.push(read(descriptor.value,field+'['+i+']'));}
  return clone;
}
function block(value:unknown,field:string):BlockRef {
  const v=object(value,['hash','number','parentHash'],field);
  return {hash:hash(v.hash,field+'.hash'),number:decimal(v.number,309,field+'.number'),parentHash:hash(v.parentHash,field+'.parentHash')};
}
function validate(value:unknown):ExecutionEvidence {
  const v=object(value,['executionSchemaVersion','origin','network','intent','submitted','inclusion','execution','finality','readback'],'root');
  if(v.executionSchemaVersion!==1)invalid('executionSchemaVersion');
  if(v.origin!=='rpc'&&v.origin!=='simulated')invalid('origin');
  const n=object(v.network,['id','name','source','endpointAlias','kind','expectedGenesis','observedGenesis'],'network');
  for(const [key,max] of [['id',128],['name',256],['source',512],['endpointAlias',128]] as const)string(n[key],max,'network.'+key);
  const observedGenesis=nullableHash(n.observedGenesis,'network.observedGenesis');
  const {observedGenesis:unused,...publicConfig}=n;
  const {endpoint,...network}=validateNetworkConfig({...publicConfig,endpoint:null});
  const intent=object(v.intent,['vm','contract','caller','expectedSequence'],'intent');
  if(intent.vm!=='revive'&&intent.vm!=='evm'&&intent.vm!=='wasm')invalid('intent.vm');
  const result:ExecutionEvidence={executionSchemaVersion:1,origin:v.origin,network:{...network,observedGenesis},intent:{vm:intent.vm,contract:address(intent.contract,'intent.contract'),caller:address(intent.caller,'intent.caller'),expectedSequence:sequence(intent.expectedSequence,'intent.expectedSequence')},submitted:null,inclusion:null,execution:null,finality:null,readback:null};
  if(v.submitted!==null){const s=object(v.submitted,['transactionHash','observedAt'],'submitted');result.submitted={transactionHash:hash(s.transactionHash,'submitted.transactionHash'),observedAt:timestamp(s.observedAt,'submitted.observedAt')};}
  if(v.inclusion!==null){const s=object(v.inclusion,['transactionHash','block','transactionIndex','transactions','observedAt'],'inclusion');const transactions=array(s.transactions,8192,'inclusion.transactions',hash);const transactionIndex=index(s.transactionIndex,'inclusion.transactionIndex');if(transactionIndex>=transactions.length)invalid('inclusion.transactionIndex out of bounds');result.inclusion={transactionHash:hash(s.transactionHash,'inclusion.transactionHash'),block:block(s.block,'inclusion.block'),transactionIndex,transactions,observedAt:timestamp(s.observedAt,'inclusion.observedAt')};}
  if(v.execution!==null){const s=object(v.execution,['transactionHash','blockHash','transactionIndex','outcome','failureReason','observedAt'],'execution');if(s.outcome!=='success'&&s.outcome!=='failure')invalid('execution.outcome');if(s.outcome==='success'&&s.failureReason!==null)invalid('execution.failureReason');const failureReason=s.outcome==='failure'?string(s.failureReason,512,'execution.failureReason'):null;result.execution={transactionHash:hash(s.transactionHash,'execution.transactionHash'),blockHash:hash(s.blockHash,'execution.blockHash'),transactionIndex:index(s.transactionIndex,'execution.transactionIndex'),outcome:s.outcome,failureReason,observedAt:timestamp(s.observedAt,'execution.observedAt')};}
  if(v.finality!==null){const s=object(v.finality,['genesisHash','finalized','ancestry','observedAt'],'finality');result.finality={genesisHash:hash(s.genesisHash,'finality.genesisHash'),finalized:block(s.finalized,'finality.finalized'),ancestry:array(s.ancestry,512,'finality.ancestry',block),observedAt:timestamp(s.observedAt,'finality.observedAt')};}
  if(v.readback!==null){const s=object(v.readback,['genesisHash','blockHash','contract','caller','sequence','observedAt'],'readback');result.readback={genesisHash:hash(s.genesisHash,'readback.genesisHash'),blockHash:hash(s.blockHash,'readback.blockHash'),contract:address(s.contract,'readback.contract'),caller:address(s.caller,'readback.caller'),sequence:sequence(s.sequence,'readback.sequence'),observedAt:timestamp(s.observedAt,'readback.observedAt')};}
  let previous='';
  for(const stage of [result.submitted,result.inclusion,result.execution,result.finality,result.readback])if(stage){if(stage.observedAt<previous)invalid('stage timestamp regression');previous=stage.observedAt;}
  return result;
}
export function parseExecutionEvidence(text:string):ExecutionEvidence {
  if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>MAX_BYTES)invalid('input exceeds 1 MiB');
  let value:unknown;
  try {value=JSON.parse(text);}catch{throw new Error('Invalid execution evidence JSON');}
  return validate(value);
}
const equalHash=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
const equalBlock=(a:BlockRef,b:BlockRef)=>equalHash(a.hash,b.hash)&&a.number===b.number&&equalHash(a.parentHash,b.parentHash);
const equalAddress=(a:string,b:string)=>/^0x[\da-fA-F]{40}$/.test(a)&&/^0x[\da-fA-F]{40}$/.test(b)?a.toLowerCase()===b.toLowerCase():a===b;
function check(present:boolean,defect:string|null,prerequisites:MonitorCheck[],success:string):MonitorCheck {
  if(!present)return {state:'unverified',reason:'Stage evidence absent; no inference from later stages'};
  if(defect)return {state:'abnormal',reason:defect};
  if(prerequisites.some(c=>c.state!=='normal'))return {state:'unverified',reason:'Prerequisite evidence has not passed'};
  return {state:'normal',reason:success};
}
function ancestryDefect(e:ExecutionEvidence):string|null {
  const f=e.finality!;
  if([e.network.expectedGenesis,e.network.observedGenesis].some(h=>h!==null&&!equalHash(f.genesisHash,h)))return 'Finality genesis mismatch';
  const path=f.ancestry;
  if(path.length===0)return 'Finality ancestry path absent';
  if(!equalBlock(path[0]!,f.finalized))return 'Ancestry must begin with exact finalized block';
  if(e.inclusion&&!equalBlock(path.at(-1)!,e.inclusion.block))return 'Ancestry must end with exact inclusion block';
  const seen=new Set<string>();
  for(let i=0;i<path.length;i++){
    const current=path[i]!,key=current.hash.toLowerCase();
    if(seen.has(key))return 'Duplicate block hash or cycle in ancestry';
    seen.add(key);
    if(seen.has(current.parentHash.toLowerCase()))return 'Cycle through ancestry parent hash';
    const next=path[i+1];
    if(next&&(!equalHash(current.parentHash,next.hash)||BigInt(current.number)!==BigInt(next.number)+1n))return 'Broken ancestry parent link or height step';
  }
  return null;
}
export function evaluateExecutionEvidence(value:unknown):ExecutionSummary {
  // Validate and detach first; no caller-owned objects are used by a past result.
  const e=validate(value),n=e.network,s=e.submitted,i=e.inclusion,x=e.execution,f=e.finality,r=e.readback;
  const network:MonitorCheck=n.kind!=='event-testnet'||[n.expectedGenesis,n.observedGenesis].some(h=>h!==null&&equalHash(h,KNOWN_MAINNET))?{state:'abnormal',reason:'Execution requires event-testnet; known historical mainnet identity is blocked'}:n.expectedGenesis===null||n.observedGenesis===null?{state:'unverified',reason:'Expected or observed genesis absent'}:!equalHash(n.expectedGenesis,n.observedGenesis)?{state:'abnormal',reason:'Observed genesis does not match expected genesis'}:{state:'normal',reason:'Offline configured event-testnet genesis match; no current network verification'};
  const submission=check(s!==null,null,[network],'Submission hash recorded');
  const inclusionMismatch=i!==null&&(!equalHash(i.transactionHash,i.transactions[i.transactionIndex]!)||
    s!==null&&(!equalHash(i.transactionHash,s.transactionHash)||!equalHash(i.transactions[i.transactionIndex]!,s.transactionHash)));
  const inclusion=check(i!==null,inclusionMismatch?'Inclusion transaction or indexed transaction list mismatch':null,[network,submission],'Submitted hash matches inclusion and indexed transaction');
  const execution=check(x!==null,x?.outcome==='failure'?'Execution failure: '+x.failureReason:x&&(s&&!equalHash(x.transactionHash,s.transactionHash)||i&&(!equalHash(x.transactionHash,i.transactionHash)||!equalHash(x.blockHash,i.block.hash)||x.transactionIndex!==i.transactionIndex))?'Execution transaction, block or index mismatch':null,[network,submission,inclusion],'Successful execution correlated to exact inclusion');
  const finality=check(f!==null,f?ancestryDefect(e):null,[network,submission,inclusion,execution],'Linked ancestry from finalized block to exact inclusion');
  const state=check(r!==null,r&&([n.expectedGenesis,n.observedGenesis,f?.genesisHash??null].some(h=>h!==null&&!equalHash(r.genesisHash,h))||f&&!equalHash(r.blockHash,f.finalized.hash)||!equalAddress(r.contract,e.intent.contract)||!equalAddress(r.caller,e.intent.caller)||r.sequence!==e.intent.expectedSequence)?'Readback genesis, finalized block, contract, caller or sequence mismatch':null,[network,submission,inclusion,execution,finality],'Finalized readback context and uint64 sequence match');
  const checks={network,submission,inclusion,execution,finality,state},all=Object.values(checks);
  const evidenceComplete=all.every(c=>c.state==='normal');
  return {mode:'offline',origin:e.origin,verifiedNetwork:false,writeAllowed:false,fullVerification:false,evidenceComplete,status:all.some(c=>c.state==='abnormal')?'abnormal':evidenceComplete?'normal':'unverified',trust:e.origin==='simulated'?'Offline simulated facts only; no Portaldot observations or consensus proof':'Offline RPC-supplied facts; source authenticity, current network and independent consensus are not verified',checks,expectedSequence:e.intent.expectedSequence,observedSequence:r?.sequence??null};
}
