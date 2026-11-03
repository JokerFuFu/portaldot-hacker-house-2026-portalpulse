// Node-only RPC observation. The exported report retains the existing offline evidence semantics.
import {keccakAsHex} from '@polkadot/util-crypto';
import {validateNetworkConfig} from '../dist/core/config.js';
import {evaluateExecutionEvidence, validateExecutionEvidence} from '../dist/core/execution.js';
import {collectNativeProbeObservation} from './native-observation.mjs';
import {exactNativeHeader, H256} from './native-header.mjs';
import {H160, uint64Word, UINT64_MAX} from './probe-event.mjs';

const V3_GENESIS = '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
const V3_CHAIN_ID = '0x190f1ca9';
const MAX_PARENT_EDGES = 32n;
const GETTER = keccakAsHex('sequenceOf(address)').slice(0, 10);
const now = () => new Date().toISOString();
const validHash = value => typeof value === 'string' && H256.test(value);
const quantity = number => '0x' + BigInt(number).toString(16);
const unverified = reason => ({state: 'unverified', reason});
const abnormal = reason => ({state: 'abnormal', reason});
const normal = reason => ({state: 'normal', reason});
const unreachable = label => abnormal(label + ' request or validation failed');

function createInputs(input, options, startedAt) {
  const config = validateNetworkConfig(input);
  if (config.kind !== 'event-testnet' || !config.endpoint || config.expectedGenesis !== V3_GENESIS) {
    throw new Error('Probe observation requires the official V3 genesis in an explicit event-testnet profile');
  }
  if (typeof options.evmEndpoint !== 'string' || !options.evmEndpoint) throw new Error('Explicit EVM endpoint required');
  // Validate both endpoint strings against the labels copied to the public evidence.
  validateNetworkConfig({...config, endpoint: options.evmEndpoint});
  const {endpoint, ...network} = config;
  const {contract, caller, expectedSequence, submittedAt, runtimeBytecode, blockHash, transactionHash} = options;
  if (!validHash(blockHash) || !validHash(transactionHash)) throw new Error('Expected native block and transaction H256');
  if (![contract, caller].every(v => typeof v === 'string' && H160.test(v))) throw new Error('Expected contract and caller H160');
  if (typeof expectedSequence !== 'string' || !/^(0|[1-9][0-9]{0,19})$/.test(expectedSequence) ||
      BigInt(expectedSequence) > UINT64_MAX) throw new Error('Expected canonical uint64 decimal sequence');
  if (typeof runtimeBytecode !== 'string' || runtimeBytecode.length > 49154 ||
      !/^0x(?:[0-9a-f]{2})+$/i.test(runtimeBytecode)) throw new Error('Expected compiled probe runtime bytecode');
  if (submittedAt !== undefined &&
      (typeof submittedAt !== 'string' || !Number.isFinite(Date.parse(submittedAt)) ||
       new Date(submittedAt).toISOString() !== submittedAt || submittedAt > startedAt)) {
    throw new Error('Invalid participant submission observation timestamp');
  }
  const intent = {vm: 'revive', contract: contract.toLowerCase(), caller: caller.toLowerCase(), expectedSequence};
  const evidence = validateExecutionEvidence({
    executionSchemaVersion: 1, origin: 'rpc', network: {...network, observedGenesis: null}, intent,
    submitted: submittedAt === undefined ? null : {transactionHash: transactionHash.toLowerCase(), observedAt: submittedAt},
    inclusion: null, execution: null, finality: null, readback: null,
  });
  return {config, evidence, intent, runtimeBytecode: runtimeBytecode.toLowerCase()};
}

