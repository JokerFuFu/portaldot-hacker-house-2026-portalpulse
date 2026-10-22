# Probe build and deployment preparation — October22

The probe source is implemented and tested locally. A readonly constructor `eth_call` on the identified V3 network returned its exact compiled runtime; no contract was deployed and no transaction was submitted. Actual signer ownership, storage/fee limits, deployment, one caller update and finality/state readback remain pending. The web application continues to provide readonly monitoring and offline evidence review.

## Build the artifact

Use Node>=22.12 and the locked dependencies from package-lock.json:

~~~sh
npm --userconfig /dev/null --cache /private/tmp/portalpulse-npm-cache --registry https://registry.npmjs.org ci --ignore-scripts
npm run build:probe -- --out artifacts/PortalPulseProbe.json
~~~

Use a fresh output path. Existing files are refused and their bytes remain intact; there is no overwrite flag. The command makes no RPC or wallet requests. It writes ABI, creation/runtime bytecode, source/bytecode SHA256 and exact compiler provenance as deterministic JSON. Two output paths produce identical artifact bytes. This is a compiler artifact, separate from monitoring/execution reports and deployment receipts.

The [contract](../contracts/PortalPulseProbe.sol) exposes `record(uint64)` and `sequenceOf(address)`, and emits `SequenceRecorded(address indexed caller,uint64 sequence)`. A caller updates only its own value; zero and the full uint64 range are valid. It has no payable receiver, asset transfer, administrator or upgrade path. Never convert sequences through JavaScript Number; ABI inputs and report values must retain integer precision.

## Exact toolchain and local proof

- npm solc0.8.24, reported build `0.8.24+commit.e11b9ed9.Emscripten.clang`; target `paris`, optimizer200, metadata bytecodeHash none.
- The build checks the locked npm integrity and installed soljson.js SHA256 `fb59b825b7d57f9de89cd9de2415b12aab1fcc7eb2573fd2bf5c9b969eacf4d9`.
- @ethereumjs/evm10.1.3 and @ethereumjs/util10.1.3 exercise real compiled bytecode in memory; they do not model Portaldot fees or independently verify its consensus.
- Local tests cover actual constructor/runtime, caller isolation, large uint64/overflow, event contents, rejected value/unknown calls, malformed source, deterministic builds and output/flag refusal.

The npm JS wrapper and [solc-bin indexed file](https://github.com/ethereum/solc-bin/blob/gh-pages/bin/list.json) have different raw file hashes. Their long embedded compiler payload is identical in the recorded comparison; do not claim entire-file or JS semantic equality. The artifact pins the actual official npm distribution and full reported build. Package sources/licenses are in [dependencies](dependencies.md).

## Official V3 identity source

[Titus's October22 designation](https://discord.com/channels/1440212664751099996/1479446495643303997/1562675414575484959) points to the [official testnet explorer](https://scanner-testnet-v3.portaldot.dev/). Its [block1](https://scanner-testnet-v3.portaldot.dev/#/blocks/1) publishes parent/genesis hash:

`0xd4f9acbcf7f52388d8b095abe3c198d19fc510e0343e643e87cfbccb155283bd`

The RPC block0/block1, published roots and local405-byte SCALE Header Blake2b-256 match passed13 cross-checks; EVM ChainID is420420777, runtime portaldot-v3/spec3002/tx2. Block0 is not indexed by that explorer; block1 parent provides the anchor. This establishes the selected organizer-published network identity, not independent consensus or ownership of any wallet. See the [sanitized evidence](evidence/v3-identity-20261022.json).

For an explicitly selected readonly connection, use [the pinned source profile](../examples/portaldot-v3-config-20261022.json):

~~~sh
node dist/cli/main.js collect --config examples/portaldot-v3-config-20261022.json --samples 4 --interval-ms 10000 --out artifacts/new-monitoring-report.json
~~~

The actual October22 four-sample run had35/36 successful requests: the fourth metadata request exceeded8 seconds, so the complete run correctly returned abnormal/exit1. Its first three identity snapshots were normal. The failed run was retained; a trusted source does not make incomplete observations green. Imported reports remain offline and preserve their original times.

## Before a real signature

1. Recheck the selected official network and actual wallet signer. Runtime mapping or candidate balance alone does not prove possession.
2. Rebuild and verify this exact source/artifact, then run constructor/fee/storage diagnostics for that signer. Paris0.8.24 has passed the recorded readonly constructor context; that does not establish all future calls or a completed deployment.
3. Record bounded gas, fee and storage exposure and show the network, origin and bytecode to the participant. The participant handles connection approval and signing; never read seeds/private keys or retry a signature automatically.
4. After a successful deployment, read the actual receipt/address, perform one caller-specific record, verify execution/finality and state at the anchored block, and export/replay the real evidence.

The [Week2 notice](https://discord.com/channels/1440212664751099996/1506204427651125349/1562526145373544599) allows clearly labeled preliminary mocks, prefers real integration and requests contract/transaction evidence where applicable. This does not replace final live requirements. Build50050 was submitted October20 and remains listed; the October22 management view did not explicitly state an approval/feedback result. See the [submission checklist](submission-checklist.md).
