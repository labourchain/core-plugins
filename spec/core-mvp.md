# Core MVP Specification

Status: draft migration projection

This specification projects the existing Core-related behavior from `Ri0n72Y/blockchain-service` into the TypeScript migration. The original Service project remains the factual source for existing protocol semantics.

## Source

Current source material used by this projection:

- `schemas/system/sys_protocol_v1.cue`
- `schemas/system/sys_record_v1.cue`
- `schemas/system/sys_entity_v1.cue`
- `schemas/system/sys_block_v1.cue`
- `schemas/system/sys_blockheader_v1.cue`
- `lib/model/types.go`
- `lib/data/blockHandler.go`
- `lib/data/recordHandler.go`
- `cmd/script/main.go`
- the human-readable protocol documents paired with the CUE schemas in the original Service project

The paired human-readable protocol documents have not all been recovered into this repository yet. Semantics defined there must be migrated before the corresponding implementation is treated as complete.

## Migration naming

The current package renames the blockchain primitive namespace from `sys.*` to `core.*`.

The current Core migration targets are:

- `sys.protocol` → `core.protocol`
- `sys.record` → `core.record`
- `sys.entity` → `core.entity`
- `sys.block` → `core.block`
- `sys.block-header` → `core.block-header`

The original block-header protocol version in the source genesis set is `0.1.0`; the migrated runtime descriptor preserves that version.

This rename is a migration decision in the new repository. Field meaning and executable behavior come from the original Service source.

## Protocol

### Source shape

`sys_protocol_v1.cue` defines:

- `protocolId`
- `version`
- `contributors`
- `package`
- `schema`
- optional `description`

`lib/model/types.go` contains the corresponding Go `Protocol` model.

### Protocol hash projection

`cmd/script/main.go` calculates a protocol hash by:

1. formatting the CUE source with `format.Source(..., format.Simplify())`;
2. concatenating `package`, protocol id, version, and formatted schema with `:` separators;
3. applying SHA-256 twice;
4. encoding the result as lowercase hexadecimal.

The TypeScript migration should reproduce this behavior with compatibility fixtures before changing it.

### Genesis protocol records

The genesis script creates one protocol record for each schema in its source protocol set. Those bootstrap records use the protocol hash itself as the record `id` instead of the ordinary `calcRecordID` path.

Any migration of this bootstrap behavior must preserve that source distinction until an explicit protocol change is made.

## Entity

### Source shape

`sys_entity_v1.cue` defines an entity with:

- `publicKey`
- `contributors`
- `protocolHash`
- optional `type`

`lib/model/types.go` contains the corresponding Go `Entity` model and an additional generic `Data` field in the Go representation.

The difference between the CUE shape and Go model should remain visible during migration rather than being silently normalized.

## Record

### Source shape

`sys_record_v1.cue` defines:

- `id`
- `protocol`
- `protocolHash`
- `createdBy`
- `createdAt`
- `signature`
- `data`

`lib/model/types.go` represents this as `RawRecord` plus `Record.ID` and `Record.Signature`.

### Record id projection

`cmd/script/main.go` implements `calcRecordID` as:

1. JSON-marshal `Data` using Go `encoding/json`;
2. concatenate `Protocol`, `ProtocolHash`, `CreatedBy`, `CreatedAt`, and the JSON payload with `:` separators;
3. apply SHA-256 twice;
4. encode the result as lowercase hexadecimal.

A TypeScript port must be checked against Go-generated fixtures. JavaScript object ordering must not be assumed to be equivalent without such compatibility evidence.

### Record signature

The original Service project contains a human-readable protocol document paired with `sys_record_v1.cue` that defines the signing semantics. That document must be migrated into `docs/protocols/core-record-v1.md` before the record-signature implementation is ported.

The current Core spec does not infer the signing payload from `calcRecordID`, the CUE field list, or adjacent code.

### Persistence behavior present in the source

`lib/data/recordHandler.go` checks record-id collisions in MongoDB and compares signatures when an id already exists. It also contains an unfinished protocol-record-specific persistence branch.

