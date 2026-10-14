# Readonly CLI

Use Node.js 22 or later. This increment has been tested on Node.js 26.8.2; final dependency/engine alignment is tracked separately. Build before invoking the CLI:

~~~sh
npm --userconfig /dev/null --cache /private/tmp/portalpulse-npm-cache --registry https://registry.npmjs.org ci --ignore-scripts
npm run build:core
node dist/cli/main.js --help
~~~

The script alias is npm run --silent cli -- <command> <options>. Direct invocation gives clean stdout suitable for JSON parsing. These commands never deploy, sign, or send transactions.

## Explicit local simulation

~~~sh
node dist/cli/main.js demo
node dist/cli/main.js demo --out /private/tmp/portalpulse-demo-report.json
node dist/cli/main.js inspect --input /private/tmp/portalpulse-demo-report.json
~~~

Use a new output path when repeating this flow: existing files are refused with exit 1. Missing parent directories are created. The demo contains six deterministic samples with fixed, openly simulated UTC dates beginning at 2026-10-14T00:00:00.100Z, conspicuous artificial deadbeef hashes, and origin: simulated. It uses a simulated analysis clock. Normal demo monitoring and exit 0 describe the simulated data; verifiedNetwork remains false. makeDemoSession() in src/demo/session.ts exposes the same core NetworkConfig and Sample types for UI reuse.

## Readonly custom profile

Start from examples/network-config.example.json. Its endpoint and expected genesis are null. Running it gives a clear unverified setup message, records one setup observation, makes zero network requests, and exits 2 promptly:

~~~sh
node dist/cli/main.js collect --config examples/network-config.example.json --samples 4 --interval-ms 10000
~~~

For a custom profile, set endpoint to an explicitly selected readonly HTTP/HTTPS/WS/WSS RPC URL and set expectedGenesis to the full 32-byte genesis hash from an independently trusted source. Keep source as the public provenance description/link and endpointAlias as a short public alias. Do not put the endpoint into these public fields. Username/password, query strings and fragments are rejected. There is no default network connection; historical competition RPCs are not configured or contacted automatically. Config files require exactly the example fields and are limited to 64 KiB.

~~~sh
node dist/cli/main.js collect --config /private/tmp/my-readonly-config.json --samples 4 --interval-ms 10000 --out /private/tmp/my-readonly-report.json
~~~

Defaults are 4 samples, 10,000 ms between completed samples, and an 8,000 ms deadline per RPC request. Samples are sequential without overlap. Sample count must be an integer from 1 through 2,000; interval must be an integer from 1 through 3,600,000 ms. Three consecutive sampled head increases are needed for the progress baseline, separately for best and finalized heads. A slow or unchanged finalized head can keep even four observations unverified. Sampled intervals do not prove unobserved block production times.

SIGINT aborts a pending RPC or interval wait, closes the transport, and writes retained evidence if --out was specified. A stopped collection may exit 1 if it contains an aborted/failed observation, or 2 if it only retains incomplete completed history. Failed observations remain in reports even when later requests succeed. An unconfigured endpoint keeps explicit unconfigured RPC errors; the setup status is unverified, while the analyzer exposes missing/failed evidence.

## Output and exit codes

Every successful command emits one compact JSON summary to stdout, including origin, mode, status, verifiedNetwork, interrupted, report metadata and monitoring checks. The report summary contains schema version, digest, public network labels, original collection start/end dates, sample count, interval and dropped-sample count. --out saves the full versioned report with RPC parameters, duration, result/error evidence, samples and SHA-256. The configured endpoint URL is excluded/redacted by shared report code. Errors and unverified setup messages go to stderr.

| Command/result | Exit | Meaning |
| --- | --- | --- |
| help or demo | 0 | Help or valid explicit simulation; no verified live network |
| inspect, valid schema and matching digest | 0 | Valid offline evidence import, including abnormal or stale history |
| collect, all checks normal and no retained failures | 0 | Configured readonly identity and sampled progress checks passed |
| collect, remaining evidence incomplete/unconfigured/interrupted | 2 | Unverified collection |
| collect, abnormal checks or retained RPC/identity failure | 1 | Abnormal evidence preserved |
| invalid options/config/input, tampered report, file/output error | 1 | Explicit failure |

Inspect always sets mode to offline and verifiedNetwork to false, preserves original origin and collection times, and evaluates freshness against the current clock. A valid imported report can show abnormal/stale monitoring and still exit 0. Inputs are limited to 16 MiB and go through the shared strict report validator and digest check. A matching SHA-256 detects changes to the payload; it does not establish source authenticity, an independent trust anchor, or network consensus. A configured genesis match only checks the identity selected by the operator.

## Development status

This is a partial readonly monitoring increment. Localhost HTTP/WS tests and the simulated demo do not count as real Portaldot V3 validation or acceptance of A03-A08/full A09. Probe contract deployment, transaction execution/finality/state readback, real V3 validation, Check-in, final submission, video and deck remain outstanding. Reports stay local until separately reviewed for publication.
