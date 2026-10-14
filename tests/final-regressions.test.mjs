import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRpc, collectSample, createReport, importReport} from '../dist/core/index.js';
import {createLiveSession} from '../dist/web/live-session.js';
import {serializeReport} from '../dist/web/view-model.js';

const hash = '0x' + '11'.repeat(32);
const limit = 16 * 1024 * 1024;
async function fixture(t, {overflow = false, methods = ['system_chain'], echo = false} = {}) {
  let requests = 0;
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const q = JSON.parse(body);
    requests++;
    const result = q.method === 'system_chain' ? (echo ? `http://${req.headers.host}${req.url}` : 'Local fixture')
      : q.method === 'state_getRuntimeVersion' ? {specName: 'fixture', specVersion: overflow ? 'OVERFLOW_NUMBER' : 1, transactionVersion: 1}
      : q.method === 'state_getMetadata' ? '0x6d6574610f00'
      : q.method === 'rpc_methods' ? {methods}
      : q.method === 'chain_getHeader' ? {number: '0x1', parentHash: hash, stateRoot: hash, extrinsicsRoot: hash, digest: {logs: []}}
      : hash;
    res.end(JSON.stringify({jsonrpc: '2.0', id: q.id, result}).replace('"OVERFLOW_NUMBER"', '1e999'));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {server.closeAllConnections(); server.close();});
  return {
    config: {id: 'final-local', name: 'Local fixture', source: 'https://public.example/evidence', endpoint: `http://127.0.0.1:${server.address().port}/sensitive-path`, endpointAlias: 'local-fixture', kind: 'custom-readonly', expectedGenesis: hash},
    healthy() {overflow = false;},
    get requests() {return requests;},
  };
}
async function sample(t, config) {
  const rpc = createRpc(config.endpoint);
  t.after(() => rpc.close());
  return collectSample(rpc, config);
}
async function directory(t) {
  const dir = await mkdtemp(join(tmpdir(), 'portalpulse-final-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  return dir;
}
function cli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['dist/cli/main.js', ...args]);
    let stdout = '', stderr = '';
    const timer = setTimeout(() => {child.kill(); reject(new Error('CLI timed out'));}, 60000);
    child.stdout.on('data', chunk => stdout += chunk);
    child.stderr.on('data', chunk => stderr += chunk);
    child.on('error', reject);
    child.on('close', status => {clearTimeout(timer); resolve({status, stdout, stderr});});
  });
}
function acceleratePolls(t) {
  const original = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => original(callback, delay === 10000 ? 0 : delay, ...args));
}

test('canonical endpoint echo is removed through real transport, snapshot, report and import', async t => {
  const f = await fixture(t, {echo: true});
  const canonical = f.config.endpoint;
  f.config.endpoint = canonical.replace('http:', 'HTTP:').replace('/sensitive-path', '/private/../sensitive-path');
  const observed = await sample(t, f.config);
  assert.equal(observed.identity.chainName, canonical);
  const report = await createReport(f.config, [observed]);
  const text = await serializeReport(report);
  assert.ok(!text.includes(canonical), 'canonical transport URL must not survive in public evidence');
  assert.ok(!text.includes(f.config.endpoint));
  assert.equal(report.payload.network.source, 'https://public.example/evidence');
  assert.deepEqual(await importReport(text), report);
});

test('overflow JSON number remains abnormal evidence and exports/imports', async t => {
  const f = await fixture(t, {overflow: true});
  const observed = await sample(t, f.config);
  const record = observed.rpc.find(r => r.method === 'state_getRuntimeVersion');
  assert.equal(record.status, 'abnormal');
  assert.equal(record.error.code, 'validation');
  const report = await createReport(f.config, [observed]);
  const imported = await importReport(await serializeReport(report));
  assert.match(JSON.stringify(imported.payload.samples[0].rpc), /nonfinite|non-finite/i);
  assert.equal(imported.payload.samples[0].identity.runtime, null);
});

