# `core.protocol` Specification

Status: defined for single-artifact executable Protocol identity and runtime verification.

## Source

Historical source facts remain in `docs/source-baseline.md`. Current design source:

- `docs/architecture.md`
- `docs/protocol.md`
- `docs/runtime-abi.md`
- `docs/genesis.md`

`Protocol` is the LabourChain chain-facing stable semantic/identity term. `Plugin` is reserved for the Cordis runtime abstraction. Restoring Protocol terminology does not restore the historical schema-only Protocol runtime.

## Responsibility

`core.protocol` defines the Protocol data carried by `Record.data`, deterministic Protocol identity, exact executable artifact identity, and artifact verification primitives.

Out of scope:

```text
Protocol build/bundle/gzip tooling
SDK / CLI / publishing implementation
release/discovery metadata
Repository / Member issuer rules
activation / recommendation / deprecation
registry/cache/storage implementation
Asset implementation
source/build provenance
Record/Block ordering rules
Cordis Plugin lifecycle / Context / Service / Fiber policy
```

A Protocol implementation may later be mounted as a Cordis Plugin; `core.protocol` must not establish a second plugin lifecycle or composition system.

## Public data model

```ts
export type ArtifactHash = string
export type ProtocolHash = string

export interface ProtocolRuntime {
  kind: 'js-esm'
  abi: number
}

export interface ProtocolDependency {
  name: string
  version: string
  protocolHash: ProtocolHash
}

export interface Protocol {
  name: string
  version: string
  runtime: ProtocolRuntime
  dependencies: ProtocolDependency[]
  artifactHash: ArtifactHash
  artifact?: string
}
```

`artifact` is optional canonical RFC 4648 Base64 of the exact gzip executable bytes. It is storage only and is excluded from ProtocolHash.

No `schema`, `runtime.entry`, `files[]`, multi-file artifact map, or FileHash path/manifest model remains in the current Protocol type.

## Structural trust boundary

Protocol data is chain-facing deterministic data, not arbitrary JavaScript object state.

For `Protocol`, `runtime`, and each dependency, validation requires plain objects whose fields are enumerable own data properties. Reject class/host instances, accessors, symbol-keyed fields, hidden/non-enumerable fields, unknown fields, or missing fields.

`dependencies[]` MUST be a dense ordinary array without extra/symbol properties or accessor elements. Sparse arrays and Array subclasses are invalid.

These checks are part of canonical identity safety, not style validation.

## Name and version

Protocol/dependency names MUST match:

```regex
^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$
```

Protocol/dependency versions MUST be exact SemVer 2.0.0 values. Ranges, tags, workspace references, or leading `v` are invalid.

## Runtime descriptor

```text
runtime.kind = "js-esm"
runtime.abi = positive safe integer
```

Current ABI v1 consumes exactly one verified gzip artifact. There is no entry path because there is no multi-file runtime artifact.

A validator MAY accept future positive ABI numbers as structurally valid Protocol data; the runtime/composition layer is responsible for rejecting unsupported ABI values before execution.

This spec freezes only the currently implemented artifact/runtime descriptor. Import-to-Cordis-Plugin mounting semantics are intentionally not invented here; they require the later runtime alignment review.

## Dependencies

Each current chain-level dependency contains exactly:

```text
name
version
protocolHash
```

`protocolHash` MUST be a 64-character lowercase hexadecimal DoubleSHA256 digest and is the authoritative identity.

Dependency names MUST be unique within one Protocol. `dependencies[]` is semantically set-like; validation returns a copy sorted by dependency `name` using UTF-8 byte order before ProtocolHash serialization.

Ordinary npm/pnpm/build dependencies are not Protocol dependencies. Build tooling SHOULD bundle normal source dependencies unless they intentionally remain independently resolved chain Protocols.

The semantic boundary between this field and Cordis runtime `inject` is not finalized by this terminology refactor. Do not derive a second Cordis dependency manager from `dependencies[]`.

## ArtifactHash

```text
ArtifactHash = DoubleSHA256(exact artifact bytes)
```

For `js-esm` ABI v1, the exact artifact bytes are the gzip-compressed ESM bundle bytes that are published, embedded, mirrored, cached, and downloaded.

