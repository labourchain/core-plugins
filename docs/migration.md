# Migration baseline

## Source

Core is being migrated incrementally from `Ri0n72Y/blockchain-service`.

The legacy repository contains two things that must be separated during migration:

1. protocol schemas under `schemas/system`;
2. protocol behavior embedded in Go scripts/handlers such as record-id calculation, protocol hashing, genesis construction, Merkle packing, and block-header verification.

The migration rule is to recover existing semantics first, then make protocol changes only through an explicit version/spec decision.

## Namespace migration

The blockchain foundation now uses the `core` namespace.

Current mapping target:

| Legacy | Core target | Notes |
| --- | --- | --- |
| `sys.protocol` | `core.protocol` | Core primitive |
| `sys.record` | `core.record` | Core primitive |
| `sys.entity` | `core.entity` | Core identity primitive |
| `sys.block` | `core.block` | Core primitive |
| `sys.block-header` | `core.blockheader` | Core primitive |
| `sys.repo` | Repo domain | Do not mechanically rename into Core |
| `sys.member` | Split by responsibility | Core identity primitive + Repo membership + LabourFlow profile |

## Existing Go behavior to recover

The legacy genesis script currently defines these behaviors:

- CUE schema loading/validation;
- double-SHA256 helper;
- deterministic legacy record-id construction;
- protocol-id/hash construction from package, id, version, and canonicalized CUE source;
- recursive Merkle-root construction from ordered record ids, duplicating the final id when a level has odd cardinality;
- bootstrap protocol records;
- bootstrap Root/member/repository records;
- genesis `previousHash = "0"`;
- genesis block-header signing with Ed25519.

The legacy data handlers additionally contain block-header verification and protocol-specific persistence branching that should be moved out of generic storage code.

## First implemented slice: `core.blockheader` v1

The current feature branch migrates the former `sys_blockheader_v1` behavior as `core_blockheader_v1` / `core.blockheader`.

Preserved compatibility behavior:

1. the signed payload contains `hash`, `previousHash`, `createdAt`, and `packer` in that order;
2. `signature` is excluded from the signed payload;
3. `packer` and `signature` are interpreted as hexadecimal values;
4. Ed25519 verification must reject mutation of any signed field.

Known inconsistency: the migrated CUE constraint for `packer` still resembles a Base64 character set, while the legacy Go verifier uses hex decoding. This remains a documented compatibility issue rather than an implicit migration fix.

See [`../spec/core-blockheader-v1.md`](../spec/core-blockheader-v1.md).

## Next migration slices

The intended sequence is:

1. `core.record`: recover record envelope, legacy id calculation, validation boundary, and define the missing trusted-record signature contract before implementing it;
2. `core.protocol`: recover descriptor/hash behavior and settle executable-runtime identity before independent-node verification relies on it;
3. `core.block`: recover Merkle packing and complete block verification;
4. genesis: refactor the hard-coded script into a deterministic Core capability with externally supplied domain bootstrap records;
5. protocol registration/replay: ensure protocol registry state is derivable from the accepted chain.

Repo, LabourFlow, and Board protocol migrations should proceed in their own repositories/specs and consume Core primitives rather than re-entering this package.
