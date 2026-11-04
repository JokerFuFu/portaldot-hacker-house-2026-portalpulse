# PortalPulse review checkpoint, 4 November 2026

The participant-probe core flow is complete in the official-source V3 RPC scope: new deployment, record(1), exact native events, linked finalized headers and caller state 1. Browser export/file-reimport, CLI replay and actual four-page A4 printing also passed. [Full chain facts and original timestamps](live-chain-20261104.md).

## Final review package

- [Eight-slide Pitch PDF](materials/20261104-final/portalpulse-final-pitch-20261104.pdf) and [editable PPTX](materials/20261104-final/portalpulse-final-pitch-20261104.pptx)
- [Three-page reviewer guide](materials/20261104-final/portalpulse-final-reviewer-guide-20261104.pdf)
- [Actual-data demo video](materials/20261104-final/portalpulse-real-demo-20261104.mp4), [captions](materials/20261104-final/portalpulse-real-demo-20261104.en.srt) and [scene/source manifest](materials/20261104-final/manifest.json)
- [Original real execution report](evidence/portalpulse-v3-execution-report-20261104.json), [deployment](evidence/portalpulse-v3-deployment-20261104.json), [collector diagnostics](evidence/portalpulse-v3-collection-20261104.json)
- [Actual A4 report](materials/20261104-final/portalpulse-real-execution-a4-20261104.pdf), [real browser monitoring](evidence/portalpulse-browser-monitor-20261104.json), [deliberate expected-genesis mismatch](evidence/portalpulse-browser-identity-mismatch-20261104.json)

The video combines genuine product screenshots, actual printed pages and captured outputs, with English captions. It is an edited walkthrough of real records, not uninterrupted interaction footage. Captures retain original dates, offline/RPC flags and any earlier Site6 wording. No wallet signing footage, keys or personal contacts appear.

## Evidence scope

| Checkpoint | Actual scope |
| --- | --- |
| New deployment, native 318063 | Participant signature, exact successful dispatch/Instantiated, empty parent code, exact 352-byte deployed runtime and initial caller state 0. Deployment-only helper checked 46 parent links. |
| New record(1), native 318407 | Exact pending-pool observation, 17 successful collector reads, native phase/contract/caller/sequence, final head 318410 and three parent links, pinned EVM runtime and caller state 1. |
| Real report browser loop | Six normal stages, actual download and file reimport, semantic identity/digest retained, CLI exit 0 and four A4 pages inspected. |
| Real browser monitoring | Eleven samples / 99 successful reads, 09:50:25.952-09:54:02.571 UTC, best 318724-318760, finalized 318722-318758. Stop/offline and later stale status retained. |
| Wrong-identity browser check | Deliberately changed expected genesis only. Nine real samples remained abnormal although RPC calls succeeded. |
| Synthetic failure catalog | Six deterministic rehearsals, including failed/revert/fork/wrong-link/state cases. These are not real failed participant transactions. |
| Earlier November 4 material | Morning four-sample/36-read CLI report and 144-second pending-probe video remain dated historical records in materials/20261104. They are superseded for current review. |

The original real report payload SHA-256 is 6dcdad84f91ac6ebd74ef333fb9371bea8839a9433ba2bc789edccd6dc12bf5b. Offline source verification, independent consensus and trie/storage proofs remain false/outside scope. The collector is limited to 32 parent edges for a fresh collection; saved reports support historical replay.

## Reproduce

~~~sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run build
node dist/cli/main.js execution-inspect --input docs/evidence/portalpulse-v3-execution-report-20261104.json
~~~

Use Node.js >=22.12. New complete-package validation retains its own command/environment record in [development evidence](development-evidence.md). [Browser steps and expected negative results](reviewer-guide.md).

## Platform

The original Check-in was submitted October 20 as Build 50050. Final platform submission and organizer approval require their own readback. The November 4 technical core result does not itself claim either. Final deadline/freeze last verified November 3: November 6 at 04:00 UTC / 12:00 Asia/Shanghai. Demo Day dates are November 8-9 UTC, participant slot unconfirmed. [Submission checklist](submission-checklist.md).
