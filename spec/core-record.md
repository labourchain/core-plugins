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

Current design restores the historical field names `protocol / protocolHash` while replacing the old schema-only Protocol implementation and Go-specific RecordId encoding with the reviewed executable Protocol and JCS contracts.

The historical repository does not establish ordinary Record signing bytes. The signing contract below is Current Design.

## Protocol identity

The current Core Protocol is:

```text
core.record@0.1.0
```

## Public data model

```ts
export type RecordId = string
import type { EntityPublicKey } from './entity.js'
import type { ProtocolHash } from './protocol.js'

export interface RawRecord {
  protocol: string
  protocolHash: ProtocolHash
  createdBy: EntityPublicKey
  createdAt: string
  data: unknown
}

export interface Record extends RawRecord {
  id: RecordId
  signature: string
}
```

`EntityPublicKey` is owned by `core.entity`. The `core.record` subpath may re-export that type for compatibility, but it does not define a second identity representation.

`RawRecord` contains exactly:

```text
protocol
protocolHash
createdBy
createdAt
data
```

`Record` contains exactly:

```text
id
protocol
protocolHash
createdBy
createdAt
signature
data
```

Unknown top-level fields are invalid in `core.record@0.1.0`.

## Record source semantics

Record exposes two independent sources:

```text
protocol / protocolHash
-> protocol source
-> which chain Protocol produced, issued, or interprets this Record

createdBy / signature
-> actor source
-> which Entity confirms responsibility for this Record
```

`createdBy` does not identify the publisher of the referenced Protocol.

## `protocol`

`protocol` is a human-readable declaration:

```text
name@version
```

The `name` and exact SemVer syntax follow the current `core.protocol` grammar.

Examples:

```text
core.protocol@0.1.0
labour.work@1.2.3
```

`protocol` is signed fact content and therefore participates in RecordId.

It is not runtime authority. Runtime/composition must not require resolving `protocolHash` and comparing the resolved Protocol name/version to this field.

## `protocolHash`

`protocolHash` is the exact machine identity of the Protocol that produced or interprets the Record.

Wire representation:

```text
64-character lowercase hexadecimal
```

Runtime/composition resolves the exact Protocol implementation by `protocolHash`.

`core.record` validates only the representation. It does not resolve Protocol data, artifact bytes, dependencies, activation state, Cordis Plugin lifecycle, or Block availability.

## `createdBy`

For ordinary Records, `createdBy` is an Entity public-key reference using the current `core.entity` base58btc representation.

Validation reuses the single Core `validateEntityPublicKey()` primitive rather than maintaining a second Base58/key-length implementation inside `core.record`.

For Ed25519:

```text
base58btcDecode(createdBy).length == 32 bytes
```

No Base58Check checksum, version byte or implicit prefix is used.

## `createdAt`

`createdAt` is a signed fact string and participates in RecordId.

`core.record@0.1.0` does not interpret it as trusted wall-clock time and does not derive ordering from it. It must be valid JCS/I-JSON string data.

## `data`

`data` is the complete Protocol-produced fact payload.

It must be representable as deterministic RFC 8785 JCS / I-JSON data without retaining JavaScript values that collapse to the same canonical JSON representation.

Allowed JSON-domain values:

```text
null
boolean
finite number except -0
valid Unicode string
ordinary array
plain JSON object
```

Reject at least:

```text
undefined
NaN
Infinity / -Infinity
-0
BigInt
function
symbol
host/class instance
Array subclass / custom Array prototype
accessor property
invalid Unicode / lone surrogate
```

Plain object means an object whose prototype is `Object.prototype` or `null` and whose enumerable string properties are ordinary data properties.

Ordinary array means an Array whose direct prototype is `Array.prototype`, whose indexed elements are dense enumerable own data properties, and which has no extra/symbol properties. Array subclasses are invalid even when `Array.isArray()` returns true.

Symbol-keyed properties are invalid.

A domain Protocol may impose stronger payload rules; those rules are not part of `core.record` validation.

## Canonical Record bytes

`canonicalRecord(rawRecord)` must:

