import assert from 'node:assert/strict';
import {test} from 'node:test';
import {blake2AsHex, keccakAsHex} from '@polkadot/util-crypto';
import {probeFixture, contract, expectedSequence, runtimeBytecode, evmEndpoint, word, callerWord, event, hash} from './helpers/probe-fixture.mjs';
import {collectProbeObservation} from '../scripts/probe-observation.mjs';
import {createExecutionReport, importExecutionReport} from '../dist/core/execution-report.js';
import {evaluateExecutionEvidence} from '../dist/core/execution.js';

function setup(...args) {
  const f = probeFixture(...args);
  return {...f, run: overrides => collectProbeObservation(f.rpc, f.evm, f.config, {...f.options, ...overrides})};
}

test('matches the probe event and exports a replayable report with pinned uint64 state', async () => {
  const f = setup();
  const result = await f.run();
  assert.equal(result.status, 'normal');
  assert.equal(result.evidence.execution.outcome, 'success');
  assert.deepEqual(result.evidence.finality.ancestry.map(b => b.hash), [f.headHash, f.blockHash]);
  assert.equal(result.evidence.readback.blockHash, f.headHash);
  assert.equal(result.evidence.readback.sequence, expectedSequence);
  assert.deepEqual(f.evmCalls.filter(x => x.method === 'eth_getCode').map(x => x.params),
    [f.evmIncluded, f.evmFinalized].map(b => [contract, {blockHash: b.hash, requireCanonical: true}]));
  const [call, selector] = f.evmCalls.find(x => x.method === 'eth_call').params;
  assert.equal(call.to, contract);
  assert.equal(call.data, keccakAsHex('sequenceOf(address)').slice(0, 10) + callerWord.slice(2));
  assert.deepEqual(selector, {blockHash: f.evmFinalized.hash, requireCanonical: true});
  const report = await createExecutionReport(result.evidence);
  const replay = evaluateExecutionEvidence((await importExecutionReport(JSON.stringify(report))).payload);
  assert.equal(replay.evidenceComplete, true);
  assert.equal(replay.mode, 'offline');
  for (const key of ['fullVerification', 'verifiedNetwork', 'writeAllowed']) assert.equal(replay[key], false);
  assert.ok(!JSON.stringify(result).includes(evmEndpoint));
});

test('keeps a missing submission time unverified after a matching state read', async () => {
  const result = await setup().run({submittedAt: undefined});
  assert.equal(result.evidence.submitted, null);
  assert.equal(result.evidence.readback.sequence, expectedSequence);
  assert.equal(result.status, 'unverified');
});

for (const [label, events] of [
  ['wrong phase', [{...event, index: 0}]],
  ['different contract', [{...event, contract: '0x' + '37'.repeat(20)}]],
]) test(label + ' supplies no probe execution or readback', async () => {
  const f = setup(events);
  const result = await f.run();
  assert.equal(result.status, 'unverified');
  assert.equal(result.evidence.execution, null);
  assert.equal(result.evidence.readback, null);
  assert.equal(f.evmCalls.length, 0);
});

for (const [label, events] of [
  ['wrong caller', [{...event, topics: [event.topics[0], word(2)]}]],
  ['wrong sequence', [{...event, data: word(9)}]],
  ['noncanonical word', [{...event, data: '0x0100'}]],
  ['duplicate matching events', [event, event]],
]) test(label + ' cannot pass as successful execution', async () => {
  const f = setup(events);
  const result = await f.run();
  assert.equal(result.status, 'abnormal');
  assert.equal(result.evidence.execution, null);
  assert.equal(result.diagnostics.probeEvent.state, 'abnormal');
  assert.equal(f.evmCalls.length, 0);
});

test('an exact-phase EVM revert overrides system success and a probe log', async () => {
  const f = setup([event, {index: 1, revert: true}]);
  const result = await f.run();
  assert.equal(result.status, 'abnormal');
  assert.equal(result.evidence.execution.outcome, 'failure');
  assert.equal(f.evmCalls.length, 0);
});

test('preserves system dispatch failure even with a matching probe log', async () => {
  const f = setup([event], [{index: 1, success: false}]);
  const result = await f.run();
  assert.equal(result.status, 'abnormal');
  assert.equal(result.evidence.execution.outcome, 'failure');
  assert.equal(f.evmCalls.length, 0);
});

