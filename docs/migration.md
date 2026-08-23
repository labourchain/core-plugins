# Migration notes

## Source authority

Existing protocol semantics come from `Ri0n72Y/blockchain-service`.

The migration reads the original protocol documents, CUE schemas, Go models, handlers, and scripts together. This repository's docs/spec organize that material for the TypeScript port.

Current GitHub-visible source paths include:

```text
schemas/system/*.cue
lib/model/types.go
lib/data/blockHandler.go
lib/data/recordHandler.go
cmd/script/main.go
```

The original Service project also has human-readable protocol documents paired with CUE definitions. Those documents must be carried over with their protocol slices. Some of them are not currently present in the GitHub `main` tree visible to this migration environment, so their semantics are not reconstructed from adjacent code.

## Namespace migration

The current package renames the blockchain primitives as follows:

| Source id | Migrated id |
| --- | --- |
| `sys.protocol` | `core.protocol` |
| `sys.record` | `core.record` |
| `sys.entity` | `core.entity` |
| `sys.block` | `core.block` |
| `sys.block-header` | `core.blockheader` |

This naming table is a decision of the new package layout. The underlying field and algorithm behavior is projected from the original source.

## Source behavior already identified

`cmd/script/main.go` currently contains:

- double SHA-256;
- record-id construction;
- protocol-hash construction;
- CUE validation during genesis generation;
- recursive Merkle-root construction;
- creation of protocol bootstrap records;
- creation of root member and genesis repository records;
- genesis `previousHash = "0"`;
- genesis BlockHeader signing.

`lib/data/blockHandler.go` contains runtime BlockHeader signature verification.

`lib/data/recordHandler.go` contains Mongo record collision handling and an unfinished protocol-record-specific persistence branch.

## Current migrated slice

`core.blockheader` ports the executable behavior of `VerifyBlockHeader`:

- hexadecimal decoding of `packer`;
- Ed25519 public-key-size validation;
- hexadecimal decoding of `signature`;
- JSON serialization of `hash`, `previousHash`, `createdAt`, and `packer` in the Go struct field order;
- Ed25519 verification of that payload.

The CUE shape is migrated separately from `sys_blockheader_v1.cue`.

## Source inconsistencies found by the review

The following issues already exist in `blockchain-service`. The migration records them before deciding any change.

### Packer encoding

`sys_blockheader_v1.cue` uses a Base64-like character constraint for `packer`. `VerifyBlockHeader` uses `hex.DecodeString`.

The first TypeScript slice follows the executable verifier for verification while preserving the migrated CUE text.

### Genesis BlockHeader signing payload

The genesis script builds a `model.BlockHeader`, marshals that full struct while `Signature` is still `""`, and signs the resulting JSON.

`VerifyBlockHeader` marshals an anonymous struct containing only:

```text
hash
previousHash
createdAt
packer
```

The two source paths therefore use different signing bytes. The current TypeScript block-header verifier follows `VerifyBlockHeader`; genesis signing compatibility remains unresolved until the genesis slice is reviewed explicitly.

### Genesis repository `protocolHash`

The genesis script creates the repository entity without assigning `ProtocolHash` before validating it as `#Repository`.

`sys_repo_v1.cue` extends `#Entity`, and `#Entity` requires `protocolHash`.

This is recorded as a source defect. The migration should not hide it through an unrelated refactor.

### Genesis protocol record order

The genesis script stores its schema definitions in a Go map and appends protocol records by ranging over that map. Those record ids are then used to build the Merkle root.

Go map iteration order is not stable, so the current source code does not provide a stable genesis protocol-record order by itself.

If the paired original protocol documentation defines an ordering rule, that document should decide the migration. Otherwise a new ordering rule needs to be treated as an explicit protocol change.

## Next source review

The next useful slice is `core.record` after the original record protocol document paired with `sys_record_v1.cue` is recovered. That source should be reviewed together with `calcRecordID`, the Go record model, and persistence behavior before writing the TypeScript record implementation.
