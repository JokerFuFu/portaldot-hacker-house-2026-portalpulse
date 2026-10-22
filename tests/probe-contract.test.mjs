import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createEVM} from '@ethereumjs/evm';
import {Account,bytesToHex,createAddressFromString,hexToBytes} from '@ethereumjs/util';

const A=createAddressFromString('0x1111111111111111111111111111111111111111');
const B=createAddressFromString('0x2222222222222222222222222222222222222222');
const word=value=>BigInt(value).toString(16).padStart(64,'0');
let cachedArtifact;

async function compiler(){
  let feature;
  try{feature=await import('../scripts/probe-compiler.mjs');}
  catch(error){assert.fail(`Probe compiler feature is missing: ${error.code??error.message}`);}
  assert.equal(typeof feature.compileProbe,'function');
  return feature.compileProbe;
}
async function artifact(){
  if(!cachedArtifact){
    const compile=await compiler();
    const source=await readFile(new URL('../contracts/PortalPulseProbe.sol',import.meta.url),'utf8');
    cachedArtifact=compile(source);
  }
  return cachedArtifact;
}
async function fixture(){
  const compiled=await artifact();
  const evm=await createEVM();
  for(const caller of [A,B])await evm.stateManager.putAccount(caller,new Account(0n,10n**18n));
  const deployment=await evm.runCall({caller:A,data:hexToBytes(compiled.creationBytecode),gasLimit:2_000_000n});
  assert.equal(deployment.execResult.exceptionError,undefined,'compiled constructor must execute');
  assert.ok(deployment.createdAddress,'constructor must create a contract');
  const to=deployment.createdAddress;
  const call=(caller,data,value=0n)=>evm.runCall({caller,to,data:hexToBytes(data),value,gasLimit:1_000_000n});
  const record=(caller,sequence,value=0n)=>call(caller,'0x'+compiled.methodIdentifiers['record(uint64)']+word(sequence),value);
  const get=async caller=>{
    const result=await call(A,'0x'+compiled.methodIdentifiers['sequenceOf(address)']+caller.toString().slice(2).padStart(64,'0'));
    assert.equal(result.execResult.exceptionError,undefined,'public sequence getter must execute');
    assert.equal(result.execResult.returnValue.length,32,'getter must return one uint64 ABI word');
    return BigInt(bytesToHex(result.execResult.returnValue));
  };
  return {compiled,evm,to,call,record,get};
}

// These tests execute real compiled bytecode in a local EVM, never a network or user wallet.
test('probe constructor installs its runtime and a fresh caller reads zero',async()=>{
  const f=await fixture();
  assert.equal(bytesToHex(await f.evm.stateManager.getCode(f.to)),f.compiled.runtimeBytecode);
  assert.equal(await f.get(A),0n);
});

test('probe records and reads the caller sequence',async()=>{
  const f=await fixture();
  assert.equal((await f.record(A,1n)).execResult.exceptionError,undefined);
  assert.equal(await f.get(A),1n);
});

test('a second caller cannot overwrite the first caller sequence',async()=>{
  const f=await fixture();
  await f.record(A,1n);
  assert.equal((await f.record(B,7n)).execResult.exceptionError,undefined);
  assert.equal(await f.get(A),1n);
  assert.equal(await f.get(B),7n);
});

test('probe preserves uint64 precision including zero, above Number range and maximum',async()=>{
  const f=await fixture();
  for(const value of [9007199254740993n,18446744073709551615n,0n]){
    assert.equal((await f.record(A,value)).execResult.exceptionError,undefined);
    assert.equal(await f.get(A),value);
  }
});

test('uint64 overflow calldata reverts without changing caller state',async()=>{
  const f=await fixture();
  await f.record(A,1n);
  const result=await f.record(A,18446744073709551616n);
  assert.ok(result.execResult.exceptionError,'ABI must reject a value outside uint64');
  assert.equal(await f.get(A),1n);
});

test('probe event identifies the exact caller, sequence and emitting contract',async()=>{
  const f=await fixture();
  const result=await f.record(B,9007199254740993n);
  assert.equal(result.execResult.exceptionError,undefined);
  assert.equal(result.execResult.logs.length,1);
  const [emitter,topics,data]=result.execResult.logs[0];
  assert.equal(bytesToHex(emitter),f.to.toString());
  assert.equal(topics.length,2);
  assert.match(f.compiled.eventSelectors.SequenceRecorded,/^0x[0-9a-f]{64}$/);
  assert.equal(bytesToHex(topics[0]),f.compiled.eventSelectors.SequenceRecorded);
  assert.equal(bytesToHex(topics[1]),'0x'+B.toString().slice(2).padStart(64,'0'));
  assert.equal(bytesToHex(data),'0x'+word(9007199254740993n));
});

test('value-bearing record calls revert and retain no assets or sequence update',async()=>{
  const f=await fixture();
  const result=await f.record(A,1n,1n);
  assert.ok(result.execResult.exceptionError,'probe is not payable');
  assert.equal(await f.get(A),0n);
  assert.equal((await f.evm.stateManager.getAccount(f.to)).balance,0n);
});

test('unknown calls revert instead of invoking an asset-handling fallback',async()=>{
  const f=await fixture();
  assert.ok((await f.call(A,'0xffffffff')).execResult.exceptionError);
  assert.equal(await f.get(A),0n);
});

test('compiler rejects actual Solidity errors instead of returning an artifact',async()=>{
  const compile=await compiler();
  assert.throws(()=>compile('pragma solidity 0.8.24; contract Broken { this is not Solidity; }'),/compil|parser|error/i);
});
