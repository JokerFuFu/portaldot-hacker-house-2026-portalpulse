import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {nativeFixture} from './helpers/native-fixture.mjs';

const root=resolve(new URL('..',import.meta.url).pathname);
function run(args,{onSpawn}={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['scripts/observe-native.mjs',...args],{cwd:root,stdio:['ignore','pipe','pipe']});
    let stdout='',stderr='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('CLI test timeout'));},10000);
    child.stdout.on('data',v=>{stdout+=v;});child.stderr.on('data',v=>{stderr+=v;});
    child.on('error',reject);child.on('close',code=>{clearTimeout(timer);resolve({code,stdout,stderr});});
    onSpawn?.(child);
  });
}
async function fixture(t,options={}) {
  const f=nativeFixture(options);const requests=[];let beforeReply=null;
  const server=createServer(async(req,res)=>{
    let body='';for await(const part of req)body+=part;
    const q=JSON.parse(body);requests.push(q);await beforeReply?.(q);
    try{const data=await f.replies[q.method]?.(q.params);res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result:data}));}
    catch(error){res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,error:{code:-32000,message:String(error)}}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const dir=await mkdtemp(join(tmpdir(),'portalpulse-native-test-'));const configPath=join(dir,'config.json'),out=join(dir,'observation.json');
  f.config.endpoint='http://127.0.0.1:'+server.address().port;
  await writeFile(configPath,JSON.stringify(f.config));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
  return {...f,dir,configPath,out,requests,beforeReply(fn){beforeReply=fn;},args:['--config',configPath,'--block-hash',f.blockHash,'--tx-hash',f.transactionHash,'--out',out]};
}
test('native CLI help states readonly system outcome and pending finality',async()=>{
  const r=await run(['--help']);assert.equal(r.code,0);assert.match(r.stdout,/readonly/i);assert.match(r.stdout,/finality/i);assert.equal(r.stderr,'');
});
test('native CLI uses actual HTTP RPC and exclusively saves scoped successful observation',async t=>{
  const f=await fixture(t);const r=await run(f.args);
  assert.equal(r.code,0,r.stderr);const saved=JSON.parse(await readFile(f.out,'utf8')),summary=JSON.parse(r.stdout);
  assert.equal(saved.status,'normal');assert.equal(saved.dispatch.outcome,'success');assert.equal(saved.inclusion.transactionIndex,1);
  assert.equal(summary.status,'normal');assert.equal(summary.fullVerification,false);
  assert.equal(saved.finalityVerified,false);assert.equal(saved.contractStateVerified,false);assert.equal(saved.writeAllowed,false);
  assert.ok(!r.stdout.includes(f.config.endpoint));assert.ok(!JSON.stringify(saved).includes(f.extrinsics[1]));
  assert.equal(f.requests.some(q=>q.method.startsWith('author_')),false);
});
test('native CLI saves target dispatch failure and exits1',async t=>{
  const f=await fixture(t,{outcomes:[{index:1,success:false}]});const r=await run(f.args);
  assert.equal(r.code,1,r.stderr);const saved=JSON.parse(await readFile(f.out,'utf8'));
  assert.equal(saved.dispatch.outcome,'failure');assert.match(saved.dispatch.failureReason,/BadOrigin/i);
});
test('native CLI missing target outcome saves unverified and exits2',async t=>{
  const f=await fixture(t,{outcomes:[{index:0,success:true}]});const r=await run(f.args);
  assert.equal(r.code,2,r.stderr);const saved=JSON.parse(await readFile(f.out,'utf8'));assert.equal(saved.status,'unverified');assert.equal(saved.dispatch,null);
});
test('native CLI existing output refuses before any network request',async t=>{
  const f=await fixture(t);await writeFile(f.out,'keep me');const r=await run(f.args);
  assert.equal(r.code,1);assert.equal(r.stdout,'');assert.match(r.stderr,/exists|overwrite/i);
  assert.equal(await readFile(f.out,'utf8'),'keep me');assert.equal(f.requests.length,0);
});
test('native CLI output created during RPC is not overwritten and has no successful stdout',async t=>{
  const f=await fixture(t);let written=false;
  f.beforeReply(async()=>{if(!written){written=true;await writeFile(f.out,'race winner');}});
  const r=await run(f.args);assert.equal(r.code,1);assert.equal(r.stdout,'');assert.equal(await readFile(f.out,'utf8'),'race winner');
});
for(const edit of [
  args=>args.slice(0,6),
  args=>[...args,'--submit','yes'],
  args=>[...args,'--tx-hash','0x'+'aa'.repeat(32)],
  args=>args.map((v,i)=>i===3?'0x00':v),
])test('native CLI invalid arguments create no report or network request',async t=>{
  const f=await fixture(t);const r=await run(edit(f.args));
  assert.equal(r.code,1);assert.equal(r.stdout,'');assert.equal(f.requests.length,0);await assert.rejects(readFile(f.out));
});
test('native CLI malformed config never requests or writes successful output',async t=>{
  const f=await fixture(t);await writeFile(f.configPath,'{bad');
  const r=await run(f.args);assert.equal(r.code,1);assert.equal(r.stdout,'');assert.equal(f.requests.length,0);await assert.rejects(readFile(f.out));
});
test('native CLI SIGINT aborts a real pending request and preserves failed evidence',async t=>{
  const f=await fixture(t);let child,observed;const sawRequest=new Promise(resolve=>{observed=resolve;});
  f.beforeReply(()=>{observed();return new Promise(()=>{});});
  const pending=run(f.args,{onSpawn:v=>{child=v;}});
  await sawRequest;child.kill('SIGINT');const r=await pending;
  assert.equal(r.code,1,r.stderr);const saved=JSON.parse(await readFile(f.out,'utf8'));
  assert.equal(saved.status,'abnormal');assert.match(saved.error.message,/abort|closed/i);assert.equal(saved.dispatch,null);
});
