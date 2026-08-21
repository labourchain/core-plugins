# Migration notes

## Scope

This first slice migrates only executable behavior already present for
`sys_blockheader_v1` in `Ri0n72Y/blockchain-service/lib/data/blockHandler.go`.
It does not redesign protocol IDs, schema layout, block semantics, or the
Cordis protocol-runtime ABI.

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

The current CUE schema for `sys_blockheader_v1` constrains `packer` with:

```cue
"^[A-Za-z0-9+/=]+$"
```

which resembles a Base64 character set. The Go verifier, however, uses
`hex.DecodeString(header.Packer)`. The migration keeps both artifacts as they
exist today and treats the discrepancy as a protocol decision to resolve
separately. Changing either side during migration would mix compatibility work
with protocol evolution.

## Next candidate

After this slice is wired into the LabourChain/Cordis protocol registry, the
next migration should inventory `sys_record_v1` and `sys_protocol_v1`, because
current record persistence already contains protocol-specific branching that
should move out of generic storage code.