for (const [label, height, expected] of [
  ['finalized head below inclusion', '0x9', 'unverified'],
  ['finalized head outside bounded window', '0x2b', 'unverified'],
  ['equal-height conflicting fork', '0xa', 'abnormal'],
  ['parent height discontinuity', '0xc', 'abnormal'],
]) test(label + ' keeps finality and state empty', async () => {
  const f = setup();
  const header = {...f.headHeader, number: height};
  const h = blake2AsHex(f.registry.createType('Header', header).toU8a(), 256);
  f.replies.chain_getFinalizedHead = () => h;
  f.replies.chain_getHeader = () => header;
  const result = await f.run();
  assert.equal(result.status, expected);
  assert.equal(result.evidence.finality, null);
  assert.equal(result.evidence.readback, null);
  assert.equal(f.evmCalls.length, 0);
});

test('rejects a finalized header whose bytes hash to a different block', async () => {
  const f = setup();
  f.replies.chain_getHeader = () => ({...f.headHeader, stateRoot: hash('e3')});
  const result = await f.run();
  assert.equal(result.status, 'abnormal');
  assert.equal(result.evidence.finality, null);
});

test('rejects different EVM chain ID before the cross-domain lookup', async () => {
  const f = setup();
  f.evmReplies.eth_chainId = () => '0x1';
  const result = await f.run();
  assert.equal(result.status, 'abnormal');
  assert.equal(result.evidence.readback, null);
  assert.deepEqual(f.evmCalls.map(x => x.method), ['eth_chainId']);
});

test('rejects contradictory EVM hash at the same finalized height', async () => {
  const f = setup();
  f.evmReplies.eth_getBlockByNumber = ([height]) =>
    height === '0xb' ? {hash: hash('cd'), number: '0xb'} : f.evmIncluded;
  const result = await f.run();
  assert.equal(result.status, 'abnormal');
  assert.equal(result.evidence.readback, null);
  assert.ok(!f.evmCalls.some(x => x.method === 'eth_call'));
});

for (const [label, code, expected] of [['empty', '0x', 'unverified'], ['unexpected', '0x61', 'abnormal']]) {
  test(label + ' runtime at finalized anchor prevents state attribution', async () => {
    const f = setup();
    f.evmReplies.eth_getCode = ([, anchor]) => anchor.blockHash === f.evmFinalized.hash ? code : runtimeBytecode;
    const result = await f.run();
    assert.equal(result.status, expected);
    assert.equal(result.evidence.readback, null);
    assert.ok(!f.evmCalls.some(x => x.method === 'eth_call'));
  });
}

test('retains a real mismatch without converting the returned state to the intended value', async () => {
  const f = setup();
  f.evmReplies.eth_call = () => word(7);
  const result = await f.run();
  assert.equal(result.status, 'abnormal');
  assert.equal(result.evidence.readback.sequence, '7');
  assert.equal(evaluateExecutionEvidence(result.evidence).checks.state.state, 'abnormal');
});

test('bad ABI word and transport error remain separately diagnosable', async () => {
  const f = setup();
  f.evmReplies.eth_call = () => word(2n ** 64n);
  const malformed = await f.run();
  assert.equal(malformed.status, 'abnormal');
  assert.equal(malformed.evidence.readback, null);
  f.evmReplies.eth_call = () => {throw Error('refused ' + evmEndpoint);};
  const unavailable = await f.run();
  assert.equal(unavailable.status, 'abnormal');
  assert.equal(unavailable.evidence.readback, null);
  assert.ok(!JSON.stringify(unavailable).includes(evmEndpoint));
});

test('refuses future submission timestamp and malformed intent before RPC', async () => {
  const f = setup();
  await assert.rejects(f.run({submittedAt: '2099-01-01T00:00:00.000Z'}), /submission/i);
  await assert.rejects(f.run({expectedSequence: '18446744073709551616'}), /uint64/i);
  assert.equal(f.calls.length, 0);
});

test('rejects one EVM block hash reused across distinct native heights before code reads', async () => {
  const f = setup();
  const duplicate = {...f.evmFinalized, hash: f.evmIncluded.hash};
  f.evmReplies.eth_getBlockByHash = ([h]) => h === f.blockHash ? f.evmIncluded : duplicate;
  f.evmReplies.eth_getBlockByNumber = ([n]) => n === '0xa' ? f.evmIncluded : duplicate;
  const result = await f.run();
  assert.equal(result.status, 'abnormal');
  assert.equal(result.evidence.readback, null);
  assert.ok(!f.evmCalls.some(call => call.method === 'eth_getCode' || call.method === 'eth_call'));
});

test('does not copy arbitrary runtime labels echoed by the provider into probe diagnostics', async () => {
  const f = setup();
  f.replies.state_getRuntimeVersion = () => ({...f.runtime, specName: evmEndpoint});
  const result = await f.run();
  assert.equal(result.status, 'normal');
  assert.ok(!JSON.stringify(result).includes(evmEndpoint));
  assert.equal(result.diagnostics.native.runtime.specVersion, f.runtime.specVersion);
});
