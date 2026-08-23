# `core.block-header` v1 Specification

Status: implemented compatibility projection

## Source

This specification projects from:

- `Ri0n72Y/blockchain-service/schemas/system/sys_blockheader_v1.cue`
- `Ri0n72Y/blockchain-service/lib/model/types.go`
- `Ri0n72Y/blockchain-service/lib/data/blockHandler.go::VerifyBlockHeader`

The original protocol id in the source genesis set is `sys.block-header:0.1.0`. The migrated id changes only the namespace prefix and is `core.block-header:0.1.0`.

Genesis signing in `cmd/script/main.go` is related source material but currently disagrees with `VerifyBlockHeader` on the signed byte sequence. That discrepancy is documented in [`core-mvp.md`](core-mvp.md) and [`../docs/migration.md`](../docs/migration.md).

## Schema projection

The migrated CUE schema declares these fields:

```text
hash
previousHash
createdAt
packer
signature
```

The TypeScript interface keeps the same field names.

## Runtime verification projection

`VerifyBlockHeader` performs the following operations, and the TypeScript verifier should reproduce them:

1. decode `packer` with hexadecimal decoding;
2. require the decoded public key to be 32 bytes, matching Ed25519 public-key size;
3. decode `signature` with hexadecimal decoding;
4. build a JSON object with `hash`, `previousHash`, `createdAt`, and `packer` in that struct field order;
5. marshal that object as JSON;
6. verify the Ed25519 signature over those bytes;
7. return failure when decoding, key-size validation, or signature verification fails.

The expected JSON shape produced by the source verifier is:

```json
{"hash":"...","previousHash":"...","createdAt":"...","packer":"..."}
```

`signature` is absent from the runtime verifier's signed object.

## Source discrepancy: CUE key encoding

The source CUE constraint for `packer` accepts a Base64-like character set, while the source Go verifier calls `hex.DecodeString`.

The current migration keeps the CUE text and ports the executable verifier's hexadecimal behavior. This is a documented source discrepancy and should not be hidden by changing one side during the migration slice.

## Current tests

The compatibility tests cover:

- the JSON field order used by the Go verifier;
- successful Ed25519 verification;
- rejection after mutating a signed field;
- rejection of a non-hex packer value by the executable verifier.

Implementation: `src/protocols/core-blockheader-v1.ts`  
Tests: `tests/core-blockheader-v1.test.ts`
