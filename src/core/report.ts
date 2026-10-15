import {canonical,digestBytes} from './integrity.js';
import {endpointRedactor, validateNetworkConfig} from './config.js';
import type {NetworkConfig,Sample,EvidenceOrigin,SessionReport,ReportPayload} from './types.js';
import {retainSamples} from './monitor.js';

const MAX_BYTES=16*1024*1024;
const statuses=['normal','abnormal','unverified','collecting'];
const origins=['rpc','simulated'];
type Obj=Record<string,unknown>;
function invalid(message:string):never {throw new Error(`Invalid report schema: ${message}`);}
function object(value:unknown,required:string[],optional:string[]=[]):Obj {
  if(!value||typeof value!=='object'||Array.isArray(value))invalid('expected object');
  const data=value as Obj,keys=Object.keys(data);
  if(required.some(key=>!Object.hasOwn(data,key))||keys.some(key=>!required.includes(key)&&!optional.includes(key)))invalid('missing or unknown fields');
  return data;
}
function string(value:unknown,max=512,allowEmpty=false):asserts value is string {
  if(typeof value!=='string'||(!allowEmpty&&value.length===0)||value.length>max)invalid('string limit');
}
function number(value:unknown,integer=false):asserts value is number {
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER||(integer&&!Number.isSafeInteger(value)))invalid('nonfinite or invalid number');
}
function choice(value:unknown,values:unknown[]):void {if(!values.includes(value))invalid('unsupported value');}
function hash(value:unknown):void {if(typeof value!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(value))invalid('hash');}
function date(value:unknown):number {
  if(typeof value!=='string')invalid('date');
  const time=Date.parse(value);
  if(!Number.isFinite(time)||new Date(time).toISOString()!==value)invalid('date');
  return time;
}
function array(value:unknown,max:number):unknown[] {
  if(!Array.isArray(value)||value.length>max)invalid('array limit');
  for(let index=0;index<value.length;index++)if(!Object.hasOwn(value,index))invalid('sparse array');
  return value;
}
function jsonValue(value:unknown,depth=0,budget={remaining:4096}):void {
  if(--budget.remaining<0||depth>8)invalid('result nesting or size limit');
  if(value===null||typeof value==='boolean')return;
  if(typeof value==='number'){if(!Number.isFinite(value))invalid('nonfinite result');return;}
  if(typeof value==='string'){if(value.length>512)invalid('result string limit');return;}
  if(Array.isArray(value)){array(value,512).forEach(item=>jsonValue(item,depth+1,budget));return;}
  if(value&&typeof value==='object'){
    if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)invalid('non-JSON result');
    const entries=Object.entries(value);if(entries.length>128)invalid('result object limit');
    for(const[key,item]of entries){string(key,128,true);jsonValue(item,depth+1,budget);}return;
  }
  invalid('non-JSON result');
}
function validateBlock(value:unknown):void {
  if(value===null)return;
  const b=object(value,['hash','number','parentHash']);hash(b.hash);hash(b.parentHash);
  if(typeof b.number!=='string'||! /^(0|[1-9][0-9]*)$/.test(b.number)||b.number.length>309)invalid('height');
}
function validateIdentity(value:unknown,expected:unknown):void {
  const i=object(value,['state','expectedGenesis','genesisHash','chainName','runtime','declaredMethods','metadataVerified','reason','writeAllowed']);
  choice(i.state,statuses);string(i.reason);
  if(i.writeAllowed!==false||typeof i.metadataVerified!=='boolean')invalid('identity flags');
  for(const key of ['expectedGenesis','genesisHash'])if(i[key]!==null)hash(i[key]);
  if(i.expectedGenesis!==expected)invalid('genesis config changed');
  if(i.chainName!==null)string(i.chainName,256);
  array(i.declaredMethods,512).forEach(method=>string(method,128));
  if(i.runtime!==null){
    const r=object(i.runtime,['specName','specVersion','transactionVersion','metadataVersion']);
    string(r.specName,128);number(r.specVersion,true);number(r.transactionVersion,true);
    if(r.metadataVersion!==null){number(r.metadataVersion,true);if(r.metadataVersion>255)invalid('metadata version');}
  }
  // Legitimate partial snapshots may retain failed validation results and unsupported metadata versions.
  if(i.state==='normal'){
    const r=i.runtime as Obj|null;
    if(i.expectedGenesis===null||i.genesisHash===null||String(i.expectedGenesis).toLowerCase()!==String(i.genesisHash).toLowerCase()||
      i.chainName===null||r===null||i.metadataVerified!==true||![13,14,15,16].includes(r.metadataVersion as number))invalid('normal identity lacks verified evidence');
  }
}
function validateRpc(value:unknown,observed:number,previous:number):void {
  const r=object(value,['method','params','startedAt','durationMs','status'],['result','error']);
  string(r.method,128);array(r.params,32);jsonValue(r.params);
  const started=date(r.startedAt);number(r.durationMs);
  // Wall clock dates have millisecond precision; performance durations retain fractions.
  if(started<previous||started>observed||started+r.durationMs>observed+1)invalid('RPC time exceeds observation');
  choice(r.status,['normal','abnormal']);
  if(r.status==='normal'&&(!Object.hasOwn(r,'result')||Object.hasOwn(r,'error')))invalid('normal RPC evidence');
  if(r.status==='abnormal'&&!Object.hasOwn(r,'error'))invalid('abnormal RPC requires error');
  if(Object.hasOwn(r,'result'))jsonValue(r.result);
  if(Object.hasOwn(r,'error')){const e=object(r.error,['code','message']);string(e.code,64);string(e.message,512,true);}
}
function validatePayload(value:unknown):asserts value is ReportPayload {
  const p=object(value,['origin','network','intervalMs','startedAt','endedAt','droppedSamples','samples']);
  choice(p.origin,origins);number(p.intervalMs);if(p.intervalMs===0)invalid('interval');number(p.droppedSamples,true);
  const n=object(p.network,['id','name','source','endpointAlias','kind','expectedGenesis']);
  string(n.id,128);string(n.name,256);string(n.source,512);string(n.endpointAlias,128);
  choice(n.kind,['event-testnet','mainnet-readonly','custom-readonly']);if(n.expectedGenesis!==null)hash(n.expectedGenesis);
  const samples=array(p.samples,2000);if(!samples.length)invalid('empty session');
  const start=date(p.startedAt),end=date(p.endedAt);let previous=-Infinity;
  for(const value of samples){
    const s=object(value,['observedAt','endpointAlias','configId','origin','identity','best','finalized','rpc']);
    const observed=date(s.observedAt);if(observed<previous)invalid('sample time order');
    if(s.configId!==n.id||s.endpointAlias!==n.endpointAlias||s.origin!==p.origin)invalid('sample origin or configuration changed');
    validateIdentity(s.identity,n.expectedGenesis);validateBlock(s.best);validateBlock(s.finalized);
    array(s.rpc,64).forEach(record=>validateRpc(record,observed,previous));
    previous=observed;
  }
  if(start!==date((samples[0] as Obj).observedAt)||end!==date((samples.at(-1) as Obj).observedAt))invalid('session start/end mismatch');
}
async function digest(payload:ReportPayload):Promise<string> {
  const bytes=new TextEncoder().encode(canonical(payload));
  if(bytes.byteLength>MAX_BYTES)invalid('report size limit');
  return digestBytes(bytes);
}
function redact(value: unknown, redactText: (text: string) => string, depth = 0): unknown {
  if (depth > 16) invalid('redaction nesting limit');
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) {
    array(value, Number.MAX_SAFE_INTEGER);
    return value.map(item => redact(item, redactText, depth + 1));
  }
  if (value && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      invalid('non-JSON evidence');
    }
    const entries = Object.entries(value).map(([key, item]) =>
      [redactText(key), redact(item, redactText, depth + 1)] as const);
    if (new Set(entries.map(([key]) => key)).size !== entries.length) {
      invalid('redacted result keys collide');
    }
    return Object.fromEntries(entries);
  }
  return value;
}

