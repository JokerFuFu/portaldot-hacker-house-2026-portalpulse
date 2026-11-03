import {blake2AsHex, keccakAsHex} from '@polkadot/util-crypto';
import {nativeFixture} from './native-fixture.mjs';

const genesis = '0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd';
export const hash = byte => '0x' + byte.repeat(32);
export const contract = '0x' + '71'.repeat(20);
export const caller = '0x' + '82'.repeat(20);
export const expectedSequence = '18446744073709551615';
export const runtimeBytecode = '0x60006000';
export const evmEndpoint = 'https://fixture.invalid/private';
export const word = sequence => '0x' + BigInt(sequence).toString(16).padStart(64, '0');
export const callerWord = '0x' + caller.slice(2).padStart(64, '0');
export const event = {
  index: 1, contract, data: word(expectedSequence),
  topics: [keccakAsHex('SequenceRecorded(address,uint64)'), callerWord],
};
export function probeFixture(probeEvents = [event], outcomes) {
  const f = nativeFixture({probeEvents, outcomes});
  f.config.expectedGenesis = genesis;
  f.replies.chain_getBlockHash = () => genesis;
  const headHeader = {...f.header, number: '0xb', parentHash: f.blockHash};
  const headHash = blake2AsHex(f.registry.createType('Header', headHeader).toU8a(), 256);
  f.replies.chain_getFinalizedHead = () => headHash;
  f.replies.chain_getHeader = ([h]) => h === headHash ? headHeader : null;
  const evmIncluded = {hash: hash('a1'), number: '0xa'};
  const evmFinalized = {hash: hash('b2'), number: '0xb'};
  const evmCalls = [];
  const replies = {
    eth_chainId: () => '0x190f1ca9',
    eth_getBlockByHash: ([h]) => h === f.blockHash ? evmIncluded : h === headHash ? evmFinalized : null,
    eth_getBlockByNumber: ([n]) => n === '0xa' ? evmIncluded : n === '0xb' ? evmFinalized : null,
    eth_getCode: () => runtimeBytecode,
    eth_call: () => word(expectedSequence),
  };
  const evm = {
    async request(method, params, signal) {
      evmCalls.push({method, params});
      if (signal?.aborted) throw Error('aborted');
      return replies[method](params);
    },
  };
  const options = {
    blockHash: f.blockHash, transactionHash: f.transactionHash, contract, caller,
    expectedSequence, submittedAt: '2026-10-14T00:00:00.000Z', evmEndpoint, runtimeBytecode,
  };
  return {...f, headHash, headHeader, evmFinalized, evmIncluded, evmCalls, evmReplies: replies,
    evm, options};
}
