import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';

const BINARY_SHA='fb59b825b7d57f9de89cd9de2415b12aab1fcc7eb2573fd2bf5c9b969eacf4d9';
const PACKAGE_INTEGRITY='sha512-G5yUqjTUPc8Np74sCFwfsevhBPlUifUOfhYrgyu6CmYlC6feSw0YS6eZW47XDT23k3JYdKx5nJ+Q7whCEmNcoA==';

try{
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=='--out'||!args[1]||args[1].startsWith('--')){
    throw new Error('Usage: node scripts/build-probe.mjs --out PATH');
  }
  const source=await readFile(new URL('../contracts/PortalPulseProbe.sol',import.meta.url),'utf8');
  const binary=await readFile(new URL(import.meta.resolve('solc/soljson.js')));
  const soljsonSha256=createHash('sha256').update(binary).digest('hex');
  const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
  const locked=lock.packages?.['node_modules/solc'];
  if(soljsonSha256!==BINARY_SHA||locked?.version!=='0.8.24'||locked?.integrity!==PACKAGE_INTEGRITY){
    throw new Error('Pinned npm Solidity compiler bytes or lockfile do not match');
  }
  const {compileProbe}=await import('./probe-compiler.mjs');
  const artifact=compileProbe(source);
  artifact.compiler={...artifact.compiler,distribution:'npm solc 0.8.24',packageIntegrity:PACKAGE_INTEGRITY,soljsonSha256};
  artifact.scope='Compiler artifact only; no deployment receipt, wallet ownership or consensus verification.';
  const output=resolve(args[1]);
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify(artifact,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({out:output,contractName:artifact.contractName,compilerVersion:artifact.compiler.version,
    creationBytes:(artifact.creationBytecode.length-2)/2,runtimeBytes:(artifact.runtimeBytecode.length-2)/2,
    creationBytecodeSha256:artifact.creationBytecodeSha256,runtimeBytecodeSha256:artifact.runtimeBytecodeSha256}));
}catch(error){console.error(error instanceof Error?error.message:String(error));process.exitCode=1;}
