# `core.entity` Specification

Status: defined for the current Entity identity primitive; domain ownership semantics remain outside Core. Ordinary Record identity/signature behavior is defined by `core.record`; Plugin availability relative to Block state remains outside `core.entity`.

## Source

Historical source:

- `Ri0n72Y/blockchain-service/schemas/system/sys_entity_v1.cue`
- `Ri0n72Y/blockchain-service/lib/model/types.go`

Current design source:

- `docs/architecture.md`
- `docs/plugin.md`
- `docs/record.md`
- `docs/genesis.md`

Historical source uses `protocolHash`; current Entity semantics use `pluginHash`.

## Plugin identity

The current Core Plugin is:

```text
core.entity@0.1.0
```

It provides the minimal public-key-rooted identity primitive used by domain Plugins such as Repository and Member.

## Historical source shape

The historical CUE shape contains:

```text
publicKey
contributors
protocolHash
type?
```

The historical Go `Entity` model additionally contains generic optional `Data`.

That mismatch remains Source Fact only.

## Current base shape

The current Entity payload shape is:

```text
publicKey
contributors
pluginHash
type?
```

`pluginHash` is the exact Plugin identity governing this Entity payload. It is a DoubleSHA256 digest, not an Entity public key.

The historical Go-only `Data` field is not silently added to the current base Entity schema.

## Entity key model

Entity identity is the only Core identity class that owns a cryptographic key pair.

```text
Entity public key -> Base58
Entity secret key -> Base58, local only
```

Base58 means base58btc / Bitcoin alphabet:

```text
123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

The codec is raw bytes ↔ Base58 text only. Do not add Base58Check checksum, version bytes, or an implicit prefix.

Only `publicKey` may appear in chain data.

Entity secret-key material must never be serialized into Entity Records, BlockHeaders, Plugin data/artifacts, or other on-chain structures.

If an implementation exposes key-generation, key-import, or signing helpers, those helpers belong to the Entity/identity side or an injected key provider and must preserve the local-only secret-key rule.

## Public-key references

Fields in other Plugins whose semantic type is an Entity public-key reference use the same base58btc representation.

Examples include, when their schema meaning is Entity identity:

```text
Record.createdBy
BlockHeader.packer
Repository.publicKey
Member.publicKey
contributors[]
```

Do not generalize Base58 to hash-derived IDs.

## Digest boundary

`pluginHash` is a DoubleSHA256-derived Plugin artifact identity, not an Entity identity.

Therefore:

```text
publicKey  -> Base58 Entity identity
pluginHash -> DoubleSHA256 digest representation
```

RecordId, PluginHash, Block identity, and RecordsRoot are not Base58 values merely because they identify chain objects.

## Core meaning

`core.entity` does not assign Repository membership, resume/profile, Project, Asset ownership, labour, Plugin-release authorization, or packer-authorization semantics.

Those semantics belong to Repo, LabourFlow, Board, runner/server policy, or other domain Plugins.

## Validation

An Entity payload interpreted by `core.entity` must satisfy:

- `core.entity` structural validation;
- base58btc public-key decoding/validation;
- `pluginHash` representation/integrity rules defined below;
- any additional rules defined by a domain Plugin that builds on Entity.

When Entity data is carried by a Record, the common envelope, JCS RecordId and `createdBy` author signature are validated by the defined `core.record` contract.

`core.record` does not resolve or execute the Record's protocol Plugin. Runtime/composition uses the Record's `pluginHash` as machine authority. Any chain-level policy about Plugin availability relative to Block position belongs to `core.block` / runtime composition, not `core.entity`.

For Ed25519 Entity identities, Base58-decoded `publicKey` must be exactly 32 bytes.

`pluginHash` must be a valid 64-character lowercase-hex PluginHash according to the Entity payload contract. `core.entity` does not turn a human-readable name/version into machine authority.

## Genesis boundary

Genesis remains a Block containing Records. Initial `core.entity` Plugin data therefore appears through a Plugin Record (`Record.data = Plugin`), not through an independent initial Plugin-state/S0 structure.

For MVP bootstrap, that initial `core.entity` Plugin Record should carry the complete embedded executable artifact required by `spec/core-plugin.md`, just like the other initial Core Plugin Records. This lets a node obtain and verify the Plugin bytes from Genesis/chain data without first depending on an external Plugin registry.

The ordinary Record contract is already defined by `core.record`. Whether Genesis retains historical exceptions such as special RecordId, `createdBy = "Root"`, unsigned bootstrap Records, Root Member/Repository creation, or special Header behavior remains part of the dedicated Genesis / `core.block` review.

## Historical encoding discrepancy

The historical source CUE regex accepts a Base64-like alphabet, while visible historical Go code elsewhere uses hexadecimal Ed25519 public-key strings.

Current Design explicitly standardizes Entity public-key identity on base58btc. This is a deliberate current contract, not a claim that the visible legacy Go implementation already used Base58 everywhere.

## Failure cases

Reject at least:

- missing required base Entity fields;
- malformed base58btc `publicKey`;
- a decoded public key whose length is not 32 bytes for Ed25519;
- malformed `pluginHash`;
- structurally invalid `contributors` / optional `type` values under the current schema;
- accidental inclusion of secret-key material in serialized Entity data.

Domain-level authorization or membership failure is not a base Entity validation failure unless the corresponding domain Plugin explicitly composes it.

Do not add failure cases based on unreviewed Plugin activation/availability state.

## Tests

Meaningful tests should cover:

- required `publicKey`, `contributors`, and `pluginHash` fields;
- optional `type` behavior;
- base58btc fixture(s) using the exact configured alphabet;
- valid 32-byte Ed25519 public-key round-trip;
- malformed Base58 and wrong decoded key length rejection;
- Entity secret-key material never appearing in serialized Entity data;
- PluginHash remaining a digest rather than Base58 identity;
- the historical Go-model/CUE `Data` mismatch remaining visible rather than silently normalized.

Tests for Repository/Member business rules belong to their owning Plugins. Plugin availability relative to Block state belongs to the later `core.block` / runtime-composition contract, not `core.entity` or `core.record`.
