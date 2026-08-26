# `core.block` Specification

Status: defined for ordinary post-Genesis Blocks, using the resolved GenesisId and Plugin-state model.

## Source

Historical source:

- `Ri0n72Y/blockchain-service/schemas/system/sys_block_v1.cue`
- `Ri0n72Y/blockchain-service/schemas/system/sys_blockheader_v1.cue`
- `Ri0n72Y/blockchain-service/lib/model/types.go`
- `Ri0n72Y/blockchain-service/cmd/script/main.go::calcMerkleRoot`
- `Ri0n72Y/blockchain-service/lib/data/blockHandler.go::VerifyBlockHeader`

Current design source:

- `docs/architecture.md`
- `docs/block.md`
- `docs/plugin.md`
- `docs/ordering.md`
- `docs/genesis.md`

## Plugin identity

The current Core Plugin is:

```text
core.block@0.1.0
```

It absorbs the responsibilities historically split between `sys.block` and `sys.block-header`.

There is no independent `core.block-header` Plugin. `BlockHeader` is a public type exported by `core.block`.

## Public types

The Plugin must expose equivalents of:

```ts
interface BlockHeader {
  previousBlock: BlockId | GenesisId
  recordsRoot: RecordsRoot
  createdAt: string
  packer: EntityPublicKey
  signature: Signature
}

interface Block {
  header: BlockHeader
  records: Record[]
}
```

`Block` does not store an independently declared `id` field. Block identity is derived by `blockId(header)`.

Semantic aliases:

```text
EntityPublicKey = base58btc-encoded Entity public key
BlockId         = DoubleSHA256 digest
GenesisId       = DoubleSHA256 digest
RecordId        = DoubleSHA256 digest
RecordsRoot     = ordered RecordId Merkle result
Signature       = Ed25519 signature result, not Base58 identity
```

DoubleSHA256-derived values use lowercase hexadecimal when serialized as chain text.

## Required executable capabilities

`core.block` must provide deterministic equivalents of:

```text
recordsRoot(records or recordIds)
signingPayload(unsignedHeader)
verifyHeader(header)
blockId(header)
verifyBlock(inputs)
```

`blockId` is required Plugin behavior, not a runner-only helper.

The Plugin does not own secret-key storage, packer authorization, canonical-chain policy, persistence, or transport.

## Entity key boundary

`packer` is an Entity public-key reference and uses the base58btc codec defined by `core.entity`.

Verification must:

1. base58btc-decode `packer`;
2. require exactly 32 Ed25519 public-key bytes;
3. verify the Header signature with those key bytes.

Entity secret keys never appear in Block data.

## Signature representation

`signature` is an Ed25519 signature result, not Base58.

Current wire representation is lowercase hexadecimal over the 64-byte signature. Malformed encoding or decoded length other than 64 bytes is invalid.

## Records Merkle root

`recordsRoot()` preserves the historical ordered Merkle algorithm:

```text
0 Record IDs -> ""
1 Record ID  -> that ID directly
pair         -> DoubleSHA256(left + right)
odd final    -> DoubleSHA256(id + id)
repeat until one value remains
```

`left` and `right` are lowercase-hex RecordId text values. `DoubleSHA256` returns lowercase hexadecimal.

Record array order is part of the Block representation and Merkle commitment only. It does not acquire Labour / Asset DAG semantics.

## Unsigned BlockHeader payload

The signing payload contains exactly these fields in this order:

```text
previousBlock
recordsRoot
createdAt
packer
```

Canonical bytes are compact UTF-8 JSON of that exact ordered shape:

```json
{"previousBlock":"...","recordsRoot":"...","createdAt":"...","packer":"..."}
```

`signature` is excluded from its own signing payload.

Implementations must construct the byte shape explicitly rather than depend on incidental object-property ordering.

## Header verification

`verifyHeader(header)` must:

1. validate field representations;
2. derive canonical unsigned Header bytes;
3. base58btc-decode `packer` into a 32-byte Ed25519 public key;
4. decode lowercase-hex `signature` into 64 bytes;
5. perform Ed25519 verification.

Success proves only that the corresponding Entity key signed the Header payload. It does not prove packer authorization or canonical-chain status.

## BlockId

`blockId(header)` derives identity from the final signed BlockHeader.

Canonical final Header field order is exactly:

```text
previousBlock
recordsRoot
createdAt
packer
signature
```

