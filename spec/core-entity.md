# `core.entity` Specification

Status: **defined for the current chain-level identity data primitive**.

## Source

Historical source:

- `Ri0n72Y/blockchain-service/schemas/system/sys_entity_v1.cue`
- `Ri0n72Y/blockchain-service/lib/model/types.go`

Current design source:

- `docs/architecture.md`
- `docs/record.md`
- the Core consistency review

Historical Entity contained `publicKey`, `contributors`, `protocolHash`, optional `type`, and the historical Go model additionally exposed generic `Data`. Current Core keeps only fields that still have a distinct identity-layer responsibility.

## Responsibility

`core.entity` defines LabourChain's public-key-rooted identity data and the shared `EntityPublicKey` representation used by Core.

An Entity is not an abstract base object that Member, Repository, Organization, or other domain payloads extend. Higher-level Protocols reference an `EntityPublicKey` as a stable identity and define their own data independently.

```text
EntityPublicKey
    ↓ identity reference
Worker / Repository / Organization / future domain facts
```

`core.entity` does not own registration state or onboarding policy. Initial exceptions, first registration, duplicate registration handling, on-chain admission flow, and rules about whether an identity must already be registered before acting are defined by the Repo package/composition layer.

## Public data model

```ts
export type EntityPublicKey = string

export interface Entity {
  publicKey: EntityPublicKey
  introducedBy?: EntityPublicKey
}
```

`publicKey` is the identity represented by this Entity fact.

`introducedBy`, when present, declares the Entity identity through which this identity claims to have been introduced. Core validates only its public-key representation. Whether that declaration is accepted as the initial introduction belongs to the Repo registration flow.

## Removed legacy fields

### `protocolHash`

Removed. Protocol provenance already belongs to the enclosing Record:

```text
Record.protocol / Record.protocolHash
```

Repeating Protocol identity inside Entity would create a second source of truth.

### `type`

Removed. Worker, Repository, Organization, Member relations, and other domain meanings are defined by their owning Protocols rather than a Core Entity discriminator.

### `contributors[]`

Replaced by optional singular `introducedBy`.

The historical plural field did not prove multi-party consent and had no Core authorization semantics. Multi-party endorsement, later invitations, registration history, or other social relations should be represented as explicit higher-level facts when needed.

## Public-key representation

`EntityPublicKey` is a raw Ed25519 public key encoded with the Bitcoin/base58btc alphabet:

```text
123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

For every Entity public-key reference:

```text
base58btcDecode(value).length == 32 bytes
```

A 32-byte Ed25519 key encodes to at most 44 Base58 characters; impossible longer input may be rejected before BigInt decoding.

No Base58Check checksum, version byte, or implicit prefix is used.

Other Core fields whose semantic type is an Entity identity use the same representation:

```text
Record.createdBy
BlockHeader.packer
Entity.introducedBy
```

Hash-derived identifiers such as ProtocolHash, RecordId, BlockId, and RecordsRoot remain digest values rather than Base58 identities.

Secret-key material is local-only and must never appear in Entity or other on-chain Core data.

## Identity fact and registration boundary

An Entity value may be carried as ordinary Record data:

```text
Record.data = Entity
```

The enclosing Record remains responsible for protocol and actor provenance:

```text
Record.protocol / protocolHash
-> protocol provenance

Record.createdBy / signature
-> actor that cryptographically confirms the Record
```

`introducedBy` is independent from `Record.createdBy`.

Core does not infer registration from a valid signature and does not maintain a registry inside `core.entity`, `core.record`, or `core.block`.

The Repo package/composition layer owns at least:

```text
initial/root registration exceptions
who may register an Entity
first-registration / duplicate-registration rules
whether introducedBy is accepted as initial provenance
whether an acting Entity must already be on-chain
registration/onboarding workflow
```

Therefore a cryptographically valid `Record.createdBy` or `BlockHeader.packer` is not, by Core validation alone, proof that Repo registration policy has accepted that identity.

`introducedBy` does not by itself mean:

```text
ownership
membership
multi-signature approval
authorization threshold
permanent trust
```

## Domain composition

Higher-level domain data references Entity identities; it does not inherit the Entity object.

Examples:

```text
Worker fact       -> references worker EntityPublicKey
Repository fact   -> references repository EntityPublicKey
Organization fact -> references organization EntityPublicKey
Member relation   -> relates Worker/Repository identities
```

No inheritance, mixin, generic Entity base class, or schema-extension mechanism is required.

## Validation

`validateEntityPublicKey(value)` requires a non-empty Base58btc string decoding to exactly 32 Ed25519 bytes and returns the validated `EntityPublicKey`.

`validateEntity(value)` requires:

1. a plain object;
2. exactly required `publicKey` plus optional `introducedBy`;
3. all present properties to be enumerable own data properties;
4. no symbol-keyed, hidden, accessor, or extra fields;
5. `publicKey` to satisfy `validateEntityPublicKey`;
6. when present, `introducedBy` to satisfy the same representation.

Explicit `introducedBy: undefined` is invalid because presence declares the field and a valid Entity public key is required.

Unknown historical/domain fields such as `contributors`, `protocolHash`, `type`, generic `Data`, or secret-key fields are invalid.

## Public API

```text
EntityError
encodeBase58btc(bytes)
decodeBase58btc(value)
validateEntityPublicKey(value)
validateEntity(value)
```

Public types:

```text
Entity
EntityPublicKey
```

Do not add identity registries, membership APIs, invitation managers, provenance graphs, inheritance helpers, or Repo registration policy to `core.entity`.

## Failure cases

Reject at least:

- non-object Entity input;
- missing `publicKey`;
- extra or removed legacy/domain fields;
- malformed Base58btc public-key references;
- public-key references decoding to a length other than 32 bytes;
- impossible overlong EntityPublicKey encodings;
- malformed `introducedBy` when present;
- explicit `introducedBy: undefined`;
- symbol-keyed, hidden, accessor, or non-data-property Entity shapes;
- secret-key material serialized into Entity data.

Do not reject based on Repo registration/admission state; that requires external composition state.

## Tests

Meaningful tests cover:

- fixed Base58btc public-key fixture and byte round-trip;
- maximum valid 44-character Ed25519 Base58 encoding and overlong rejection;
- Entity with only `publicKey`;
- Entity with one valid `introducedBy`;
- malformed/wrong-length public-key references;
- rejection of removed `contributors`, `protocolHash`, and `type` fields;
- rejection of secret-key/historical generic Data fields;
- rejection of accessor and symbol-keyed shapes.

Repo registration, onboarding, initial exceptions, membership, endorsement, and authorization tests belong to the Repo/domain package.
