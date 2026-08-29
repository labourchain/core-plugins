# `core.record` Specification

Status: **pending source-aligned review before implementation**.

The Record envelope, historical RecordId behavior, and previously selected ordinary Record signing contract remain review inputs. However, the sections below that assume `activePluginState`, N→N+1 Plugin activation, same-Block Plugin rejection, Repository-issued Plugin releases, or standalone Genesis/S0 bootstrap belong to the superseded Plugin-state design and are **not normative implementation requirements**.

Until the dedicated `core.record` review is complete, issue #7 is the implementation gate. Do not implement the superseded Plugin-availability assumptions from this document.

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

Different Record types may assign different business meaning to the author Entity. Any earlier statement that `core.plugin` Records must resolve `createdBy` as a Repository issuer is superseded and must be reconsidered outside `core.plugin`.

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

Genesis bootstrap signature behavior is pending the dedicated source review; do not assume Genesis Plugin data bypasses Record solely because it is Plugin data.

## Plugin resolution — pending review

A Record carries:

```text
plugin = name@version
pluginHash
```

and must ultimately be interpreted by that exact Plugin identity.

How the validator locates eligible Plugin Records at a given Block position is **not frozen** in this spec. In particular, do not assume before review:

```text
activePluginState
pre-Block-only Plugin snapshot
same-Block Plugin Record rejection
N -> N+1 activation
standalone Genesis S0
```

These semantics must be decided from the source-aligned Record/Block review.

## Payload validation

After the exact referenced Plugin is resolved under the reviewed Record/Block rules, `data` must satisfy that Plugin's schema/public types and deterministic validation behavior.

`core.record` handles the common Record envelope and dispatches Plugin-specific payload validation to the exact Plugin identified by `pluginHash`.

A domain Plugin may define references to Records, Assets, Projects, Repositories, or external objects. Those relations remain part of that Plugin's payload semantics. `core.record` does not assign a generic dependency meaning to them.

## PluginHash integrity

`pluginHash` must be:

```text
64-char lowercase hexadecimal DoubleSHA256 digest
```

and must identify the exact Plugin whose `name@version` equals the Record's `plugin` field.

A matching Plugin name/version with a different PluginHash is not sufficient.

## Required deterministic capabilities — pending final review

Candidate runtime capabilities are:

```text
recordId(rawRecord)
signingPayload(recordId)
verifySignature(record)
verifyRecord(record, pluginResolver)
```

The exact `verifyRecord` resolver/state shape remains pending the dedicated Record/Block availability review and must not expose the removed `activePluginState` API by assumption.

## Business relation boundary

Labour / Asset DAG relations do not participate in generic `core.record` validity beyond deterministic payload rules explicitly defined by the referenced domain Plugin.

Core must not infer business relations from timestamps, Block position, Record array order, runtime arrival order, or unsigned metadata.

## Failure cases

Subject to the pending Plugin-resolution review, an ordinary Record must reject malformed common identity/signature representations, mismatched derived RecordId, invalid author signature, inconsistent `plugin` / `pluginHash`, and payload validation failure.

There is no generic Core failure condition for Labour/Asset DAG topology or dependency ordering.

Do not treat “Plugin is not active in pre-Block state” as a frozen failure case until the Record/Block review approves such a state model.

## Tests

The eventual Record tests should protect source-derived RecordId behavior, the approved signing contract, Entity/signature encodings, exact Plugin identity consistency, and payload validation.

Do not add same-Block Plugin rejection, N→N+1 activation, activePluginState, or S0 tests before the corresponding review approves those semantics.

## Resolved source gap

The historical repository does not establish ordinary Record signing bytes. The current domain-separated RecordId signing contract remains a previously selected current-model decision, but Genesis/bootstrap interaction with it must still be reviewed against source.
