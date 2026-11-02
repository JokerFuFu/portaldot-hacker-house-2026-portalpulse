import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {blake2AsHex} from '@polkadot/util-crypto';
import {nativeFixture,genesis,parent,eventsKey} from './helpers/native-fixture.mjs';
import {createRpc} from '../dist/core/rpc.js';
const module=await import('../scripts/native-observation.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
function collector(){assert.equal(typeof module.collectNativeObservation,'function','native collector feature must exist');return module.collectNativeObservation;}
const h='0x'+'aa'.repeat(32);
async function observe(f){return collector()(f.rpc,f.config,{blockHash:f.blockHash,transactionHash:f.transactionHash});}
test('native observation correlates raw hash to index1 and only its success event',async()=>{
  const f=nativeFixture();const result=await observe(f);
  assert.equal(result.status,'normal');assert.equal(result.inclusion.transactionIndex,1);assert.equal(result.inclusion.transactionHash,f.transactionHash);
  assert.equal(result.dispatch.outcome,'success');assert.equal(result.dispatch.systemEvent,'ExtrinsicSuccess');
  assert.equal(result.block.number,'10');assert.equal(result.metadata.atBlockHash,parent);
  for(const flag of ['verifiedNetwork','writeAllowed','fullVerification','finalityVerified','contractStateVerified','signerVerified'])assert.equal(result[flag],false);
  assert.equal(result.origin,'rpc');assert.equal(result.mode,'readonly-native-observation');
  const serialized=JSON.stringify(result);
  assert.ok(!serialized.includes(f.config.endpoint));assert.ok(!serialized.includes(f.metadataHex));assert.ok(!serialized.includes(f.extrinsics[1]));
  assert.deepEqual(f.calls.find(c=>c.method==='state_getMetadata').params,[parent]);
  assert.deepEqual(f.calls.find(c=>c.method==='state_getRuntimeVersion').params,[parent]);
  assert.deepEqual(f.calls.find(c=>c.method==='state_getStorage').params,[eventsKey,f.blockHash]);
});
for(const [name,change] of [
  ['missing expected genesis',f=>{f.config.expectedGenesis=null;}],
  ['custom profile',f=>{f.config.kind='custom-readonly';}],
  ['historical mainnet relabelled as event',f=>{f.config.expectedGenesis='0x83b5212c69f85f3996f8696bb35bf913af51b176a5f53d0a74fd3a83dc0b8a54';}],
  ['unconfigured endpoint',f=>{f.config.endpoint=null;}],
])test(name+' refuses before any RPC',async()=>{
  const f=nativeFixture();change(f);await assert.rejects(observe(f));assert.equal(f.calls.length,0);
});
test('observed wrong genesis refuses before transaction RPCs',async()=>{
  const f=nativeFixture();f.replies.chain_getBlockHash=()=>h;
  const r=await observe(f);assert.equal(r.status,'abnormal');assert.equal(r.error.code,'identity');
  assert.deepEqual(f.calls.map(c=>c.method),['chain_getBlockHash']);
});
test('header hash mismatch fails before metadata or storage',async()=>{
  const f=nativeFixture();f.replies.chain_getBlock=()=>({block:{header:{...f.header,number:'0x0b'},extrinsics:f.extrinsics}});
  const r=await observe(f);assert.equal(r.status,'abnormal');assert.equal(r.error.code,'block');
  assert.ok(!f.calls.some(c=>c.method==='state_getStorage'));
});
test('foreign index success does not verify the requested transaction',async()=>{
  const f=nativeFixture({outcomes:[{index:0,success:true}]});const r=await observe(f);
  assert.equal(r.status,'unverified');assert.equal(r.dispatch,null);assert.equal(r.inclusion.transactionIndex,1);
});
test('a target failure is retained even when another index succeeds',async()=>{
  const f=nativeFixture({outcomes:[{index:0,success:true},{index:1,success:false}]});const r=await observe(f);
  assert.equal(r.status,'abnormal');assert.equal(r.dispatch.outcome,'failure');assert.match(r.dispatch.failureReason,/BadOrigin/i);
});
for(const outcomes of [[{index:1,success:true},{index:1,success:false}],[{index:1,success:true},{index:1,success:true}]]){
  test('conflicting or duplicated target outcomes cannot pass',async()=>{
    const r=await observe(nativeFixture({outcomes}));assert.equal(r.status,'abnormal');assert.equal(r.error.code,'events');
  });
}
for(const phase of ['Finalization','Initialization'])test(phase+' phase never supplies target execution',async()=>{
  const r=await observe(nativeFixture({outcomes:[{index:1,success:true,phase}]}));assert.equal(r.status,'unverified');assert.equal(r.dispatch,null);
});
test('missing target is unverified without attempting event storage',async()=>{
  const f=nativeFixture();const r=await collector()(f.rpc,f.config,{blockHash:f.blockHash,transactionHash:h});
  assert.equal(r.status,'unverified');assert.equal(r.inclusion,null);assert.ok(!f.calls.some(c=>c.method==='state_getStorage'));
});
test('duplicate raw transaction matches are ambiguous and abnormal',async()=>{
  const f=nativeFixture({extrinsics:['0x1004000001','0x1004000001']});const r=await observe(f);
  assert.equal(r.status,'abnormal');assert.equal(r.error.code,'block');
});
for(const method of ['chain_getBlock','state_getStorage'])test('null '+method+' remains unverified',async()=>{
  const f=nativeFixture();f.replies[method]=()=>null;
  const r=await observe(f);assert.equal(r.status,'unverified');assert.equal(r.dispatch,null);
});
for(const [label,method,result] of [
  ['trailing metadata','state_getMetadata',f=>f.metadataHex+'00'],
  ['trailing event bytes','state_getStorage',f=>f.eventHex+'00'],
  ['invalid event encoding','state_getStorage',()=> '0x04ff'],
  ['odd extrinsic hex','chain_getBlock',f=>({block:{header:f.header,extrinsics:['0x123',f.extrinsics[1]]}})],
  ['noncanonical extrinsic compact length','chain_getBlock',f=>({block:{header:f.header,extrinsics:['0x110004000000',f.extrinsics[1]]}})],
])test(label+' cannot pass',async()=>{
  const f=nativeFixture();f.replies[method]=()=>result(f);
  const r=await observe(f);assert.equal(r.status,'abnormal');assert.equal(r.dispatch,null);
});
test('a SCALE-valid event with an out-of-range phase index is rejected',async()=>{
  const r=await observe(nativeFixture({outcomes:[{index:999,success:true},{index:1,success:true}]}));
  assert.equal(r.status,'abnormal');assert.equal(r.error.code,'events');
});
test('RPC failure is retained without exposing endpoint text',async()=>{
  const f=nativeFixture();f.replies.chain_getBlock=()=>{throw new Error('failed '+f.config.endpoint);};
  const r=await observe(f);assert.equal(r.status,'abnormal');assert.ok(!JSON.stringify(r).includes(f.config.endpoint));assert.match(r.error.message,/\[endpoint\]/);
});
test('already aborted operation never reaches RPC',async()=>{
  const f=nativeFixture();const c=new AbortController();c.abort();
  const r=await collector()(f.rpc,f.config,{blockHash:f.blockHash,transactionHash:f.transactionHash,signal:c.signal});
  assert.equal(r.status,'abnormal');assert.equal(f.calls.length,0);
});
for(const opt of [{blockHash:'0x00',transactionHash:h},{blockHash:h,transactionHash:'bad'},{blockHash:h,transactionHash:h,extra:true}]){
  test('invalid input refuses before RPC '+JSON.stringify(opt),async()=>{
    const f=nativeFixture();await assert.rejects(collector()(f.rpc,f.config,opt));assert.equal(f.calls.length,0);
  });
}
test('native read methods use actual readonly transport and writes remain forbidden',async t=>{
  const server=createServer(async(req,res)=>{let body='';for await(const part of req)body+=part;const q=JSON.parse(body);res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result:q.method==='chain_getBlock'?null:'0x00'}));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();return new Promise(r=>server.close(r));});
  const rpc=createRpc('http://127.0.0.1:'+server.address().port);t.after(()=>rpc.close());
  assert.equal(await rpc.request('chain_getBlock',[h]),null);assert.equal(await rpc.request('state_getStorage',[eventsKey,h]),'0x00');
  await assert.rejects(rpc.request('author_submitExtrinsic',['0x00']),/readonly/i);
});

