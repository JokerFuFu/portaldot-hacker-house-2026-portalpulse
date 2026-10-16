import assert from 'node:assert/strict';
import {test} from 'node:test';
import http from 'node:http';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createReport,importReport} from '../dist/core/report.js';
import {makeDemoSession} from '../dist/demo/session.js';
import {makeViewModel,serializeReport,importIntoState} from '../dist/web/view-model.js';
import {createLiveSession} from '../dist/web/live-session.js';
import {App} from '../dist/web/App.js';
const demo=makeDemoSession();
const report=()=>createReport(demo.config,demo.samples,{origin:'simulated'});
test('offline mode retains original origin and collection window; best/finalized/stale stay separate',async()=>{
 const r=await report(),vm=makeViewModel(r,'offline',Date.parse(r.payload.endedAt)+30000);
 assert.equal(vm.modeLabel,'离线导入');assert.equal(vm.originLabel,'模拟数据');
 assert.equal(vm.endedAt,r.payload.endedAt);assert.equal(vm.summary.freshness.state,'abnormal');
 assert.equal(vm.best.number,'105');assert.equal(vm.finalized.number,'104');assert.equal(vm.summary.bestProgress.state,'normal');
 const real=structuredClone(r);real.payload.origin='rpc';real.payload.samples.forEach(s=>s.origin='rpc');
 const realVm=makeViewModel(real,'offline',Date.parse(real.payload.endedAt));assert.equal(realVm.modeLabel,'离线导入');
});
test('unverified metadata or identity cannot be promoted by the UI',async()=>{
 const r=await report();r.payload.samples.at(-1).identity.metadataVerified=false;
 const vm=makeViewModel(r,'live',Date.parse(r.payload.endedAt));
 assert.equal(vm.summary.identity.state,'unverified');assert.equal(vm.summary.bestProgress.state,'unverified');assert.equal(vm.modeLabel,'模拟演示');
});
test('SSR shows origin, collection time, labeled actions, unknowns and plain text source/alias/errors',async()=>{
 const data=makeDemoSession();data.config.source='<img src=x onerror=alert(1)>';data.config.endpointAlias='<script>bad</script>';
 data.samples.forEach(s=>s.endpointAlias=data.config.endpointAlias);data.samples.at(-1).best=null;
 data.samples.at(-1).rpc[0]={...data.samples.at(-1).rpc[0],status:'abnormal',error:{code:'bad',message:'<script>bad</script>'}};
 const r=await createReport(data.config,data.samples,{origin:'simulated'});
 const html=renderToStaticMarkup(createElement(App,{initialReport:r,initialMode:'offline'}));
 for(const text of ['离线导入','模拟数据',r.payload.endedAt,'最新区块','最终确认','数据新鲜度','未知','导入 JSON','导出 JSON','打印报告'])assert.ok(html.includes(text),text);
 assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>bad'));
 assert.ok(!html.includes('dangerouslySetInnerHTML'));
});
test('empty SSR never auto-starts or pretends to have evidence',()=>{
 const html=renderToStaticMarkup(createElement(App));assert.match(html,/尚无观测/);assert.match(html,/加载模拟会话/);assert.match(html,/未连接/);
});
test('invalid/tampered import has clear error and keeps previous valid report',async()=>{
 const r=await report();for(const text of ['{',JSON.stringify({...r,sha256:'0'.repeat(64)}),' '.repeat(16*1024*1024+1)]){
 const result=await importIntoState(text,r);assert.equal(result.report,r);assert.match(result.error,/导入失败/);
 }
 const result=await importIntoState(await serializeReport(r),null);assert.equal(result.mode,'offline');assert.equal(result.error,null);assert.deepEqual(result.report,r);
});
test('compact UTF8 export near byte boundary round-trips while pretty JSON exceeds limit',async()=>{
 const d=makeDemoSession();const s=structuredClone(d.samples[0]);s.rpc=[{...s.rpc[0],result:Array(64).fill('汉'.repeat(60))}];
 const samples=Array.from({length:1200},(_,i)=>({...structuredClone(s),observedAt:new Date(Date.parse(s.observedAt)+i*10000).toISOString(),rpc:s.rpc.map(r=>({...r,startedAt:new Date(Date.parse(r.startedAt)+i*10000).toISOString()}))}));
 const r=await createReport(d.config,samples,{origin:'simulated'}),text=await serializeReport(r);
 assert.ok(Buffer.byteLength(JSON.stringify(r,null,2))>16*1024*1024);assert.ok(Buffer.byteLength(text)<=16*1024*1024);
 assert.deepEqual(await importReport(text),r);
 const enlarged=structuredClone(r);enlarged.payload.network.source='汉'.repeat(6*1024*1024);await assert.rejects(serializeReport(enlarged),/size|limit/i);
});
async function fixture(t,delay=100){
 const hash='0x'+'12'.repeat(32);let arrivals=0,notify;
 const arrived=new Promise(resolve=>notify=resolve);
 const server=http.createServer(async(req,res)=>{let text='';for await(const chunk of req)text+=chunk;const q=JSON.parse(text);arrivals++;notify();
 setTimeout(()=>{const result=q.method==='system_chain'?'Local fixture':q.method==='chain_getBlockHash'||q.method==='chain_getFinalizedHead'?hash:q.method==='state_getRuntimeVersion'?{specName:'fixture',specVersion:1,transactionVersion:1}:q.method==='state_getMetadata'?'0x6d6574610f00':q.method==='rpc_methods'?{methods:[]}: {number:'0x1',parentHash:hash,stateRoot:hash,extrinsicsRoot:hash,digest:{logs:[]}};
 res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result}));},delay);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 return {config:{id:'fixture',name:'Local fixture',source:'Local delayed HTTP test',endpoint:`http://127.0.0.1:${server.address().port}`,endpointAlias:'delayed-local',kind:'custom-readonly',expectedGenesis:hash},arrived,get arrivals(){return arrivals}};
}
test('stop aborts real delayed HTTP request and never publishes stale completion',async t=>{
 const f=await fixture(t),reports=[],errors=[],session=createLiveSession();
 session.start(f.config,r=>reports.push(r),e=>errors.push(e));await f.arrived;session.stop();
 await new Promise(resolve=>setTimeout(resolve,200));assert.equal(reports.length,0);assert.equal(errors.length,0);assert.equal(session.active,false);assert.equal(f.arrivals,1);
});
test('config replacement cancels old transport; only new complete snapshots publish',async t=>{
 const f=await fixture(t,30),reports=[],session=createLiveSession();t.after(()=>session.stop());
 session.start(f.config,r=>reports.push(r),assert.fail);await f.arrived;
 const replacement={...f.config,id:'replacement',endpointAlias:'new-local'};
 const completed=new Promise((resolve,reject)=>session.start(replacement,r=>{reports.push(r);resolve();},reject));
 await completed;session.stop();assert.equal(reports.length,1);assert.equal(reports[0].payload.network.id,'replacement');
 assert.equal(reports[0].payload.origin,'rpc');assert.equal(reports[0].payload.samples.length,1);
 assert.ok(Date.now()-Date.parse(reports[0].payload.endedAt)<1000);assert.ok(!JSON.stringify(reports[0]).includes(f.config.endpoint));
 assert.deepEqual(await importReport(await serializeReport(reports[0])),reports[0]);
});

test('network view remains default and execution owner is mounted but hidden',()=>{
 const html=renderToStaticMarkup(createElement(App));
 assert.match(html,/<button[^>]*aria-pressed="true"[^>]*>网络观测<\/button>/);
 assert.match(html,/<button[^>]*aria-pressed="false"[^>]*>执行复核<\/button>/);
 assert.match(html,/<section[^>]*class="execution-view"[^>]*hidden=""/);
 assert.match(html,/开始只读采集/);assert.match(html,/加载模拟执行/);
});
