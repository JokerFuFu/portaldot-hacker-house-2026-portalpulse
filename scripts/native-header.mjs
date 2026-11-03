import {TypeRegistry} from '@polkadot/types';
import {blake2AsHex} from '@polkadot/util-crypto';

export const H256 = /^0x[0-9a-f]{64}$/i;

export function bytes(value, max, label) {
  if (typeof value !== 'string' || value.length > 2 + 2 * max || !/^0x(?:[0-9a-f]{2})*$/i.test(value)) {
    throw new Error('Invalid or oversized ' + label);
  }
  return Buffer.from(value.slice(2), 'hex');
}

export function exactCodec(codec, raw, label) {
  if (!Buffer.from(codec.toU8a()).equals(raw)) throw new Error('Noncanonical or trailing ' + label);
  return codec;
}

export function exactNativeHeader(header, expectedHash) {
  const keys = ['parentHash', 'number', 'stateRoot', 'extrinsicsRoot', 'digest'];
  if (!header || typeof header !== 'object' || Object.keys(header).length !== keys.length ||
      keys.some(key => !Object.hasOwn(header, key)) ||
      ![header.parentHash, header.stateRoot, header.extrinsicsRoot].every(v => typeof v === 'string' && H256.test(v)) ||
      typeof header.number !== 'string' || !/^0x[0-9a-f]{1,64}$/i.test(header.number) ||
      !header.digest || Object.keys(header.digest).length !== 1 ||
      !Array.isArray(header.digest.logs) || header.digest.logs.length > 512) {
    throw new Error('Malformed selected block header');
  }
  let encoded;
  try {
    const registry = new TypeRegistry();
    let size = 0;
    for (const log of header.digest.logs) {
      const raw = bytes(log, 512 * 1024, 'digest');
      size += raw.length;
      if (size > 512 * 1024) throw new Error('Digest size limit');
      exactCodec(registry.createType('DigestItem', raw), raw, 'digest item');
    }
    encoded = registry.createType('Header', header).toU8a();
  } catch {
    throw new Error('Invalid or oversized selected block header');
  }
  if (blake2AsHex(encoded, 256) !== expectedHash) throw new Error('Selected header hash mismatch');
  return {hash: expectedHash, number: BigInt(header.number).toString(), parentHash: header.parentHash.toLowerCase()};
}
