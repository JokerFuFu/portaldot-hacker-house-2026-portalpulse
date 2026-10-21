import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createExecutionReport,importExecutionReport} from '../dist/core/execution-report.js';
const fixture=JSON.parse(await readFile(new URL('../examples/execution-simulated.example.json',import.meta.url),'utf8'));
async function optional(path){try{return await import(path);}catch(e){if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;}}
const model=await optional('../dist/web/execution-model.js');
const demo=await optional('../dist/demo/execution.js');
const ui=await optional('../dist/web/ExecutionPanel.js');

test('execution editor offers six labeled rehearsal choices with an explicit offline boundary',()=>{
 const html=renderToStaticMarkup(createElement(ui.ExecutionPanel));assert.match(html,/<label[^>]*for="execution-scenario"[^>]*>模拟验收场景<\/label>/);assert.match(html,/<select[^>]*id="execution-scenario"/);
 for(const id of ['complete','missing-evidence','execution-failed','wrong-transaction','unfinalized','state-mismatch'])assert.match(html,new RegExp('<option[^>]*value="'+id+'"'));
 assert.match(html,/始终离线/);assert.match(html,/没有自动网络连接、签名或交易操作/);
});
function api(name){assert.equal(typeof model[name],'function',name+' must be available');return model[name];}
function render(props){assert.equal(typeof ui.ExecutionReportView,'function','ExecutionReportView must be available');return renderToStaticMarkup(createElement(ui.ExecutionReportView,props));}

