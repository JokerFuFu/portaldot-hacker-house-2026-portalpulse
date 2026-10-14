# Readonly CLI

Use Node.js >=22.12. This increment has been tested locally on Node.js 26.8.2 / npm 11.19.1. Independent Node 22.12 clean-directory reproduction and scoped real-browser checks passed at 2f1a91e. Final fix code 49e6439, at revision 6b24591, subsequently passed independent Node 22.12 clean-archive installation, all 188 tests, type checking, production build and post-build CLI demo/inspect, each with exit 0. Scoped browser rechecks at 6b24591 cover the empty state, URL-shaped ID/alias rejection without an observation, simulation, non-RPC failure and Stop. Browser network-request counts were not measured in that check; download/file import, 390px layout and print-media evidence still belong only to 2f1a91e. See development-evidence.md for exact scope. Direct dependencies are exactly pinned: TypeScript 7.0.2, ws 8.22.0, React/react-dom 19.3.0, Vite 8.3.4 and official types (@types/node 22.20.5; @types/react and @types/react-dom 19.3.0). See dependencies.md for source and license details. Build before invoking the CLI:

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

For a custom profile, set endpoint to an explicitly selected readonly HTTP/HTTPS/WS/WSS RPC URL and set expectedGenesis to the full 32-byte genesis hash from an independently trusted source. Keep source as the public provenance description/link and endpointAlias as a short public alias. The CLI, web session and core share config validation before RPC I/O. ID and endpointAlias must be public labels without URLs. Do not put the configured endpoint or a URL-normalized equivalent into any public field; unrelated source citation URLs remain allowed. Username/password, query strings and fragments are rejected. There is no default network connection; historical competition RPCs are not configured or contacted automatically. Config files require exactly the example fields and are limited to 64 KiB.

~~~sh
node dist/cli/main.js collect --config /private/tmp/my-readonly-config.json --samples 4 --interval-ms 10000 --out /private/tmp/my-readonly-report.json
~~~

Defaults are 4 samples, 10,000 ms between completed samples, and an 8,000 ms deadline per RPC request. Samples are sequential without overlap. Sample count must be an integer from 1 through 2,000; interval must be an integer from 1 through 3,600,000 ms. Three consecutive sampled head increases are needed for the progress baseline, separately for best and finalized heads. A slow or unchanged finalized head can keep even four observations unverified. Sampled intervals do not prove unobserved block production times.

SIGINT aborts a pending RPC or interval wait, closes the transport, and writes retained evidence if --out was specified. A stopped collection may exit 1 if it contains an aborted/failed observation, or 2 if it only retains incomplete completed history. Failed observations remain in the retained window even when later requests succeed. Nonfinite node numbers such as JSON 1e999 become explicit bounded diagnostic strings, preserving the validation failure; the importer still rejects nonfinite JSON numbers. An unconfigured endpoint keeps explicit unconfigured RPC errors; the setup status is unverified, while the analyzer exposes missing/failed evidence.

## Output and exit codes

Every successful command emits one compact JSON summary to stdout, including origin, mode, status, verifiedNetwork, interrupted, report metadata and monitoring checks. The report summary contains schema version, digest, public network labels, original collection start/end dates, sample count, interval and dropped-sample count. --out saves the full versioned report with RPC parameters, duration, result/error evidence, samples and SHA-256. The configured endpoint URL and its URL-normalized equivalents are excluded/redacted by shared report code; this is not general secret discovery. Errors and unverified setup messages go to stderr.

| Command/result | Exit | Meaning |
| --- | --- | --- |
| help or demo | 0 | Help or valid explicit simulation; no verified live network |
| inspect, valid schema and matching digest | 0 | Valid offline evidence import, including abnormal or stale history |
| collect, all checks normal and no retained failures | 0 | Configured readonly identity and sampled progress checks passed |
| collect, remaining evidence incomplete/unconfigured/interrupted | 2 | Unverified collection |
| collect, abnormal checks or retained RPC/identity failure | 1 | Abnormal evidence preserved |
| invalid options/config/input, tampered report, file/output error | 1 | Explicit failure |

Inspect always sets mode to offline and verifiedNetwork to false, preserves original origin and collection times, and evaluates freshness against the current clock. A valid imported report can show abnormal/stale monitoring and still exit 0. Inputs are limited to 16 MiB and go through the shared strict report validator and digest check. Collection retains the newest window fitting both 2,000 observations and the complete compact UTF-8 report budget, including the envelope and digest. Wide legal observations can therefore produce fewer than 2,000 saved samples: droppedSamples counts all discarded observations, while startedAt / endedAt describe the actual retained window. CLI output saves this importable window; the live collector continues from that same window. A matching SHA-256 detects changes to the payload; it does not establish source authenticity, an independent trust anchor, or network consensus. A configured genesis match only checks the identity selected by the operator.

## Development status

This is a partial readonly monitoring increment. Localhost HTTP/WS tests and the simulated demo do not count as real Portaldot V3 validation or acceptance of A03-A08/full A09. Probe contract deployment, transaction execution/finality/state readback, real V3 validation, Check-in, final submission, video and deck remain outstanding. Reports stay local until separately reviewed for publication.