`ArtifactHash` MUST be serialized as 64-character lowercase hexadecimal.

Compression metadata is therefore part of exact artifact bytes. Current Core build tooling normalizes gzip metadata, but reproducible construction belongs to Protocol Dev SDK #23, not to `core.protocol` runtime verification.

## Embedded artifact

`artifact` is optional. When present:

1. it MUST be a string;
2. it MUST be canonical RFC 4648 Base64 using the standard alphabet and padding;
3. decode + re-encode MUST reproduce the exact input string;
4. `artifactHash(decodedBytes)` MUST equal `Protocol.artifactHash`.

Embedding does not change ProtocolHash. The same exact gzip bytes may be embedded in Record data, resolved from cache, mirror, registry, or other distribution channel and still identify the same Protocol.

## ProtocolHash

After validation:

```text
identity = {
  name,
  version,
  runtime,
  dependencies: dependencies sorted by UTF-8 name,
  artifactHash
}

ProtocolHash = DoubleSHA256(UTF8(JCS(identity)))
```

`artifact` MUST be excluded from identity.

JCS MUST follow the repository's existing RFC 8785/I-JSON rules, including valid Unicode scalar data and rejection of invalid numeric data such as non-finite numbers or negative zero where applicable.

## Public verification API

The public `core.protocol` API MUST be limited to:

```text
ProtocolError
validateProtocol(protocol)
artifactHash(bytes)
protocolHash(protocol)
verifyArtifact(protocol, artifactBytes, expectedProtocolHash?)
verifyEmbeddedArtifact(protocol, expectedProtocolHash?)
```

Low-level JCS serialization, identity-construction helpers, build manifest helpers, and package construction helpers MUST NOT be public runtime API.

`artifactHash()` remains public because exact artifact hashing is itself a verification primitive and may be reused by Protocol Dev SDK #23 without duplicating the protocol algorithm.

## Verification semantics

`validateProtocol(protocol)` MUST:

- validate exact shape and structural trust boundary;
- validate name/version/runtime/dependencies/digests;
- normalize dependency ordering in its returned value;
- when `artifact` exists, validate canonical Base64 and ArtifactHash.

`protocolHash(protocol)` MUST validate the Protocol and return the canonical ProtocolHash.

`verifyArtifact(protocol, bytes, expectedProtocolHash?)` MUST:

1. validate the Protocol;
2. require `bytes` to be a `Uint8Array`;
3. require `artifactHash(bytes) === protocol.artifactHash`;
4. calculate ProtocolHash;
5. if `expectedProtocolHash` is supplied, validate its digest form and require exact equality;
6. return the calculated ProtocolHash.

`verifyEmbeddedArtifact(protocol, expectedProtocolHash?)` MUST:

1. validate the Protocol and its optional embedded artifact;
2. require embedded `artifact` to exist;
3. calculate ProtocolHash;
4. optionally compare expected ProtocolHash;
5. return the calculated ProtocolHash.

Malformed data MUST throw `ProtocolError`. There is no boolean soft-failure path for malformed identity/artifact data.

## Runtime artifact size

`core.protocol` MUST NOT reject an artifact merely because compressed bytes exceed an engineering threshold. The approximately 500 KiB compressed-size warning belongs to Dev SDK/build tooling.

`js-esm` ABI v1's 1 MiB decompressed runtime hard limit belongs to runtime loading and is defined in `core-runtime-abi.md`; it is not an `artifactHash()` or Protocol descriptor-size rule.

## Distribution and metadata boundary

Human description, release notes, source URLs, package-manager metadata, registry/discovery metadata, build inputs, reproducible-build provenance, Cordis Fiber state, and current loaded/unloaded state MUST NOT be added to Protocol identity merely because they accompany a release/runtime instance.

Protocol Dev SDK is #23. Release/distribution channels are #24.

## Genesis boundary

Initial Core Protocols may carry embedded gzip artifacts so Genesis/bootstrap does not require an external registry. `core.protocol` defines no Genesis-specific validity path; Genesis #10 composes ordinary Protocol/Record/Block primitives.

ProtocolHash fixtures MUST be regenerated intentionally when this pre-v0.1.0 terminology change alters Protocol identity or artifact bytes.
