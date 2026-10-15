import {validateExecutionEvidence} from './execution.js';
import type {ExecutionEvidence} from './execution.js';
import {canonical,digestBytes} from './integrity.js';

export interface ExecutionReport {
  executionReportVersion:1;
  payload:ExecutionEvidence;
  sha256:string;
}
const MAX_BYTES=1024*1024;
function invalid(field:string):never {throw new Error('Invalid execution report: '+field);}
function payloadBytes(payload:ExecutionEvidence):Uint8Array<ArrayBuffer> {
  // The complete compact envelope is bounded; execution facts are never evicted.
  const envelope={executionReportVersion:1,payload,sha256:'0'.repeat(64)};
  if(new TextEncoder().encode(JSON.stringify(envelope)).byteLength>MAX_BYTES)invalid('size exceeds 1 MiB');
  return new TextEncoder().encode(canonical(payload));
}
export async function createExecutionReport(value:unknown):Promise<ExecutionReport> {
  // Capture every nested fact before the first await, without serializing unknown input.
  const payload=validateExecutionEvidence(value);
  const bytes=payloadBytes(payload);
  return {executionReportVersion:1,payload,sha256:await digestBytes(bytes)};
}
export async function importExecutionReport(text:string):Promise<ExecutionReport> {
  if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>MAX_BYTES)invalid('input exceeds 1 MiB');
  let value:unknown;
  try {value=JSON.parse(text);}catch{invalid('JSON');}
  if(!value||typeof value!=='object'||Array.isArray(value))invalid('envelope');
  const report=value as Record<string,unknown>;
  const keys=Object.keys(report);
  if(keys.length!==3||!['executionReportVersion','payload','sha256'].every(key=>Object.hasOwn(report,key)))invalid('envelope fields');
  if(report.executionReportVersion!==1)invalid('unsupported version');
  const sha256=report.sha256;
  if(typeof sha256!=='string'||!/^[0-9a-f]{64}$/.test(sha256))invalid('digest');
  const payload=validateExecutionEvidence(report.payload);
  // Parsed JSON is safe to serialize; validation must not erase changed field values.
  if(canonical(report.payload)!==canonical(payload))invalid('noncanonical payload values');
  if(await digestBytes(payloadBytes(payload))!==sha256)throw new Error('Execution report digest integrity mismatch');
  // Integrity says nothing about source authenticity; consumers must evaluate these facts.
  return {executionReportVersion:1,payload,sha256};
}
