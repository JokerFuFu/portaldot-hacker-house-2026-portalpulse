import {keccakAsHex} from '@polkadot/util-crypto';

const selector = keccakAsHex('SequenceRecorded(address,uint64)');
export const UINT64_MAX = (1n << 64n) - 1n;
export const H160 = /^0x[0-9a-f]{40}$/i;

export function uint64Word(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/i.test(value)) throw new Error('Invalid uint64 ABI word');
  const sequence = BigInt(value);
  if (sequence > UINT64_MAX) throw new Error('Noncanonical uint64 ABI word');
  return sequence.toString();
}

export function probeEvent(events, intent) {
  if (events.some(event => event.section === 'revive' && event.method === 'EthExtrinsicRevert')) {
    return {state: 'abnormal', reason: 'Revive.EthExtrinsicRevert at the target phase', reverted: true};
  }
  const matches = [];
  for (const event of events) {
    if (event.section !== 'revive' || event.method !== 'ContractEmitted') continue;
    const fields = event.meta.fields.map(field => field.name.toString());
    if (fields.join(',') !== 'contract,data,topics') {
      return {state: 'unverified', reason: 'Unknown Revive.ContractEmitted layout'};
    }
    const [contract, data, topics] = event.data;
    if (contract.toHex().toLowerCase() !== intent.contract || topics[0]?.toHex().toLowerCase() !== selector) continue;
    matches.push({data, topics});
  }
  if (!matches.length) return {state: 'unverified', reason: 'No matching SequenceRecorded event at the target phase'};
  if (matches.length !== 1) return {state: 'abnormal', reason: 'Ambiguous SequenceRecorded events at the target phase'};
  const [{data, topics}] = matches;
  try {
    const indexed = topics[1]?.toHex().toLowerCase();
    if (topics.length !== 2 || !/^0x0{24}[0-9a-f]{40}$/.test(indexed)) throw new Error('Invalid indexed caller');
    const caller = '0x' + indexed.slice(26);
    const sequence = uint64Word('0x' + Buffer.from(data.toU8a(true)).toString('hex'));
    if (caller !== intent.caller || sequence !== intent.expectedSequence) {
      return {state: 'abnormal', reason: 'Probe event caller or sequence mismatch', caller, sequence};
    }
    return {state: 'normal', reason: 'Exact phase, contract, caller and uint64 event match', caller, sequence};
  } catch {
    return {state: 'abnormal', reason: 'Malformed SequenceRecorded ABI payload'};
  }
}
