// Sorted keys at every object depth; only validated JSON values reach this serializer.
export function canonical(value:unknown):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  const data=value as Record<string,unknown>;
  return '{'+Object.keys(data).sort().map(key=>JSON.stringify(key)+':'+canonical(data[key])).join(',')+'}';
}
// Internal only: callers must validate and detach evidence before serialization/hashing.
export async function digestBytes(bytes:Uint8Array<ArrayBuffer>):Promise<string> {
  const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
}