test('trailing bytes in a digest item cannot be silently normalized into a matching header',async()=>{
  const f=nativeFixture();
  const header={...f.header,digest:{logs:['0x08']}};
  f.blockHash=blake2AsHex(f.registry.createType('Header',header).toU8a(),256);
  f.replies.chain_getBlock=()=>({block:{header:{...header,digest:{logs:['0x0800']}},extrinsics:f.extrinsics}});
  const r=await observe(f);
  assert.equal(r.status,'abnormal');assert.equal(r.error.code,'block');
});

for(const [label,bad] of [
  ['unsupported version','0x0400'],
  ['truncated call','0x080400'],
  ['trailing call bytes','0x140400000000'],
])test('malformed target extrinsic '+label+' cannot acquire a successful dispatch',async()=>{
  const f=nativeFixture({extrinsics:['0x1004000000',bad]});
  const r=await observe(f);
  assert.equal(r.status,'abnormal');assert.equal(r.dispatch,null);assert.equal(r.error.code,'extrinsic');
});
test('RPC error crossing truncation boundary is redacted before saved observation',async t=>{
  const f=nativeFixture();f.config.endpoint='https://private.internal.example/secret-route';
  const previous=globalThis.fetch;
  globalThis.fetch=async(_url,options)=>{
    const request=JSON.parse(options.body);
    return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,error:{code:-32000,message:'x'.repeat(490)+f.config.endpoint}}));
  };
  t.after(()=>{globalThis.fetch=previous;});
  const client=createRpc(f.config.endpoint);t.after(()=>client.close());
  const r=await collector()(client,f.config,{blockHash:f.blockHash,transactionHash:f.transactionHash});
  assert.equal(r.status,'abnormal');
  assert.ok(!JSON.stringify(r).includes('private.intern'),'no partial configured hostname may survive');
});