using compact UTF-8 JSON:

```json
{"previousBlock":"...","recordsRoot":"...","createdAt":"...","packer":"...","signature":"..."}
```

Then:

```text
BlockId = DoubleSHA256(canonicalSignedHeaderBytes)
```

The result is lowercase hexadecimal and is not Base58.

Changing any signed Header field or the signature changes BlockId.

## Chain linkage

For ordinary Block `Bn`, `n > 1`:

```text
Bn.header.previousBlock = blockId(Bn-1.header)
```

For the first ordinary Block:

```text
B1.header.previousBlock = GenesisId
```

`GenesisId` is supplied by the already-completed Genesis recognition path defined in `spec/genesis.md`.

`core.block` validates against an explicit preceding identity supplied by the caller and does not select a canonical branch.

## Plugin-state rule

Ordinary Block `N` is validated against the immutable `activePluginState` established before Block `N` begins.

A Plugin release Record contained in Block `N` does not make that Plugin active while validating any other Record in Block `N`.

Only after the complete Block succeeds may accepted Plugin release Records be applied to produce the state used by Block `N+1`.

## `verifyBlock` inputs

Ordinary Block verification receives at least:

```text
precedingIdentity
activePluginState
candidateBlock
```

The runner chooses which preceding identity/state pair it asks Core to verify against.

## `verifyBlock` behavior

Conceptual validation order:

1. compare `candidateBlock.header.previousBlock` with `precedingIdentity`;
2. derive `recordsRoot` from candidate Records in declared array order;
3. require the derived value to equal `candidateBlock.header.recordsRoot`;
4. freeze `activePluginState` for the whole Block;
5. validate every Record against only exact Plugins active in that state;
6. for `core.plugin` release Records, validate artifact/issuer/dependencies using the same pre-Block state;
7. verify the BlockHeader signature;
8. derive candidate BlockId using `blockId(header)`;
9. only after complete acceptance, apply accepted Plugin releases to produce `nextPluginState`.

A useful deterministic return value may expose:

```text
blockId
nextPluginState
```

without persisting either value inside the Plugin.

## Exact Plugin resolution

Record validation must resolve:

```text
Record.plugin = name@version
Record.pluginHash = exact PluginHash
```

against the same entry in `activePluginState`.

A name/version match with a different PluginHash is invalid.

## Business relation boundary

Labour / Asset DAG topology is outside generic Core Block validity.

The Plugin must not:

- require a business reference to target an earlier Block;
- require a business reference to target an earlier Record in the current Block;
- topologically sort Records by Labour/Asset relations;
- reject a Block merely because a generic business relation graph is cyclic.

Domain-specific payload consistency belongs to the exact active domain Plugin.

## Runner/server boundary

`core.block` does not define:

- secret-key storage;
- which Entity may propose/pack a Block;
- packer authorization policy;
- canonical-chain selection;
- Plugin artifact persistence/fetch policy;
- transport/synchronization;
- retry/scheduling policy.

These belong to the independent runner/server composition.

## Failure cases

Reject an ordinary Block when any required Core condition fails, including:

- previous linkage mismatch;
- ordered Record IDs do not reproduce `header.recordsRoot`;
- a Record is invalid;
- a Record references a Plugin not active before the Block;
- `Record.plugin` / `pluginHash` do not resolve to the same active Plugin;
- a Plugin release fails `core.plugin` validation;
- Header field/key/signature encoding is invalid;
- Ed25519 Header verification fails.

No partial Plugin-state update may survive a rejected Block.

Labour / Asset DAG topology is not a generic Core failure condition.

## Tests

Meaningful tests must cover at least:

- source Merkle fixtures for zero, one, even, and odd Record counts;
- Record array order affecting RecordsRoot;
- exact unsigned Header byte shape/order;
- base58btc packer fixture and Ed25519 verification;
- malformed packer/signature encoding rejection;
- exact signed Header byte shape/order used by `blockId`;
- deterministic BlockId fixture;
- mutation of any Header field/signature changing BlockId;
- GenesisId linkage for B1;
- previous BlockId linkage for B2+;
- Plugin released in Block N remaining inactive until Block N+1;
- exact name/version + PluginHash resolution;
- invalid Record or Plugin release rejecting the complete Block without advancing Plugin state;
- business DAG relationships introducing no hidden Core ordering requirement.