async function collectFinality(request, inclusion, observedGenesis, diagnostics) {
  const head = await request('native', 'chain_getFinalizedHead', []);
  if (head === null) return unverified('RPC finalized head absent');
  if (!validHash(head)) return abnormal('Invalid RPC finalized head hash');
  const headHash = head.toLowerCase();
  const readHeader = async hash => {
    const raw = await request('native', 'chain_getHeader', [hash]);
    return raw === null ? null : exactNativeHeader(raw, hash);
  };
  const finalized = headHash === inclusion.hash ? inclusion : await readHeader(headHash);
  if (!finalized) return unverified('RPC finalized header unavailable');
  diagnostics.finalizedHead = finalized;
  const gap = BigInt(finalized.number) - BigInt(inclusion.number);
  if (gap < 0n) return unverified('RPC finalized head below inclusion');
  if (gap > MAX_PARENT_EDGES) return unverified('Inclusion outside the 32-parent-edge observation window');

  const ancestry = [finalized];
  let current = finalized;
  while (BigInt(current.number) > BigInt(inclusion.number)) {
    const parent = current.parentHash === inclusion.hash ? inclusion : await readHeader(current.parentHash);
    if (!parent) return unverified('Parent header unavailable');
    if (BigInt(parent.number) !== BigInt(current.number) - 1n) return abnormal('Native parent height discontinuity');
    ancestry.push(parent);
    current = parent;
  }
  if (current.hash !== inclusion.hash) return abnormal('RPC finalized ancestry does not contain the selected inclusion');
  return {
    ...normal('Exact native header path from the RPC finalized head to inclusion'),
    fact: {genesisHash: observedGenesis, finalized, ancestry, observedAt: now()},
  };
}

async function mapEvmAnchor(request, block) {
  const byNative = await request('evm', 'eth_getBlockByHash', [block.hash, false]);
  const byNumber = await request('evm', 'eth_getBlockByNumber', [quantity(block.number), false]);
  if (byNative === null || byNumber === null) return unverified('EVM block mapping unavailable');
  if (!validHash(byNative?.hash) || !validHash(byNumber?.hash) ||
      byNative.hash.toLowerCase() !== byNumber.hash.toLowerCase() ||
      byNative.number !== quantity(block.number) || byNumber.number !== quantity(block.number)) {
    return abnormal('Native alias and EVM height resolve to conflicting blocks');
  }
  return {state: 'normal', hash: byNative.hash.toLowerCase()};
}

