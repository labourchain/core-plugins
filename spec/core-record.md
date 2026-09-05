# `core.record` Specification

Status: defined for the ordinary Record primitive. Genesis bootstrap exceptions remain outside this spec and are reviewed separately with `core.block` / Genesis.

## Source

Historical source:

- `Ri0n72Y/blockchain-service/schemas/system/sys_record_v1.cue`
- `Ri0n72Y/blockchain-service/lib/model/types.go`
- `Ri0n72Y/blockchain-service/cmd/script/main.go::calcRecordID`
- `Ri0n72Y/blockchain-service/lib/data/recordHandler.go`

Current design source:

- `docs/source-baseline.md`
- `docs/architecture.md`
- `docs/record.md`
- `docs/genesis.md`
- `docs/ordering.md`

Historical `protocol / protocolHash` are migrated to `plugin / pluginHash`.

The historical repository does not establish ordinary Record signing bytes. The signing contract below is Current Design.

## Plugin identity

The current Core Plugin is:

```text
core.record@0.1.0
```

## Public data model

```ts
export type RecordId = string
export type EntityPublicKey = string

export interface RawRecord {
  plugin: string
  pluginHash: string
  createdBy: EntityPublicKey
  createdAt: string
  data: unknown
}

export interface Record extends RawRecord {
  id: RecordId
  signature: string
}
```

`RawRecord` contains exactly:

```text
plugin
pluginHash
createdBy
createdAt
data
```

`Record` contains exactly:

```text
id
plugin
pluginHash
createdBy
createdAt
signature
data
```

Unknown top-level fields are invalid in `core.record@0.1.0`.

## Record source semantics

Record exposes two independent sources:

```text
plugin / pluginHash
-> protocol source
-> which chain Plugin/protocol produced or issued this Record

createdBy / signature
-> actor source
-> which Entity confirms responsibility for this Record
```

`createdBy` does not identify the publisher of the referenced Plugin.

## `plugin`

`plugin` is a human-readable declaration:

```text
name@version
```

The `name` and exact SemVer syntax follow the current `core.plugin` grammar.

Examples:

```text
core.plugin@0.1.0
labour.work@1.2.3
```

`plugin` is signed fact content and therefore participates in RecordId.

It is not runtime authority. Runner/runtime must not require resolving `pluginHash` and comparing the resolved Plugin name/version to this field.

## `pluginHash`

`pluginHash` is the exact machine identity of the Plugin/protocol that produced the Record.

Wire representation:

```text
64-character lowercase hexadecimal
```

Runtime/composition resolves/executes the protocol by `pluginHash`.

`core.record` validates only the representation. It does not resolve Plugin data, artifact bytes, dependencies, activation state or Block availability.

## `createdBy`

For ordinary Records, `createdBy` is an Entity public-key reference using the current `core.entity` base58btc representation.

For Ed25519:

```text
base58btcDecode(createdBy).length == 32 bytes
```

No Base58Check checksum, version byte or implicit prefix is used.

## `createdAt`

`createdAt` is a signed fact string and participates in RecordId.

`core.record@0.1.0` does not interpret it as trusted wall-clock time and does not derive ordering from it. It must be valid JCS/I-JSON string data.

## `data`

`data` is the complete Plugin-produced fact payload.

It must be representable as deterministic RFC 8785 JCS / I-JSON data.

Allowed JSON-domain values:

```text
null
boolean
finite number
valid Unicode string
array
plain JSON object
```

Reject at least:

```text
undefined
NaN
Infinity / -Infinity
BigInt
function
symbol
host/class instance
accessor property
invalid Unicode / lone surrogate
```

Plain object means an object whose prototype is `Object.prototype` or `null` and whose enumerable string properties are ordinary data properties.

Symbol-keyed properties are invalid.

A domain Plugin may impose stronger payload rules; those rules are not part of `core.record` validation.

## Canonical Record bytes

`canonicalRecord(rawRecord)` must:

1. validate the exact RawRecord shape and common field representations;
2. validate that `data` is supported JCS/I-JSON data;
3. construct the RawRecord identity object from exactly `plugin`, `pluginHash`, `createdBy`, `createdAt`, `data`;
4. serialize it using RFC 8785 JSON Canonicalization Scheme;
5. return exact UTF-8 bytes.

Object property input order has no identity meaning.

No Unicode normalization is applied.

## RecordId

```text
RecordId = DoubleSHA256(canonicalRecord(rawRecord))
```

The serialized RecordId is 64-character lowercase hexadecimal.

RecordId commits to the complete RawRecord:

```text
plugin
pluginHash
createdBy
createdAt
data
```

It does not include:

```text
id
signature
```

This deliberately replaces the historical Go-specific:

```text
plugin:pluginHash:createdBy:createdAt:JSON(data)
```

style with a cross-language JCS identity contract.

## Full `data` participation

`core.record` does not omit storage-like or Plugin-specific fields from `data` when deriving RecordId.

Therefore when:

```text
Record.data = Plugin
```

and that Plugin contains `artifact`, the artifact field participates in RecordId because it is part of the actual chain fact.