test('overflow sample does not poison subsequent healthy live publication', async t => {
  acceleratePolls(t);
  const f = await fixture(t, {overflow: true});
  const session = createLiveSession();
  t.after(() => session.stop());
  const reports = [];
  await new Promise((resolve, reject) => session.start(f.config, r => {
    reports.push(r);
    f.healthy();
    if (reports.length === 2) {session.stop(); resolve();}
  }, error => {session.stop(); reject(new Error(error));}));
  const imported = await importReport(await serializeReport(reports[1]));
  assert.equal(imported.payload.samples.length, 2);
  assert.equal(imported.payload.samples[0].rpc.find(r => r.method === 'state_getRuntimeVersion').status, 'abnormal');
  assert.equal(imported.payload.samples[1].identity.state, 'normal');
});

test('wide legal samples retain newest window under complete UTF8 report budget', async t => {
  const methods = Array.from({length: 128}, (_, i) => `method_${i}_` + 'x'.repeat(100));
  const f = await fixture(t, {methods});
  const first = await sample(t, f.config);
  const samples = Array.from({length: 2000}, (_, i) => ({...structuredClone(first),
    observedAt: new Date(Date.parse(first.observedAt) + i * 10000).toISOString(),
    rpc: first.rpc.map(r => ({...r, startedAt: new Date(Date.parse(r.startedAt) + i * 10000).toISOString()})),
  }));
  assert.ok(Buffer.byteLength(JSON.stringify(samples)) > limit);
  const report = await createReport(f.config, samples, {droppedSamples: 7});
  const text = await serializeReport(report);
  assert.ok(Buffer.byteLength(text) <= limit);
  assert.ok(report.payload.samples.length < 2000);
  assert.equal(report.payload.droppedSamples, 2007 - report.payload.samples.length);
  assert.equal(report.payload.startedAt, samples[2000 - report.payload.samples.length].observedAt);
  assert.equal(report.payload.endedAt, samples.at(-1).observedAt);
  assert.deepEqual(await importReport(text), report);
  // Retention is maximal for the full envelope, not an arbitrary conservative byte estimate.
  const extra = {...report, payload: {...report.payload, samples: [samples[1999 - report.payload.samples.length], ...report.payload.samples]}};
  assert.ok(Buffer.byteLength(JSON.stringify(extra)) > limit);
});

test('wide legal CLI collection saves retained observations instead of losing the session', async t => {
  const f = await fixture(t, {methods: Array.from({length: 128}, (_, i) => `method_${i}_` + 'x'.repeat(100))});
  const dir = await directory(t), configPath = join(dir, 'config.json'), out = join(dir, 'report.json');
  await writeFile(configPath, JSON.stringify(f.config));
  const run = await cli(['collect', '--config', configPath, '--samples', '2000', '--interval-ms', '1', '--out', out]);
  assert.equal(run.status, 2, run.stderr); // Fixed heads cannot establish a progress baseline.
  const text = await readFile(out, 'utf8');
  const report = await importReport(text);
  assert.equal(f.requests, 18000);
  assert.ok(report.payload.samples.length < 2000);
  assert.equal(report.payload.droppedSamples + report.payload.samples.length, 2000);
  assert.equal(JSON.parse(run.stdout).report.sampleCount, report.payload.samples.length);
  assert.ok(Buffer.byteLength(text) <= limit);
});

test('live byte-window eviction stays synchronized across later publications', async t => {
  acceleratePolls(t);
  const f = await fixture(t, {methods: Array.from({length: 256}, (_, i) => `${i}_` + '汉'.repeat(120))});
  const session = createLiveSession();
  t.after(() => session.stop());
  let observations = 0, afterDrop = 0, last;
  await new Promise((resolve, reject) => session.start(f.config, report => {
    observations++;
    last = report;
    try {
      assert.equal(report.payload.droppedSamples + report.payload.samples.length, observations);
      assert.equal(report.payload.startedAt, report.payload.samples[0].observedAt);
      assert.equal(report.payload.endedAt, report.payload.samples.at(-1).observedAt);
      if (report.payload.droppedSamples) afterDrop++;
      if (afterDrop === 3) {session.stop(); resolve();}
      if (observations > 300) throw new Error('fixture did not reach the byte boundary');
    } catch (error) {session.stop(); reject(error);}
  }, error => {session.stop(); reject(new Error(error));}));
  assert.ok(last.payload.droppedSamples >= 3);
  assert.deepEqual(await importReport(await serializeReport(last)), last);
});

