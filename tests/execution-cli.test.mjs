import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const run=(...args)=>spawnSync(process.execPath,['dist/cli/main.js',...args],{encoding:'utf8',timeout:5000});
async function input(t,change){const dir=await mkdtemp(join(tmpdir(),'portalpulse-execution-'));t.after(()=>rm(dir,{recursive:true,force:true}));const value=JSON.parse(await readFile('examples/execution-simulated.example.json','utf8'));change?.(value);const file=join(dir,'evidence.json');await writeFile(file,JSON.stringify(value));return file;}
test('execution CLI complete synthetic flow exits zero with offline provenance and trust flags',async t=>{const file=await input(t);const r=run('execution-inspect','--input',file);assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');const s=JSON.parse(r.stdout);assert.equal(s.status,'normal');assert.equal(s.mode,'offline');assert.equal(s.origin,'simulated');assert.equal(s.evidenceComplete,true);assert.equal(s.fullVerification,false);assert.equal(s.writeAllowed,false);assert.equal(s.verifiedNetwork,false);assert.equal(s.observedSequence,'9007199254740993');});
test('execution CLI partial flow exits two with unverified state',async t=>{const file=await input(t,f=>f.execution=null);const r=run('execution-inspect','--input',file);assert.equal(r.status,2,r.stderr);assert.equal(JSON.parse(r.stdout).checks.execution.state,'unverified');});
test('execution CLI failed execution exits one even with later matching readback',async t=>{const file=await input(t,f=>{f.execution.outcome='failure';f.execution.failureReason='Synthetic call failure';});const r=run('execution-inspect','--input',file);assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).status,'abnormal');});
test('execution CLI malformed JSON has no stdout and no payload echo',async t=>{const file=await input(t);await writeFile(file,'{"secret":"DO-NOT-ECHO"');const r=run('execution-inspect','--input',file);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.ok(!r.stderr.includes('DO-NOT-ECHO'));});
test('execution CLI invalid schema has no stdout',async t=>{const file=await input(t,f=>f.extra=true);const r=run('execution-inspect','--input',file);assert.equal(r.status,1);assert.equal(r.stdout,'');});
test('execution CLI enforces 1MiB file limit',async t=>{const file=await input(t);await writeFile(file,' '.repeat(1048577));const r=run('execution-inspect','--input',file);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/size|limit/i);});
for(const args of [[],['--input'],['--input','x','--input','y'],['--input','x','--unknown','y'],['--out','x'],['extra']])test('execution CLI rejects missing/duplicate/unknown arguments '+args.join(' '),()=>{const r=run('execution-inspect',...args);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.ok(r.stderr.length>0);});
test('execution command is discoverable in CLI help',()=>{const r=run('--help');assert.equal(r.status,0);assert.match(r.stdout,/execution-inspect --input path/);assert.match(r.stdout,/offline/i);});
