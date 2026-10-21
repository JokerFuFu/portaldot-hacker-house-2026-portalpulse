# Offline execution evidence

The M2A increment validates and evaluates supplied execution facts locally; M2B adds detached versioned execution report creation/import and CLI export. It does not connect to RPC, decode SCALE/events, use a wallet, deploy a probe, sign a call, or collect new execution facts. `origin: rpc` describes the supplied provenance and is not source authentication. The supplied JSON has no endpoint field. This format is separate from the M1 monitoring report and its SHA-256 envelope; it is not accepted by the monitoring report importer. M2C adds a separate local execution-review view to the existing web app.

Build with Node.js >=22.12, then run:

~~~sh
npm run build:core
node dist/cli/main.js execution-inspect --input examples/execution-simulated.example.json
node dist/cli/main.js execution-report --input examples/execution-simulated.example.json --out /private/tmp/portalpulse-execution-report.json
node dist/cli/main.js execution-inspect --input /private/tmp/portalpulse-execution-report.json
~~~

The example is entirely synthetic, including its addresses, hashes, heights and fixed 2026-10-14 timestamps. It declares expected/read sequence `9007199254740993`, stored and compared as a decimal string beyond JavaScript's safe integer boundary. Its result is `mode: offline`, `origin: simulated`, `status: normal`, `evidenceComplete: true`, `verifiedNetwork: false`, `writeAllowed: false`, `fullVerification: false`. No fact in the example is claimed as a Portaldot observation. A zero value can be read and compared, but cannot establish that an update executed successfully.

## API and strict structure

The public core exports `parseExecutionEvidence(text: string): ExecutionEvidence`, `validateExecutionEvidence(value: unknown): ExecutionEvidence` and `evaluateExecutionEvidence(value: unknown): ExecutionSummary`, plus their types. The validator returns a detached clone; parser/evaluator reuse that same validator. Parsing limits actual UTF-8 input to **1 MiB**, uses concise JSON errors, and validates the complete structure. Direct evaluation validates unknown objects and creates detached data before analysis. Neither API mutates the input or retains caller-owned references in its result.

All fields are required and unknown fields are rejected at every object level. The five stage fields may each be `null`; later stages never supply a missing earlier stage.

| Field | Shape |
| --- | --- |
| executionSchemaVersion | `1` |
| origin | `rpc` or `simulated` |
| network | M1 public config (`id`, `name`, `source`, `endpointAlias`, `kind`, `expectedGenesis`), plus nullable `observedGenesis`; no `endpoint` |
| intent | `vm` (`revive`, `evm`, `wasm`), `contract`, `caller`, `expectedSequence` |
| submitted | `transactionHash`, `observedAt`, or null |
| inclusion | `transactionHash`, `block`, `transactionIndex`, `transactions`, `observedAt`, or null |
| execution | `transactionHash`, `blockHash`, `transactionIndex`, `outcome` (`success` or `failure`), `failureReason`, `observedAt`, or null |
| finality | `genesisHash`, `finalized`, `ancestry`, `observedAt`, or null |
| readback | `genesisHash`, `blockHash`, `contract`, `caller`, `sequence`, `observedAt`, or null |

A block contains exactly `hash`, canonical decimal `number`, and `parentHash`. Hashes are 32-byte `0x` hex; comparisons ignore hex letter case. Heights are canonical nonnegative decimal strings of at most 309 characters. Sequences are canonical decimal uint64 strings (`0` through `18446744073709551615`). Indices must be finite nonnegative safe integers; the inclusion index must be inside its transaction array. Arrays must be dense, without extra fields, and contain at most **8192 transactions / 512 ancestry blocks**. Non-JSON prototypes, accessors, symbols, unknown fields, nonfinite numbers, invalid hashes/decimals, control characters and malformed timestamps are rejected.

Contract/caller identifiers are bounded to 128 characters and cannot be URL-shaped. Hex-20 identifiers compare case-insensitively; opaque native identifiers compare exactly, with no implied SS58/H160 mapping. A successful outcome requires `failureReason: null`; failure requires a nonempty reason of at most 512 characters without controls. `observedAt` uses canonical UTC `YYYY-MM-DDTHH:mm:ss.sssZ`; present stages must be nondecreasing in submitted → inclusion → execution → finality → readback order. No current-time or endpoint default is inferred.

## Six checks and result meaning

| Check | Required evidence |
| --- | --- |
| network | `event-testnet`, non-null matching expected/observed genesis; known historical mainnet identity blocked |
| submission | Submission hash and normal network check |
| inclusion | Submitted hash matches both inclusion hash and `transactions[transactionIndex]` |
| execution | Successful outcome matches inclusion transaction, block hash and index |
| finality | Matching observed genesis; path begins at exact finalized block and ends at exact inclusion block, including height/parent; each parent link and height step matches; no duplicate hashes or cycles |
| state | Matching observed genesis and finalized hash, intent contract/caller and expected uint64 sequence |

