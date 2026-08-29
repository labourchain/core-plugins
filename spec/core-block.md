# `core.block` Specification

Status: **pending source-aligned review before implementation**.

This file intentionally freezes only source-derived Block/BlockHeader/Merkle facts and current architecture boundaries. Earlier proposals for a new BlockHeader shape, BlockId, GenesisId linkage, `activePluginState`, N→N+1 Plugin activation, same-Block Plugin rejection, and `nextPluginState` belong to the superseded Plugin-state design and are not normative requirements.

Issue #9 is the implementation gate.

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
- `docs/block.md`
- `docs/ordering.md`
- `docs/plugin.md`

## Source data model

Historical Block:

```ts
interface Block {
  header: BlockHeader
  records: Record[]
}
```

Historical BlockHeader fields:

```text
hash
previousHash
createdAt
packer
signature
```

Current architecture keeps `BlockHeader` as a public type owned by `core.block`; there is no independent `core.block-header` Plugin.

Exact current field names/identity semantics require dedicated review and must not be inferred from the superseded design.

## Source Merkle algorithm

Historical `calcMerkleRoot(ids)` behaves as:

```text
0 ids -> ""
1 id  -> id
pair  -> DoubleSHA256(left + right)
odd   -> DoubleSHA256(id + id)
repeat until one value remains
```

`left/right` are the historical RecordId text values.

This algorithm is a source fact and should be preserved unless the Block review establishes a concrete migration reason to change it.

## Current confirmed responsibilities

`core.block` owns the Block/BlockHeader data contract and deterministic operations required to validate the Block confirmation container.

Confirmed boundary:

```text
Block contains ordered Record[]
BlockHeader belongs to core.block
Block chain order is confirmation/storage order
business Labour/Asset/Project DAG is not generic Block semantics
```

The exact executable capability list remains pending review. Historical Merkle calculation and Header verification are source inputs.

## Plugin Record resolution — pending review

Plugin is ordinary Record data:

```text
Record.data = Plugin
```

There is no independent `PluginRelease` or `activePluginState` object owned by `core.plugin`.

Before `verifyBlock` or equivalent can be frozen, review must determine:

```text
how each Record resolves its exact Plugin
whether a Plugin Record earlier in the same Block may interpret a later Record
whether same-Block Plugin dependencies may resolve
whether a pre-Block Plugin snapshot is required
how Genesis Plugin Records bootstrap interpretation
```

Do not assume N→N+1 activation or same-Block rejection.

## Genesis — pending review

Genesis remains a Block containing Records.

Historical Genesis facts include:

```text
previousHash = "0"
Protocol Records in Block.records[]
Protocol Record IDs equal ProtocolHash
Root Member Record
Genesis Repository Record
Genesis Repository public key as packer
historical Header signing flow
```

The previously designed standalone `GenesisManifest`, `GenesisId`, and initial `S0 Plugin artifact set` are removed assumptions.

Any current Genesis linkage rule must be derived during the dedicated Record/Block/Genesis review.

## BlockHeader signing / Block identity — pending review

The superseded design proposed:

```text
previousBlock
recordsRoot
createdAt
packer
signature
```

with a new canonical JSON signing payload and derived BlockId.

These are not frozen here.

The review must compare them with historical `hash/previousHash/createdAt/packer/signature`, historical `VerifyBlockHeader`, and Genesis script behavior before selecting current semantics.

## Entity / packer boundary

It remains valid that secret-key storage, packer authorization and canonical-chain selection are not properties of the Block data structure itself.

However, exact public-key encoding and signature wire representation must be aligned with the reviewed `core.entity` / `core.block` contract rather than inherited uncritically from the superseded proposal.

## Business relation boundary

Core Block validity must not generically infer or impose:

```text
Labour causality
Asset lineage
Project membership
Repository membership
business dependency topology
```

Record array order may be part of Block representation/commitment but does not automatically acquire business meaning.

## Failure cases

Do not freeze failure cases that depend on unreviewed Plugin availability, GenesisId, new Header fields, or new BlockId rules.

Source-derived malformed Block/BlockHeader representation and Merkle/Header verification failures should be turned into exact failure cases only after the dedicated review fixes the current data contract.

## Tests

Before issue #9 is refined into implementation scope, do not add tests for:

```text
N -> N+1 Plugin activation
same-Block Plugin inactivity
activePluginState / nextPluginState
standalone GenesisId linkage
new fixed Header JSON bytes
new BlockId algorithm
```

Future tests should start from historical Block/Merkle/Header fixtures and the reviewed current migration decisions.
