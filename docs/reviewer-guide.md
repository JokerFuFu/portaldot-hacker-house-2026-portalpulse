# PortalPulse reviewer guide

Updated October21,2026. Track: **Node Operations & Tooling**.

[Open the prototype](https://portalpulse-jokerfufu-2026-readonly.jokerfu.chatgpt.site/) · [Materials](https://portalpulse-jokerfufu-2026-readonly.jokerfu.chatgpt.site/materials/) · [Public source](https://github.com/JokerFuFu/portaldot-hacker-house-2026-portalpulse) · [Build50050](https://dorahacks.io/build/50050)

## What you can verify now

PortalPulse separates reachability, network identity, execution, finality and caller-specific state readback. The readonly console and offline execution checker work without a wallet. Six deterministic rehearsal scenarios make failures and missing evidence directly reproducible; they exercise the real report evaluator, not prewritten status labels.

The progress materials were submitted with Build50050 on October20. The last platform readback was **Under Review**, not approval or final submission. The public record is a project-maintained index of actual platform UI observations, not a platform-issued certificate: [submission scope](evidence/checkin-submission-20261020.json).

**No recognized-V3 probe deployment or complete live execution is claimed.** Every execution rehearsal has `origin=simulated`, `mode=offline`, `verifiedNetwork=false`, `writeAllowed=false`, `fullVerification=false`. Even the complete scenario means supplied facts agree internally; it does not authenticate the source or establish independent consensus.

## A 90-second browser rehearsal

1. Open the prototype and switch from 网络观测 (network observation) to 执行复核 (execution review). No default RPC is started.
2. Click 加载模拟执行 (load simulated execution) for the default complete case. See the six stages, original synthetic time and exact sequence `9007199254740993`.
3. Use 模拟验收场景 (rehearsal scenario). Changing it immediately performs local review. Try the two execution failures: an included-but-failed call and a successful result belonging to another transaction. Both must be abnormal.
4. Choose missing evidence or unfinalized. Missing facts remain unverified; later facts never fill a missing stage by inference.
5. Choose state mismatch. The report retains expected `9007199254740993` and observed `9007199254740992` without rounding.
6. Export the execution report, then import that JSON through 导入执行JSON. The original facts, origin, times and SHA-256 remain. Change a payload field without updating its digest and reimport: validation rejects it while retaining the last valid report.

The selector and editor do not appear in a printed report. Existing October16 A4 samples and captioned video retain their original synthetic scope; they do not document this new selector or any live transaction.

## Expected results

| Scenario ID | Browser choice | Expected result | CLI exit |
|---|---|---|---|
| `complete` | 完整事实一致 | All supplied facts internally consistent; trust/write flags still false | 0 |
| `missing-evidence` | 缺少执行证据 | Execution absent; execution/finality/state conclusions unverified even with later facts | 2 |
| `execution-failed` | 已纳入但执行失败 | Included transaction with explicit execution failure stays abnormal | 1 |
| `wrong-transaction` | 成功事件属于其他交易 | Success outcome cannot pass when its transaction differs | 1 |
| `unfinalized` | 尚未最终确认 | Execution success with finality/readback absent stays unverified | 2 |
| `state-mismatch` | 状态回读不匹配 | Caller-specific sequence differs by1; both exact integers retained | 1 |

## Run the same cases locally

Use Node.js >=22.12 and the locked dependencies. From the repository:

~~~sh
npm --userconfig /dev/null --cache /private/tmp/portalpulse-npm-cache --registry https://registry.npmjs.org ci --ignore-scripts
npm test
npm run typecheck
npm run build
node dist/cli/main.js execution-demo --scenario complete
node dist/cli/main.js execution-demo --scenario wrong-transaction --out /private/tmp/portalpulse-wrong-transaction.json
node dist/cli/main.js execution-inspect --input /private/tmp/portalpulse-wrong-transaction.json
~~~

The last two commands intentionally exit1 for abnormal evidence, with a diagnostic JSON summary and a saved/inspectable report. This is different from malformed input or an output error, which emits stderr and no successful summary. Missing-evidence and unfinalized intentionally exit2. Omit `--scenario` for complete. Use a new output path on repeats; existing files are never overwritten. `--config` and RPC options are not accepted by this command.

Behavior revision `5ad3fe6` passed99 focused and507 full Node22.12 tests plus type checking/build. This increment reuses pinned dependencies; no fresh installation is claimed for it. Earlier clean-install, print and media checks retain their own revisions and dates in [development evidence](development-evidence.md).

## Remaining live integration

The October17 real readonly monitoring report is historical RPC evidence, separate from these synthetic rehearsals. It keeps original collection time and unverified identity: [historical record](evidence/v3-monitoring-20261017.json). Observing a genesis from the same RPC does not independently authenticate that endpoint.

Before preparing a probe deployment: obtain independently trusted organizer-recognized V3 Test identity, compare it with live block0, verify the actual selected wallet origin/mapping/funds, and record/test compiler options and bounded gas/storage exposure. Only then request the user's signature. Deployment receipt, update call, finality ancestry and anchored state readback must all be collected before claiming a complete real flow.

The final integrated video, deployment evidence and final DoraHacks submission remain outstanding. No signature, transaction or organizer message is required to run this rehearsal. Existing event dates are recorded separately in [the submission checklist](submission-checklist.md).
