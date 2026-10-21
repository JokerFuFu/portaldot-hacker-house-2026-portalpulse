import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as demo from '../dist/demo/execution.js';
import {evaluateExecutionEvidence} from '../dist/core/execution.js';
import {createExecutionReport,importExecutionReport} from '../dist/core/execution-report.js';
const original=JSON.parse(await readFile('examples/execution-simulated.example.json','utf8'));
function make(id){assert.equal(typeof demo.makeExecutionScenario,'function','rehearsal factory must be available');return demo.makeExecutionScenario(id);}
const cases=[
 ['complete','normal','state','normal','9007199254740993'],
 ['missing-evidence','unverified','execution','unverified','9007199254740993'],
 ['execution-failed','abnormal','execution','abnormal','9007199254740993'],
 ['wrong-transaction','abnormal','execution','abnormal','9007199254740993'],
 ['unfinalized','unverified','finality','unverified',null],
 ['state-mismatch','abnormal','state','abnormal','9007199254740992'],
];
for(const [id,status,stage,stageState,observedSequence] of cases)test('rehearsal '+id+' demonstrates its actual diagnostic result without elevated trust',async()=>{
 const evidence=make(id),result=evaluateExecutionEvidence(evidence);
 assert.equal(result.status,status);assert.equal(result.checks[stage].state,stageState);
 assert.equal(result.evidenceComplete,id==='complete');assert.equal(result.expectedSequence,'9007199254740993');assert.equal(result.observedSequence,observedSequence);
 assert.equal(result.mode,'offline');assert.equal(result.origin,'simulated');for(const flag of ['verifiedNetwork','writeAllowed','fullVerification'])assert.equal(result[flag],false);
 assert.equal(evidence.submitted.observedAt,'2026-10-14T00:00:00.000Z');
 const report=await createExecutionReport(evidence);assert.deepEqual((await importExecutionReport(JSON.stringify(report))).payload,evidence);
});
test('catalog exposes distinct runnable choices and default preserves the original complete fixture',()=>{
 assert.ok(Array.isArray(demo.executionScenarios),'scenario catalog must be available');assert.equal(demo.executionScenarios.length,6);
 assert.deepEqual(demo.executionScenarios.map(s=>s.id),cases.map(c=>c[0]));
 for(const s of demo.executionScenarios){assert.ok(s.label.trim());assert.ok(s.description.trim());make(s.id);}
 assert.deepEqual(make(),original);
});
test('scenario calls do not share nested observations or poison subsequent complete evidence',()=>{
 const first=make('wrong-transaction');first.network.source='MUTATED';first.finality.ancestry[0].number='999';first.inclusion.transactions.push('0x'+'1'.repeat(64));
 assert.deepEqual(make('complete'),original);assert.equal(make('wrong-transaction').finality.ancestry[0].number,'101');
});
test('missing and unfinalized presets retain provided facts without inventing a confirmation',()=>{
 const missing=make('missing-evidence');assert.equal(missing.execution,null);assert.ok(missing.finality);assert.ok(missing.readback);
 assert.equal(evaluateExecutionEvidence(missing).checks.finality.state,'unverified');
 const unfinalized=make('unfinalized');assert.equal(unfinalized.execution.outcome,'success');assert.equal(unfinalized.finality,null);assert.equal(unfinalized.readback,null);
});
test('wrong-transaction preset retains successful outcome but the correlation fails',()=>{
 const e=make('wrong-transaction');assert.equal(e.execution.outcome,'success');assert.equal(e.inclusion.transactionHash,e.submitted.transactionHash);assert.notEqual(e.execution.transactionHash,e.submitted.transactionHash);
 assert.match(evaluateExecutionEvidence(e).checks.execution.reason,/transaction.*mismatch/i);
});
for(const id of ['unknown','__proto__','constructor','',null,{}])test('unknown scenario '+String(id)+' rejects instead of falling back',()=>{
 assert.equal(typeof demo.makeExecutionScenario,'function','rehearsal factory must be available');assert.throws(()=>demo.makeExecutionScenario(id),/Unknown execution scenario/);
});
