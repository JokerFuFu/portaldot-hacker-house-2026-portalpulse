# PortalPulse acceptance and evidence scope

Updated 4 November 2026. Actual successful V3 probe integration and the browser report loop are complete. Negative cases preserve their actual local/artificial scope. Technical acceptance, source publication and the organizer's platform decision remain separate.

| ID | Requirement | Recorded evidence and scope |
| --- | --- | --- |
| A01 | Wrong network identity | Actual public browser changed only expected genesis to 0x11 repeated 32 bytes. Nine real samples stayed identity-abnormal despite successful RPC. Correct identity restored. No write path is enabled in the browser. |
| A02 | Timeout, stale and cancellation | Local transport/session tests cover the 8-second timeout and cancellation. Actual October 22 monitor and November 4 operator metadata preflight retained their metadata timeout. November 4 real browser Stop/offline later became stale. No new induced browser-network timeout is claimed. |
| A03 | Included execution failure | Artificial execution-failed/revert tests and six-case browser/CLI rehearsal stay abnormal. Actual participant update succeeded; no actual failed participant update was induced for this case. |
| A04 | Another transaction's success | Wrong-transaction artificial tests reject another hash/phase. The real positive update separately matched exact native hash/index, contract, caller and uint64. The negative case remains a fixture. |
| A05 | Not finalized | Artificial unfinalized/fork tests remain unverified. Actual participant update was observed pending and later matched to finalized 318410 with three exact parent links. Independent consensus remains outside scope. |
| A06 | State mismatch | Artificial exact-uint64 mismatch remains abnormal. Actual pinned readback after record(1) matched 1; no false claim of an actual-chain mismatch. |
| A07 | Report modification | Strict field/digest/size tests and dated October browser tamper rejection preserve a prior valid report. November 4 real download/reimport preserved the exact report and digest. |
| A08 | Actual complete flow | Passed in official-source RPC scope: new deployment 318063, update 318407, exact success/probe events, finalized ancestry, pinned code/state 1, actual browser export/file-reimport/CLI replay and four-page A4 print. [Evidence](live-chain-20261104.md). |
| A09 | Fresh environment | Passed November 4 in a fresh147-file checkout and initially empty npm cache:80 locked packages,594/594 tests, typecheck/build, exact saved-real-report replay and probe recompilation. Functional bytes match the snapshot. [Dated record](evidence/final-reproduction-20261104.json). Earlier clean-install evidence remains historical. |
| A10 | Public delivery/privacy | Final public source, JSON, media, hosted assets and source ZIP are checked as a bounded release inventory. Final release/readback record is separate from individual file existence; no wallet backup/private key/seed/contact/local path belongs in the public package. |

## Exact monitoring rules

- Default sample interval 10 seconds, per-request timeout 8 seconds.
- Original observation window and last update remain visible. Offline imports never become live automatically.
- At least three adjacent observed block changes establish a baseline. Before that progress is unverified.
- After the baseline, stalled threshold is max(180 seconds, 3 times median observed block interval). Reachability, freshness, best progress and finalized progress are separate.
- Network reports retain at most 2,000 samples and 16 MiB compact UTF-8 JSON, showing dropped count/window. Execution reports are limited to 1 MiB without truncating facts.
- Complete evidence, missing evidence and explicit failure produce distinct results. Stop/config changes abort old work. New writes never auto-resign or resend.

## Scope

The probe stores only the caller's uint64 test sequence. The browser is readonly. Native deployment/update were signed manually by the participant on the confirmed official-source testnet.

All execution imports stay mode=offline with verifiedNetwork/writeAllowed/fullVerification=false. SHA-256 checks content integrity. RPC source authenticity, signature ownership, independent consensus and trie/storage proofs are not established by a normal report. Live probe collection has a 32-parent-edge window and 90-second deadline; use saved JSON for historical replay. Deployment's separate operator readback checked 46 edges.

Historical browser narrow-layout, keyboard, pending-export cancellation and 26-page synthetic print checks retain their October dates and code attribution in [development evidence](development-evidence.md). [Current reviewer steps](reviewer-guide.md) and [platform checklist](submission-checklist.md).
