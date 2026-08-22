# `core.blockheader` v1

Paired schema: [`../../schemas/core/core_blockheader_v1.cue`](../../schemas/core/core_blockheader_v1.cue)  
Implementation spec: [`../../spec/core-blockheader-v1.md`](../../spec/core-blockheader-v1.md)

## Purpose

`core.blockheader` is the signed header attached to a LabourChain block. It provides the information required to bind a block to the preceding chain position, identify the packer, carry the block-time value, and verify the packer's confirmation signature.

This v1 document preserves the semantics currently evidenced by the legacy Service implementation. It does not introduce new block-hash semantics or encoding changes.

## Fields

The paired CUE schema defines:

- `hash` — the legacy block hash/root field. In the current migrated v1 behavior this value is the records Merkle root produced by block packing;
- `previousHash` — the previous accepted block/header identifier, with the genesis sentinel defined by the genesis rules;
- `createdAt` — timestamp supplied by the caller/packer;
- `packer` — public key identifying the packer;
- `signature` — packer confirmation signature.

## Signature meaning

The packer signature confirms the header values that determine this block's position and packer identity.

The legacy verifier signs/verifies the JSON serialization of these fields in this exact order:

1. `hash`
2. `previousHash`
3. `createdAt`
4. `packer`

`signature` is excluded from its own payload.

The current compatibility implementation interprets `packer` and `signature` as hexadecimal Ed25519 values.

## Compatibility note

The CUE constraint for `packer` resembles a Base64 character set, while the legacy Go verifier decodes the public key as hexadecimal. Migration keeps the executable Go behavior for v1 and records the mismatch explicitly. Resolving it requires a versioned protocol decision.

## Boundary

This protocol verifies cryptographic header integrity. It does not decide whether a given packer is authorized by an organization/repository policy. Authorization is composed outside this primitive.
