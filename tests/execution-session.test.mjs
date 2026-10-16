import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
const fixture=JSON.parse(await readFile(new URL('../examples/execution-simulated.example.json',import.meta.url),'utf8'));
let module={};try{module=await import('../dist/web/execution-session.js');}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
function setup(){assert.equal(typeof module.createExecutionSession,'function','createExecutionSession must be available');const states=[];const session=module.createExecutionSession(s=>states.push(s));return {session,states,last:()=>states.at(-1)};}
function delayed(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const raw=JSON.stringify(fixture);
test('generation advances before invoking read; reentrant newer load wins',async()=>{
 const {session,last}=setup();let newer;
 await session.load(()=>{newer=session.load(async()=>JSON.stringify({...fixture,origin:'rpc'}));return Promise.resolve(raw);});await newer;
 assert.equal(last().report.payload.origin,'rpc');assert.equal(last().busy,false);
});
for(const outcome of ['success','error'])test('older delayed '+outcome+' cannot replace newer report',async()=>{
 const {session,last}=setup(),old=delayed(),pending=session.load(()=>old.promise);
 await session.load(async()=>JSON.stringify({...fixture,origin:'rpc'}));const good=last();
 if(outcome==='success')old.resolve(raw);else old.reject(new Error('old read failed'));await pending;
 assert.equal(last(),good);assert.equal(good.report.payload.origin,'rpc');
});
test('busy retains previous good report and latest failure preserves it with retry guidance',async()=>{
 const {session,last}=setup();await session.load(async()=>raw);const good=last(),bad=delayed();
 const pending=session.load(()=>bad.promise);assert.equal(last().busy,true);assert.equal(last().report,good.report);assert.equal(last().inputKind,'raw');
 bad.resolve('{');await pending;assert.equal(last().report,good.report);assert.equal(last().inputKind,'raw');assert.equal(last().busy,false);assert.match(last().error,/导入失败/);
 await session.load(async()=>raw);assert.equal(last().error,null);
});
test('read rejection is caught and null previous state is preserved',async()=>{
 const {session,last}=setup();await session.load(async()=>{throw new Error('cannot read');});
 assert.equal(last().report,null);assert.equal(last().inputKind,null);assert.equal(last().busy,false);assert.match(last().error,/cannot read/);
});
for(const action of ['clear','dispose'])test(action+' suppresses pending success and error and future dispose callbacks',async()=>{
 for(const outcome of ['success','error']){
  const {session,states,last}=setup();await session.load(async()=>raw);const d=delayed(),pending=session.load(()=>d.promise);session[action]();const count=states.length;
  if(action==='clear')assert.deepEqual(last(),{report:null,inputKind:null,busy:false,error:null});
  if(outcome==='success')d.resolve(raw);else d.reject(new Error('late'));await pending;assert.equal(states.length,count);
  if(action==='dispose'){await session.load(async()=>raw);await session.simulated();session.clear();assert.equal(states.length,count);}
 }
});
test('simulated replaces pending import with exact fixed synthetic facts',async()=>{
 const {session,last}=setup(),d=delayed(),pending=session.load(()=>d.promise);await session.simulated();const good=last();
 assert.equal(good.inputKind,'simulated');assert.deepEqual(good.report.payload,fixture);assert.equal(good.busy,false);
 d.resolve(JSON.stringify({...fixture,origin:'rpc'}));await pending;assert.equal(last(),good);
});

for(const action of ['clear','dispose'])test(action+' while real digest awaits suppresses raw and simulated completion',async()=>{
 for(const operation of ['load','simulated']){
  const {session,states,last}=setup();
  const pending=operation==='load'?session.load(()=>Promise.resolve(raw)):session.simulated();
  // A resolved read resumes parsing/creation before this continuation; SHA-256 still awaits.
  await Promise.resolve();session[action]();const count=states.length;
  await pending;assert.equal(states.length,count);
  if(action==='clear')assert.deepEqual(last(),{report:null,inputKind:null,busy:false,error:null});
 }
});
