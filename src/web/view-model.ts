import type {SessionReport} from '../core/types.js';
import {analyzeSamples} from '../core/monitor.js';
import {importReport} from '../core/report.js';
export type Mode='live'|'offline'|'simulated';
export const REPORT_BYTE_LIMIT=16*1024*1024;
export const stateLabel={normal:'正常',abnormal:'异常',unverified:'未验证',collecting:'采集中'} as const;
export function makeViewModel(report:SessionReport,mode:Mode,nowMs:number){
 const p=report.payload,summary=analyzeSamples(p.samples,nowMs,p.intervalMs);
 return {modeLabel:mode==='offline'?'离线导入':p.origin==='simulated'?'模拟演示':'实时只读采集',originLabel:p.origin==='simulated'?'模拟数据':'RPC 观测',summary,
  network:p.network,startedAt:p.startedAt,endedAt:p.endedAt,best:summary.latest?.best??null,finalized:summary.latest?.finalized??null,
  count:p.samples.length,dropped:p.droppedSamples,intervalMs:p.intervalMs,sha256:report.sha256};
}
export async function serializeReport(report:SessionReport):Promise<string>{
 const text=JSON.stringify(report);
 if(new TextEncoder().encode(text).byteLength>REPORT_BYTE_LIMIT)throw new Error('Report size limit: 16 MiB');
 await importReport(text);return text;
}
export async function importIntoState(text:string,previous:SessionReport|null):Promise<{report:SessionReport|null;mode:Mode;error:string|null}>{
 try{return {report:await importReport(text),mode:'offline',error:null};}
 catch(error){return {report:previous,mode:'offline',error:'导入失败：'+(error instanceof Error?error.message:'无效报告')};}
}
