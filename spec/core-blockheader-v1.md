# `core.blockheader` v1 Specification

Status: **implemented / legacy-compat**

This specification freezes the currently migrated block-header verification behavior from the legacy Go service. It is a compatibility contract, not a claim that every legacy representation choice is the desired final protocol design.

## Schema

### CORE-BH-001 — fields

A v1 block header contains exactly the protocol fields:

```text
hash
previousHash
createdAt
packer
signature
```

The migrated CUE schema remains the structural source for these fields.

## Signature payload

### CORE-BH-002 — canonical payload

The signature payload **MUST** be the UTF-8 bytes of JSON with exactly the following fields in this insertion order:

```json
{"hash":"...","previousHash":"...","createdAt":"...","packer":"..."}
```

`signature` **MUST NOT** be included in the payload.

No whitespace, pretty-printing, additional field, or reordered field **MAY** be introduced by the v1 canonicalizer.

### CORE-BH-003 — Ed25519 verification

`packer` **MUST** be decoded as a hexadecimal raw Ed25519 public key.

The decoded public key **MUST** contain exactly 32 bytes.

`signature` **MUST** be decoded as hexadecimal bytes and verified as an Ed25519 signature over the `CORE-BH-002` payload.

Verification **MUST** fail if any signed field is changed without re-signing.

## Compatibility issue

### CORE-BH-004 — CUE encoding mismatch

The migrated CUE constraint for `packer` resembles a Base64-compatible character set, while the legacy Go verifier decodes the value using hexadecimal decoding.

The executable v1 verifier **MUST** preserve the legacy hexadecimal interpretation.

The schema constraint **MUST NOT** be silently changed as part of migration. Resolving the mismatch requires an explicit version/spec decision.

## Out of scope for this protocol slice

This verifier does not decide:

- whether `hash` is the correct long-term full block identifier;
- whether the packer is authorized by a repository/authority policy;
- whether the block's record set actually derives the supplied `hash` value;
- whether `previousHash` references the canonical preceding block;
- how genesis is authorized.

Those checks belong to `core.block`, chain/genesis logic, or an authorization composition and are specified separately.

## Acceptance tests

The implementation **MUST** cover at least:

1. `CORE-BH-002`: exact canonical JSON field order and representation;
2. `CORE-BH-003`: valid Ed25519 signature succeeds;
3. `CORE-BH-003`: mutation of a signed field fails;
4. `CORE-BH-004`: non-hex packer input is rejected by the executable verifier.

The current implementation is `src/protocols/core-blockheader-v1.ts` and the compatibility tests are `tests/core-blockheader-v1.test.ts`.
