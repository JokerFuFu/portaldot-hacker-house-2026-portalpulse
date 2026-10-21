import {validateNetworkConfig} from '../core/config.js';
import {useEffect,useRef,useState} from 'react';
import type {FormEvent,ChangeEvent} from 'react';
import type {NetworkConfig,SessionReport} from '../core/types.js';
import {createReport} from '../core/report.js';
import {makeDemoSession} from '../demo/session.js';
import {createLiveSession} from './live-session.js';
import {ExecutionPanel} from './ExecutionPanel.js';
import {makeViewModel,serializeReport,importIntoState,stateLabel,REPORT_BYTE_LIMIT} from './view-model.js';
import type {Mode} from './view-model.js';
const unknown='未知';
const initialConfig:NetworkConfig={id:'custom-readonly',name:'自定义只读网络',source:'用户手动配置（来源待核验）',endpoint:null,endpointAlias:'custom-node',kind:'custom-readonly',expectedGenesis:null};
export function App({initialReport,initialMode='offline'}:{initialReport?:SessionReport;initialMode?:Mode}){
 const [report,setReport]=useState<SessionReport|null>(initialReport??null),[mode,setMode]=useState<Mode>(initialMode);
 const [config,setConfig]=useState(initialConfig),[running,setRunning]=useState(false),[error,setError]=useState<string|null>(null);
 const [now,setNow]=useState(()=>Date.now()),[notice,setNotice]=useState('未连接；请选择模拟、导入或填写只读配置。'),[busy,setBusy]=useState(false);
 const [view,setView]=useState<'network'|'execution'>('network');
 const session=useRef<ReturnType<typeof createLiveSession>|null>(null),revision=useRef(0);
 useEffect(()=>{session.current=createLiveSession();return()=>{revision.current++;session.current?.stop();};},[]);
 useEffect(()=>{if(!report)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[Boolean(report)]);
 const vm=report?makeViewModel(report,mode,now):null;
 function stop(){revision.current++;session.current?.stop();setRunning(false);setBusy(false);if(report?.payload.origin==='rpc')setMode('offline');setNotice('已停止采集；保留的记录为离线观测。');}
 function change(key:keyof NetworkConfig,value:string){stop();setConfig(current=>({...current,[key]:key==='endpoint'||key==='expectedGenesis'?value||null:value}));setError(null);}
 async function simulated(){const token=++revision.current;setBusy(true);setError(null);try{const d=makeDemoSession(),r=await createReport(d.config,d.samples,{origin:'simulated'});if(token!==revision.current)return;setReport(r);setMode('simulated');setNow(Date.now());setNotice('已加载模拟会话：人工固定数据，未连接网络。');}catch(e){if(token===revision.current)setError(String(e));}finally{if(token===revision.current)setBusy(false);}}
 async function imported(event:ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  const token=++revision.current;setBusy(true);setError(null);
  try{
   if(file.size>REPORT_BYTE_LIMIT)throw new Error('文件超过 16 MiB 上限');
   const result=await importIntoState(await file.text(),report);if(token!==revision.current)return;
   if(result.error){setError(result.error);return;}
   setReport(result.report);setMode('offline');setNow(Date.now());setNotice('已导入离线记录；SHA-256 只检测改动，不证明来源真实或当前在线。');
  }catch(e){if(token===revision.current)setError('导入失败：'+(e instanceof Error?e.message:'无法读取文件'));}
  finally{if(token===revision.current)setBusy(false);}
 }
 async function exported(){if(!report)return;setBusy(true);setError(null);try{
  const text=await serializeReport(report),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='portalpulse-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  setNotice('已生成紧凑 JSON 下载；含原始采集时间与来源，不含配置端点。');
 }catch(e){setError('导出失败：'+(e instanceof Error?e.message:'无效报告'));}finally{setBusy(false);}}
 function start(event: FormEvent) {
  event.preventDefault();
  revision.current++;
  setError(null);
  try {
   const validated = validateNetworkConfig(config);
   session.current?.start(validated, r => {
    setReport(r);
    setMode('live');
    setNow(Date.now());
    setError(null);
    setNotice('已完成一次只读观测；状态只代表保留的采样窗口。');
   }, message => setError('采集失败：' + message));
   setReport(null);
   setMode('live');
   setRunning(true);
   setNotice('采集中；正在等待完整观测，未知项保持未验证。');
  } catch (e) {
   setRunning(false);
   setError(e instanceof Error ? e.message : '配置无效');
  }
 }
 const latest=vm?.summary.latest;
 const checks=vm?[
  ['RPC 可达',vm.summary.reachability],['网络身份',vm.summary.identity],['最新区块推进',vm.summary.bestProgress],['最终确认推进',vm.summary.finalizedProgress],['数据新鲜度',vm.summary.freshness],
 ] as const:[];
 return <main>
  <header className="masthead"><div><h1>PortalPulse</h1><p>只读网络观测台</p></div><span className="scope">本地只读增量 · V3 验证待完成</span></header>
  <nav className="view-switch actions" aria-label="工作视图"><button aria-pressed={view==='network'} onClick={()=>setView('network')}>网络观测</button><button aria-pressed={view==='execution'} onClick={()=>{stop();setView('execution');}}>执行复核</button></nav>
  <section className="network-view" hidden={view!=='network'}>
  <section className="source-banner" aria-label="观测来源"><strong>{vm?.modeLabel??(running?'实时只读采集':'未连接')}</strong><span>{vm?.originLabel??(running?'等待 RPC 观测':'尚无观测')}</span><p>{vm?.network.source??'没有默认活动端点。模拟会话为人工数据；离线记录保留原始采集时间。'}</p></section>
  <nav className="actions" aria-label="报告操作"><button disabled={running||busy} onClick={()=>void simulated()}>加载模拟会话</button><label className={`file-button ${running||busy?'disabled':''}`}>导入 JSON<input type="file" accept=".json,application/json" aria-label="导入 JSON" disabled={running||busy} onChange={e=>void imported(e)}/></label><button disabled={!report||busy} onClick={()=>void exported()}>导出 JSON</button><button disabled={!report} onClick={()=>window.print()}>打印报告</button></nav>
  <p className="notice" role="status" aria-live="polite">{notice}</p>{error?<p className="error" role="alert">{error}。已有有效记录会保留；修正后可重试。</p>:null}
  <div className="console-layout">
   <section className="observations"><h2>观测与证据</h2>
    {vm?<>
     <div className="head-strip"><div><span>最新区块 · best</span><strong>{vm.best?.number??unknown}</strong><small>{vm.best?.hash??'区块哈希未知'}</small></div><div><span>最终确认 · finalized</span><strong>{vm.finalized?.number??unknown}</strong><small>{vm.finalized?.hash??'区块哈希未知'}</small></div></div>
     <dl className="identity"><dt>配置名称 / ID</dt><dd>{vm.network.name} / {vm.network.id}</dd><dt>端点别名</dt><dd>{vm.network.endpointAlias}</dd><dt>节点链名称</dt><dd>{latest?.identity.chainName??unknown}</dd><dt>预期创世哈希</dt><dd>{latest?.identity.expectedGenesis??'未知：没有预期身份依据'}</dd><dt>实际创世哈希</dt><dd>{latest?.identity.genesisHash??unknown}</dd><dt>运行时</dt><dd>{latest?.identity.runtime?`${latest.identity.runtime.specName} / spec ${latest.identity.runtime.specVersion} / tx ${latest.identity.runtime.transactionVersion}`:unknown}</dd><dt>元数据头</dt><dd>{latest?.identity.metadataVerified?'识别头版本（不证明完整 SCALE 能力）':'未验证'} / {latest?.identity.runtime?.metadataVersion??unknown}</dd></dl>
     <table className="status-table"><caption>独立状态与判断依据</caption><thead><tr><th>检查项</th><th>状态</th><th>依据</th></tr></thead><tbody>{checks.map(([label,check])=><tr key={label}><th scope="row">{label}</th><td><span className={`state ${check.state}`}>{stateLabel[check.state]}</span></td><td>{check.reason}</td></tr>)}</tbody></table>
     <h3>采样窗口</h3><dl className="window"><dt>采集开始</dt><dd>{vm.startedAt}</dd><dt>最后完成 / 窗口结束</dt><dd>{vm.endedAt}</dd><dt>采样间隔 / 请求超时</dt><dd>{vm.intervalMs} ms / 8000 ms</dd><dt>保留观测 / 已丢弃</dt><dd>{vm.count} / {vm.dropped}（上限 2000 条 / 16 MiB；不代表全天可用性）</dd><dt>推进基线 / 告警阈值</dt><dd>{vm.summary.baselineMs===null?'未验证':vm.summary.baselineMs+' ms'} / {vm.summary.thresholdMs} ms</dd></dl>
     <h3>RPC 详情 · 最后完成的观测</h3><p className="hint">方法、参数、耗时与响应均是原始观测依据；元数据与方法列表保存摘要。</p><div className="rpc-records">{latest?.rpc.map((record,index)=><details key={index}><summary><code>{record.method}</code><span>{record.durationMs.toFixed(1)} ms</span><span className={`state ${record.status}`}>{stateLabel[record.status]}</span></summary><dl><dt>请求开始</dt><dd>{record.startedAt}</dd><dt>参数</dt><dd><pre>{JSON.stringify(record.params)}</pre></dd><dt>响应 / 错误</dt><dd><pre>{JSON.stringify({result:record.result,error:record.error},null,2)}</pre></dd></dl></details>)}</div>
     <h3>证据时间线</h3><div className="timeline">{report?.payload.samples.slice().reverse().map((sample,index)=><details key={`${sample.observedAt}-${index}`}><summary><time>{sample.observedAt}</time><span>best {sample.best?.number??unknown} / finalized {sample.finalized?.number??unknown}</span><span>{stateLabel[sample.identity.state]}</span></summary><p>{sample.identity.reason}</p><pre>{JSON.stringify(sample,null,2)}</pre></details>)}</div>
     <h3>报告完整性</h3><p className="digest">SHA-256 <code>{vm.sha256}</code></p><p className="hint">摘要只检测报告改动，不证明真实性、当前在线或独立共识。离线与模拟状态始终显示在来源栏。</p>
    </>:<div className="empty"><h3>{running?'采集中 · 尚无完整观测':'尚无观测'}</h3><p>{running?'完整请求结束前不显示正常。可停止采集，再调整配置。':'加载模拟会话了解字段，或导入已有 JSON。连接真实端点前，填写右侧来源和身份依据。'}</p><p>网络身份、最新区块、最终确认与数据新鲜度：未验证。</p></div>}
   </section>
   <aside><h2>自定义只读连接</h2><p className="hint">手动启动。允许 HTTP / HTTPS / WS / WSS；拒绝认证、查询与片段。浏览器连接还取决于 CORS 和安全上下文。</p>
    <form onSubmit={start}><label>端点（必填）<input name="endpoint" required type="url" placeholder="https://your-node.example" value={config.endpoint??''} onChange={e=>change('endpoint',e.target.value)}/></label><label>端点别名（必填）<input required maxLength={128} value={config.endpointAlias} onChange={e=>change('endpointAlias',e.target.value)}/></label><label>公开来源说明（必填）<input required maxLength={512} value={config.source} onChange={e=>change('source',e.target.value)}/></label><label>网络名称（必填）<input required maxLength={256} value={config.name} onChange={e=>change('name',e.target.value)}/></label><label>配置 ID（必填）<input required maxLength={128} value={config.id} onChange={e=>change('id',e.target.value)}/></label><label>预期创世哈希（选填）<input maxLength={66} value={config.expectedGenesis??''} placeholder="留空则身份保持未验证" onChange={e=>change('expectedGenesis',e.target.value)}/></label><div className="form-actions"><button className="primary" disabled={running||busy} type="submit">开始只读采集</button><button type="button" disabled={!running} onClick={stop}>停止采集</button></div></form>
    <p className="hint">修改配置会中止旧请求并保留离线记录。报告仅使用别名与来源，配置端点不导出。数据留在本机，刷新页面会清空未导出的会话。</p>
    <div className="pending"><h3>当前交付范围</h3><p>只读网络观测、报告与六类离线执行验收场景。进度材料已于2026-10-20随<a href="https://dorahacks.io/build/50050">Build50050</a>提交，最后回读为待审核；尚非审核通过或最终提交。可信网络身份、探针部署及实链执行 / 最终确认 / 状态回读仍待完成。</p></div>
   </aside>
  </div>
  </section>
  <section className="execution-view" hidden={view!=='execution'}><ExecutionPanel/></section>
  <footer>PortalPulse · 本地只读工具 · 网络报告上限 16 MiB · 执行JSON上限 1 MiB · 不含签名或交易操作</footer>
 </main>;
}
