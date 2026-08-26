# `core.record` Specification

Status: defined for the current `core.record@0.1.0` Record envelope, RecordId, author signature, active-Plugin resolution, and payload validation.

## Source

Historical source:

- `Ri0n72Y/blockchain-service/schemas/system/sys_record_v1.cue`
- `Ri0n72Y/blockchain-service/lib/model/types.go`
- `Ri0n72Y/blockchain-service/cmd/script/main.go::calcRecordID`
- `Ri0n72Y/blockchain-service/lib/data/recordHandler.go`

Current design source:

- `docs/source-baseline.md`
- `docs/architecture.md`
- `docs/plugin.md`
- `docs/genesis.md`
- `docs/ordering.md`

Historical source uses `protocol` / `protocolHash`. Current Record semantics use `plugin` / `pluginHash`.

The visible historical source reserves a `signature` field but does not define an ordinary Record signing payload or verifier. That is a recorded Source Gap, not an implementation requirement. `core.record@0.1.0` therefore defines an explicit current signing contract below.

## Plugin identity

The current Core Plugin is:

```text
core.record@0.1.0
```

## Current Record shape

The current Record envelope is:

```text
id
plugin
pluginHash
createdBy
createdAt
signature
data
```

`plugin` is a human-readable exact release reference:

```text
name@version
```

For example:

```text
core.block@0.1.0
```

`pluginHash` is the exact executable Plugin identity defined by `core.plugin`.

Historical `protocol` / `protocolHash` remain Source Fact only and must not appear in current-model APIs merely for naming compatibility.

## RawRecord

The unsigned/common Record content is:

```text
plugin
pluginHash
createdBy
createdAt
data
```

`id` derives from this RawRecord. `signature` confirms the resulting RecordId but is not part of the RecordId itself.

## RecordId

The current Record ID algorithm preserves the historical value-concatenation behavior while applying the current field semantics:

1. JSON-marshal `data` using source-compatible deterministic behavior;
2. concatenate `plugin`, `pluginHash`, `createdBy`, `createdAt`, and serialized `data` with `:` separators in that order;
3. apply SHA-256 twice;
4. represent the 32-byte digest as 64-character lowercase hexadecimal.

Conceptually:

```text
RecordId = DoubleSHA256(current RawRecord values)
```

Renaming `protocol` → `plugin` and `protocolHash` → `pluginHash` does not add field names to the hash input; the algorithm hashes the ordered values.

RecordId is a digest and must not be Base58-encoded.

A TypeScript implementation must reproduce known source fixtures where equivalent historical/current field values are used. It must not assume arbitrary JavaScript object property ordering proves compatibility with the historical JSON behavior.

## Entity author identity

`createdBy` is an Entity public-key reference for ordinary post-Genesis Records.

Ordinary Record author identity therefore uses the base58btc Entity public-key representation defined by `core.entity`.

For Ed25519 Entity identity:

```text
base58btcDecode(createdBy).length == 32 bytes
```

This Base58 rule applies because `createdBy` is an Entity identity reference. It does not apply to `id`, `pluginHash`, or `signature`.

Different Record types may assign different business meaning to the author Entity. In particular, ordinary `core.plugin` release Records require `createdBy` to resolve to a Repository public key.

## Record signing payload

`core.record@0.1.0` defines the fixed signing domain:

```text
RECORD_SIGNING_DOMAIN = "labourchain:record:v1:"
```

For a valid 64-character lowercase-hex RecordId:

```text
recordIdBytes = hexDecode(record.id)
```

`recordIdBytes` must be exactly 32 bytes.

The exact signing payload is:

```text
signingPayload(record.id)
= UTF8(RECORD_SIGNING_DOMAIN)
  || recordIdBytes
```

No JSON encoding, delimiter, newline, NUL byte, chain identifier, GenesisId, BlockId, or other runtime metadata is appended.

This contract intentionally signs the already-derived RecordId rather than serializing RawRecord a second time. The RecordId commits to `plugin`, `pluginHash`, `createdBy`, `createdAt`, and `data`; the fixed domain prefix prevents the same Ed25519 operation from being interpreted as a generic signature over an arbitrary 32-byte digest.

## Signature generation and wire representation

An ordinary Record signature is:

```text
signatureBytes
= Ed25519.Sign(authorSecretKey, signingPayload(record.id))
```

The signing key must correspond to the Entity public key encoded in `createdBy`.

The on-chain `signature` field is:

```text
lowercase hex(signatureBytes)
```

For Ed25519 it must therefore be exactly:

```text
64 bytes
128 lowercase hexadecimal characters
```

Signature is a cryptographic result, not an Entity identity and not a Base58 value.

Secret-key storage and user/device signing UX belong to the runner/client/identity side. `core.record` only defines the deterministic signing bytes and verification rule.

## Signature verification

A trusted ordinary Record verifier must not verify the supplied `id` blindly.

It must first derive the expected RecordId from the Record's RawRecord fields and require:

```text
record.id == recordId(rawRecord)
```

Only after that equality succeeds may it construct `signingPayload(record.id)` and verify the signature.

