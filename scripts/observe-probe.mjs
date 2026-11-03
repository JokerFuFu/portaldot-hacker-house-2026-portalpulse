import {constants} from 'node:fs';
import {lstat, mkdir, open, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {createRpc} from '../dist/core/rpc.js';
import {createExecutionReport} from '../dist/core/execution-report.js';
import {compileProbe} from './probe-compiler.mjs';
import {collectProbeObservation} from './probe-observation.mjs';

const usage = [
  'PortalPulse readonly native Revive probe observation (Node >=22.12)',
  'node scripts/observe-probe.mjs --config PATH --evm-endpoint URL --block-hash H256',
  '  --tx-hash H256 --contract H160 --caller H160 --expected-sequence UINT64 --out PATH',
  '  [--submitted-at UTC_ISO_TIMESTAMP]',
  'Use the native extrinsic hash. Submission time is participant-supplied and optional.',
  'Writes an ExecutionReport v1 for offline replay. Stdout preserves collection diagnostics.',
  'Exit 0 complete RPC evidence, 1 abnormal/error, 2 incomplete. Existing files are protected.',
  '',
].join('\n');

function parse(args) {
  if (!args.length || (args.length === 1 && ['--help', '-h'].includes(args[0]))) return null;
  const required = ['config', 'evm-endpoint', 'block-hash', 'tx-hash', 'contract', 'caller', 'expected-sequence', 'out'];
  const values = new Map();
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].slice(2);
    if (!args[i].startsWith('--') || (!required.includes(name) && name !== 'submitted-at')) throw new Error('Unknown probe option');
    if (values.has(name)) throw new Error('Duplicate probe option');
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Missing probe option value');
    values.set(name, args[i + 1]);
  }
  if (required.some(key => !values.has(key))) throw new Error('Missing required probe option');
  return values;
}

async function readConfig(path) {
  const file = await open(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0));
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > 65536) throw new Error('Invalid config file or size limit');
    const data = Buffer.alloc(65537);
    const {bytesRead} = await file.read(data, 0, data.length, 0);
    if (bytesRead > 65536) throw new Error('Config size limit');
    try {
      return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(data.subarray(0, bytesRead)));
    } catch {
      throw new Error('Invalid probe config JSON');
    }
  } finally {
    await file.close();
  }
}

async function main() {
  const args = parse(process.argv.slice(2));
  if (!args) {
    process.stdout.write(usage);
    return 0;
  }
  const out = resolve(args.get('out'));
  try {
    await lstat(out);
    throw new Error('Output exists, refusing overwrite');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const config = await readConfig(args.get('config'));
  const source = await readFile(new URL('../contracts/PortalPulseProbe.sol', import.meta.url), 'utf8');
  const {runtimeBytecode} = compileProbe(source);
  const evmEndpoint = args.get('evm-endpoint');
  const native = createRpc(config?.endpoint);
  const evm = createRpc(evmEndpoint);
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90_000)]);
  const interrupt = () => controller.abort();
  process.on('SIGINT', interrupt);
  let result;
  try {
    result = await collectProbeObservation(native, evm, config, {
      blockHash: args.get('block-hash'), transactionHash: args.get('tx-hash'),
      contract: args.get('contract'), caller: args.get('caller'), expectedSequence: args.get('expected-sequence'),
      submittedAt: args.get('submitted-at'), evmEndpoint, runtimeBytecode, signal,
    });
  } finally {
    native.close();
    evm.close();
    process.removeListener('SIGINT', interrupt);
  }

  const interrupted = controller.signal.aborted;
  const deadlineReached = signal.aborted && !interrupted;
  const status = interrupted || deadlineReached ? 'abnormal' : result.status;
  const report = await createExecutionReport(result.evidence);
  await mkdir(dirname(out), {recursive: true});
  try {
    await writeFile(out, JSON.stringify(report), {flag: 'wx'});
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('Output exists, refusing overwrite');
    throw error;
  }
  process.stdout.write(JSON.stringify({
    status, interrupted, deadlineReached,
    submissionTimeSource: result.evidence.submitted ? 'participant' : null,
    offline: result.summary, collection: result.diagnostics,
    report: {executionReportVersion: 1, sha256: report.sha256},
  }) + '\n');
  return status === 'normal' ? 0 : status === 'abnormal' ? 1 : 2;
}

try {
  process.exitCode = await main();
} catch (error) {
  process.stderr.write('Error: ' + (error instanceof Error ? error.message : 'Probe observation failed') + '\n');
  process.exitCode = 1;
}
