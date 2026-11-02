# Native transaction observation

This Node-only command observes one **supplied native extrinsic hash inside one supplied block**. It checks the selected genesis, recomputes the header hash, hashes the raw length-prefixed extrinsics, and accepts a system dispatch outcome only from the target extrinsic's exact ApplyExtrinsic phase. It never signs, submits, deploys, connects a wallet, or searches an account.

A normal observation means **single-RPC correlation of inclusion and system dispatch**. It does not prove that the extrinsic invoked PortalPulseProbe, identify its signer or caller, interpret wrapper/batch inner-call results, verify the extrinsics trie root, establish independent consensus/finality, or read contract state. Those remain explicit false flags even for a successful system event. A batch or wrapper can have system success while an inner call fails; do not use this command as a contract success verdict.

## Run

Use Node >=22.12, normal npm ci including development dependencies, then build the existing transport:

~~~sh
npm ci --ignore-scripts
npm run build:core
node scripts/observe-native.mjs --config /path/to/private-config.json --block-hash 0xYOUR_64_HEX_DIGITS --tx-hash 0xYOUR_64_HEX_DIGITS --out /path/to/new-observation.json
~~~

The two hash arguments must each be a complete H256. Replace the placeholders; they are not working transaction values. The seven-field config is the existing [monitoring config](cli.md) with an explicit endpoint, kind event-testnet, and non-null expectedGenesis. Select the genesis from an independent trusted official source before observing. A matching RPC-reported value alone is not authentication. The historical known mainnet identity is refused even if the config relabels it as an event testnet.

No default live endpoint exists. Credentials/query/fragment in endpoint URLs and configured endpoints inside public labels are rejected by the existing config validator. The config stays local; output omits the endpoint and raw extrinsic/metadata/event bytes. It contains the supplied public hashes, endpoint alias, source label and target system result, so review local output before sharing.

## What is queried

1. chain_getBlockHash(0) must match the explicit selected genesis; mismatch stops before block/event calls.
2. chain_getBlock(blockHash) supplies the header and raw extrinsics. Hash the exact canonical length-prefixed extrinsic bytes; exactly one match is required. The header hash is recomputed using its SCALE encoding; digest items must individually roundtrip byte-for-byte.
3. state_getRuntimeVersion(parentHash) and state_getMetadata(parentHash) select the runtime that executes the target block, including a runtime-upgrade block. The included block's parent hash is recorded.
4. state_getStorage(System.Events key, blockHash) supplies the selected block's events. Decode using that parent metadata, require exact byte roundtrip, and correlate ApplyExtrinsic(index) with the matched raw transaction.
5. Exactly one system.ExtrinsicSuccess or system.ExtrinsicFailed at that index establishes the scoped dispatch result. A foreign phase/index cannot supply success; duplicate/conflicting outcomes, invalid phase indices, malformed metadata/events and hash mismatch are abnormal. Missing block, target, event storage or target system outcome remains unverified.

The fixed storage key is the standard Twox128(System) + Twox128(Events). The decoder also verifies that the supplied portable metadata declares plain System.Events storage with prefix System. Portable metadata V14/V15 is supported; other versions fail rather than being guessed. Unknown signed-extension warnings from the codec remain on stderr; this decoder is not validated as a signing client.

Each transport request retains the existing 8000ms deadline. Only two extra readonly methods, chain_getBlock and state_getStorage, were added; author/state mutation methods remain forbidden. Metadata's complete UTF-8 RPC envelope remains limited to2MiB; other envelopes1MiB. Internal decoding caps metadata at1MiB raw, an extrinsic body or event storage at512KiB raw, transactions/events at8192, and digest logs at512. Over-budget data fails; it is not truncated into success. SIGINT aborts and closes the transport; completed or failed evidence is preserved when the local output can be saved.

## Output and exits

The file is nativeObservationVersion1, a separate scoped observation. It is **not** the offline executionSchemaVersion1 payload or ExecutionReport and is not accepted by those importers. No new native-observation import or tamper-verification command is provided. Its metadata SHA-256 identifies the observed metadata bytes; that hash is not a provenance signature.

- Exit0: normal target system dispatch observation.
- Exit1: failed dispatch, malformed/conflicting evidence, request/abort failure, invalid CLI/config, or output failure.
- Exit2: incomplete/unverified observation, such as missing target or missing target event.

Well-formed partial/abnormal observations are saved for diagnosis. Invalid arguments/config and file errors have no successful stdout. Existing output files are refused before requests, and exclusive final creation prevents a racing writer from being overwritten.

The file includes the selected block/parent, raw transaction hash and index, metadata version/byte count/SHA, execution-time runtime version, method timing/status, and target system outcome/failure reason when available. Output always retains verifiedNetwork=false, writeAllowed=false, fullVerification=false, finalityVerified=false, contractStateVerified=false, signerVerified=false and extrinsicsRootVerified=false. Header hashing does not verify the block body's trie root or the events storage root.

## November2 historical V3 trial

The [dated checkpoint](evidence/native-observation-20261102.json) records an actual readonly run against the organizer-selected V3 environment, using historical block211653. Its public extrinsic at index0 produced a correlated ExtrinsicSuccess. The parent V14 metadata was561916 bytes, SHA2566cdd6dd8df07912cde51e8d8614d8d3f5e2bfa26305350483c1c1141d39f2015. This is a **historical public-extrinsic collector trial, not PortalPulse deployment/update or a participant-signed probe**. Unknown AuthorizeCall/EthSetOrigin warnings were retained. No historical third-party transaction is counted toward PortalPulse's probe acceptance.

The next project work still includes the actual selected-wallet/route/fee budget, user-controlled signature and deployment/update, contract-specific event semantics, finality ancestry and anchored caller-state readback, integration into the six-stage report/web flow, and a new live demonstration.

## Primary references

- [Polkadot.js JSON-RPC definitions](https://polkadot.js.org/docs/substrate/rpc/) for block, metadata and storage queries.
- [Polkadot.js transaction cookbook](https://polkadot.js.org/docs/api/cookbook/tx/) for system dispatch success/failure and metadata-based dispatch errors.
- [Polkadot.js codec/type creation](https://polkadot.js.org/docs/api/start/types.create/) for metadata-dependent decoding. Runtime behavior was tested separately; upstream docs are not a Portaldot compatibility certificate.
