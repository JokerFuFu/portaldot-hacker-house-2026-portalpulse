# PortalPulse review checkpoint - 4 November 2026

Track **Node Operations & Tooling**. Builder **JokerFuFu**, with AI-assisted development and actual competition-period Git history.

This checkpoint provides refreshed review materials for source 6059a1dbde747501be826696573a06a35ae28178. The new files contain official V3 readonly observations, a dated historical transaction and explicitly synthetic rehearsals. Participant-probe deployment, a new live update and final platform submission remain pending.

## Review materials

- [Eight-slide Pitch Deck PDF](materials/20261104/portalpulse-review-pitch-20261104.pdf)
- [Editable Pitch Deck PPTX](materials/20261104/portalpulse-review-pitch-20261104.pptx), including the editable architecture and source notes
- [Three-page reviewer guide PDF](materials/20261104/portalpulse-reviewer-guide-20261104.pdf)
- [144-second captioned CLI walkthrough MP4](materials/20261104/portalpulse-cli-walkthrough-20261104.mp4)
- [English captions](materials/20261104/portalpulse-cli-walkthrough-20261104.en.srt) and [video scene/source manifest](materials/20261104/video-manifest-20261104.json)
- [Actual four-sample monitor report](materials/20261104/monitor-report.json) and [CLI evidence summary](materials/20261104/cli-evidence-20261104.json)
- [Reproduced local probe artifact](materials/20261104/PortalPulseProbe.json)

The video is an edited output-snapshot walkthrough, silent with burned-in English captions. Its selected data fields come from actual CLI executions and the linked reports. It includes synthetic scenarios and the November 3 historical transaction. The full new participant-probe demonstration remains pending.

## Evidence and original dates

| Evidence | Actual scope |
| --- | --- |
| 4 Nov, 02:08:16.520-02:09:21.268 UTC | Four official V3 monitoring samples, 36 successful readonly RPC requests, collection exit 0 and status normal. Best 314148 to 314159, finalized 314146 to 314157, configured genesis matched, runtime 3002 / transaction 2. |
| 4 Nov monitor replay | Same report, mode offline and verifiedNetwork=false. Captured freshness abnormal/stale, retained with valid schema/digest and inspect exit 0. |
| 3 Nov historical RPC transaction, replayed 4 Nov | Native inclusion 299780 and observed finalized head 299784, four checked parent links. Probe intent uses zero contract/caller placeholders. Submission, matching probe execution and state evidence absent. Replay exit 2 / unverified. |
| 4 Nov six CLI rehearsals | Actual commands, synthetic facts. Complete exit 0, missing/unfinalized exit 2, explicit failures exit 1. All remain offline with three false verification/write flags. |
| 4 Nov probe compilation | solc 0.8.24, Paris, optimizer 200, metadata hash none. 384-byte creation / 352-byte runtime. Whole artifact matches October 22 bytes, SHA-256 c24969a5916a942aed355d3f77d9aea3527d3b6138b78c89cbfbd67cda3a8e33. |
| 3 Nov implementation validation | 594 full-suite tests, type checks and build passed at 6059a1d. That full suite was not rerun for this documentation/media update. |
| 16 Oct screenshots in the Deck | Genuine public UI initial view and synthetic execution review, retaining their original dates and scope. |
| 16 Oct print acceptance | Existing five scenarios / 26 A4 pages, with six-case browser additions on October 21. New GUI print acceptance was not performed for this refresh. |

Monitor payload digest is 6928a59da42505e5b7dbdf20364d202c1a59e44caac9b4f4d95785b5a4fa8c34. Historical execution-report digest remains 5951443419f352bbcdb252ff9c5d8f9a34e89b0d6ac8b854c5a309a129412c65. A digest checks content integrity. Configured genesis matching is a selected-source identity check. Source authenticity, storage proofs and independent consensus require their own evidence.

## Reproduce

Use Node.js >=22.12 and the lockfile dependencies, including development dependencies. November 4 command captures used Node 24.22.1.

~~~sh
npm ci --ignore-scripts
npm run build:core
node dist/cli/main.js execution-demo --scenario complete
node dist/cli/main.js execution-demo --scenario state-mismatch
node dist/cli/main.js inspect --input docs/materials/20261104/monitor-report.json
node dist/cli/main.js execution-inspect --input docs/evidence/probe-readback-historical-report-20261103.json
~~~

| Synthetic scenario | Expected status | CLI exit | Importable report |
| --- | --- | --- | --- |
| complete | normal | 0 | [JSON](materials/20261104/scenario-complete.json) |
| missing-evidence | unverified | 2 | [JSON](materials/20261104/scenario-missing-evidence.json) |
| execution-failed | abnormal | 1 | [JSON](materials/20261104/scenario-execution-failed.json) |
| wrong-transaction | abnormal | 1 | [JSON](materials/20261104/scenario-wrong-transaction.json) |
| unfinalized | unverified | 2 | [JSON](materials/20261104/scenario-unfinalized.json) |
| state-mismatch | abnormal | 1 | [JSON](materials/20261104/scenario-state-mismatch.json) |

All execution reports remain mode=offline, verifiedNetwork=false, writeAllowed=false and fullVerification=false. Use the network-observation importer for the monitor report and execution review for an execution report. Original timestamps and the decimal sequence 9007199254740993 are retained. [Webpage rehearsal steps](reviewer-guide.md).

To take a new readonly network sample, explicitly choose the organizer-source profile and use a new output path. Existing outputs are refused.

~~~sh
node dist/cli/main.js collect \
  --config examples/portaldot-v3-config-20261022.json \
  --samples 4 --interval-ms 10000 --out new-monitor-report.json
~~~

The run may return normal, abnormal or unverified according to observed facts. Keep the exact output and collection times. [CLI behavior and exit codes](cli.md).

## Real-probe handoff

The [native Revive collector](probe-readback.md) is implemented and exports the existing ExecutionReport format. It correlates the exact event phase, contract, caller and uint64, validates at most 32 parent links, checks EVM block identity, compares compiled runtime and reads caller state at a fixed EVM block hash. Full positive-path cases were exercised with artificial fixtures and local HTTP services.

Before deployment, confirm the actual wallet account, mapping, fresh test balance, fee and finite storage-deposit budget. The participant then signs the new probe deployment and record(uint64). Preserve actual contract/caller H160, native block/extrinsic hashes, exact sequence, submission time and wallet receipt. The October 27 candidate estimate/cap remain dated preflight evidence. [Deployment toolchain and gate](probe-toolchain.md).

Run the collector shortly after inclusion, replacing its documented variables with those actual receipts. Keep both probe-report.json and probe-collection.json. The latter retains transport/collection diagnostics that may not be represented in the exported report. The current collection window is 32 native parent edges and the collection deadline is 90 seconds.

## Platform and schedule

Check-in was submitted on October 20 as [Build 50050](https://dorahacks.io/build/50050). The original platform readback was Under Review. Organizer approval and the current owner-only review state remain unconfirmed. There was no new platform submission during this media refresh.

Final submission and code freeze are November 6 at 04:00 UTC / 12:00 Asia/Shanghai, last read from the official event page on November 3. Demo Day is November 8-9 UTC dates, with the participant slot still pending. The final receipt, participant-probe evidence and corresponding media still need completion. [Official event](https://dorahacks.io/hackathon/portaldot-hacker-house-2026/detail).

Potential ecosystem support would fund real-probe validation and operator trials. Hosted monitoring and shared history remain product hypotheses. [Design and next steps](design.md).