A single-block ancestry path is sufficient when finalized and inclusion are the exact same block. Merely observing a higher finalized height is insufficient. Missing paths fail. Explicit failure or a known mismatch stays abnormal even if other evidence is incomplete; incomplete prerequisites prevent downstream normal status. Missing stages and missing expected/observed genesis remain unverified. Mainnet/custom profiles are abnormal for this execution workflow.

The historical mainnet genesis `0x83b5212c69f85f3996f8696bb35bf913af51b176a5f53d0a74fd3a83dc0b8a54`, recorded in [network preflight](network-preflight.md), is blocked even when a supplied profile relabels it as `event-testnet`. It is a historical denial value, not a newly confirmed V3 parameter or an allowlist for unknown V3 networks. A configured matching genesis establishes only consistency with the operator's supplied identity.

`evidenceComplete` is true only when all six checks are normal. Aggregate `status` is abnormal if any check is abnormal, otherwise normal if all pass, otherwise unverified. `expectedSequence` and nullable `observedSequence` remain visible even on failure. Every result contains offline/provenance/trust labels and permanently false `verifiedNetwork`, `writeAllowed`, and `fullVerification`. A normal result establishes internal consistency of supplied facts, not independent finality/consensus or source authenticity.

Raw inspection emits one compact summary JSON for well-formed evidence: complete offline flow exits **0**, partial/unverified flow **2**, abnormal flow **1**. Malformed input, unreadable/oversized files, and missing/duplicate/unknown arguments exit **1** with an error on stderr and no stdout. Only `--input path` is accepted; there is no output overwrite, network collection or signing flag.

## Versioned execution reports (M2B)

The final M2B code 3e7b607 and documentation checkpoint d842530 were publicly delivered on 2026-10-15: focused 139/139, full 424/424, typecheck and build passed; 52 source files and the source ZIP were anonymously read back byte-for-byte. Initial 117a84c with 419/419 is historical. This delivery did not update the M1 Site or establish real V3 execution.

The core exports `createExecutionReport(value: unknown): Promise<ExecutionReport>` and `importExecutionReport(text: string): Promise<ExecutionReport>`. The envelope has exactly three own JSON fields:

~~~ts
interface ExecutionReport {
  executionReportVersion: 1;
  payload: ExecutionEvidence;
  sha256: string; // exactly 64 lowercase hexadecimal characters
}
~~~

Creation validates unknown evidence before any serialization, detaches every network/intent/stage object and array before the first await, then hashes only that validated payload. M1's exact canonical serializer and byte digest implementation are shared internally: object keys sort recursively, array order is preserved, and normal JSON primitives retain their values. No summary, mode or current timestamp is stored. The M2A evidence schema/evaluator and M1 version-1 digest/retention semantics remain unchanged.

Both the complete compact exported envelope and the complete imported text are limited to **1048576 UTF-8 bytes**, inclusive; imported whitespace counts. Oversize execution facts are rejected, never truncated. Import checks the bound, parses the exact envelope/version/hash structure, validates/clones its payload, rejects any change between the parsed and validated payload values using recursively sorted object keys, verifies SHA-256, and returns detached evidence. Object key order and JSON whitespace remain equivalent. Raw evidence creation retains M2A normalization (for example, uppercase `network.expectedGenesis` becomes lowercase); saved envelopes must already use those canonical field values. Changing expectedGenesis casing is rejected even with a recomputed digest. Unknown fields, forged status/verification fields and tampering fail. Structurally valid abnormal or partial evidence remains importable for diagnosis.

Consumers must call `evaluateExecutionEvidence(report.payload)` after import. Matching integrity cannot establish normal status, source authenticity, current liveness, independent consensus or real V3 work. Changing origin while retaining the previous digest is detected; a person who changes facts and recomputes the digest has not authenticated those facts.

`execution-report --input path --out path` saves the complete compact envelope to a new file, then prints the recomputed summary with `report: {executionReportVersion: 1, sha256, integrity: 'sha256-content-only; not source authenticity'}`. Partial/abnormal evidence is saved even with exits 2/1. Missing/duplicate/unknown flags, malformed inputs, existing outputs and write errors fail with no successful stdout. `execution-inspect --input path` accepts raw evidence or an envelope; an explicit own version field selects strict report import without fallback. It emits the same report metadata only for envelopes. See [CLI behavior](cli.md).

Runtime-specific decoding, trusted real V3 identity, probe deployment/update, wallet signatures, live inclusion/execution/finality collection and pinned-block readback remain pending. The M2C web/print flow below does not collect live facts. Its public release3 and subsequent actual print acceptance are described below. The synthetic tests do not satisfy real-chain A03–A08 or full A09 acceptance. Verification records and their actual revisions appear in [development evidence](development-evidence.md).

## Offline execution web and print flow (M2C, 2026-10-16)

Run the existing app with Node.js >=22.12 and the locked dependencies. The initial view is 网络观测. Choose 执行复核 to stop any monitoring collection while retaining the separate network and execution records. Switching back does not restart collection automatically.