Verification uses:

```text
publicKeyBytes = base58btcDecode(record.createdBy)
signatureBytes = hexDecode(record.signature)

Ed25519.Verify(
  publicKeyBytes,
  signingPayload(record.id),
  signatureBytes
)
```

The decoded public key must be exactly 32 bytes and the decoded signature exactly 64 bytes.

Because `signature` is not part of RawRecord, changing only the signature does not change RecordId. It does make author confirmation invalid unless the replacement signature also verifies for the same `createdBy` and signing payload.

Genesis initial Plugin artifacts do not use this ordinary Record signing path.

## Active Plugin resolution

An ordinary Record is interpreted only against a Plugin active before its containing Block begins.

The Record's:

```text
plugin = name@version
pluginHash
```

must resolve to the same exact active Plugin release.

A Plugin released earlier in the same ordinary Block is not active for this purpose.

Genesis initial Plugins are outside ordinary Record validation and are loaded through `spec/genesis.md`.

## Payload validation

After the referenced Plugin is resolved, `data` must satisfy that Plugin's schema/public types and deterministic validation behavior.

`core.record` handles the common Record envelope and dispatches Plugin-specific payload validation to the exact active Plugin identified by `pluginHash`.

A domain Plugin may define references to Records, Assets, Projects, Repositories, or external objects. Those relations remain part of that Plugin's payload semantics. `core.record` does not assign a generic dependency meaning to them.

## PluginHash integrity

`pluginHash` must be:

```text
64-char lowercase hexadecimal DoubleSHA256 digest
```

and must resolve to the exact active Plugin artifact whose manifest `name@version` equals the Record's `plugin` field.

A matching Plugin name/version with a different PluginHash is not sufficient.

## Required deterministic capabilities

The `core.record` runtime must provide equivalent deterministic capabilities for:

```text
recordId(rawRecord)
signingPayload(recordId)
verifySignature(record)
verifyRecord(record, activePluginState, pluginResolver)
```

Exact TypeScript function names may differ if the public Plugin ABI uses a different naming convention, but the behavior must remain separately testable.

`verifyRecord` must cover at least:

1. common Record shape/encoding validation;
2. RecordId recomputation and equality;
3. `createdBy` Entity public-key validation;
4. signature decoding and Ed25519 verification;
5. exact active `plugin` + `pluginHash` resolution;
6. deterministic payload validation under that exact Plugin.

Repository issuer authorization, packer authorization, persistence, network arrival, and canonical-chain selection do not belong to this primitive unless explicitly supplied by another Plugin/composition layer.

## Business relation boundary

Labour / Asset DAG relations do not participate in generic `core.record` validity beyond deterministic payload rules explicitly defined by the referenced domain Plugin.

Core must not infer business relations from timestamps, Block position, Record array order, runtime arrival order, or unsigned metadata.

## Failure cases

An ordinary Record must be rejected when at least one of the following holds:

- `id` is not 64-character lowercase hexadecimal;
- recomputed RecordId differs from `id`;
- `plugin` is not a valid exact `name@version` reference;
- `pluginHash` is malformed;
- `createdBy` is malformed base58btc or does not decode to a 32-byte Ed25519 public key;
- `signature` is not exactly 128-character lowercase hexadecimal or does not decode to 64 bytes;
- Ed25519 verification over the exact domain-separated RecordId payload fails;
- its exact Plugin is not active before the containing Block;
- `plugin` and `pluginHash` resolve inconsistently;
- payload validation under the exact Plugin fails.

There is no generic Core failure condition for Labour/Asset DAG topology or dependency ordering.

## Tests

Meaningful tests must cover:

- historical/current equivalent RecordId compatibility fixture;
- Record mutation changing the derived RecordId;
- signature mutation not changing RecordId but failing signature verification;
- RecordId remaining a DoubleSHA256 digest rather than Base58 identity;
- exact signing payload bytes: UTF-8 domain prefix followed by the 32 decoded RecordId bytes;
- a fixed Ed25519 valid signature vector for the Record signing domain;
- valid signature rejected when verified under a different author public key;
- valid signature rejected when Record content changes and the RecordId is recomputed or mismatches;
- malformed/uppercase/wrong-length RecordId rejection;
- malformed/uppercase/wrong-length signature rejection;
- valid/invalid base58btc `createdBy` Entity references;
- exact `plugin` + `pluginHash` resolution;
- same name/version with wrong PluginHash rejection;
- inactive Plugin reference rejection;
- Plugin released in the same Block remaining unavailable for Record validation;
- active Plugin payload validation success/failure;
- business-reference fields acquiring no implicit Core ordering semantics.

Do not add separate tests merely to increase coverage when they do not protect an independent Record contract or regression.

## Resolved source gap

The historical repository does not establish ordinary Record signing bytes. `core.record@0.1.0` intentionally resolves that gap with the versioned domain-separated RecordId signing contract above.

If additional historical documentation is recovered later, record it as Source Fact and compare it with this current contract; do not silently rewrite the already-versioned `core.record@0.1.0` behavior.
