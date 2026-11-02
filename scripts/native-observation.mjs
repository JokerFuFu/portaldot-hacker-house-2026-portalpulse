// Node-only, readonly native extrinsic observation. This is not a signer or probe receipt.
import {createHash} from 'node:crypto';
import {Metadata,TypeRegistry} from '@polkadot/types';
import {blake2AsHex} from '@polkadot/util-crypto';
import {validateNetworkConfig,endpointRedactor} from '../dist/core/config.js';

const MAINNET='0x83b5212c69f85f3996f8696bb35bf913af51b176a5f53d0a74fd3a83dc0b8a54';
const EVENTS_KEY='0x26aa394eea5630e07c48ae0c9558cef780d41e5e16056765bc8461851072c9d7';
const H256=/^0x[0-9a-fA-F]{64}$/;
class ObservationError extends Error {
  constructor(code,message){super(message);this.code=code;}
}
function bytes(value,max,label) {
  if(typeof value!=='string'||value.length<2||value.length>2+2*max||!/^0x(?:[0-9a-fA-F]{2})*$/.test(value)){
    throw new Error('Invalid or oversized '+label);
  }
  return Buffer.from(value.slice(2),'hex');
}
function compact(data) {
  const mode=data[0]&3;
  if(mode===0)return {value:data[0]>>>2,offset:1};
  if(mode===1&&data.length>=2){const n=data.readUInt16LE(0)>>>2;if(n>=64)return {value:n,offset:2};}
  if(mode===2&&data.length>=4){const n=data.readUInt32LE(0)>>>2;if(n>=16384)return {value:n,offset:4};}
  throw new Error('Noncanonical or oversized compact length');
}
function exactCodec(codec,raw,label) {
  if(!Buffer.from(codec.toU8a()).equals(raw))throw new Error('Noncanonical or trailing '+label);
  return codec;
}
function short(text,redact) {
  return redact(String(text)).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,512);
}
export async function collectNativeObservation(rpc,input,options) {
  const config=validateNetworkConfig(input);
  if(config.kind!=='event-testnet'||config.endpoint===null||config.expectedGenesis===null||config.expectedGenesis===MAINNET){
    throw new Error('Native observation requires an explicit event-testnet endpoint and non-mainnet expected genesis');
  }
  if(!options||typeof options!=='object'||Array.isArray(options)||
     Object.keys(options).some(k=>!['blockHash','transactionHash','signal'].includes(k))||
     !H256.test(options.blockHash)||!H256.test(options.transactionHash)){
    throw new Error('Expected blockHash and transactionHash as H256');
  }
  const blockHash=options.blockHash.toLowerCase(),transactionHash=options.transactionHash.toLowerCase();
  const redact=endpointRedactor(config.endpoint);
  const {endpoint,...publicConfig}=config;
  const result={
    nativeObservationVersion:1,origin:'rpc',mode:'readonly-native-observation',
    startedAt:new Date().toISOString(),endedAt:null,status:'unverified',
    network:{...publicConfig,observedGenesis:null},
    target:{blockHash,transactionHash},block:null,inclusion:null,dispatch:null,metadata:null,runtime:null,
    checks:{identity:{state:'unverified'},inclusion:{state:'unverified'},dispatch:{state:'unverified'}},
    verifiedNetwork:false,writeAllowed:false,fullVerification:false,finalityVerified:false,
    contractStateVerified:false,signerVerified:false,extrinsicsRootVerified:false,
    trust:'Single-RPC correlation only; no source authentication, consensus proof, caller/probe semantics, finality or contract state verification.',
    calls:[],error:null,
  };
  let stage='identity';
  async function request(method,params) {
    if(options.signal?.aborted)throw new Error('Request aborted');
    const call={method,observedAt:new Date().toISOString(),status:'collecting'};
    result.calls.push(call);
    const started=performance.now();
    try{
      const data=await rpc.request(method,params,options.signal);
      if(options.signal?.aborted)throw new Error('Request aborted');
      call.status='normal';return data;
    }catch(error){call.status='abnormal';throw error;}
    finally{call.durationMs=performance.now()-started;}
  }
  try{
    const observed=await request('chain_getBlockHash',[0]);
    if(typeof observed!=='string'||!H256.test(observed))throw new ObservationError('identity','Invalid observed genesis');
    result.network.observedGenesis=observed.toLowerCase();
    if(result.network.observedGenesis!==config.expectedGenesis){
      result.checks.identity={state:'abnormal'};
      throw new ObservationError('identity','Observed genesis does not match the selected event-testnet');
    }
    result.checks.identity={state:'normal'};
    stage='block';
    const response=await request('chain_getBlock',[blockHash]);
    if(response===null)return result;
    const block=response?.block;
    const header=block?.header;
    const headerKeys=['parentHash','number','stateRoot','extrinsicsRoot','digest'];
    if(!header||typeof header!=='object'||Object.keys(header).length!==5||headerKeys.some(k=>!Object.hasOwn(header,k))||
      !H256.test(header.parentHash)||!H256.test(header.stateRoot)||!H256.test(header.extrinsicsRoot)||
      typeof header.number!=='string'||!/^0x[0-9a-fA-F]{1,64}$/.test(header.number)||
      !header.digest||Object.keys(header.digest).length!==1||!Array.isArray(header.digest.logs)||header.digest.logs.length>512){
      throw new ObservationError('block','Malformed selected block header');
    }
    let headerBytes;
    try{
      const headerRegistry=new TypeRegistry();
      let size=0;
      for(const log of header.digest.logs){
        const raw=bytes(log,512*1024,'digest');size+=raw.length;
        exactCodec(headerRegistry.createType('DigestItem',raw),raw,'digest item');
      }
      if(size>512*1024)throw new Error('Digest size');
      headerBytes=headerRegistry.createType('Header',header).toU8a();
    }catch{throw new ObservationError('block','Invalid or oversized selected block header');}
    if(blake2AsHex(headerBytes,256)!==blockHash)throw new ObservationError('block','Selected header hash mismatch');
    if(BigInt(header.number)===0n)throw new ObservationError('block','Genesis block has no transaction execution context');
    if(!Array.isArray(block.extrinsics)||block.extrinsics.length>8192){
      throw new ObservationError('block','Invalid or oversized extrinsic list');
    }
    const hashes=[];let total=0;
    for(const extrinsic of block.extrinsics){
      const raw=bytes(extrinsic,512*1024,'extrinsic');
      if(!raw.length)throw new Error('Empty extrinsic');
      const {value,offset}=compact(raw);
      if(value<1||value!==raw.length-offset)throw new Error('Extrinsic length mismatch');
      total+=raw.length;if(total>512*1024)throw new Error('Extrinsic body size limit');
      hashes.push(blake2AsHex(raw,256));
    }
    result.block={hash:blockHash,number:BigInt(header.number).toString(),parentHash:header.parentHash.toLowerCase()};
    const matches=hashes.flatMap((hash,index)=>hash===transactionHash?[index]:[]);
    if(matches.length===0)return result;
    if(matches.length!==1)throw new ObservationError('block','Ambiguous transaction hash in selected block');
    const index=matches[0];
    result.inclusion={transactionHash,transactionIndex:index,transactionCount:hashes.length};
    result.checks.inclusion={state:'normal'};
    stage='runtime';
    const runtime=await request('state_getRuntimeVersion',[result.block.parentHash]);
    if(!runtime||typeof runtime.specName!=='string'||!runtime.specName.length||runtime.specName.length>128||
       !Number.isSafeInteger(runtime.specVersion)||runtime.specVersion<0||
       !Number.isSafeInteger(runtime.transactionVersion)||runtime.transactionVersion<0){
      throw new ObservationError('runtime','Invalid execution-time runtime version');
    }
    result.runtime={atBlockHash:result.block.parentHash,specName:short(runtime.specName,redact),specVersion:runtime.specVersion,transactionVersion:runtime.transactionVersion};
    stage='metadata';
    const rawMetadata=bytes(await request('state_getMetadata',[result.block.parentHash]),1024*1024,'metadata');
    let registry,metadata,eventType;
    try{
      registry=new TypeRegistry();
      metadata=exactCodec(new Metadata(registry,rawMetadata),rawMetadata,'metadata');
      if(![14,15].includes(Number(metadata.version)))throw new Error('Only portable metadata supported');
      registry.setMetadata(metadata);
      const system=metadata.asLatest.pallets.find(p=>p.name.toString()==='System');
      const storage=system?.storage.unwrapOr(null);
      const entry=storage?.items.find(x=>x.name.toString()==='Events');
      if(storage?.prefix.toString()!=='System'||!entry?.type.isPlain)throw new Error('System.Events plain storage required');
      eventType=registry.createLookupType(entry.type.asPlain);
    }catch{throw new ObservationError('metadata','Unable to decode exact portable parent metadata and System.Events type');}
    result.metadata={atBlockHash:result.block.parentHash,version:Number(metadata.version),bytes:rawMetadata.length,
      sha256:createHash('sha256').update(rawMetadata).digest('hex'),codecValidatedForSigning:false};
    stage='extrinsic';
    try{
      const rawTarget=bytes(block.extrinsics[index],512*1024,'target extrinsic');
      exactCodec(registry.createType('Extrinsic',rawTarget),rawTarget,'target extrinsic');
    }catch{throw new ObservationError('extrinsic','Unable to decode the exact target extrinsic with execution-time metadata');}
    stage='events';
    const storageHex=await request('state_getStorage',[EVENTS_KEY,blockHash]);
    if(storageHex===null)return result;
    let events;
    try{
      const raw=bytes(storageHex,512*1024,'events');
      if(!raw.length||compact(raw).value>8192)throw new Error('Events count limit');
      events=exactCodec(registry.createType(eventType,raw),raw,'events');
      if(!Array.isArray(events)||events.length>8192)throw new Error('Invalid event vector');
    }catch{throw new ObservationError('events','Unable to decode exact bounded System.Events bytes');}
    const outcomes=[];
    for(const record of events){
      if(!record.phase||!record.event)throw new ObservationError('events','Invalid EventRecord shape');
      if(!record.phase.isApplyExtrinsic)continue;
      const eventIndex=record.phase.asApplyExtrinsic.toNumber();
      if(eventIndex>=hashes.length)throw new ObservationError('events','Event phase index outside selected block');
      const event=record.event;
      if(eventIndex===index&&event.section==='system'&&['ExtrinsicSuccess','ExtrinsicFailed'].includes(event.method)){
        outcomes.push(event);
      }
    }
    if(outcomes.length===0)return result;
    if(outcomes.length!==1)throw new ObservationError('events','Conflicting or duplicate system outcome events');
    const event=outcomes[0],success=event.method==='ExtrinsicSuccess';
    let failureReason=null;
    if(!success){
      const error=event.data[0];
      if(!error)throw new ObservationError('events','Failure event lacks a dispatch error');
      if(error.isModule){
        try{const decoded=registry.findMetaError(error.asModule);failureReason=decoded.section+'.'+decoded.name;}
        catch{failureReason=error.toString();}
      }else{failureReason=error.toString();}
      failureReason=short(failureReason,redact);
    }
    result.dispatch={outcome:success?'success':'failure',systemEvent:event.method,transactionHash,blockHash,transactionIndex:index,failureReason};
    result.checks.dispatch={state:success?'normal':'abnormal'};
    result.status=success?'normal':'abnormal';
    return result;
  }catch(error){
    result.status='abnormal';
    result.error={code:error instanceof ObservationError?error.code:stage,message:short(error instanceof Error?error.message:'Observation failed',redact)};
    if(stage==='identity')result.checks.identity={state:'abnormal'};
    else if(stage==='block')result.checks.inclusion={state:'abnormal'};
    else result.checks.dispatch={state:'abnormal'};
    return result;
  }finally{result.endedAt=new Date().toISOString();}
}
