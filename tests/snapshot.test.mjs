import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {createRpc} from '../dist/core/rpc.js';
import {collectSample} from '../dist/core/snapshot.js';
const genesis='0x'+'11'.repeat(32),best='0x'+'22'.repeat(32),finalized='0x'+'33'.repeat(32),parent='0x'+'44'.repeat(32);
const config={id:'local-fixture',name:'Fixture',source:'Local test',endpoint:null,endpointAlias:'fixture',kind:'event-testnet',expectedGenesis:genesis};
const methods=['system_chain','system_properties','state_getRuntimeVersion','state_getMetadata','rpc_methods','chain_getBlockHash','chain_getHeader','chain_getFinalizedHead'];
function response(q){
  switch(q.method){
    case'system_chain':return 'Local fixture';
    case'system_properties':return {tokenSymbol:'TEST',tokenDecimals:12};
    case'state_getRuntimeVersion':return {specName:'fixture',specVersion:1,transactionVersion:2};
    case'state_getMetadata':return '0x6d6574610f0100';
    case'rpc_methods':return {methods};
    case'chain_getBlockHash':return q.params[0]===0?genesis:best;
    case'chain_getFinalizedHead':return finalized;
    case'chain_getHeader':return {number:q.params[0]===best?'0x20000000000001':'0x20000000000000',parentHash:parent,stateRoot:genesis,extrinsicsRoot:finalized,digest:{logs:[]}};
  }
}
async function fixture(t,override=()=>undefined){
  const calls=[];let failing=false;
  const server=createServer(async(req,res)=>{let body='';for await(const part of req)body+=part;const q=JSON.parse(body);calls.push(q);if(failing){res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,error:{code:-1,message:'fixture offline'}}));return;}
    const changed=override(q),result=changed===undefined?response(q):changed;
    res.end(JSON.stringify(result?.fixtureError?{jsonrpc:'2.0',id:q.id,error:{code:-1,message:result.fixtureError}}:{jsonrpc:'2.0',id:q.id,result}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const rpc=createRpc(`http://127.0.0.1:${server.address().port}`,{timeoutMs:1000});
  t.after(async()=>{rpc.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});return{rpc,calls,fail:()=>{failing=true;}};
}
test('collects explicit genesis and pinned heads without losing large height',async t=>{const {rpc,calls}=await fixture(t);const sample=await collectSample(rpc,config);
  assert.equal(sample.identity.genesisHash,genesis);assert.equal(sample.identity.state,'normal');assert.equal(sample.best.number,'9007199254740993');assert.equal(sample.finalized.number,'9007199254740992');assert.equal(sample.identity.writeAllowed,false);assert.equal(sample.identity.metadataVerified,true);assert.equal(sample.identity.runtime.metadataVersion,15);assert.equal(sample.origin,'rpc');
  assert.ok(calls.some(q=>q.method==='chain_getBlockHash'&&q.params[0]===0));assert.deepEqual(calls.filter(q=>q.method==='chain_getHeader').map(q=>q.params),[[best],[finalized]]);assert.equal(sample.rpc.length,9);
  const metadata=sample.rpc.find(q=>q.method==='state_getMetadata');assert.equal(metadata.result.byteCount,7);assert.equal(metadata.result.version,15);assert.equal(metadata.result.prefix,'0x6d657461');assert.equal(sample.rpc.find(q=>q.method==='rpc_methods').result.methodCount,8);assert.ok(sample.rpc.every(q=>q.durationMs>=0&&q.startedAt));
});
test('mismatched genesis is abnormal and writes remain disabled',async t=>{const{rpc}=await fixture(t);const sample=await collectSample(rpc,{...config,expectedGenesis:parent});assert.equal(sample.identity.state,'abnormal');assert.equal(sample.identity.writeAllowed,false);});
test('missing expected genesis stays unverified including event-testnet label',async t=>{const{rpc}=await fixture(t);const sample=await collectSample(rpc,{...config,expectedGenesis:null});assert.equal(sample.identity.state,'unverified');assert.equal(sample.identity.writeAllowed,false);});
for(const [name,method,value]of[
  ['missing metadata','state_getMetadata',null],['invalid metadata magic','state_getMetadata','0x000000000f'],['invalid metadata hex','state_getMetadata','0x6d6574610fZ0'],['missing runtime','state_getRuntimeVersion',null],['unsafe runtime version','state_getRuntimeVersion',{specName:'x',specVersion:9007199254740992,transactionVersion:1}],['missing chain name','system_chain',null],['malformed method list','rpc_methods',{methods:['system_chain',4]}],['genesis unavailable','chain_getBlockHash',{fixtureError:'genesis unavailable'}],
])test(`${name} cannot verify a matched identity`,async t=>{const{rpc}=await fixture(t,q=>q.method===method?value:undefined);const sample=await collectSample(rpc,config);assert.equal(sample.identity.state,'unverified');assert.ok(sample.rpc.some(q=>q.method===method&&q.status==='abnormal'));assert.equal(sample.identity.writeAllowed,false);});
test('advertised header capability does not turn actual header failure into success',async t=>{const{rpc}=await fixture(t,q=>q.method==='chain_getHeader'?{fixtureError:'header unavailable'}:undefined);const sample=await collectSample(rpc,config);assert.ok(sample.identity.declaredMethods.includes('chain_getHeader'));assert.equal(sample.best,null);assert.equal(sample.finalized,null);assert.ok(sample.rpc.filter(q=>q.method==='chain_getHeader').every(q=>q.status==='abnormal'));});
for(const [name,value]of[['invalid number',{number:'0xZZ'}],['missing state root',{stateRoot:null}],['invalid parent',{parentHash:'bad'}]])test(`header ${name} stays null with validation trace`,async t=>{const{rpc}=await fixture(t,q=>q.method==='chain_getHeader'?{...response(q),...value}:undefined);const sample=await collectSample(rpc,config);assert.equal(sample.best,null);assert.equal(sample.finalized,null);assert.ok(sample.rpc.filter(q=>q.method==='chain_getHeader').every(q=>q.error.code==='validation'));});
test('later endpoint failure never caches earlier successful fields',async t=>{const f=await fixture(t);assert.equal((await collectSample(f.rpc,config)).best.hash,best);f.fail();const sample=await collectSample(f.rpc,config);assert.equal(sample.best,null);assert.equal(sample.finalized,null);assert.equal(sample.identity.genesisHash,null);assert.equal(sample.identity.runtime,null);assert.equal(sample.identity.metadataVerified,false);assert.equal(sample.identity.state,'unverified');assert.ok(sample.rpc.every(q=>q.status==='abnormal'));});
test('node strings, methods and bulky evidence are bounded',async t=>{const{rpc}=await fixture(t,q=>q.method==='system_chain'?'x'.repeat(2000):q.method==='rpc_methods'?{methods:Array.from({length:300},()=> 'y'.repeat(200))}:q.method==='state_getMetadata'?'0x6d6574610f'+'00'.repeat(100000):undefined);const sample=await collectSample(rpc,config);assert.ok((sample.identity.chainName?.length??0)<=256);assert.ok(sample.identity.declaredMethods.length<=256);assert.ok(sample.identity.declaredMethods.every(x=>x.length<=128));assert.ok(JSON.stringify(sample.rpc).length<10000);});
test('aborted collection preserves explicit errors and simulated origin',async t=>{const{rpc,calls}=await fixture(t);const abort=new AbortController();abort.abort();const sample=await collectSample(rpc,config,{origin:'simulated',signal:abort.signal});assert.equal(sample.origin,'simulated');assert.equal(sample.identity.state,'unverified');assert.equal(sample.best,null);assert.equal(calls.length,0);assert.ok(sample.rpc.every(q=>q.status==='abnormal'));});
test('unknown metadata version remains visible but cannot verify identity',async t=>{const{rpc}=await fixture(t,q=>q.method==='state_getMetadata'?'0x6d657461ff0100':undefined);const sample=await collectSample(rpc,config);assert.equal(sample.identity.runtime.metadataVersion,255);assert.equal(sample.identity.metadataVerified,false);assert.equal(sample.identity.state,'unverified');assert.match(sample.identity.reason,/unsupported/i);});
test('malformed finalized hash cannot cause an unpinned header query',async t=>{const{rpc,calls}=await fixture(t,q=>q.method==='chain_getFinalizedHead'?'bad':undefined);const sample=await collectSample(rpc,config);assert.equal(sample.finalized,null);assert.deepEqual(calls.filter(q=>q.method==='chain_getHeader').map(q=>q.params),[[best]]);assert.equal(sample.rpc.find(q=>q.method==='chain_getFinalizedHead').status,'abnormal');});