test('fixed demo factory is exact synthetic fixture and fresh on every call',()=>{
 assert.equal(typeof demo.makeDemoExecutionEvidence,'function','makeDemoExecutionEvidence must be available');
 const first=demo.makeDemoExecutionEvidence();assert.deepEqual(first,fixture);first.finality.ancestry[0].number='999';
 assert.deepEqual(demo.makeDemoExecutionEvidence(),fixture);
});
test('raw and report roundtrip preserve provenance, original times and decimal sequence',async()=>{
 const read=api('readExecutionInput'),serialize=api('serializeExecutionReport');
 const raw=await read(JSON.stringify(fixture));assert.equal(raw.inputKind,'raw');assert.deepEqual(raw.report.payload,fixture);
 const text=await serialize(raw.report);assert.equal(text,JSON.stringify(raw.report));assert.deepEqual(await importExecutionReport(text),raw.report);
 const saved=await read(text);assert.equal(saved.inputKind,'report');assert.deepEqual(saved.report,raw.report);
 assert.equal(saved.report.payload.readback.sequence,'9007199254740993');assert.equal(saved.report.payload.execution.observedAt,'2026-10-14T00:00:00.000Z');
});
test('view model re-evaluates supplied facts, with offline and false flags even for all-normal RPC',async()=>{
 const make=api('makeExecutionViewModel'),f=structuredClone(fixture);f.origin='rpc';
 const r=await createExecutionReport(f),vm=make(r,'report');
 assert.equal(vm.modeLabel,'离线执行复核');assert.match(vm.originLabel,/RPC/);assert.equal(vm.sha256,r.sha256);
 assert.equal(vm.summary.status,'normal');assert.equal(vm.summary.evidenceComplete,true);
 for(const key of ['verifiedNetwork','writeAllowed','fullVerification'])assert.equal(vm.summary[key],false);
 assert.equal(vm.summary.mode,'offline');assert.equal(vm.summary.observedSequence,'9007199254740993');
 r.payload.execution.outcome='failure';r.payload.execution.failureReason='synthetic failure';
 assert.equal(make(r,'report').summary.status,'abnormal');
});
for(const [label,change,status,stage] of [
 ['partial',f=>{f.execution=null;},'unverified','execution'],
 ['failed',f=>{f.execution.outcome='failure';f.execution.failureReason='synthetic failed';},'abnormal','execution'],
 ['missing genesis',f=>{f.network.observedGenesis=null;},'unverified','network'],
 ['readback mismatch',f=>{f.readback.sequence='0';},'abnormal','state'],
])test('reader preserves '+label+' diagnostic facts',async()=>{
 const read=api('readExecutionInput'),make=api('makeExecutionViewModel'),f=structuredClone(fixture);change(f);
 const {report}=await read(JSON.stringify(f));assert.deepEqual(report.payload,f);
 const vm=make(report,'raw');assert.equal(vm.summary.status,status);assert.equal(vm.summary.checks[stage].state,status);
});
for(const [label,value] of [
 ['malformed','{'],['M1',JSON.stringify({schemaVersion:1,payload:{},sha256:'0'.repeat(64)})],
 ['mixed',JSON.stringify({...fixture,executionReportVersion:1})],
 ['unknown raw',JSON.stringify({...fixture,extra:true})],
])test('strict reader rejects '+label+' without fallback',async()=>{
 const read=api('readExecutionInput');await assert.rejects(read(value),/invalid|JSON/i);
});
test('strict report path rejects version, digest, forged summary and changed canonical casing',async()=>{
 const read=api('readExecutionInput');
 for(const change of [r=>{r.executionReportVersion=2;},r=>{r.sha256='0'.repeat(64);},r=>{r.summary={status:'normal'};},r=>{r.payload.network.expectedGenesis='0x'+'A'.repeat(64);}]){
  const r=await createExecutionReport(fixture);change(r);await assert.rejects(read(JSON.stringify(r)),/invalid|canonical|integrity/i);
 }
});
test('serialization validates exact compact envelope and rejects tampering',async()=>{
 const serialize=api('serializeExecutionReport'),r=await createExecutionReport(fixture);r.payload.intent.expectedSequence='1';
 await assert.rejects(serialize(r),/integrity/i);
});
test('reader accepts exactly 1 MiB of UTF8 and rejects plus one byte and nontext',async()=>{
 const read=api('readExecutionInput'),f=structuredClone(fixture);f.network.source='合成来源';
 for(const base of [JSON.stringify(f),JSON.stringify(await createExecutionReport(f))]){
  const exact=base+' '.repeat(1048576-Buffer.byteLength(base));assert.equal(Buffer.byteLength(exact),1048576);
  await read(exact);await assert.rejects(read(exact+' '),/1\s?MiB/);
 }
 await assert.rejects(read(null),/文本/);
});
test('empty SSR offers execution editor and actions without claiming evidence',()=>{
 assert.equal(typeof ui.ExecutionPanel,'function','ExecutionPanel must be available');
 const html=renderToStaticMarkup(createElement(ui.ExecutionPanel));
 for(const label of ['尚无执行证据','加载模拟执行','导入执行JSON','执行证据JSON','复核粘贴JSON','导出执行报告','打印执行报告','清空执行记录','离线'])assert.ok(html.includes(label),label);
 assert.match(html,/<textarea[^>]*id="execution-json"/);assert.ok(!html.includes('实链验证通过'));
});
test('report SSR shows six checks, inspectable facts, original times and permanent trust limits',async()=>{
 const report=await createExecutionReport(fixture),html=render({report,inputKind:'simulated'});
 for(const text of ['事实一致性','网络身份（离线）','提交','纳入','执行','最终确认','状态回读','模拟数据','离线执行复核','当前网络未验证','禁止写入','完整验证未完成','SHA-256',report.sha256,'9007199254740993','0xbbbbbb','0xcccccc','0xdddddd','0xeeeeee','2026-10-14T00:00:00.000Z','ancestry','transactionIndex','observedAt'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/<tr data-stage=/g)||[]).length,6);
});
test('partial SSR keeps null unknowns while actual zero index and sequence remain visible',async()=>{
 const f=structuredClone(fixture);f.submitted=null;f.execution=null;f.readback=null;f.network.expectedGenesis=null;
 const html=render({report:await createExecutionReport(f),inputKind:'raw'});
 assert.match(html,/未提供\/未验证/);assert.match(html,/unverified/);assert.ok(html.includes('transactionIndex'));
 assert.ok(!html.includes('实链验证通过'));
 const zero=structuredClone(fixture);zero.intent.expectedSequence='0';zero.readback.sequence='0';
 assert.match(render({report:await createExecutionReport(zero),inputKind:'raw'}),/>0</);
});
test('React escapes imported source, alias, caller and failure reason and RPC stays offline',async()=>{
 const f=structuredClone(fixture);f.origin='rpc';f.network.source='<img src=x onerror=alert(1)>';f.network.endpointAlias='<script>bad</script>';
 f.intent.caller='<svg onload=bad>';f.execution.outcome='failure';f.execution.failureReason='<script>failed</script>';
 const html=render({report:await createExecutionReport(f),inputKind:'raw'});
 for(const tag of ['img','script','svg'])assert.ok(html.includes('&lt;'+tag),tag);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(!html.includes('<svg'));
 assert.match(html,/RPC/);assert.match(html,/离线执行复核/);assert.match(html,/当前网络未验证/);
});