This is distinct from `PluginHash`, whose identity form intentionally excludes Plugin.artifact storage representation.

Consequently, two Plugin Records may have the same PluginHash but different RecordId when one carries embedded artifact bytes and the other does not.

## Record representation validation

`validateRawRecord(value)` validates RawRecord structure/common representations and returns a normalized RawRecord value.

`validateRecord(value)` must:

1. validate exact Record shape;
2. validate RawRecord fields;
3. validate `id` as 64-character lowercase hexadecimal;
4. validate `signature` as 128-character lowercase hexadecimal Ed25519 signature representation;
5. derive `recordId(rawRecord)`;
6. require supplied `id` to equal the derived RecordId;
7. return the validated Record.

`validateRecord()` does not cryptographically verify the signature.

## Signing domain

```text
RECORD_SIGNING_DOMAIN = "labourchain:record:v1:"
```

For a valid RecordId:

```text
recordIdBytes = hexDecode(recordId)
```

`recordIdBytes` is exactly 32 bytes.

## Signing payload

```text
signingPayload(recordId)
= UTF8(RECORD_SIGNING_DOMAIN)
  || recordIdBytes
```

No JSON, delimiter, newline, NUL, chain identifier, Block identifier or runtime metadata is appended.

## Signature

Ordinary Record signature:

```text
signatureBytes
= Ed25519.Sign(authorSecretKey, signingPayload(record.id))
```

Wire representation:

```text
lowercase hex(signatureBytes)
```

Ed25519 signature is exactly 64 bytes / 128 lowercase hexadecimal characters.

Secret-key storage and signing UX are outside `core.record`.

## Signature verification

`verifySignature(record)` must:

1. call equivalent `validateRecord(record)` behavior, so RecordId is re-derived before signature verification;
2. decode `createdBy` as base58btc and require exactly 32 Ed25519 public-key bytes;
3. decode the 128-character lowercase-hex signature to 64 bytes;
4. construct `signingPayload(record.id)`;
5. perform Ed25519 verification;
6. return the cryptographic verification result.

Malformed Record representation is an error. A well-formed Record with a cryptographically incorrect signature returns `false`.

## Required public capabilities

```text
RecordError
validateRawRecord(value)
validateRecord(value)
canonicalRecord(rawRecord)
recordId(rawRecord)
signingPayload(recordId)
verifySignature(record)
```

Public types:

```text
RecordId
EntityPublicKey
RawRecord
Record
```

Low-level JCS, DoubleSHA256, Base58 and Ed25519 key-construction helpers remain internal unless another Core spec establishes a shared primitive API.

## Plugin/runtime boundary

`core.record` must not expose a `pluginResolver`, `activePluginState` or equivalent Plugin-state API.

The composition is:

```text
Record
-> core.record validates envelope / RecordId / actor signature
-> runtime uses pluginHash to locate exact Plugin
-> core.plugin verifies Plugin identity/artifact
-> Plugin executes its own protocol-specific Record rules
```

`plugin = name@version` remains signed human-readable declaration and is not machine execution authority.

## Out of scope

`core.record` does not define:

```text
Plugin resolution/fetch/cache
Plugin execution
Plugin dependency resolution
Plugin activation / lifecycle
same-Block Plugin availability
Block ordering / packing
Genesis exceptions
Repository issuer authorization
Labour / Asset / Project DAG semantics
persistence / network arrival
trusted time semantics
```

## Genesis boundary

Historical Genesis Source Facts include:

```text
Protocol Record.id = ProtocolHash
createdBy = "Root"
bootstrap Records without ordinary signature
```

These behaviors are not reusable branches in ordinary `core.record`.

Genesis review may later define bootstrap-specific construction/recognition rules around the ordinary Record primitive.

## Failure cases

Reject at least:

- non-object or unknown/missing top-level fields;
- malformed `plugin` declaration;
- malformed `pluginHash`;
- malformed base58btc `createdBy` or decoded key length != 32;
- non-string / invalid-Unicode `createdAt`;
- non-JCS/I-JSON `data`;
- malformed RecordId representation;
- supplied RecordId differing from derived RecordId;
- malformed signature representation.

`verifySignature()` additionally returns `false` for a well-formed but cryptographically invalid Ed25519 signature.

Do not reject based on Plugin availability, Block position, business DAG topology or wall-clock interpretation.

## Tests

Meaningful tests must cover:

- fixed JCS canonical RawRecord bytes and fixed RecordId fixture;
- object property order independence in RawRecord/data;
- `plugin`, `pluginHash`, `createdBy`, `createdAt`, and full `data` mutations changing RecordId;
- embedded Plugin artifact presence changing RecordId while PluginHash can remain unchanged;
- exact top-level shape;
- plugin / PluginHash representation validation;
- base58btc 32-byte Ed25519 public-key validation;
- malformed JSON/JCS values and invalid Unicode rejection;
- supplied RecordId mismatch rejection;
- signing payload fixed domain/bytes;
- valid Ed25519 signature verification;
- wrong signature returning false;
- signature not participating in RecordId;
- no Plugin resolver/state dependency in `core.record` API.
