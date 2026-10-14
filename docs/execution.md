# Offline execution evidence

The M2A increment validates and evaluates supplied execution facts locally. It does not connect to RPC, decode SCALE/events, use a wallet, deploy a probe, sign a call, or collect new execution facts. `origin: rpc` describes the supplied provenance and is not source authentication. The supplied JSON has no endpoint field. This format is separate from the M1 monitoring report and its SHA-256 envelope; it is not accepted by the existing monitoring report importer or web UI.

Build with Node.js >=22.12, then run:

~~~sh
npm run build:core
node dist/cli/main.js execution-inspect --input examples/execution-simulated.example.json
~~~

The example is entirely synthetic, including its addresses, hashes, heights and fixed 2026-10-14 timestamps. It declares expected/read sequence `9007199254740993`, stored and compared as a decimal string beyond JavaScript's safe integer boundary. Its result is `mode: offline`, `origin: simulated`, `status: normal`, `evidenceComplete: true`, `verifiedNetwork: false`, `writeAllowed: false`, `fullVerification: false`. No fact in the example is claimed as a Portaldot observation. A zero value can be read and compared, but cannot establish that an update executed successfully.

## API and strict structure

The public core exports `parseExecutionEvidence(text: string): ExecutionEvidence` and `evaluateExecutionEvidence(value: unknown): ExecutionSummary`, plus their types. Parsing limits actual UTF-8 input to **1 MiB**, uses concise JSON errors, and validates the complete structure. Direct evaluation validates unknown objects and creates detached data before analysis. Neither API mutates the input or retains caller-owned references in its result.

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

The CLI emits one compact summary JSON for well-formed evidence: complete offline flow exits **0**, partial/unverified flow **2**, abnormal flow **1**. Malformed input, unreadable/oversized files, and missing/duplicate/unknown arguments exit **1** with an error on stderr and no stdout. Only `--input path` is accepted; there is no output overwrite, network collection or signing flag.

Runtime-specific decoding, trusted real V3 identity, probe deployment/update, wallet signatures, live inclusion/execution/finality collection, pinned-block readback, unified execution reports and browser integration remain pending. The synthetic tests do not satisfy real-chain A03–A08 or full A09 acceptance. Verification records and their actual revisions appear in [development evidence](development-evidence.md).