export async function collectProbeObservation(nativeRpc, evmRpc, input, options) {
  const startedAt = now();
  const {config, evidence, intent, runtimeBytecode} = createInputs(input, options, startedAt);
  const diagnostics = {
    startedAt, endedAt: null, calls: [], native: null, finalizedHead: null, evmAnchors: [],
    probeEvent: unverified('Native probe event unavailable'),
    finality: unverified('Inclusion evidence unavailable'),
    state: unverified('Probe execution and finality required'),
  };
  const request = async (domain, method, params) => {
    const call = {domain, method, observedAt: now(), durationMs: 0, status: 'collecting'};
    diagnostics.calls.push(call);
    const start = performance.now();
    try {
      options.signal?.throwIfAborted();
      const response = await (domain === 'native' ? nativeRpc : evmRpc).request(method, params, options.signal);
      options.signal?.throwIfAborted();
      call.status = 'normal';
      return response;
    } catch (error) {
      call.status = 'abnormal';
      throw error;
    } finally {
      call.durationMs = performance.now() - start;
    }
  };
  const finish = () => {
    diagnostics.endedAt = now();
    const summary = evaluateExecutionEvidence(evidence);
    const states = [diagnostics.native?.status, diagnostics.probeEvent.state, diagnostics.finality.state, diagnostics.state.state];
    const status = summary.status === 'abnormal' || states.includes('abnormal') ? 'abnormal' : summary.status;
    return {status, evidence, summary, diagnostics};
  };
  const native = await collectNativeProbeObservation(
    {request: (method, params) => request('native', method, params)},
    config, {blockHash: options.blockHash, transactionHash: options.transactionHash, signal: options.signal}, intent,
  );
  const runtime = native.runtime ? {
    atBlockHash: native.runtime.atBlockHash,
    specVersion: native.runtime.specVersion,
    transactionVersion: native.runtime.transactionVersion,
  } : null;
  diagnostics.native = {
    status: native.status, errorCode: native.error?.code ?? null, runtime, metadata: native.metadata,
  };
  evidence.network.observedGenesis = native.network.observedGenesis;
  if (!native.inclusion || !native.block) return finish();
  const {transactionHash, transactionIndex} = native.inclusion;
  evidence.inclusion = {
    transactionHash, transactionIndex, block: native.block, transactions: native.transactions,
    observedAt: native.endedAt,
  };
  diagnostics.probeEvent = native.probeEvent ?? diagnostics.probeEvent;
  const execution = (outcome, failureReason) => ({
    transactionHash, transactionIndex, blockHash: native.block.hash, outcome, failureReason, observedAt: native.endedAt,
  });
  if (native.dispatch?.outcome === 'failure') {
    // Persist only the classified reason. Provider-controlled text may contain endpoints or secrets.
    evidence.execution = execution('failure', 'System.ExtrinsicFailed at the target phase');
  } else if (native.probeEvent?.reverted) {
    evidence.execution = execution('failure', native.probeEvent.reason);
  }
  try {
    const {fact, ...verdict} = await collectFinality(request, native.block, native.network.observedGenesis, diagnostics);
    diagnostics.finality = verdict;
    evidence.finality = fact ?? null;
  } catch {
    diagnostics.finality = unreachable('Native finality');
  }
  if (native.dispatch?.outcome !== 'success' || diagnostics.probeEvent.state !== 'normal' || !evidence.finality) return finish();

  try {
    const chainId = await request('evm', 'eth_chainId', []);
    if (chainId !== V3_CHAIN_ID) {
      diagnostics.state = abnormal('EVM chain ID differs from official V3');
      return finish();
    }
    const blocks = [native.block];
    if (native.block.hash !== evidence.finality.finalized.hash) blocks.push(evidence.finality.finalized);
    for (const block of blocks) {
      const mapping = await mapEvmAnchor(request, block);
      if (mapping.state !== 'normal') {
        diagnostics.state = mapping;
        return finish();
      }
      if (diagnostics.evmAnchors.some(anchor => anchor.evmHash === mapping.hash)) {
        diagnostics.state = abnormal('One EVM hash reused for distinct native heights');
        return finish();
      }
      diagnostics.evmAnchors.push({nativeHash: block.hash, evmHash: mapping.hash, height: block.number});
    }
    for (const {nativeHash, evmHash} of diagnostics.evmAnchors) {
      const anchor = {blockHash: evmHash, requireCanonical: true};
      const code = await request('evm', 'eth_getCode', [intent.contract, anchor]);
      if (code === '0x' || code === null) {
        diagnostics.state = unverified('Probe runtime unavailable at the selected anchor');
        return finish();
      }
      if (typeof code !== 'string' || code.toLowerCase() !== runtimeBytecode) {
        diagnostics.state = abnormal('Runtime bytecode does not match the local PortalPulse probe');
        return finish();
      }
      if (nativeHash === native.block.hash) evidence.execution = execution('success', null);
    }
    const anchor = {blockHash: diagnostics.evmAnchors.at(-1).evmHash, requireCanonical: true};
    const data = GETTER + intent.caller.slice(2).padStart(64, '0');
    const response = await request('evm', 'eth_call', [{to: intent.contract, data}, anchor]);
    if (response === null || response === '0x') {
      diagnostics.state = unverified('Probe getter returned no state word');
      return finish();
    }
    const sequence = uint64Word(response);
    evidence.readback = {
      genesisHash: native.network.observedGenesis, blockHash: evidence.finality.finalized.hash,
      contract: intent.contract, caller: intent.caller, sequence, observedAt: now(),
    };
    diagnostics.state = sequence === intent.expectedSequence ? normal('Pinned caller sequence matches') : abnormal('Pinned caller sequence differs');
  } catch {
    diagnostics.state = unreachable('EVM readback');
  }
  return finish();
}
