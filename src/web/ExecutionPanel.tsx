import {useEffect,useRef,useState} from 'react';
import type {ChangeEvent} from 'react';
import type {ExecutionReport} from '../core/execution-report.js';
import {makeExecutionViewModel,serializeExecutionReport} from './execution-model.js';
import type {ExecutionInputKind} from './execution-model.js';
import {createExecutionSession} from './execution-session.js';
import type {ExecutionSessionState} from './execution-session.js';
import {stateLabel} from './view-model.js';

const unknown='未提供/未验证';

export interface ExecutionNotice {report:ExecutionReport|null;message:string;}

// A prior clear/download outcome belongs to its report, not a later load.
export function executionStatus(state:ExecutionSessionState,exporting:boolean,notice:ExecutionNotice):string {
 if(state.busy)return '复核中；保留上一次有效报告。';
 if(exporting)return '正在导出执行报告。';
 if(state.error)return state.report?'复核失败；保留上一次有效执行报告。修正 JSON 或重新选择文件后重试。':'复核失败；暂无有效执行报告。修正 JSON 或重新选择文件后重试。';
 if(state.report&&notice.report!==state.report) {
  const completed=state.inputKind==='simulated'?'已加载模拟执行':state.inputKind==='report'?'已导入执行报告':'已复核原始执行证据';
  return completed+'；离线事实一致性复核已完成。来源真实性及实链执行仍未验证。可查看当前复核结果。';
 }
 return notice.message;
}

export function ExecutionReportView({report,inputKind}:{report:ExecutionReport;inputKind:ExecutionInputKind}) {
 const vm=makeExecutionViewModel(report,inputKind),e=report.payload;
 const stages=[
  ['network','网络身份（离线）',e.network],
  ['submission','提交',e.submitted],
  ['inclusion','纳入',e.inclusion],
  ['execution','执行',e.execution],
  ['finality','最终确认',e.finality],
  ['state','状态回读',e.readback],
 ] as const;
 return <article className="execution-report" id="execution-report-result" tabIndex={-1} aria-label="离线执行事实复核报告">
  <section className="source-banner" aria-label="执行来源">
   <strong>{vm.modeLabel}</strong><span>{vm.originLabel}</span><p>{vm.inputLabel} · {e.network.source}</p>
  </section>
  <h2>事实一致性 <span className={'state '+vm.summary.status}>{stateLabel[vm.summary.status]}</span></h2>
  <p className="execution-limits">当前网络未验证 · 禁止写入 · 完整验证未完成。正常仅表示提供的事实内部一致；不证明来源真实、当前在线、独立共识或真实 V3 执行。</p>
  <dl className="execution-context">
   <dt>网络名称 / ID</dt><dd>{e.network.name} / {e.network.id}</dd>
   <dt>来源 / 端点别名</dt><dd>{e.network.source} / {e.network.endpointAlias}</dd>
   <dt>网络类型</dt><dd>{e.network.kind}</dd>
   <dt>预期创世哈希</dt><dd>{e.network.expectedGenesis??unknown}</dd>
   <dt>提供的创世哈希</dt><dd>{e.network.observedGenesis??unknown}</dd>
   <dt>VM / 合约</dt><dd>{e.intent.vm} / {e.intent.contract}</dd>
   <dt>调用者</dt><dd>{e.intent.caller}</dd>
   <dt>预期序号</dt><dd>{vm.summary.expectedSequence}</dd>
   <dt>回读序号</dt><dd>{vm.summary.observedSequence??unknown}</dd>
   <dt>提供的执行结果</dt><dd>{e.execution?.outcome??unknown}</dd>
   <dt>失败原因</dt><dd>{e.execution?.failureReason??unknown}</dd>
  </dl>
  <table className="execution-stages"><caption>六阶段状态、依据与原始事实</caption>
   <thead><tr><th>阶段 / 状态</th><th>判断依据</th><th>提供的原始事实（含原始时间）</th></tr></thead>
   <tbody>{stages.map(([key,label,facts])=><tr key={key} data-stage={key}>
    <th scope="row">{label}<br/><span className={'state '+vm.summary.checks[key].state}>{stateLabel[vm.summary.checks[key].state]}</span></th>
    <td>{vm.summary.checks[key].reason}</td><td>{facts===null?<p>{unknown}</p>:<pre>{JSON.stringify(facts,null,2)}</pre>}</td>
   </tr>)}</tbody>
  </table>
  <h3>报告完整性与信任边界</h3>
  <p className="digest">SHA-256 <code>{vm.sha256}</code></p>
  <p className="execution-limits">摘要只检测内容改动，不能认证来源或证明实链共识。{vm.summary.trust}</p>
  <p className="hint">mode=offline · verifiedNetwork=false · writeAllowed=false · fullVerification=false</p>
 </article>;
}