1. Choose 加载模拟执行 for the exact synthetic example above, use 导入执行JSON, or paste text into the labeled 执行证据JSON field and choose 复核粘贴JSON.
2. The separate strict reader accepts raw M2A evidence or a M2B envelope. An own executionReportVersion field always selects strict report import with no raw fallback. Mixed/M1/unknown fields, unsupported versions, changed canonical casing and invalid digests fail. Both the file's declared size and the actual UTF-8 text are checked against the inclusive 1048576-byte input limit; nothing is truncated.
3. Read 事实一致性 and the six independent network/submission/inclusion/execution/finality/readback results, core reasons and complete supplied stage facts. Source/alias/genesis, VM/contract/caller, transaction/index/block, failure, finalized anchor/ancestry, expected/observed sequence and every original stage timestamp remain inspectable. Null means 未提供/未验证; decimal 0 and values above JavaScript's safe integer boundary remain exact strings.
4. 查看当前复核结果 focuses the report at the source banner and summary. Desktop and390px keyboard alignment were checked on the final code. 导出执行报告 validates the compact envelope before downloading portalpulse-execution-report.json; the saved text can be re-imported. 打印执行报告 invokes printing with CSS that retains active-report facts/origin/offline/trust labels while hiding controls/editor. Actual Chrome A4 print and pagination were checked on October16 for the five cases below. 清空执行记录 clears the execution report and editor and invalidates pending work; it does not discard the separate network report.

Loading displays 复核中, retains the previous good report and disables conflicting actions; clear can cancel pending work. File inputs reset so the same file can be selected again. Failed reads/imports keep the previous valid report and display retry guidance. Only the latest non-disposed generation may publish; stale successes/errors, clear and unmount cannot resurrect old state. Asynchronous export also checks that the selected report still exists before download or notice updates. The controller has no transport, framework or timers; UI state and download binding stay in the React panel.

Every execution result remains offline, including RPC provenance and all-normal facts. “Normal” is supplied-fact consistency only; verifiedNetwork, writeAllowed and fullVerification remain false. SHA-256 is content integrity, not authenticity/current liveness/independent consensus. Raw editor text stays in memory and out of print. No local storage, auto-start, live calls, signatures, wallet, contract deployment or inferred V3 allowlist was added.

Worker checks cover Node behavior/SSR/build only: initial b54945c had full 453/453; R1 code 812a8e2 had focused 106/106 and full 460/460. The current small start-alignment change has its own check/commit record in development evidence; these older counts are not assigned to its bytes.

Controller real-browser evidence on 812a8e2 covers default M1/simulated records, retained network best 105 and RPC-origin execution report across switches, six stages/source/original times/uint64, fresh clear→simulate and export→valid report-paste notices, canonical-case rejection retaining the previous digest, partial-unverified/failed-abnormal/RPC-offline with all three false flags, and inspected 390×844 layout where inner/document/body widths were all390 (viewport restored). A real 2511-byte download, strict core reimport and file-picker reimport belong specifically to b54945c; the export/core path was unchanged but these operations were not repeated after every fix.

Actual Chrome Page.printToPDF A4 portrait acceptance passed on October16 for complete, partial, failed, RPC-origin and65-block ancestry fixtures: 3/3/3/3/14 pages,26 total. All pages were visually reviewed; source facts, original times, exact sequence, digest and offline/three-false limits remained. Editor text, actions and the inactive view were excluded. The long-chain comparison checked every block hash, height and parent hash across repeated table headers. Long tokens may continue across pages; no input was truncated.

One actual browser export-cancellation case held a single WebCrypto digest, clicked export then clear, released the real digest and waited for it to finish. No download anchor was clicked, no report returned and the clear status remained. Test hooks were restored. This is scoped interaction evidence, not a claim about every browser or race.

The final alignment code9b0f6e4 passed106 focused/460 full tests plus typecheck/build; source/test bytes are unchanged by this documentation/materials increment, so the suite was not rerun. Public release3, desktop/mobile keyboard checks and preserved-source hosted simulation retain their original evidence. [Current materials](checkin-materials.md) include a prototype Deck and a92-second silent snapshot walkthrough made from genuine UI captures and actual reports. This does not verify Portaldot V3. Recognized V3 identity/runtime/account mapping/funds/probe/live execution/finality/readback, live integration video, Check-in and final submission remain pending.
# October21 offline rehearsal update

The existing evaluator is now exposed through six deterministic scenario choices in the execution editor and `execution-demo [--scenario ID] [--out path]` in the CLI. IDs, statuses and expected exits are documented in the [reviewer guide](reviewer-guide.md). Selection in the webpage immediately reviews the chosen synthetic facts; the existing button reloads it. Invalid scenario names reject, pending older reads cannot replace the new report, and failed loads retain the last valid result. Every result remains offline with all three verification/write flags false. Original timestamps and exact uint64 values are preserved; no new report schema, network collector, wallet or probe operation was added.
