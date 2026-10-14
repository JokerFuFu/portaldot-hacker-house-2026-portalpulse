import {RpcError} from './rpc.js';
import type {ReadOnlyRpc,NetworkConfig,Sample,EvidenceOrigin,RpcRecord,RuntimeInfo,BlockRef} from './types.js';

const KNOWN_METADATA_VERSIONS=new Set([13,14,15,16]);
function invalid(message:string):never {throw new RpcError('validation',message);}
function object(value:unknown):Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value))invalid('Expected object');
  return value as Record<string,unknown>;
}
function boundedString(value:unknown,max=256):string {
  if(typeof value!=='string'||!value.length||value.length>max)invalid('Invalid or oversized string');
  return value;
}
function hash(value:unknown):string {
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(value))invalid('Invalid block hash');
  return value.toLowerCase();
}
function runtimeInfo(value:unknown):RuntimeInfo {
  const data=object(value);
  const specName=boundedString(data.specName,128);
  for(const key of ['specVersion','transactionVersion'])if(!Number.isSafeInteger(data[key])||(data[key] as number)<0)invalid('Invalid runtime version');
  return {specName,specVersion:data.specVersion as number,transactionVersion:data.transactionVersion as number,metadataVersion:null};
}
function header(value:unknown,pinnedHash:string):BlockRef {
  const data=object(value);
  if(typeof data.number!=='string'||!/^0x[0-9a-fA-F]+$/.test(data.number)||data.number.length>258)invalid('Invalid header number');
  hash(data.stateRoot);hash(data.extrinsicsRoot);
  const digest=object(data.digest);if(!Array.isArray(digest.logs)||digest.logs.length>256||!digest.logs.every(log=>typeof log==='string'&&/^0x(?:[0-9a-fA-F]{2})*$/.test(log)&&log.length<=4098))invalid('Invalid header digest');
  return {hash:pinnedHash,number:BigInt(data.number).toString(10),parentHash:hash(data.parentHash)};
}
function safeText(value:string,max=256):string {
  return value.replace(/(?:https?|wss?):\/\/[^\s"'<>]+/gi,'[endpoint]').slice(0,max);
}
// Evidence is intentionally small and never contains an unbounded node object.
function summarize(value:unknown,depth=0):unknown {
  if(typeof value==='string')return safeText(value);
  if(value===null||typeof value==='boolean'||typeof value==='number')return value;
  if(depth>=2)return '[summarized]';
  if(Array.isArray(value))return value.slice(0,8).map(item=>summarize(item,depth+1));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,16).map(([key,item])=>[safeText(key,128),summarize(item,depth+1)]));
  return '[unavailable]';
}
function evidence(method:string,value:unknown):unknown {
  if(method==='state_getMetadata'){
    const hex=typeof value==='string'?value:'';
    return {prefix:hex.slice(0,10),byteCount:/^0x(?:[0-9a-fA-F]{2})*$/.test(hex)?(hex.length-2)/2:null,version:/^0x[0-9a-fA-F]{10}/.test(hex)?parseInt(hex.slice(10,12),16):null};
  }
  if(method==='rpc_methods')return {methodCount:value&&typeof value==='object'&&Array.isArray((value as Record<string,unknown>).methods)?((value as Record<string,unknown>).methods as unknown[]).length:null};
  return summarize(value);
}

export async function collectSample(rpc:ReadOnlyRpc,config:NetworkConfig,options:{origin?:EvidenceOrigin;signal?:AbortSignal}={}):Promise<Sample> {
  const records:RpcRecord[]=[];
  async function read<T>(method:string,params:unknown[],validate:(value:unknown)=>T):Promise<T|null>{
    const record:RpcRecord={method,params,startedAt:new Date().toISOString(),durationMs:0,status:'abnormal'};
    records.push(record);const started=performance.now();
    try{const value=await rpc.request(method,params,options.signal);record.result=evidence(method,value);const result=validate(value);record.status='normal';return result;}
    catch(error){record.error={code:error instanceof RpcError?safeText(error.code,64):'rpc',message:safeText(error instanceof Error?error.message:'Request failed',512)};return null;}
    finally{record.durationMs=Math.max(0,performance.now()-started);}
  }
  const chainName=await read('system_chain',[],boundedString);
  const genesisHash=await read('chain_getBlockHash',[0],hash);
  const runtime=await read('state_getRuntimeVersion',[],runtimeInfo);
  let metadataVersion:number|null=null;
  // This verifies only magic, hex format and a recognized header version, not SCALE schema or capabilities.
  const metadata=await read('state_getMetadata',[],value=>{
    if(typeof value!=='string'||!/^0x(?:[0-9a-fA-F]{2}){5,}$/.test(value)||value.slice(0,10).toLowerCase()!=='0x6d657461')invalid('Invalid metadata hex or magic');
    metadataVersion=parseInt(value.slice(10,12),16);
    if(!KNOWN_METADATA_VERSIONS.has(metadataVersion))throw new RpcError('unsupported','Unsupported version for metadata header check');
    return true;
  });
  if(runtime)runtime.metadataVersion=metadataVersion;
  const declaredMethods=await read('rpc_methods',[],value=>{
    const data=object(value);if(!Array.isArray(data.methods)||data.methods.length>256)invalid('Invalid or oversized method list');
    return data.methods.map(method=>boundedString(method,128));
  });
  const bestHash=await read('chain_getBlockHash',[],hash);
  const best=bestHash?await read('chain_getHeader',[bestHash],value=>header(value,bestHash)):null;
  const finalizedHash=await read('chain_getFinalizedHead',[],hash);
  const finalized=finalizedHash?await read('chain_getHeader',[finalizedHash],value=>header(value,finalizedHash)):null;
  let expectedGenesis:string|null=null;
  let expectedInvalid=false;
  if(config.expectedGenesis!==null){try{expectedGenesis=hash(config.expectedGenesis);}catch{expectedInvalid=true;}}
  const mismatch=expectedGenesis!==null&&genesisHash!==null&&expectedGenesis!==genesisHash;
  const complete=chainName!==null&&genesisHash!==null&&runtime!==null&&metadata===true&&declaredMethods!==null;
  const state=mismatch?'abnormal':!expectedInvalid&&expectedGenesis!==null&&complete?'normal':'unverified';
  let reason=mismatch?'Genesis does not match configured identity':expectedInvalid?'Invalid configured genesis':expectedGenesis===null?'No expected genesis configured':complete?'Configured genesis matched; readonly identity header checks passed':'Incomplete identity evidence';
  if(records.some(record=>record.error?.code==='unsupported'))reason+='; unsupported metadata version for header check';
  return {observedAt:new Date().toISOString(),endpointAlias:safeText(config.endpointAlias,128),configId:safeText(config.id,128),origin:options.origin??'rpc',identity:{state,expectedGenesis,genesisHash,chainName,runtime,declaredMethods:declaredMethods??[],metadataVerified:metadata===true,reason,writeAllowed:false},best,finalized,rpc:records};
}