export function ExecutionPanel() {
 const [state,setState]=useState<ExecutionSessionState>({report:null,inputKind:null,busy:false,error:null});
 const [text,setText]=useState(''),[exporting,setExporting]=useState(false),[notice,setNotice]=useState<ExecutionNotice>({report:null,message:'执行证据仅在本机离线复核；导入上限 1 MiB UTF-8。'});
 const session=useRef<ReturnType<typeof createExecutionSession>|null>(null);
 const currentReport=useRef<ExecutionReport|null>(null),exportRevision=useRef(0);
 useEffect(()=>{
  const controller=createExecutionSession(next=>{
   exportRevision.current++;
   currentReport.current=next.report;
   setExporting(false);
   setState(next);
  });
  session.current=controller;
  return()=>{exportRevision.current++;currentReport.current=null;controller.dispose();session.current=null;};
 },[]);
 const busy=state.busy||exporting;
 async function imported(event:ChangeEvent<HTMLInputElement>) {
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  await session.current?.load(async()=>{
   if(file.size>1048576)throw new Error('执行文件超过1MiB');
   return file.text();
  });
 }
 async function exported() {
  const report=state.report;
  if(!report||busy)return;
  const token=++exportRevision.current;
  setExporting(true);
  try {
   const value=await serializeExecutionReport(report);
   if(token!==exportRevision.current||currentReport.current!==report)return;
   const url=URL.createObjectURL(new Blob([value],{type:'application/json'}));
   try {
    const link=document.createElement('a');link.href=url;link.download='portalpulse-execution-report.json';link.click();
   } finally {setTimeout(()=>URL.revokeObjectURL(url),1000);}
   if(token===exportRevision.current&&currentReport.current===report)
    setNotice({report,message:'已生成执行报告下载；保留来源与原始阶段时间。SHA-256 仅检查内容。'});
  } catch(error) {
   if(token===exportRevision.current&&currentReport.current===report)
    setNotice({report,message:'导出失败：'+(error instanceof Error?error.message:'无效执行报告')});
  } finally {if(token===exportRevision.current)setExporting(false);}
 }
 function showResult() {
  const target=document.getElementById('execution-report-result');
  target?.focus({preventScroll:true});
  target?.scrollIntoView({block:'start'});
 }
 function clear() {
  session.current?.clear();setText('');setNotice({report:null,message:'已清空执行记录；未连接网络。'});
 }
 return <div className="execution-panel">
  <div className="execution-editor">
   <h2>执行复核</h2><button disabled={!state.report||busy} onClick={showResult}>查看当前复核结果</button><p className="hint">始终离线。支持原始执行证据或版本化执行报告；没有自动网络连接、签名或交易操作。</p>
   <div className="actions">
    <button disabled={busy} onClick={()=>void session.current?.simulated()}>加载模拟执行</button>
    <label className={'file-button '+(busy?'disabled':'')}>导入执行JSON<input type="file" accept=".json,application/json" aria-label="导入执行JSON" disabled={busy} onChange={e=>void imported(e)}/></label>
   </div>
   <label htmlFor="execution-json">执行证据JSON</label>
   <textarea id="execution-json" value={text} onChange={e=>setText(e.target.value)} disabled={busy} rows={6} spellCheck={false}/>
   <button disabled={busy||!text.trim()} onClick={()=>void session.current?.load(async()=>text)}>复核粘贴JSON</button>
  </div>
  <div className="actions execution-actions" aria-label="执行报告操作">
   <button disabled={busy||!state.report} onClick={()=>void exported()}>导出执行报告</button>
   <button disabled={busy||!state.report} onClick={()=>window.print()}>打印执行报告</button>
   <button disabled={!state.report&&!busy&&!text} onClick={clear}>清空执行记录</button>
  </div>
  <p className="notice" role="status" aria-live="polite">{executionStatus(state,exporting,notice)}</p>
  {state.error?<p className="error" role="alert">{state.error}。已有有效执行报告会保留；修正 JSON 或重新选择文件后重试。</p>:null}
  {state.report&&state.inputKind?<ExecutionReportView report={state.report} inputKind={state.inputKind}/>:<div className="empty execution-empty"><h3>尚无执行证据</h3><p>加载模拟执行，或导入 / 粘贴执行JSON。所有缺失事实保持未提供/未验证。</p><p>当前网络未验证 · 禁止写入 · 完整验证未完成。</p></div>}
 </div>;
}
