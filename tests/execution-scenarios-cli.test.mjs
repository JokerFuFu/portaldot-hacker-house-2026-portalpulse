import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawnSync} from 'node:child_process';
import {readFile,mkdtemp,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const run=(...args)=>spawnSync(process.execPath,['dist/cli/main.js',...args],{encoding:'utf8',timeout:5000});
async function output(t){const dir=await mkdtemp(join(tmpdir(),'portalpulse-rehearsal-'));t.after(()=>rm(dir,{recursive:true,force:true}));return join(dir,'report.json');}
for(const [id,exit,status] of [['complete',0,'normal'],['missing-evidence',2,'unverified'],['execution-failed',1,'abnormal'],['wrong-transaction',1,'abnormal'],['unfinalized',2,'unverified'],['state-mismatch',1,'abnormal']])test('CLI rehearsal '+id+' saves inspectable offline diagnosis with honest exit',async t=>{
 const out=await output(t),r=run('execution-demo','--scenario',id,'--out',out);assert.equal(r.status,exit,r.stderr);assert.equal(r.signal,null);assert.equal(r.stderr,'');
 const s=JSON.parse(r.stdout);assert.equal(s.status,status);assert.equal(s.origin,'simulated');assert.equal(s.mode,'offline');for(const flag of ['verifiedNetwork','writeAllowed','fullVerification'])assert.equal(s[flag],false);
 assert.equal(s.expectedSequence,'9007199254740993');const report=JSON.parse(await readFile(out,'utf8'));assert.equal(report.payload.submitted.observedAt,'2026-10-14T00:00:00.000Z');assert.equal(report.sha256,s.report.sha256);
 const inspected=run('execution-inspect','--input',out);assert.equal(inspected.status,exit,inspected.stderr);assert.deepEqual(JSON.parse(inspected.stdout),s);
});
test('CLI rehearsal defaults to complete without an output file requirement',()=>{const r=run('execution-demo');assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).evidenceComplete,true);assert.equal(JSON.parse(r.stdout).writeAllowed,false);});
for(const args of [['--scenario'],['--scenario','unknown'],['--scenario','__proto__'],['--scenario','constructor'],['--scenario','complete','--scenario','unfinalized'],['--out'],['--config','unused'],['--input','unused'],['--samples','1']])test('CLI rehearsal rejects invalid flags/scenario '+args.join(' '),async t=>{const out=await output(t),r=run('execution-demo',...args,'--out',out);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/Missing|Unknown|Duplicate/);await assert.rejects(access(out));});
test('CLI rehearsal refuses overwrite and retains original bytes',async t=>{const out=await output(t);await writeFile(out,'KEEP ORIGINAL\n');const r=run('execution-demo','--scenario','execution-failed','--out',out);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/exists|overwrite/i);assert.equal(await readFile(out,'utf8'),'KEEP ORIGINAL\n');});
