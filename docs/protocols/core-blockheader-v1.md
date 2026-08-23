# `core.block-header` v1

Paired schema: [`../../schemas/core/core_blockheader_v1.cue`](../../schemas/core/core_blockheader_v1.cue)  
Implementation spec: [`../../spec/core-blockheader-v1.md`](../../spec/core-blockheader-v1.md)

## Source

This document is migrated from the block-header material in `Ri0n72Y/blockchain-service`:

- `schemas/system/sys_blockheader_v1.cue`
- `lib/model/types.go`
- `lib/data/blockHandler.go::VerifyBlockHeader`
- `cmd/script/main.go` for the related genesis signing path

The original protocol id/version in the source genesis set is `sys.block-header:0.1.0`. The migrated protocol id/version is `core.block-header:0.1.0`.

## Protocol structure

The CUE schema declares:

- `hash`
- `previousHash`
- `createdAt`
- `packer`
- `signature`

The Go `BlockHeader` model uses the same field names in JSON form.

## Runtime signature verification

`VerifyBlockHeader` decodes `packer` as a hexadecimal Ed25519 public key and checks that it is 32 bytes.

It decodes `signature` as hexadecimal bytes, then JSON-marshals an anonymous struct containing these fields in order:

1. `hash`
2. `previousHash`
3. `createdAt`
4. `packer`

The resulting bytes are verified with Ed25519.

## Source discrepancies

The CUE `packer` constraint accepts a Base64-like character set while the Go verifier decodes the value as hexadecimal.

The genesis script also signs a different JSON shape: it marshals the complete `BlockHeader` while `signature` is still an empty string. The runtime verifier excludes `signature` from its verification struct.

These discrepancies are retained as migration findings in [`../migration.md`](../migration.md). The current TypeScript verifier follows the runtime `VerifyBlockHeader` path.