async function sessionFeedback() {
 assert.equal(typeof ui.executionStatus,'function','production executionStatus must be available');
 const {createExecutionSession}=await import('../dist/web/execution-session.js');
 let state={report:null,inputKind:null,busy:false,error:null};
 const session=createExecutionSession(next=>{state=next;});
 return {session,get state(){return state;},status:notice=>ui.executionStatus(state,false,notice)};
}
test('first simulated load announces its current offline result instead of the initial input hint',async()=>{
 const flow=await sessionFeedback();
 const initial={report:null,message:'执行证据仅在本机离线复核；导入上限 1 MiB UTF-8。'};
 await flow.session.simulated();
 const status=flow.status(initial);
 assert.match(status,/已加载模拟执行/);assert.match(status,/离线/);assert.match(status,/真实性|实链/);
});
test('clear then simulate cannot announce that the newly loaded report is cleared',async()=>{
 const flow=await sessionFeedback();await flow.session.simulated();flow.session.clear();
 const cleared={report:null,message:'已清空执行记录；未连接网络。'};
 assert.equal(flow.status(cleared),cleared.message);
 await flow.session.simulated();const status=flow.status(cleared);
 assert.match(status,/已加载模拟执行/);assert.doesNotMatch(status,/已清空/);
});
for(const kind of ['raw','report'])test('export then valid '+kind+' import replaces the previous download outcome',async()=>{
 const flow=await sessionFeedback();await flow.session.simulated();
 const previous=flow.state.report,download={report:previous,message:'已生成执行报告下载；保留来源与原始阶段时间。SHA-256 仅检查内容。'};
 assert.equal(flow.status(download),download.message);
 const text=JSON.stringify(kind==='raw'?fixture:previous);
 await flow.session.load(async()=>text);
 assert.notEqual(flow.state.report,previous);assert.equal(flow.state.inputKind,kind);
 const status=flow.status(download);
 assert.match(status,kind==='raw'?/已复核原始执行证据/:/已导入执行报告/);
 assert.match(status,/离线/);assert.doesNotMatch(status,/已生成.*下载|已清空/);
});
test('latest failed import announces retained previous result and retry while preserving report',async()=>{
 const flow=await sessionFeedback();await flow.session.simulated();
 const previous=flow.state.report,download={report:previous,message:'已生成执行报告下载'};
 await flow.session.load(async()=>'{');
 assert.equal(flow.state.report,previous);assert.match(flow.state.error,/导入失败/);
 const status=flow.status(download);
 assert.match(status,/复核失败/);assert.match(status,/保留.*有效/);assert.match(status,/重试/);
 assert.doesNotMatch(status,/已生成.*下载|已清空/);
});
test('current download notice and busy state remain accurate for the same report',async()=>{
 const flow=await sessionFeedback();await flow.session.simulated();
 const notice={report:flow.state.report,message:'已生成执行报告下载；SHA-256 仅检查内容。'};
 assert.equal(flow.status(notice),notice.message);
 assert.match(ui.executionStatus(flow.state,true,notice),/正在导出/);
 assert.match(ui.executionStatus({...flow.state,busy:true},false,notice),/复核中/);
});
test('execution result has a keyboard focus target and a visible entry from the editor',async()=>{
 const report=await createExecutionReport(fixture),html=render({report,inputKind:'simulated'});
 assert.match(html,/<article[^>]*id="execution-report-result"[^>]*tabindex="-1"/i);
 const empty=renderToStaticMarkup(createElement(ui.ExecutionPanel));
 assert.match(empty,/<button[^>]*disabled=""[^>]*>查看当前复核结果<\/button>/);
});