for (const key of ['id', 'endpointAlias']) test(`URL-shaped ${key} rejects before CLI/core/frontend RPC I/O`, async t => {
  const f = await fixture(t);
  const invalid = {...f.config, [key]: 'https://public.example/identifier'};
  const dir = await directory(t), path = join(dir, 'config.json');
  await writeFile(path, JSON.stringify(invalid));
  const run = await cli(['collect', '--config', path, '--samples', '1']);
  assert.equal(run.status, 1);
  assert.equal(f.requests, 0, 'CLI must reject public identifiers before the first request');
  const rpc = createRpc(f.config.endpoint);
  t.after(() => rpc.close());
  await assert.rejects(collectSample(rpc, invalid), /config|public|label|identifier/i);
  const session = createLiveSession();
  t.after(() => session.stop());
  assert.throws(() => session.start(invalid, assert.fail, assert.fail), /config|public|label|identifier/i);
  assert.equal(f.requests, 0);
});

test('canonical config endpoint in public source rejects before any core/frontend I/O', async t => {
  const f = await fixture(t);
  const invalid = {...f.config, endpoint: f.config.endpoint.replace('http:', 'HTTP:'), source: 'Evidence: ' + f.config.endpoint};
  const rpc = createRpc(f.config.endpoint);
  t.after(() => rpc.close());
  await assert.rejects(collectSample(rpc, invalid), /config|endpoint|public/i);
  const session = createLiveSession();
  t.after(() => session.stop());
  assert.throws(() => session.start(invalid, assert.fail, assert.fail), /config|endpoint|public/i);
  assert.equal(f.requests, 0);
});

test('host case, default port and dot-path URL equivalents redact without losing public evidence', async t => {
  const f = await fixture(t);
  const observed = await sample(t, f.config);
  const config = {...f.config, endpoint: 'HTTP://LOCALHOST:80/private/../sensitive-path'};
  const canonical = 'http://localhost/sensitive-path';
  observed.identity.chainName = canonical;
  observed.rpc[0].result = {
    endpointEcho: 'Node: http://LOCALHOST:80/sensitive-path, unreachable',
    publicCitation: 'https://public.example/evidence',
  };
  const report = await createReport(config, [observed]);
  assert.equal(report.payload.samples[0].identity.chainName, '[endpoint]');
  assert.equal(report.payload.samples[0].rpc[0].result.endpointEcho, 'Node: [endpoint], unreachable');
  assert.equal(report.payload.samples[0].rpc[0].result.publicCitation, 'https://public.example/evidence');
  assert.deepEqual(await importReport(await serializeReport(report)), report);
  for (const key of ['name', 'source']) {
    await assert.rejects(createReport({...config, [key]: `Node: ${canonical}`}, [observed]), /endpoint.*public|public.*endpoint/i);
  }
});

test('import still rejects raw nonfinite JSON result even with otherwise valid report', async t => {
  const f = await fixture(t);
  const observed = await sample(t, f.config);
  observed.rpc[0].result = {diagnostic: 'REPLACE_NUMBER'};
  const report = await createReport(f.config, [observed]);
  const text = JSON.stringify(report).replace('"REPLACE_NUMBER"', '1e999');
  await assert.rejects(importReport(text), /nonfinite result/);
});

test('overflow CLI collection saves abnormal diagnostic evidence with exit 1', async t => {
  const f = await fixture(t, {overflow: true});
  const dir = await directory(t), configPath = join(dir, 'config.json'), out = join(dir, 'report.json');
  await writeFile(configPath, JSON.stringify(f.config));
  const run = await cli(['collect', '--config', configPath, '--samples', '1', '--out', out]);
  assert.equal(run.status, 1);
  const report = await importReport(await readFile(out, 'utf8'));
  assert.equal(report.payload.samples[0].rpc.find(r => r.method === 'state_getRuntimeVersion').error.code, 'validation');
  assert.match(JSON.stringify(report), /nonfinite/);
});
