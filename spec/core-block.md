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

Historical `BlockHeader.hash` is not a full Block identity. Genesis writes the ordered RecordId Merkle root into it. Current design therefore names that field by its actual meaning.

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

`"0"` is reserved as the source-derived first-link sentinel. Whether current Genesis uses it is finalized by the Genesis review. Ordinary non-first Blocks link to a 64-character lowercase-hex `BlockId`.

`BlockHeader` is owned by `core.block`; there is no separate `core.block-header` Plugin.

## Record baseline

Ordinary Record behavior remains owned by `core.record`:

```text
RawRecord = plugin / pluginHash / createdBy / createdAt / data
RecordId = DoubleSHA256(JCS(RawRecord))
ordinary signature = domain-separated Ed25519 over RecordId
```

`core.block` must not redefine RecordId, Record author confirmation, Plugin resolution, Entity registration policy, or protocol-specific `Record.data` validity.

## Records root

Retain the historical ordered RecordId Merkle algorithm:

```text
0 ids -> ""
1 id  -> id
pair  -> DoubleSHA256(UTF8(left + right))
odd   -> DoubleSHA256(UTF8(id + id))
repeat until one value remains
```

`left/right` are 64-character lowercase-hex RecordId text. Internal nodes are also lowercase-hex DoubleSHA256 text. RecordId text is not hex-decoded before pair hashing.

Therefore:

```text
recordsRoot([]) = ""
recordsRoot([id]) = id
```

Array order participates in `recordsRoot`. Empty Blocks remain representable.

### Duplicate RecordIds are invalid

The historical odd-leaf duplication rule has a deterministic ambiguity:

```text
recordsRoot([A, B, C])
== recordsRoot([A, B, C, C])
```

because both first levels contain:

```text
DoubleSHA256(A + B)
DoubleSHA256(C + C)
```

This is not a cryptographic hash collision; it is a property of the retained tree construction. If duplicate RecordIds were allowed, two different `Block.records[]` values could share the same `recordsRoot`, and therefore the same BlockId/Header signature when the remaining Header fields match.

To preserve the historical Merkle algorithm without introducing a new leaf format or `recordCount` Header field, `core.block@0.1.0` requires RecordIds in one Block to be unique.

`recordsRoot(recordIds)` must reject duplicate RecordIds. `verifyBlock(block)` must therefore reject a Block containing the same RecordId more than once.

This is a confirmation-container integrity rule, not a business-DAG rule.

`recordsRoot` commits Record fact identities, not Record signature bytes. Each Record author signature is verified independently.

## Block identity

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

`BlockId` is a 64-character lowercase-hex digest and is not serialized as another Header field. Header signature is excluded from identity.

`blockId()` accepts either an exact `RawBlockHeader` or exact full `BlockHeader`; for the latter only the four unsigned fields enter canonical identity.

Ordinary chain linkage is:

```text
current.header.previousBlock = blockId(previous.header)
```

Checking that equality requires chain context. Standalone `verifyBlock(block)` does not decide which previous Block a runtime should attach it to.

## Header signature

Packer identity uses the shared `core.entity` representation:

```text
raw 32-byte Ed25519 public key -> base58btc text
```

Core validates key representation and signature only; Repo/network policy decides whether the Entity is registered/authorized to pack.

Block signature wire representation is 128-character lowercase hex.

```text
BLOCK_SIGNING_DOMAIN = "labourchain:block:v1:"
blockSigningPayload(id)
= UTF8(BLOCK_SIGNING_DOMAIN) || hexDecode(BlockId)
```

The packer signs that payload with the matching Ed25519 private key.

Historical Genesis/runtime JSON-signing differences and historical packer hex/Base64-like encodings are not carried forward.

## Header representation

`RawBlockHeader` and `BlockHeader` use exact top-level fields. Unknown, missing, accessor, symbol-keyed or non-enumerable fields are rejected.

```text
recordsRoot   -> "" or 64-character lowercase hex
previousBlock -> "0" or 64-character lowercase hex
createdAt     -> well-formed Unicode string
packer        -> EntityPublicKey
signature     -> 128-character lowercase hex
```

`createdAt` remains signed header data. Core adds no wall-clock, monotonicity or RFC3339 consensus rule.