The unfinished branch is source evidence of intended protocol-specific handling, but its incomplete code is not sufficient to define additional protocol semantics.

## Block header

The detailed projection is maintained in [`core-blockheader-v1.md`](core-blockheader-v1.md).

The source consists of:

- `sys_blockheader_v1.cue` for the field shape;
- `lib/model/types.go` for the Go model;
- `lib/data/blockHandler.go::VerifyBlockHeader` for runtime verification;
- `cmd/script/main.go` for genesis header creation/signing.

The migrated protocol id is `core.block-header` and the source version is `0.1.0`.

The runtime verifier and genesis signer currently disagree on the exact signing payload. This is recorded under **Source inconsistencies** below.

## Block

### Source shape

`sys_block_v1.cue` defines a block as:

```text
header: BlockHeader
records: ordered list of Record
```

`lib/model/types.go` contains the corresponding Go model.

### Merkle projection

`cmd/script/main.go` implements the records root with this recursive behavior:

- no ids → empty string;
- one id → that id;
- each pair → `DoubleSHA256(left + right)`;
- an unpaired final id is duplicated and hashed with itself;
- repeat until one value remains.

The genesis script stores this result in `BlockHeader.Hash`.

Compatibility tests for the port should cover empty, single, even, and odd record counts.

## Genesis

`cmd/script/main.go` is the current executable source for genesis construction.

Its current flow is:

1. load root-member and genesis-node Ed25519 keys from configured paths;
2. load the configured CUE package;
3. load seven source schemas: protocol, record, entity, member, repo, block, and block-header;
4. calculate protocol hashes;
5. create bootstrap protocol records;
6. create the root member record;
7. create the genesis repository record;
8. collect record ids and calculate the Merkle root;
9. create a block header with `previousHash = "0"` and the genesis repository public key as `packer`;
10. sign the header;
11. validate the final block with CUE and write `genesis_block.json`.

The first migration should reproduce and test source behavior before generalizing the genesis API.

## Source inconsistencies found during migration

These are disagreements or defects present in the original Service material. They are facts about the source state, not new protocol decisions.

### Block-header key encoding

`sys_blockheader_v1.cue` constrains `packer` with a Base64-like character set, while `VerifyBlockHeader` decodes `packer` with `hex.DecodeString`.

The current TypeScript verifier preserves the Go runtime hex behavior while the migrated CUE is kept unchanged.

### Genesis signature payload vs runtime verifier

The genesis script signs `json.Marshal(header)` while `header.Signature` is still an empty string. The Go `BlockHeader` model therefore includes `"signature":""` in the bytes being signed.

`VerifyBlockHeader` constructs a separate anonymous struct containing only `hash`, `previousHash`, `createdAt`, and `packer`, so it verifies a different byte sequence.

The current `core.block-header` implementation ports the runtime verifier. Genesis signing must not be claimed compatible until this source inconsistency is resolved deliberately.

### Genesis repository protocol hash

The genesis script builds the repository as a Go `Entity` without assigning `ProtocolHash` before validating it as `#Repository`.

`sys_repo_v1.cue` extends `#Entity`, and `#Entity` requires `protocolHash: string`.

The migration must preserve this as a known source defect until the genesis slice decides how to handle it.

### Genesis record order

The source genesis protocol set is stored in a Go map and iterated directly when protocol records are appended. Go map iteration order is not stable, while the resulting ordered record ids feed the Merkle calculation.

The current source therefore does not establish a reproducible protocol-record order for genesis. A deterministic ordering rule would be a protocol change unless corresponding source documentation already defines one.

## Implementation scope for the current feature

The current executable slice ports `VerifyBlockHeader` and its paired block-header schema.

The feature should add further protocol code only after its source document/CUE/Go behavior has been inspected and projected into the relevant spec.

Testing should focus on source-backed behavior and concrete regressions. Coverage-oriented tests without protocol value are unnecessary.

## Verification

The repository check command is:

```bash
pnpm check
```

It runs typecheck, tests, and build.
