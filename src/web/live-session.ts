import type {NetworkConfig,Sample,SessionReport,ReadOnlyRpc} from '../core/types.js';
import {createRpc} from '../core/rpc.js';
import {collectSample} from '../core/snapshot.js';
import {retainSamples} from '../core/monitor.js';
import {createReport} from '../core/report.js';
// One owner for transport, timer and generation: stopped/replaced sessions cannot publish.
export function createLiveSession(){
 let generation=0,controller:AbortController|null=null,rpc:ReadOnlyRpc|null=null,timer:ReturnType<typeof setTimeout>|null=null;
 function stop(){generation++;controller?.abort();controller=null;rpc?.close();rpc=null;if(timer!==null)clearTimeout(timer);timer=null;}
 return {get active(){return controller!==null;},stop,
  start(config:NetworkConfig,onReport:(report:SessionReport)=>void,onError:(message:string)=>void){
   stop();if(!config.endpoint)throw new Error('请填写只读端点');
   const connection=createRpc(config.endpoint),abort=new AbortController(),current=generation;
   rpc=connection;controller=abort;const fixed={...config};let samples:Sample[]=[],dropped=0;
   const valid=()=>generation===current&&!abort.signal.aborted;
   async function collect(){
    try{
     const sample=await collectSample(connection,fixed,{signal:abort.signal});if(!valid())return;
     const retained=retainSamples([...samples,sample]);samples=retained.samples;dropped+=retained.dropped;
     const report=await createReport(fixed,samples,{origin:'rpc',intervalMs:10000,droppedSamples:dropped});
     if(valid())onReport(report);
    }catch(error){if(valid())onError(error instanceof Error?error.message:'采集失败');}
    if(valid())timer=setTimeout(()=>{void collect();},10000);
   }
   void collect();
  }
 };
}