// Count the complete compact UTF-8 envelope, including digest and separators.
// Each sample is serialized once; evictions only remeasure the small envelope.
function retainReportBytes(payload: ReportPayload): void {
  const encoder = new TextEncoder();
  const samples = payload.samples;
  const sizes = samples.map(sample => encoder.encode(JSON.stringify(sample)).byteLength);
  let sampleBytes = sizes.reduce((total, size) => total + size, 0);
  let first = 0;
  while (first < samples.length) {
    payload.startedAt = samples[first]!.observedAt;
    const envelope = {schemaVersion: 1, payload: {...payload, samples: []}, sha256: '0'.repeat(64)};
    const bytes = encoder.encode(JSON.stringify(envelope)).byteLength +
      sampleBytes + samples.length - first - 1;
    if (bytes <= MAX_BYTES) {
      payload.samples = samples.slice(first);
      return;
    }
    sampleBytes -= sizes[first]!;
    first++;
    payload.droppedSamples++;
  }
  invalid('single sample exceeds report size limit');
}

export async function createReport(
  config: NetworkConfig,
  samples: Sample[],
  options: {origin?: EvidenceOrigin; intervalMs?: number; droppedSamples?: number} = {},
): Promise<SessionReport> {
  const {endpoint, ...network} = validateNetworkConfig(config);
  number(options.droppedSamples ?? 0, true);
  array(samples, Number.MAX_SAFE_INTEGER);
  const retained = retainSamples(samples);
  const clean = redact(retained.samples, endpointRedactor(endpoint)) as Sample[];
  const payload: ReportPayload = {
    origin: options.origin ?? clean[0]?.origin ?? 'rpc',
    network,
    intervalMs: options.intervalMs ?? 10000,
    startedAt: clean[0]?.observedAt ?? '',
    endedAt: clean.at(-1)?.observedAt ?? '',
    droppedSamples: (options.droppedSamples ?? 0) + retained.dropped,
    samples: clean,
  };
  // Reject invalid evidence before retention or JSON serialization can hide it.
  validatePayload(payload);
  retainReportBytes(payload);
  number(payload.droppedSamples, true);
  const report: SessionReport = {schemaVersion: 1, payload, sha256: await digest(payload)};
  if (new TextEncoder().encode(JSON.stringify(report)).byteLength > MAX_BYTES) {
    invalid('report size limit');
  }
  return report;
}

export async function importReport(text:string):Promise<SessionReport> {
  if(typeof text!=='string'||text.length>MAX_BYTES||new TextEncoder().encode(text).byteLength>MAX_BYTES)invalid('report size limit');
  let parsed:unknown;try{parsed=JSON.parse(text);}catch{invalid('JSON');}
  const report=object(parsed,['schemaVersion','payload','sha256']);
  if(report.schemaVersion!==1)invalid('unsupported schema version');
  if(typeof report.sha256!=='string'||! /^[0-9a-f]{64}$/.test(report.sha256))invalid('digest');
  validatePayload(report.payload);
  if(await digest(report.payload)!==report.sha256)throw new Error('Report digest integrity mismatch');
  // Imported evidence retains its collection time/origin, and proves no current liveness or provenance.
  return report as unknown as SessionReport;
}
