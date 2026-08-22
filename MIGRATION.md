# Migration notes

## Scope

This first slice migrates executable behavior already present for the former
`sys_blockheader_v1` protocol in `Ri0n72Y/blockchain-service/lib/data/blockHandler.go`.
The LabourChain MVP now uses the `core` namespace for core blockchain protocols,
so this slice also renames the protocol to `core_blockheader_v1` / `core.blockheader`.
It does not redesign block semantics or the Cordis protocol-runtime ABI.

## Preserved behavior

The legacy Go verifier signs/verifies the JSON serialization of exactly these
fields in this order:

1. `hash`
2. `previousHash`
3. `createdAt`
4. `packer`

`signature` is excluded from the signed payload.

The legacy verifier decodes both `packer` and `signature` as hexadecimal and
verifies an Ed25519 signature. The TypeScript implementation preserves that
behavior.

## Known existing inconsistency

The current CUE schema for `core_blockheader_v1` still constrains `packer` with:

```cue
"^[A-Za-z0-9+/=]+$"
```

which resembles a Base64 character set. The Go verifier, however, uses
`hex.DecodeString(header.Packer)`. The migration preserves the Go runtime
behavior and carries the schema constraint forward unchanged. The discrepancy
remains an explicit protocol decision for a later compatibility revision.

## Next candidates

The next core migrations should inventory the former `sys_record_v1` and
`sys_protocol_v1` behavior, rename them into the `core` namespace, and move
protocol-specific logic out of generic persistence code.