## Confirmation order and domain relations

Block order is confirmation/storage order.

Records in one Block may have real domain dependencies, including labour Records depending on another Record's output. Core does not infer or validate those relations from array position.

Labour/Asset/Project tracing, input/output consistency and business causality belong to their domain Plugins.

The duplicate-RecordId prohibition above only ensures that `recordsRoot` uniquely commits the Block's ordered RecordId sequence under the retained Merkle rule; it does not impose generic DAG or topological-order semantics.

## Plugin availability is not Block validity

A Record declares exact protocol machine identity through `pluginHash`. Runtime/composition resolves and executes that Plugin.

Normal composition should make a Plugin available before Records governed by it are produced. First publishing a Plugin in the same Block as Records that depend on it is not recommended, but it is not a generic Block-validity rule.

`core.block` does not maintain or validate:

```text
PluginRelease / activePluginState / nextPluginState
N -> N+1 activation
pre-Block Plugin snapshot
same-Block Plugin activation/inactivity
earlier-in-same-Block Plugin activation
Plugin dependency ordering by Block position
```

## `verifyBlock` boundary

`verifyBlock` validates only the deterministic confirmation container:

```text
exact Block / BlockHeader representation
-> each ordinary Record envelope and derived RecordId
-> each ordinary Record author signature
-> RecordId uniqueness inside the Block
-> recordsRoot(record.id in array order)
-> equality with header.recordsRoot
-> derived BlockId
-> packer signature over BlockId
```

Malformed representation or deterministic identity/commitment mismatch is an error. A well-formed but cryptographically invalid Record or Header signature returns verification failure, consistent with `core.record` behavior.

`verifyBlock` does not validate:

```text
Plugin execution or protocol-specific Record.data rules
Entity registration/admission state
Labour/Asset/Project business topology
Plugin publication/activation order
PoA packer authorization
previousBlock equality against a particular local chain head
canonical-chain selection
network synchronization
persistence
```

## Minimal public capability

```text
recordsRoot(recordIds)
blockId(rawHeader | header)
blockSigningPayload(blockId)
verifyHeader(header)
verifyBlock(block)
```

plus Block types and `BlockError`.

`blockSigningPayload` is deliberately named because the package root already exports `core.record`'s `signingPayload`.

No signing helper, key generation, Plugin resolver, chain store, Entity registry or consensus-policy object belongs in `core.block`.

## Genesis boundary

Genesis remains a Block containing Records, including initial `Record.data = Plugin` values.

Standalone `GenesisManifest`, `GenesisId`, and S0 Plugin artifact-set designs remain removed.

Historical bootstrap RecordId/`createdBy`/signature exceptions, Root Member/Repository retention and exact use of the reserved `"0"` first-link sentinel are finalized by the dedicated Genesis review. Ordinary `core.block` must not grow Plugin-state, Repo-registration-state or business-state branches for Genesis.

## Failure cases

Reject or fail verification for at least:

- malformed Block or Header shape;
- malformed RecordId/root/previous-link/packer/signature representation;
- duplicate RecordIds inside one Block;
- malformed ordinary Records;
- RecordId mismatch;
- invalid ordinary Record author signature;
- recomputed Records root mismatch;
- invalid packer signature.

Do not reject solely for:

- empty `records[]`;
- same-Block business dependencies;
- same-Block Plugin publication/use;
- Plugin activation assumptions;
- domain DAG topology;
- Repo registration/admission state unavailable to standalone Core validation.

## Tests

Meaningful tests should cover:

- fixed historical-style ordered Merkle fixtures using current RecordId representation;
- empty and single-Record roots;
- Record order changing the root;
- duplicate RecordId rejection, including the `[A,B,C]` vs `[A,B,C,C]` ambiguity regression;
- fixed JCS-derived BlockId fixture;
- raw and full Header producing the same BlockId;
- all unsigned Header fields affecting BlockId;
- fixed block signing payload;
- valid and invalid Ed25519 packer signatures;
- Records-root mismatch;
- malformed Block/Header representation;
- ordinary Record signature verification through `verifyBlock`;
- acceptance of empty `records[]`;
- absence of Plugin-activation and business-DAG rejection rules.

Genesis bootstrap exceptions are tested only after the Genesis review fixes them.
