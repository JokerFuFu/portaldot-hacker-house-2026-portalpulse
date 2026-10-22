import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createEVM} from '@ethereumjs/evm';
import {Account,bytesToHex,createAddressFromString,hexToBytes} from '@ethereumjs/util';

const script=fileURLToPath(new URL('../scripts/build-probe.mjs',import.meta.url));
async function workspace(t){const dir=await mkdtemp(join(tmpdir(),'portalpulse-probe-build-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
const run=(cwd,args)=>spawnSync(process.execPath,[script,...args],{cwd,encoding:'utf8',timeout:20000});

test('build command produces a complete artifact whose constructor executes',async t=>{
  const dir=await workspace(t),out=join(dir,'nested','probe.json');
  const result=run(dir,['--out',out]);
  assert.equal(result.status,0,result.stderr);
  const artifact=JSON.parse(await readFile(out,'utf8'));
  assert.equal(artifact.artifactVersion,1);
  assert.equal(artifact.contractName,'PortalPulseProbe');
  assert.equal(artifact.compiler.version,'0.8.24+commit.e11b9ed9.Emscripten.clang');
  assert.equal(artifact.compiler.soljsonSha256,'fb59b825b7d57f9de89cd9de2415b12aab1fcc7eb2573fd2bf5c9b969eacf4d9');
  const evm=await createEVM(),caller=createAddressFromString('0x1111111111111111111111111111111111111111');
  await evm.stateManager.putAccount(caller,new Account(0n,10n**18n));
  const deployed=await evm.runCall({caller,data:hexToBytes(artifact.creationBytecode),gasLimit:2_000_000n});
  assert.equal(deployed.execResult.exceptionError,undefined);
  assert.ok(deployed.createdAddress);
  assert.equal(bytesToHex(await evm.stateManager.getCode(deployed.createdAddress)),artifact.runtimeBytecode);
});

test('two build paths produce byte-identical evidence without host paths or time',async t=>{
  const dir=await workspace(t),a=join(dir,'first.json'),b=join(dir,'second.json');
  assert.equal(run(dir,['--out',a]).status,0);
  assert.equal(run(dir,['--out',b]).status,0);
  const first=await readFile(a),second=await readFile(b);
  assert.deepEqual(first,second);
  assert.equal(first.includes(Buffer.from(dir)),false);
});

test('build refuses an existing output and keeps its original bytes',async t=>{
  const dir=await workspace(t),out=join(dir,'existing.json');
  await writeFile(out,'keep original evidence\n');
  const result=run(dir,['--out',out]);
  assert.equal(result.status,1);
  assert.match(result.stderr,/exist|EEXIST/i);
  assert.equal(await readFile(out,'utf8'),'keep original evidence\n');
});

test('missing, duplicate and RPC-style flags fail before creating files',async t=>{
  const dir=await workspace(t),out=join(dir,'should-not-exist.json');
  for(const args of [[],['--out'],['--out',out,'--out',join(dir,'other.json')],['--out',out,'--rpc','https://example.invalid'],['--out','--unknown']]){
    const result=run(dir,args);
    assert.equal(result.status,1,JSON.stringify(args));
    assert.match(result.stderr,/usage/i);
    assert.equal(result.stdout,'');
    assert.deepEqual(await readdir(dir),[]);
  }
});
