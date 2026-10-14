import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createServer} from 'node:http';
import {normalizeEndpoint, endpointRedactor, validateNetworkConfig} from '../dist/core/config.js';
import {createRpc, collectSample, createReport, importReport} from '../dist/core/index.js';

const hash = '0x' + '11'.repeat(32);
const citation = 'https://public.example/evidence';
async function fixture(t, {longEcho = false, collidingKeys = false, repeatedPath = false} = {}) {
  let requests = 0;
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const q = JSON.parse(body);
    requests++;
    const compact = repeatedPath
      ? `http://${req.headers.host}/sensitive-path/../sensitive-path`
      : `HTTP:${req.headers.host}/private/../sensitive-path`;
    const result = q.method === 'system_chain' ? (collidingKeys ? {[compact]: 'one', '[endpoint]': 'two'} : longEcho ? 'x'.repeat(245) + compact : compact)
      : q.method === 'state_getRuntimeVersion' ? {specName: 'fixture', specVersion: 1, transactionVersion: 1}
      : q.method === 'state_getMetadata' ? '0x6d6574610f00'
      : q.method === 'rpc_methods' ? {methods: ['system_chain']}
      : q.method === 'chain_getHeader' ? {number: '0x1', parentHash: hash, stateRoot: hash, extrinsicsRoot: hash, digest: {logs: []}}
      : hash;
    res.end(JSON.stringify({jsonrpc: '2.0', id: q.id, result}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => {server.closeAllConnections(); server.close();});
  const endpoint = `http://127.0.0.1:${server.address().port}/sensitive-path`;
  return {
    config: {id: 'closing-fixture', name: 'Local fixture', source: citation, endpoint, endpointAlias: 'local', kind: 'custom-readonly', expectedGenesis: hash},
    get requests() {return requests;},
  };
}

// Catches the fast path bypassing exact configured text before any URL scan.
test('accepted compact configured URL always redacts its original and canonical spelling', () => {
  for (const scheme of ['http', 'https', 'ws', 'wss']) {
    const endpoint = `${scheme}:localhost/sensitive-path`;
    const redact = endpointRedactor(endpoint);
    assert.equal(normalizeEndpoint(endpoint).href, `${scheme}://localhost/sensitive-path`);
    assert.equal(redact(endpoint), '[endpoint]');
    assert.equal(redact(normalizeEndpoint(endpoint).href), '[endpoint]');
    assert.equal(redact(citation), citation);
  }
});

// Catches a standard configuration whose node echoes a compact equivalent.
test('compact equivalent node URLs redact with standard config and preserve unrelated citations', () => {
  const redact = endpointRedactor('http://localhost/sensitive-path');
  for (const echo of ['http:localhost/sensitive-path', 'HTTP:LOCALHOST:80/private/../sensitive-path', 'http:/localhost/sensitive-path']) {
    assert.equal(redact(`Node: ${echo}, unavailable`), 'Node: [endpoint], unavailable');
  }
  assert.equal(redact(`Reference: ${citation}`), `Reference: ${citation}`);
});

test('public compact endpoint labels reject before core RPC I/O', async t => {
  const f = await fixture(t);
  const rpc = createRpc(f.config.endpoint);
  t.after(() => rpc.close());
  for (const endpoint of [f.config.endpoint, f.config.endpoint.replace('http://', 'http:')]) {
    for (const source of [f.config.endpoint.replace('http://', 'http:'), endpoint]) {
      const invalid = {...f.config, endpoint, source: 'Evidence: ' + source};
      assert.throws(() => validateNetworkConfig(invalid), /endpoint.*public|public.*endpoint/i);
      await assert.rejects(collectSample(rpc, invalid), /endpoint.*public|public.*endpoint/i);
    }
  }
  assert.equal(f.requests, 0);
});

for (const compactConfig of [false, true]) test(`actual transport redacts compact node echo with ${compactConfig ? 'compact' : 'standard'} configuration`, async t => {
  const f = await fixture(t);
  const config = {...f.config, endpoint: compactConfig ? f.config.endpoint.replace('http://', 'http:') : f.config.endpoint};
  const rpc = createRpc(config.endpoint);
  t.after(() => rpc.close());
  const observed = await collectSample(rpc, config);
  assert.equal(observed.identity.state, 'normal');
  const report = await createReport(config, [observed]);
  assert.equal(report.payload.samples[0].identity.chainName, '[endpoint]');
  assert.equal(report.payload.samples[0].rpc[0].result, '[endpoint]');
  assert.equal(report.payload.network.source, citation);
  assert.equal(f.requests, 9);
  assert.deepEqual(await importReport(JSON.stringify(report)), report);
});

test('snapshot redacts recognized compact echo before bounded evidence truncation', async t => {
  const f = await fixture(t, {longEcho: true});
  const rpc = createRpc(f.config.endpoint);
  t.after(() => rpc.close());
  const observed = await collectSample(rpc, f.config);
  assert.equal(observed.identity.chainName, null);
  assert.equal(observed.rpc[0].status, 'abnormal');
  assert.equal(observed.rpc[0].error.code, 'validation');
  assert.equal(observed.rpc[0].result, 'x'.repeat(245) + '[endpoint]');
  const report = await createReport(f.config, [observed]);
  assert.equal(report.payload.samples[0].rpc[0].result, 'x'.repeat(245) + '[endpoint]');
  assert.deepEqual(await importReport(JSON.stringify(report)), report);
});

test('compact endpoint key collision still rejects without losing evidence', async t => {
  const f = await fixture(t);
  const rpc = createRpc(f.config.endpoint);
  t.after(() => rpc.close());
  const observed = await collectSample(rpc, f.config);
  observed.rpc[0].result = {[f.config.endpoint.replace('http://', 'http:')]: 'one', '[endpoint]': 'two'};
  await assert.rejects(createReport(f.config, [observed]), /collide/i);
});

// Snapshot-side replacement must not silently collapse two evidence keys.
test('snapshot records a validation failure when redacted evidence keys collide', async t => {
  const f = await fixture(t, {collidingKeys: true});
  const rpc = createRpc(f.config.endpoint);
  t.after(() => rpc.close());
  const observed = await collectSample(rpc, f.config);
  assert.equal(observed.rpc[0].status, 'abnormal');
  assert.equal(observed.rpc[0].error.code, 'validation');
  assert.match(observed.rpc[0].error.message, /keys collide/i);
  assert.equal(Object.hasOwn(observed.rpc[0], 'result'), false);
  const report = await createReport(f.config, [observed]);
  assert.deepEqual(await importReport(JSON.stringify(report)), report);
});

// Full-token equivalence must run before a literal endpoint can replace its prefix.
test('composed endpoint equivalents redact completely before literal prefix fallback', () => {
  for (const scheme of ['http', 'https', 'ws', 'wss']) {
    const port = scheme === 'https' || scheme === 'wss' ? 443 : 80;
    const standard = scheme + '://localhost/sensitive-path';
    for (const endpoint of [standard, scheme + ':localhost/sensitive-path']) {
      const redact = endpointRedactor(endpoint);
      const equivalents = [
        standard + '/../sensitive-path',
        scheme + ':localhost/sensitive-path/../sensitive-path',
        scheme.toUpperCase() + '://LOCALHOST:' + port + '/sensitive-path/../sensitive-path',
        scheme.toUpperCase() + ':LOCALHOST:' + port + '/sensitive-path/.././sensitive-path',
      ];
      for (const echo of equivalents) {
        assert.equal(new URL(echo).href, new URL(endpoint).href);
        assert.equal(redact(echo), '[endpoint]', endpoint + ' <- ' + echo);
        assert.equal(redact('Node: ' + echo + ', unavailable'), 'Node: [endpoint], unavailable');
      }
      assert.equal(redact(citation), citation);
    }
  }
});

for (const compactConfig of [false, true]) test('actual repeated-path echo is fully redacted with ' + (compactConfig ? 'compact' : 'standard') + ' config', async t => {
  const f = await fixture(t, {repeatedPath: true});
  const config = {...f.config, endpoint: compactConfig ? f.config.endpoint.replace('http://', 'http:') : f.config.endpoint};
  const rpc = createRpc(config.endpoint);
  t.after(() => rpc.close());
  const observed = await collectSample(rpc, config);
  assert.equal(observed.identity.state, 'normal');
  const report = await createReport(config, [observed]);
  assert.equal(report.payload.samples[0].identity.chainName, '[endpoint]');
  assert.equal(report.payload.samples[0].rpc[0].result, '[endpoint]');
  assert.equal(report.payload.network.source, citation);
  assert.equal(f.requests, 9);
  assert.deepEqual(await importReport(JSON.stringify(report)), report);
});

test('exact configured fallback remains unconditional for text outside token scanner', () => {
  for (const endpoint of ['http:localhost/sensitive path', 'ht\ttp:localhost/sensitive-path']) {
    const redact = endpointRedactor(endpoint);
    assert.equal(redact('Configured: ' + endpoint), 'Configured: [endpoint]');
    assert.equal(redact(new URL(endpoint).href), '[endpoint]');
    assert.equal(redact(citation), citation);
  }
});
