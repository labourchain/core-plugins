# `core.block` Specification

Status: **defined for ordinary Block confirmation primitives; Genesis bootstrap exceptions remain in the dedicated Genesis review**.

Ordinary `core.record` identity/signature semantics and `core.entity` public-key representation are already defined.

## Source

Historical source:

- `Ri0n72Y/blockchain-service/schemas/system/sys_block_v1.cue`
- `Ri0n72Y/blockchain-service/schemas/system/sys_blockheader_v1.cue`
- `Ri0n72Y/blockchain-service/lib/model/types.go`
- `Ri0n72Y/blockchain-service/cmd/script/main.go::calcMerkleRoot`
- `Ri0n72Y/blockchain-service/lib/data/blockHandler.go::VerifyBlockHeader`
- historical Genesis construction in `cmd/script/main.go`

Current boundary source:

- `docs/source-baseline.md`
- `docs/architecture.md`
- `docs/record.md`
- `docs/block.md`
- `docs/ordering.md`
- `docs/plugin.md`

## Data model

Historical Block keeps its basic composition:

```ts
interface Block {
  header: BlockHeader
  records: Record[]
}
```

Historical `BlockHeader.hash` is not a full Block identity. The Genesis source writes the ordered RecordId Merkle root into it. Current design therefore names that field by its actual meaning.

Current ordinary Header model:

```ts
interface RawBlockHeader {
  recordsRoot: RecordsRoot
  previousBlock: BlockId | "0"
  createdAt: string
  packer: EntityPublicKey
}

interface BlockHeader extends RawBlockHeader {
  signature: string
}
```

`"0"` is reserved as the source-derived first-link sentinel. Whether current Genesis uses that sentinel is finalized by the Genesis review; ordinary non-first Blocks link to a 64-character lowercase-hex `BlockId`.

`BlockHeader` is a public type owned by `core.block`; there is no independent `core.block-header` Plugin.

## Record baseline

Ordinary Record behavior remains owned by `core.record`:

```text
RawRecord = plugin / pluginHash / createdBy / createdAt / data
RecordId = DoubleSHA256(JCS(RawRecord))
ordinary signature = domain-separated Ed25519 over RecordId
```

`core.block` must not redefine RecordId, Record author confirmation, Plugin resolution, or protocol-specific `Record.data` validity.

## Records root

The historical ordered RecordId Merkle algorithm is retained:

```text
0 ids -> ""
1 id  -> id
pair  -> DoubleSHA256(left + right)
odd   -> DoubleSHA256(id + id)
repeat until one value remains
```

`left/right` are the 64-character lowercase-hex RecordId text values. Internal Merkle nodes are also lowercase-hex DoubleSHA256 text.

The algorithm intentionally hashes the UTF-8 text concatenation of the two IDs; it does not hex-decode them before hashing.

Therefore:

```text
recordsRoot([]) = ""
recordsRoot([id]) = id
```

Empty Blocks remain representable because the historical source explicitly defines the empty root. Core adds no minimum Record count without a concrete requirement.

Record array order participates in `recordsRoot`. Core does not require RecordIds to be unique and does not reinterpret the ordered array as a generic business topology.

`recordsRoot` commits Record fact identities, not Record signature bytes. Each Record author signature remains an independently verified proof over its RecordId.

## Block identity

A Block needs an identity distinct from its Records root because Header confirmation metadata is part of the chain history.

`BlockId` is derived from the unsigned Header:

```text
BlockId =
DoubleSHA256(
  JCS({
    recordsRoot,
    previousBlock,
    createdAt,
    packer
  })
)
```

`BlockId` is a 64-character lowercase-hex digest and is not serialized as an additional Header field.

The Header signature is excluded from BlockId, matching the separation already used by Record identity: identity commits the unsigned header; the signature proves the identified actor confirmed it.

`blockId()` accepts either an exact `RawBlockHeader` or an exact full `BlockHeader`. For a full Header, only the four unsigned fields above enter the canonical identity; `signature` is deliberately excluded rather than treated as an unknown field.

For ordinary chain linkage:

```text
current.header.previousBlock = blockId(previous.header)
```

Checking that equality requires chain context. A standalone `verifyBlock(block)` validates the Header representation and confirmation but does not decide which previous Block a runtime should attach it to.

## Header signature

Packer identity uses the `core.entity` representation:

```text
raw 32-byte Ed25519 public key -> base58btc text
```

Block signature wire representation is 128-character lowercase hex.

Domain:

```text
labourchain:block:v1:
```

Signing payload:

```text
UTF8("labourchain:block:v1:") || hexDecode(BlockId)
```

The packer signs this payload with the Ed25519 private key corresponding to `header.packer`.

