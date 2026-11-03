import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {compileProbe} from '../scripts/probe-compiler.mjs';
import {syntheticMetadata} from './helpers/native-fixture.mjs';
import {probeFixture, contract, caller, expectedSequence} from './helpers/probe-fixture.mjs';
import {readExecutionInput, makeExecutionViewModel} from '../dist/web/execution-model.js';

const exec = promisify(execFile);
async function run(args, timeout = 15000) {
  try {
    return {code: 0, ...await exec(process.execPath, args, {timeout})};
  } catch (error) {
    if (!Number.isInteger(error.code)) throw error;
    return {code: error.code, stdout: error.stdout, stderr: error.stderr};
  }
}

test('real CLI transport exports one report that the CLI and web import can replay', async t => {
  const f = probeFixture();
  const runtime = compileProbe(await readFile('contracts/PortalPulseProbe.sol', 'utf8')).runtimeBytecode;
  f.evmReplies.eth_getCode = () => runtime;
  const calls = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const part of request) body += part;
    const rpc = JSON.parse(body);
    calls.push({path: request.url, ...rpc});
    const replies = request.url === '/native' ? f.replies : f.evmReplies;
    const result = replies[rpc.method](rpc.params);
    response.end(JSON.stringify({jsonrpc: '2.0', id: rpc.id, result}));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const dir = await mkdtemp(join(tmpdir(), 'portalpulse-probe-observe-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const base = 'http://127.0.0.1:' + server.address().port;
  const reflectedMetadata = syntheticMetadata(true, base + '/evm').metadataHex;
  f.replies.state_getMetadata = () => reflectedMetadata;
  const config = join(dir, 'config.json');
  const out = join(dir, 'report.json');
  await writeFile(config, JSON.stringify({...f.config, endpoint: base + '/native'}));
  const args = [
    'scripts/observe-probe.mjs', '--config', config, '--evm-endpoint', base + '/evm',
    '--block-hash', f.blockHash, '--tx-hash', f.transactionHash, '--contract', contract,
    '--caller', caller, '--expected-sequence', expectedSequence,
    '--submitted-at', '2026-10-14T00:00:00.000Z', '--out', out,
  ];
  const result = await run(args);
  assert.equal(result.code, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  const saved = await readFile(out, 'utf8');
  assert.equal(summary.status, 'normal');
  assert.equal(summary.offline.fullVerification, false);
  assert.ok(!result.stdout.includes(base));
  assert.ok(!result.stderr.includes(base), 'provider metadata cannot echo the endpoint to stderr');
  assert.ok(!saved.includes(base));
  assert.equal(calls.filter(call => call.method === 'eth_call').length, 1);
  assert.ok(calls.every(call => !/^(author_|eth_send)/.test(call.method)));

  const input = await readExecutionInput(saved);
  const web = makeExecutionViewModel(input.report, input.inputKind);
  assert.equal(web.summary.evidenceComplete, true);
  assert.equal(web.summary.observedSequence, expectedSequence);
  assert.equal(web.summary.mode, 'offline');
  assert.equal(web.sha256, summary.report.sha256);
  const replay = await run(['dist/cli/main.js', 'execution-inspect', '--input', out]);
  assert.equal(replay.code, 0, replay.stderr);
  assert.equal(JSON.parse(replay.stdout).report.sha256, summary.report.sha256);

  const count = calls.length;
  const repeated = await run(args);
  assert.equal(repeated.code, 1);
  assert.match(repeated.stderr, /exists|overwrite/i);
  assert.equal(repeated.stdout, '');
  assert.equal(await readFile(out, 'utf8'), saved);
  assert.equal(calls.length, count);
});

test('rejects a FIFO config without waiting for another process', {skip: process.platform === 'win32'}, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'portalpulse-probe-fifo-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const fifo = join(dir, 'not-a-config');
  await exec('mkfifo', [fifo]);
  const result = await run([
    'scripts/observe-probe.mjs', '--config', fifo, '--evm-endpoint', 'https://fixture.invalid',
    '--block-hash', '0x' + '11'.repeat(32), '--tx-hash', '0x' + '22'.repeat(32),
    '--contract', contract, '--caller', caller, '--expected-sequence', '1', '--out', join(dir, 'report.json'),
  ], 3000);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /config file/i);
  assert.equal(result.stdout, '');
});
