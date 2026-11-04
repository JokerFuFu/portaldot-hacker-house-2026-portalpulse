# PortalPulse reviewer guide

Updated 4 November 2026. Track: Node Operations & Tooling.

[Console](https://jokerfufu.github.io/portaldot-hacker-house-2026-portalpulse/) · [Materials](https://jokerfufu.github.io/portaldot-hacker-house-2026-portalpulse/materials/) · [Source](https://github.com/JokerFuFu/portaldot-hacker-house-2026-portalpulse) · [Build 50050](https://dorahacks.io/build/50050)

## Review the real participant update

1. Download the [real execution report](evidence/portalpulse-v3-execution-report-20261104.json).
2. Open the console and select 执行复核 (execution review), then 导入执行JSON (import execution JSON). Choose that file, or paste its JSON.
3. Check six normal stages, contract 0x7a7ceb705bb1886f2d7aee766c6e8ee8a3c42d2d and caller sequence 1. The finality table links native 318410 back to inclusion 318407. Review the original times and digest 6dcdad84f91ac6ebd74ef333fb9371bea8839a9433ba2bc789edccd6dc12bf5b.
4. Export, reimport and print. Source rpc and mode offline remain visible, with verifiedNetwork/writeAllowed/fullVerification=false. These flags describe the imported report's trust boundary, even when all supplied facts agree.

[Exact deployment/update evidence and scope](live-chain-20261104.md). The actual November 4 browser download/file-reimport, CLI replay and four-page A4 print passed. A separate 11-sample / 99-read real monitoring window and deliberately mismatched expected-genesis test are saved alongside it.

## Reproduce locally

~~~sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
node dist/cli/main.js execution-inspect --input docs/evidence/portalpulse-v3-execution-report-20261104.json
npm run dev
~~~

Use Node.js >=22.12 and the exact lockfile, including development dependencies. The saved real report replays without RPC access or a wallet. The live collector is for a recent new transaction: it checks at most 32 parent edges and a 90-second collection deadline. A much later fresh read of the saved November 4 block can correctly be unverified. [Collector usage](probe-readback.md).

## Six synthetic failure rehearsals

Changing 模拟验收场景 (rehearsal scenario) immediately reviews deterministic artificial facts. All stay origin=simulated / mode=offline with three false verification/write flags. They exercise the actual evaluator, not hardcoded result labels. Synthetic sequence 9007199254740993 remains an exact decimal string.

| Scenario | Expected result | CLI exit |
| --- | --- | --- |
| complete | All supplied stages consistent | 0 |
| missing-evidence | Execution/finality/state unverified | 2 |
| execution-failed | Included call explicitly failed | 1 |
| wrong-transaction | Another transaction's success rejected | 1 |
| unfinalized | No finality/readback claimed | 2 |
| state-mismatch | Exact expected/observed values differ by 1 | 1 |

~~~sh
node dist/cli/main.js execution-demo --scenario complete
node dist/cli/main.js execution-demo --scenario wrong-transaction --out new-wrong-transaction.json
node dist/cli/main.js execution-inspect --input new-wrong-transaction.json
~~~

The last two commands intentionally exit 1 and preserve abnormal evidence. Missing/unfinalized exit 2. Output paths must be new. Malformed input/output errors emit stderr and do not claim a successful report. The failure/revert/fork catalog does not claim induced failures on the actual testnet.

## Network reports and trust

Network JSON uses the network-observation importer, not execution review. It retains its original collection window and can become stale. The November 4 [real monitor report](evidence/portalpulse-browser-monitor-20261104.json) and [wrong-identity report](evidence/portalpulse-browser-identity-mismatch-20261104.json) demonstrate this distinction.

The selected organizer-source V3 genesis is crosschecked against RPC block 0 and local header hashes. SHA-256 establishes content integrity, not source authenticity. Independent consensus, transaction-signature ownership and storage proofs are outside this tool's delivered verification scope. No secret or signature is needed for report review.

Check-in was submitted October 20 as Build 50050, originally Under Review. Technical evidence, a saved final artifact and a platform final-submission receipt are distinct records. [Submission status](submission-checklist.md).
