import {createExecutionReport,importExecutionReport} from '../core/execution-report.js';
import type {ExecutionReport} from '../core/execution-report.js';
import {evaluateExecutionEvidence,parseExecutionEvidence} from '../core/execution.js';

export type ExecutionInputKind='raw'|'report'|'simulated';

export async function readExecutionInput(text:string):Promise<{report:ExecutionReport;inputKind:'raw'|'report'}> {
 if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>1048576)
  throw new Error('执行输入超过1MiB或不是文本');
 const value:unknown=JSON.parse(text);
 if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,'executionReportVersion'))
  return {report:await importExecutionReport(text),inputKind:'report'};
 return {report:await createExecutionReport(parseExecutionEvidence(text)),inputKind:'raw'};
}

export async function serializeExecutionReport(report:ExecutionReport):Promise<string> {
 const text=JSON.stringify(report);
 await importExecutionReport(text);
 return text;
}

export function makeExecutionViewModel(report:ExecutionReport,inputKind:ExecutionInputKind) {
 return {
  summary:evaluateExecutionEvidence(report.payload),
  modeLabel:'离线执行复核',
  originLabel:report.payload.origin==='simulated'?'模拟数据':'RPC 来源（真实性未验证）',
  inputLabel:inputKind==='simulated'?'固定人工示例':inputKind==='report'?'执行报告 JSON':'原始执行证据 JSON',
  sha256:report.sha256,
 };
}