Historical Genesis/runtime JSON-signing differences and historical packer hex/Base64-like encodings are not carried forward.

## Header representation

`RawBlockHeader` and `BlockHeader` use exact top-level fields. Unknown, missing, accessor, symbol-keyed or non-enumerable fields are rejected at the trust boundary, consistent with the existing Core validators.

Representation rules:

```text
recordsRoot   -> "" or 64-character lowercase hex
previousBlock -> "0" or 64-character lowercase hex
createdAt     -> well-formed Unicode string
packer        -> base58btc value decoding to exactly 32 bytes
signature     -> 128-character lowercase hex
```

`createdAt` remains fact/header data. Core does not add wall-clock, monotonicity or RFC3339 consensus validation beyond valid string representation.

## Confirmation order and domain relations

Block order is confirmation/storage order.

Records in the same Block may have real domain dependencies, including labour Records that depend on outputs represented by other Records in the same Block. Core does not infer or validate those relations from Record array position.

Labour/Asset/Project tracing, input/output consistency and other business causality belong to their domain Plugins.

## Plugin availability is not Block validity

A Record declares exact protocol machine identity through `pluginHash`. Runtime/composition resolves and executes that Plugin.

Normal composition should make a Plugin available before Records governed by it are produced. Publishing a Plugin for the first time in the same Block as Records that depend on it is not recommended.

This is not a generic Block-validity rule. `core.block` does not maintain or validate:

```text
PluginRelease / activePluginState / nextPluginState
N -> N+1 activation
pre-Block Plugin snapshot
same-Block Plugin activation/inactivity
earlier-in-same-Block Plugin activation
Plugin dependency ordering by Block position
```

A Block is not rejected merely because it contains both a Plugin Record and another Record using that Plugin's `pluginHash`.

## `verifyBlock` boundary

`verifyBlock` validates the deterministic confirmation container only:

```text
exact Block / BlockHeader representation
-> each ordinary Record envelope and derived RecordId
-> each ordinary Record author signature
-> recordsRoot(record.id in array order)
-> equality with header.recordsRoot
-> derived BlockId
-> packer signature over BlockId
```

Malformed representation or deterministic identity/commitment mismatch is an error. A well-formed but cryptographically invalid Record or Header signature returns verification failure, consistent with `core.record` behavior.

`verifyBlock` does not validate:

```text
Plugin execution or protocol-specific Record.data rules
Labour/Asset/Project business topology
Plugin publication/activation order
PoA packer authorization
previousBlock equality against a particular local chain head
canonical-chain selection
network synchronization
persistence
```

Those require runtime, network or domain context beyond a standalone Block.

## Minimal public capability

The implementation should expose only the confirmation primitives needed by callers:

```text
recordsRoot(recordIds)
blockId(rawHeader | header)
blockSigningPayload(blockId)
verifyHeader(header)
verifyBlock(block)
```

plus Block types and `BlockError`.

`blockSigningPayload` is deliberately named rather than exporting a second generic `signingPayload`, because the package root already exports `core.record`'s `signingPayload`.

No signing helper, key generation, Plugin resolver, chain store or consensus/policy object belongs in `core.block`.

## Genesis boundary

Genesis remains a Block containing Records, including initial `Record.data = Plugin` values.

Standalone `GenesisManifest`, `GenesisId`, and S0 Plugin artifact-set designs remain removed.

Historical bootstrap RecordId/`createdBy`/signature exceptions, Root Member/Repository retention and exact use of the reserved `"0"` first-link sentinel are finalized by the dedicated Genesis review. Ordinary `core.block` must not grow Plugin-state or business-state branches for Genesis.

## Failure cases

Reject or fail verification for at least:

- malformed Block or Header shape;
- malformed Records root / previous-link / packer / signature representation;
- malformed ordinary Records;
- RecordId mismatch;
- invalid ordinary Record author signature;
- recomputed Records root mismatch;
- invalid packer signature.

Do not reject solely for:

- repeated RecordIds;
- empty `records[]`;
- same-Block business dependencies;
- same-Block Plugin publication/use;
- Plugin activation assumptions;
- domain DAG topology.

## Tests

Meaningful tests should cover:

- fixed historical-style ordered Merkle fixtures using current RecordId representation;
- empty and single-Record roots;
- Record order changing the root;
- fixed JCS-derived BlockId fixture;
- raw and full Header producing the same BlockId;
- all unsigned Header fields affecting BlockId;
- fixed block signing payload;
- valid and invalid Ed25519 packer signatures;
- Records-root mismatch;
- malformed Block/Header representation;
- ordinary Record signature verification through `verifyBlock`;
- absence of duplicate-Record, Plugin-activation and business-DAG rejection rules.

Genesis bootstrap exceptions are tested only after the Genesis review fixes them.