1. validate the exact RawRecord shape and common field representations;
2. validate that `data` is supported JCS/I-JSON data;
3. construct the RawRecord identity object from exactly `protocol`, `protocolHash`, `createdBy`, `createdAt`, `data`;
4. serialize it using RFC 8785 JSON Canonicalization Scheme;
5. return exact UTF-8 bytes.

Object property input order has no identity meaning.

No Unicode normalization is applied.

`-0` is rejected before JCS serialization because ECMAScript serializes it as `0` while JavaScript runtime code can distinguish the two values. Record identity therefore never accepts two runtime-distinct numeric inputs that collapse only through minus-zero serialization.

## RecordId

```text
RecordId = DoubleSHA256(canonicalRecord(rawRecord))
```

The serialized RecordId is 64-character lowercase hexadecimal.

RecordId commits to the complete RawRecord:

```text
protocol
protocolHash
createdBy
createdAt
data
```

It does not include:

```text
id
signature
```

This deliberately replaces the historical Go-specific colon-concatenation identity with a cross-language JCS identity contract.

## Full `data` participation

`core.record` does not omit storage-like or Protocol-specific fields from `data` when deriving RecordId.

Therefore when:

```text
Record.data = Protocol
```

and that Protocol contains `artifact`, the artifact field participates in RecordId because it is part of the actual chain fact.

This is distinct from `ProtocolHash`, whose identity form intentionally excludes `Protocol.artifact` storage representation.

Consequently, two Protocol Records may have the same ProtocolHash but different RecordId when one carries embedded artifact bytes and the other does not.

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

1. call equivalent `validateRecord(record)` behavior, so RecordId and the shared Entity public-key representation are revalidated before signature verification;
2. decode the already-validated `createdBy` using the shared `core.entity` base58btc codec;
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
RawRecord
Record
```

`EntityPublicKey` comes from `core.entity`; the Record subpath may re-export it but does not own a separate definition.

Low-level JCS, DoubleSHA256 and Ed25519 SPKI construction remain internal. Base58btc and Entity public-key representation belong to `core.entity` and are reused here rather than duplicated.

## Protocol/runtime boundary

`core.record` must not expose a `protocolResolver`, `activeProtocolState` or equivalent Protocol-state API.

The composition is:

```text
Record
-> core.record validates envelope / RecordId / actor signature
-> runtime uses protocolHash to locate exact Protocol implementation
-> core.protocol verifies Protocol identity/artifact
-> Protocol implementation executes its own Record rules
```

`protocol = name@version` remains signed human-readable declaration and is not machine execution authority.

Cordis Plugin mounting/lifecycle belongs to runtime composition and must not be duplicated by `core.record`.

## Out of scope

`core.record` does not define:

```text
Protocol resolution/fetch/cache
Protocol execution
Protocol dependency resolution
Protocol activation / lifecycle
Cordis Plugin lifecycle
same-Block Protocol availability
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
- malformed `protocol` declaration;
- malformed `protocolHash`;
- malformed base58btc `createdBy` or decoded key length != 32;
- non-string / invalid-Unicode `createdAt`;
- non-JCS/I-JSON `data`, including `-0`, Array subclasses, sparse/extended arrays, accessors and symbol-keyed properties;
- malformed RecordId representation;
- supplied RecordId differing from derived RecordId;
- malformed signature representation.

`verifySignature()` additionally returns `false` for a well-formed but cryptographically invalid Ed25519 signature.

Do not reject based on Protocol availability, Block position, business DAG topology or wall-clock interpretation.

## Tests

Meaningful tests must cover:

- fixed JCS canonical RawRecord bytes and fixed RecordId fixture;
- object property order independence in RawRecord/data;
- `protocol`, `protocolHash`, `createdBy`, `createdAt`, and full `data` mutations changing RecordId;
- embedded Protocol artifact presence changing RecordId while ProtocolHash can remain unchanged;
- exact top-level shape;
- protocol / ProtocolHash representation validation;
- shared `core.entity` base58btc 32-byte Ed25519 public-key validation;
- malformed JSON/JCS values, `-0`, Array subclasses and invalid Unicode rejection;
- supplied RecordId mismatch rejection;
- signing payload fixed domain/bytes;
- valid Ed25519 signature verification;
- wrong signature returning false;
- signature not participating in RecordId;
- no Protocol resolver/state dependency in `core.record` API.
