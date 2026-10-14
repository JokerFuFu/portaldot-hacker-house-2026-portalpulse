import type {NetworkConfig,Sample,RpcRecord} from '../core/index.js';

// These fixed dates and conspicuous hashes are simulated product data.
const artificialHash=(n:number):string=>'0x'+'deadbeef'.repeat(7)+n.toString(16).padStart(8,'0');
export function makeDemoSession():{config:NetworkConfig;samples:Sample[]} {
  const genesis=artificialHash(0);
  const config:NetworkConfig={id:'simulated-demo',name:'Simulated PortalPulse demo',source:'Artificial local demo data; not a network source',endpoint:null,endpointAlias:'simulated-fixture',kind:'custom-readonly',expectedGenesis:genesis};
  const base=Date.parse('2026-10-14T00:00:00.000Z');
  const samples:Sample[]=Array.from({length:6},(_,index)=>{
    const observed=base+index*10000+100;
    const best={hash:artificialHash(100+index),number:String(100+index),parentHash:artificialHash(99+index)};
    const finalized={hash:artificialHash(99+index),number:String(99+index),parentHash:artificialHash(98+index)};
    const runtime={specName:'simulated-fixture',specVersion:1,transactionVersion:1,metadataVersion:15};
    const reads:[string,unknown[],unknown][]=[['system_chain',[],'Simulated fixture'],['chain_getBlockHash',[0],genesis],['state_getRuntimeVersion',[],runtime],['state_getMetadata',[],{prefix:'0x6d657461',byteCount:6,version:15}],['rpc_methods',[],{methodCount:6}],['chain_getBlockHash',[],best.hash],['chain_getHeader',[best.hash],best],['chain_getFinalizedHead',[],finalized.hash],['chain_getHeader',[finalized.hash],finalized]];
    const rpc:RpcRecord[]=reads.map(([method,params,result],n)=>({method,params,result,startedAt:new Date(observed-20+n*2).toISOString(),durationMs:1,status:'normal'}));
    return {observedAt:new Date(observed).toISOString(),configId:config.id,endpointAlias:config.endpointAlias,origin:'simulated',identity:{state:'normal',expectedGenesis:genesis,genesisHash:genesis,chainName:'Simulated fixture',runtime,declaredMethods:['system_chain','chain_getBlockHash','chain_getHeader','chain_getFinalizedHead','state_getMetadata','state_getRuntimeVersion'],metadataVerified:true,reason:'Simulated configured identity match; no network verification',writeAllowed:false},best,finalized,rpc};
  });
  return {config,samples};
}
