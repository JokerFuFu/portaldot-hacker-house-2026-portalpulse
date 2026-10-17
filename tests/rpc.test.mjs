import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {WebSocketServer} from 'ws';
import {createRpc} from '../dist/core/rpc.js';

const hash='0x'+'11'.repeat(32);
async function fixture(t,kind,reply,{delayConnect=false}={}) {
  const calls=[];
  const server=createServer(async(req,res)=>{
    if(kind==='ws')return;
    let body='';for await(const part of req)body+=part;
    const request=JSON.parse(body);calls.push(request);
    reply(request,value=>{res.end(typeof value==='string'?value:JSON.stringify(value));},()=>res.destroy());
  });
  const sockets=new Set();server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
  const wss=kind==='ws'?new WebSocketServer({noServer:true}):null;
  if(wss){server.on('upgrade',(req,socket,head)=>{if(delayConnect)return;wss.handleUpgrade(req,socket,head,ws=>{wss.emit('connection',ws,req);});});wss.on('connection',ws=>ws.on('message',data=>{const request=JSON.parse(data.toString());calls.push(request);reply(request,value=>ws.send(typeof value==='string'?value:JSON.stringify(value)),()=>ws.close());}));}
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const endpoint=`${kind==='ws'?'ws':'http'}://127.0.0.1:${server.address().port}`;
  const clients=[];
  t.after(async()=>{for(const client of clients)client.close();for(const ws of wss?.clients??[])ws.terminate();server.closeAllConnections();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));});
  return {calls,client:(options)=>{const client=createRpc(endpoint,options);clients.push(client);return client;}};
}
for(const kind of ['http','ws']){
  test(`${kind}: forbidden mutation never reaches server; readonly request correlates`,async t=>{
    const {calls,client}=await fixture(t,kind,(q,send)=>send({jsonrpc:'2.0',id:q.id,result:hash}));
    const rpc=client();
    await assert.rejects(rpc.request('author_submitExtrinsic',['0x00']),/readonly|forbidden/i);
    await assert.rejects(rpc.request('system_unknown'),/readonly|forbidden/i);
    assert.equal(calls.length,0);
    assert.equal(await rpc.request('chain_getBlockHash',[0]),hash);
    assert.deepEqual(calls[0].params,[0]);assert.equal(calls[0].jsonrpc,'2.0');
  });
  test(`${kind}: concurrent out-of-order responses have unique IDs`,async t=>{
    const {calls,client}=await fixture(t,kind,(q,send)=>setTimeout(()=>send({jsonrpc:'2.0',id:q.id,result:q.params[0]}),q.params[0]===1?20:0));
    const rpc=client();assert.deepEqual(await Promise.all([rpc.request('chain_getBlockHash',[1]),rpc.request('chain_getBlockHash',[2])]),[1,2]);
    assert.notEqual(calls[0].id,calls[1].id);
  });
  test(`${kind}: accepts V14-sized metadata hex above 1 MiB without truncation`,async t=>{
    // Synthetic transport data with the V14 prefix and observed decoded byte size;
    // this checks JSON-RPC transport, not SCALE metadata decoding.
    const metadata='0x6d6574610e'+'00'.repeat(561911);
    assert.equal(Buffer.byteLength(metadata,'utf8'),1123834);
    const {calls,client}=await fixture(t,kind,(q,send)=>send({jsonrpc:'2.0',id:q.id,result:metadata}));
    assert.equal(await client().request('state_getMetadata'),metadata);
    assert.equal(calls[0].method,'state_getMetadata');
  });
  for(const [method,bytes,accepted] of [
    ['state_getMetadata',2097152,true],
    ['state_getMetadata',2097153,false],
    ['system_chain',1048576,true],
    ['system_chain',1048577,false],
  ])test(`${kind}: ${method} full UTF-8 envelope at ${bytes} bytes is ${accepted?'accepted':'rejected'}`,async t=>{
    const result='链🔒';
    const {client}=await fixture(t,kind,(q,send)=>{
      const envelope=JSON.stringify({jsonrpc:'2.0',id:q.id,result});
      const response=envelope+' '.repeat(bytes-Buffer.byteLength(envelope,'utf8'));
      assert.equal(Buffer.byteLength(response,'utf8'),bytes);
      assert.ok(response.length<bytes);
      send(response);
    });
    const request=client().request(method);
    if(accepted)assert.equal(await request,result);
    else await assert.rejects(request,{name:'RpcError',code:'size'});
  });
  for(const [label,response,pattern] of [
    ['RPC error',q=>({jsonrpc:'2.0',id:q.id,error:{code:-32601,message:'No method'}}),/No method/],
    ['malformed JSON',()=>'{broken',/json|malformed/i],
    ['wrong ID',q=>({jsonrpc:'2.0',id:q.id+1,result:true}),/id|correlat/i],
    ['invalid version',q=>({jsonrpc:'1.0',id:q.id,result:true}),/json|version|malformed/i],
    ['both result and error',q=>({jsonrpc:'2.0',id:q.id,result:true,error:{code:1,message:'bad'}}),/result|malformed/i],
    ['neither result nor error',q=>({jsonrpc:'2.0',id:q.id}),/result|malformed/i],
    ['invalid error object',q=>({jsonrpc:'2.0',id:q.id,error:'bad'}),/Malformed response error/i],
    ['oversized response',q=>({jsonrpc:'2.0',id:q.id,result:'x'.repeat(1048576)}),/size|large|limit/i],
  ]) test(`${kind}: rejects ${label}`,async t=>{const {client}=await fixture(t,kind,(q,send)=>send(response(q)));await assert.rejects(client().request('system_chain'),pattern);});
  test(`${kind}: request expires at 30ms without response`,async t=>{const {client}=await fixture(t,kind,()=>{});const started=performance.now();await assert.rejects(client({timeoutMs:30}).request('system_chain'),/timeout|deadline/i);assert.ok(performance.now()-started<1000);});
  test(`${kind}: server closing rejects pending request`,async t=>{const {client}=await fixture(t,kind,(_q,_send,close)=>close());await assert.rejects(client().request('system_chain'),/closed|network|fetch/i);});
  test(`${kind}: abort and explicit close settle pending requests`,async t=>{const {client}=await fixture(t,kind,()=>{});const rpc=client();const controller=new AbortController();const pending=rpc.request('system_chain',[],controller.signal);controller.abort();await assert.rejects(pending,/abort/i);const next=rpc.request('system_chain');rpc.close();await assert.rejects(next,/closed/i);await assert.rejects(rpc.request('system_chain'),/closed/i);});
  test(`${kind}: already-aborted request emits nothing`,async t=>{const {calls,client}=await fixture(t,kind,()=>{});const controller=new AbortController();controller.abort();await assert.rejects(client().request('system_chain',[],controller.signal),/abort/i);assert.equal(calls.length,0);});
}
test('WebSocket connect is included in deadline',async t=>{const {client}=await fixture(t,'ws',()=>{},{delayConnect:true});await assert.rejects(client({timeoutMs:30}).request('system_chain'),/timeout|deadline/i);});
test('rejects credential-bearing or unsupported endpoints and invalid deadlines',()=>{
  for(const endpoint of ['ftp://localhost','http://user:secret@localhost','http://localhost?token=secret','ws://localhost#secret'])assert.throws(()=>createRpc(endpoint),/endpoint|credential|protocol/i);
  for(const timeoutMs of [0,-1,Infinity,NaN])assert.throws(()=>createRpc('http://localhost',{timeoutMs}),/timeout/i);
});
for(const kind of ['http','ws']){
  test(`${kind}: abort after server observes request allows fresh later request`,async t=>{
    let observed;const sawRequest=new Promise(resolve=>{observed=resolve;});
    const {client,calls}=await fixture(t,kind,(q,send)=>{if(q.params[0]==='waiting')observed();else send({jsonrpc:'2.0',id:q.id,result:'fresh'});});
    const rpc=client(),controller=new AbortController();const first=rpc.request('system_chain',['waiting'],controller.signal);await sawRequest;controller.abort();await assert.rejects(first,/abort/i);assert.equal(await rpc.request('system_chain'), 'fresh');assert.equal(calls.length,2);
  });
  test(`${kind}: close rejects every in-flight request`,async t=>{
    let observed;const sawTwo=new Promise(resolve=>{observed=resolve;});let seen=0;
    const {client}=await fixture(t,kind,()=>{if(++seen===2)observed();});const rpc=client();
    const first=rpc.request('system_chain'),second=rpc.request('chain_getFinalizedHead');await sawTwo;
    const assertions=[assert.rejects(first,/closed/i),assert.rejects(second,/closed/i)];rpc.close();await Promise.all(assertions);
  });
}
test('expired WebSocket deadline never opens or emits a late request',async t=>{const{client,calls}=await fixture(t,'ws',(q,send)=>send({jsonrpc:'2.0',id:q.id,result:true}));await assert.rejects(client({timeoutMs:0.000001}).request('system_chain'),/timeout|deadline/i);await new Promise(resolve=>setTimeout(resolve,30));assert.equal(calls.length,0);});
