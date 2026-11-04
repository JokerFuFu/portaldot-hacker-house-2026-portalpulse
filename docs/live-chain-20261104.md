# Actual V3 probe and browser acceptance, 4 November 2026

The participant signed a new native Revive deployment and record(1) on organizer-selected PortaldotV3 Test. The product collector then produced a complete six-stage RPC report. This checkpoint records that successful transaction; the failure catalog remains separately labeled artificial data.

## Exact deployment and update

| Field | Captured value |
| --- | --- |
| Contract | 0x7a7ceb705bb1886f2d7aee766c6e8ee8a3c42d2d |
| Caller H160 | 0xa8b69220b626457f4b718496ab516ccc6218d1cd |
| Deployment native tx | 0x2ea2e1a719b819f168807b6b3f97d618fc0bff2cbe2817f938803f5c6632e3b5 |
| Deployment native block / index | 318063 / 1 |
| Deployment native block hash | 0xa9b907e2da351e571e9958879112a082265bba18060d45373565c68a17bb4c49 |
| Update native tx | 0xdbfe322c6fabf4f39f5f21ecfebc2f583a5511ba2e429cd7a38d7ef99785c7f3 |
| Update native block / index | 318407 / 1 |
| Update native block hash | 0xe5144ef8ce45c61fe87f15b91a96410312dc6a2802ba19d18b105e28adc4e8e8 |
| Captured finalized native head | 318410 / 0x53a2c4da2707f985c1dc3047bcbd464a037569c6cefbfefda700dc20ab139d68 |
| Expected / read sequence | 1 / 1 |
| Report payload SHA-256 | 6dcdad84f91ac6ebd74ef333fb9371bea8839a9433ba2bc789edccd6dc12bf5b |

The deployment readback found matching System.ExtrinsicSuccess and Revive.Instantiated in the exact phase. Parent EVM code was empty. Inclusion and finalized code matched the exact 352-byte compiled runtime, and the initial caller sequence was 0. Actual deployment fee was 0.05110751235041 tPOT; actual CodeUpload/Storage holds totaled 40.566 tPOT. These are historical actual values, not a fee estimate for another transaction.

The update collector ran 09:18:34.282-09:18:49.718 UTC. Its 17 readonly calls succeeded, exit 0. It correlated the exact transaction/ApplyExtrinsic index, successful dispatch, matching SequenceRecorded contract/caller/uint64, three native parent edges, both EVM block aliases, exact runtime at inclusion/finality and sequenceOf(caller)=1 at the finalized EVM block hash. EVM inclusion hash was 0xb2d822081488c5c5bf8e5c6a9261c151ead587a633b463e78383210173661a1f; finalized EVM hash was 0x5a58181320472b598cd004f66b3b0e294a6e33afe459dbaf48217922f1afec49.

The optional submitted-at timestamp 2026-11-04T09:18:07.879Z came from an actual author_pendingExtrinsics first observation matching this exact transaction hash, account and call. The CLI calls its optional timestamp participant-supplied. It is an observed pending-pool timestamp, not an invented or exact wallet-send time. The earlier watch timed out before this observation; that failed watch and a separate metadata timeout remain in the private operator record.

## Original evidence

- [Deployment and 46-edge operator readback](evidence/portalpulse-v3-deployment-20261104.json)
- [Original portable execution report](evidence/portalpulse-v3-execution-report-20261104.json)
- [Product collector diagnostics](evidence/portalpulse-v3-collection-20261104.json)
- [Combined evidence index and trust scope](evidence/portalpulse-v3-live-checkpoint-20261104.json)
- [Real browser monitoring report](evidence/portalpulse-browser-monitor-20261104.json)
- [Deliberately wrong-identity browser report](evidence/portalpulse-browser-identity-mismatch-20261104.json)

## Actual browser acceptance

On the existing public Site6 console, the original execution report displayed six normal stages and exact sequence 1. The browser downloaded the JSON, reimported that actual file through the file chooser and preserved all facts/digest. The downloaded report also passed execution-inspect. Actual Chrome A4 printing produced four pages, inspected for facts, times, digest, repeated table headers and offline limitations. Only the active report printed. [A4 report](materials/20261104-final/portalpulse-real-execution-a4-20261104.pdf).

Separate real browser monitoring recorded 11 samples and 99 successful reads, 09:50:25.952-09:54:02.571 UTC. Best block advanced 318724 to 318760, finalized 318722 to 318758. The operator chose a custom-readonly profile with the official-source genesis; that original profile kind is retained. Stop changed the report to offline, and later freshness correctly became stale. This observation window is not a claim of continuous availability.

For a negative browser test, the operator deliberately changed only the expected genesis to 0x11 repeated 32 bytes. Nine real samples at 10:08:10.767-10:11:02.462 UTC still reached the same official node, but identity stayed abnormal with Genesis does not match configured identity. The correct expected genesis was restored afterward. No transaction was signed for this negative test.

## Replay and limits

~~~sh
npm ci --ignore-scripts
npm run build
node dist/cli/main.js execution-inspect --input docs/evidence/portalpulse-v3-execution-report-20261104.json
~~~

Expected exit 0 / normal / evidenceComplete=true / sequence 1. Browser execution review accepts the same report. Its mode is offline, origin rpc, verifiedNetwork=false, writeAllowed=false and fullVerification=false. Normal describes correlated supplied facts. Source authenticity, signature ownership, independent consensus and trie/storage proofs remain outside the report's scope.

The product collector has a 32-parent-edge window. Its historical replay path is the saved report, not a fresh collection of this old block against today's later head. The deployment operator helper separately verified 46 links. [Collector reference](probe-readback.md).

The earlier 594-test checkpoint belongs to November 3 at implementation baseline 6059a1d. Final-source clean-environment verification and publication have their own dated record in [development evidence](development-evidence.md). Platform approval and final submission are tracked separately in the [submission checklist](submission-checklist.md).
