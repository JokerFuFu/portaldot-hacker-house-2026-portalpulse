import {normalizeEndpoint} from './config.js';
import type {ReadOnlyRpc} from './types.js';

const READONLY_METHODS = new Set([
  'system_chain', 'system_properties', 'state_getRuntimeVersion', 'state_getMetadata',
  'rpc_methods', 'chain_getBlockHash', 'chain_getHeader', 'chain_getFinalizedHead',
]);
const RESPONSE_LIMIT = 1024 * 1024;
const METADATA_RESPONSE_LIMIT = 2 * 1024 * 1024;
let nextId = 0;

export class RpcError extends Error {
  constructor(public readonly code:string, message:string) {super(message);this.name='RpcError';}
}

function parseResponse(text:string,id:number):unknown {
  let data:unknown;
  try {data=JSON.parse(text);} catch {throw new RpcError('malformed','Malformed JSON response');}
  if (!data || typeof data!=='object' || Array.isArray(data)) throw new RpcError('malformed','Malformed JSON-RPC response');
  const response=data as Record<string,unknown>;
  if(response.jsonrpc!=='2.0')throw new RpcError('malformed','Malformed JSON-RPC version');
  if(response.id!==id)throw new RpcError('correlation','Response ID did not correlate');
  const result=Object.hasOwn(response,'result');
  const error=Object.hasOwn(response,'error');
  if(result===error)throw new RpcError('malformed','Response must have exactly one result or error');
  if(error){
    const value=response.error;
    if(!value || typeof value!=='object' || Array.isArray(value))throw new RpcError('malformed','Malformed response error');
    const rpcError=value as Record<string,unknown>;
    if(!Number.isSafeInteger(rpcError.code)||typeof rpcError.message!=='string')throw new RpcError('malformed','Malformed response error');
    throw new RpcError(String(rpcError.code),rpcError.message.slice(0,512));
  }
  return response.result;
}

export function createRpc(endpoint:string,options:{timeoutMs?:number}={}):ReadOnlyRpc {
  let url: URL;
  try {
    url = normalizeEndpoint(endpoint);
  } catch (error) {
    throw new RpcError('endpoint', error instanceof Error ? error.message : 'Invalid endpoint');
  }
  const timeoutMs=options.timeoutMs??8000;
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new RpcError('timeout','Timeout must be positive and finite');
  const pending=new Set<(error:RpcError)=>void>();
  let closed=false;
  return {
    async request(method,params=[],signal){
      if(!READONLY_METHODS.has(method))throw new RpcError('forbidden','Readonly method required');
      const responseLimit=method==='state_getMetadata'?METADATA_RESPONSE_LIMIT:RESPONSE_LIMIT;
      if(closed)throw new RpcError('closed','RPC client closed');
      if(signal?.aborted)throw new RpcError('aborted','Request aborted');
      const id=++nextId;
      const started=performance.now();
      return new Promise<unknown>((resolve,reject)=>{
        let settled=false;
        let timer:ReturnType<typeof setTimeout>;
        let socket:WebSocket|undefined;
        const controller=new AbortController();
        const finish=(error?:RpcError,result?:unknown)=>{
          if(settled)return;
          settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);pending.delete(cancel);
          controller.abort();
          if(socket){socket.removeEventListener('open',open);socket.removeEventListener('message',message);socket.removeEventListener('error',failure);socket.removeEventListener('close',disconnected);socket.close();}
          if(error)reject(error);else resolve(result);
        };
        const cancel=(error:RpcError)=>finish(error);
        const abort=()=>finish(new RpcError('aborted','Request aborted'));
        const failure=()=>finish(new RpcError('network','Network request failed'));
        const disconnected=()=>finish(new RpcError('closed','WebSocket closed before response'));
        const open=()=>{try{socket!.send(JSON.stringify({jsonrpc:'2.0',id,method,params}));}catch{failure();}};
        const message=(event:MessageEvent)=>{
          if(typeof event.data!=='string'){finish(new RpcError('malformed','Malformed non-text JSON response'));return;}
          if(new TextEncoder().encode(event.data).byteLength>responseLimit){finish(new RpcError('size','Response exceeds size limit'));return;}
          try{finish(undefined,parseResponse(event.data,id));}catch(error){finish(error as RpcError);}
        };
        const deadline=()=>{
          const remaining=timeoutMs-(performance.now()-started);
          if(remaining<=0)finish(new RpcError('timeout','Request deadline timeout'));
          else timer=setTimeout(deadline,Math.min(remaining,2147483647));
        };
        pending.add(cancel);signal?.addEventListener('abort',abort,{once:true});deadline();
        if(settled)return;
        if(url.protocol==='ws:'||url.protocol==='wss:'){
          try{socket=new WebSocket(url);socket.addEventListener('open',open);socket.addEventListener('message',message);socket.addEventListener('error',failure);socket.addEventListener('close',disconnected);}catch{failure();}
        }else{
          void (async()=>{
            let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
            try{
              const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal:controller.signal,redirect:'error'});
              if(!response.ok)throw new RpcError('http',`HTTP response status ${response.status}`);
              if(!response.body)throw new RpcError('malformed','Empty response body');
              reader=response.body.getReader();
              const chunks:Uint8Array[]=[];let size=0;
              while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>responseLimit)throw new RpcError('size','Response exceeds size limit');chunks.push(chunk.value);}
              const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
              finish(undefined,parseResponse(new TextDecoder('utf-8',{fatal:true}).decode(bytes),id));
            }catch(error){finish(error instanceof RpcError?error:new RpcError('network','Network request failed'));}
            finally{if(reader){try{await reader.cancel();}catch{}reader.releaseLock();}}
          })();
        }
      });
    },
    close(){closed=true;for(const cancel of [...pending])cancel(new RpcError('closed','RPC client closed'));},
  };
}
