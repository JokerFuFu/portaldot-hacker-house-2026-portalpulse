# PortalPulse

**Official Check-in result: PASSED.** The organizer result document lists entry 10, PortalPulse (JokerFuFu), Node Operations & Tooling. [Source and review scope](docs/evidence/official-checkin-result-20261104.json). The old Windows rerun had three SIGINT-test failures; the current fresh594-test run was macOS Node24. Current Windows signal behavior has not been independently retested.

Node Operations & Tooling for Portaldot Hacker House 2026.

PortalPulse helps node operators and DApp builders see whether a network is advancing, where a transaction failed, and whether finalized caller state matches the requested update. It combines a readonly browser console, Node.js collectors, a small caller-specific Solidity probe, and portable JSON/print reports.

**4 November 2026: the participant deployed a new probe on the official V3 Test network and signed record(1).** The product collector matched the exact transaction, event, caller, finalized ancestry, compiled runtime and state value 1. The exported report passed browser download/reimport, CLI replay and actual four-page A4 printing. [Full evidence and scope](docs/live-chain-20261104.md).

- [Console and current materials](https://jokerfufu.github.io/portaldot-hacker-house-2026-portalpulse/)
- [Real execution JSON](docs/evidence/portalpulse-v3-execution-report-20261104.json), [deployment record](docs/evidence/portalpulse-v3-deployment-20261104.json) and [collection diagnostics](docs/evidence/portalpulse-v3-collection-20261104.json)
- [Pitch PDF](docs/materials/20261104-final/portalpulse-final-pitch-20261104.pdf), [editable PPTX](docs/materials/20261104-final/portalpulse-final-pitch-20261104.pptx), [reviewer guide](docs/materials/20261104-final/portalpulse-final-reviewer-guide-20261104.pdf), [demo video](docs/materials/20261104-final/portalpulse-real-demo-20261104.mp4)
- [Build 50050](https://dorahacks.io/build/50050), the original October 20 Check-in project. Platform submission and organizer approval are separate from technical acceptance. [Submission checklist](docs/submission-checklist.md).

**Fresh-environment acceptance, 4 November:** 80 locked packages, 594/594 tests, typecheck/build, saved-real-report replay and exact probe recompilation passed in an isolated checkout with an empty npm cache. [Command scope and source hashes](docs/evidence/final-reproduction-20261104.json).

## Recorded V3 deployment

| Item | Actual record |
| --- | --- |
| Probe H160 | 0x7a7ceb705bb1886f2d7aee766c6e8ee8a3c42d2d |
| Deployment native transaction | 0x2ea2e1a719b819f168807b6b3f97d618fc0bff2cbe2817f938803f5c6632e3b5 |
| Deployment native block | 318063, index 1 |
| record(1) native transaction | 0xdbfe322c6fabf4f39f5f21ecfebc2f583a5511ba2e429cd7a38d7ef99785c7f3 |
| Update native block | 318407, index 1 |
| Observed finalized head | 318410, three checked parent edges to inclusion |
| Runtime and state | Exact compiled 352-byte runtime at inclusion/finality, caller sequence 1 |

The participant performed wallet signing. The application never receives private keys, seeds or wallet backups. The probe stores only each caller's uint64 sequence and emits SequenceRecorded; it has no asset-transfer or administration function.

## Run locally

Use Node.js >=22.12 and npm, including the locked development dependencies. November 4 command captures use Node 24.22.1.

~~~sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
npm run dev
~~~

The terminal prints the localhost URL. Production browser files are in dist/site. npm run preview serves that build. Vite uses relative asset paths so a project-path static host also works.

Replay the saved real execution without a wallet or an RPC connection:

~~~sh
node dist/cli/main.js execution-inspect --input docs/evidence/portalpulse-v3-execution-report-20261104.json
~~~

Expected: exit 0, status normal, evidenceComplete=true, sequence 1. The report stays origin=rpc, mode=offline and verifiedNetwork/writeAllowed/fullVerification=false. In the console choose 执行复核 (execution review), import this JSON, inspect the six stages, export/reimport or print.

Collect a new readonly network observation using a new output path:

~~~sh
node dist/cli/main.js collect --config examples/portaldot-v3-config-20261022.json --samples 4 --interval-ms 10000 --out new-monitor-report.json
node dist/cli/main.js inspect --input new-monitor-report.json
~~~

The actual result may be normal, abnormal or unverified. The webpage starts without a default network connection. Configuration changes, Stop and switching views abort prior requests. Network reports retain their original collection window and become stale on replay.

## Functions and validation

| Module | Delivered behavior |
| --- | --- |
| Network identity | Expected/observed genesis, runtime, source and capability display. A real browser mismatch test stays abnormal. |
| Monitoring | HTTP/WebSocket RPC timings, best/finalized block progress, freshness and explicit failure states. Eleven real browser samples produced 99 successful reads on November 4. |
| Native execution collection | Exact native extrinsic hash/index and event phase, caller/contract/uint64 association, linked finalized headers and block-hash-pinned EVM code/state. |
| Probe | Pinned Solidity 0.8.24 / Paris compilation and actual V3 native Revive deployment/update. |
| Reports | Strict JSON schema/digest validation, network 16 MiB and execution 1 MiB limits, original timestamps, exact large integers, browser/CLI replay and printable active report. |
| Failure rehearsals | Six labeled artificial cases: complete, missing, execution failed, wrong transaction, unfinalized and state mismatch. |

~~~sh
node dist/cli/main.js execution-demo --scenario complete
node dist/cli/main.js execution-demo --scenario execution-failed
node dist/cli/main.js execution-demo --scenario state-mismatch
~~~

Complete exits 0, explicit abnormal cases exit 1, missing/unfinalized exit 2. They are synthetic tests, separate from the real successful participant transaction. Malformed input/output errors use stderr. Existing output paths are refused.

## Trust and reproduction limits

The selected organizer-source V3 genesis is 0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd, native RPC wss://test-node-v3.portaldot.dev, EVM RPC https://test-evm-rpc-v3.portaldot.dev, EVM chain ID 420420777. The [source-grounding record](docs/evidence/v3-identity-20261022.json) distinguishes official-source matching from independent consensus.

Reports describe RPC-supplied facts. SHA-256 detects content changes; it does not authenticate a source. No independent consensus, signature-ownership, body-trie or storage-proof verification is claimed. All imported execution reports stay offline with the three verification/write flags false, including a complete normal report. Browser monitoring is readonly.

The live probe collector checks at most 32 native parent edges and has a 90-second collection deadline. Run it shortly after a new update. **Use the saved JSON for historical replay**: collecting the November 4 transaction against a much later head can correctly return unverified. The deployment-only operator readback separately checked 46 edges; it does not expand the product collector's limit.

## Documentation and development record

- [Reviewer steps](docs/reviewer-guide.md), [CLI reference](docs/cli.md), [probe collector](docs/probe-readback.md), [deployment/toolchain](docs/probe-toolchain.md), [running and static hosting](docs/deployment.md)
- [Acceptance scope](docs/acceptance.md), [architecture and design](docs/design.md), [dated development evidence](docs/development-evidence.md), [schedule](docs/roadmap.md)
- [Dependency versions, licenses and attribution](docs/dependencies.md), [MIT license](LICENSE)

Product implementation commits were created during the October 14-November 6 development period. The native-probe collector baseline is 6059a1d. Earlier prototype material remains under dated docs/materials directories and retains its historical/synthetic limitations. AI assisted implementation and documentation; participant signatures and the actual chain/UI checks are recorded separately.
