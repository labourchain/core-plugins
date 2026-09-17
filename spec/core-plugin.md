# `core.plugin` Specification

Status: defined for single-artifact executable Plugin identity and runtime verification.

## Source

Historical source facts remain in `docs/source-baseline.md`. Current design source:

- `docs/architecture.md`
- `docs/plugin.md`
- `docs/runtime-abi.md`
- `docs/genesis.md`

Historical `Protocol` is replaced by `Plugin`; there is no parallel Protocol entity.

## Responsibility

`core.plugin` defines the Plugin data carried by `Record.data`, deterministic Plugin identity, exact executable artifact identity, and runtime verification primitives.

Out of scope:

```text
Plugin build/bundle/gzip tooling
SDK / CLI / publishing implementation
release/discovery metadata
Repository / Member issuer rules
activation / recommendation / deprecation
registry/cache/storage implementation
Asset implementation
source/build provenance
Record/Block ordering rules
lifecycle/RPC/Cordis Context policy
```

## Public data model

```ts
export type ArtifactHash = string
export type PluginHash = string

export interface PluginRuntime {
  kind: 'js-esm'
  abi: number
}

export interface PluginDependency {
  name: string
  version: string
  pluginHash: PluginHash
}

export interface Plugin {
  name: string
  version: string
  runtime: PluginRuntime
  dependencies: PluginDependency[]
  artifactHash: ArtifactHash
  artifact?: string
}
```

`artifact` is optional canonical RFC 4648 Base64 of the exact gzip executable bytes. It is storage only and is excluded from PluginHash.

No `schema`, `runtime.entry`, `files[]`, `PluginFile`, multi-file artifact map, or FileHash path/manifest model remains in the current Plugin type.

## Structural trust boundary

Plugin data is chain-facing deterministic data, not arbitrary JavaScript object state.

For `Plugin`, `runtime`, and each dependency, validation requires plain objects whose fields are enumerable own data properties. Reject class/host instances, accessors, symbol-keyed fields, hidden/non-enumerable fields, unknown fields, or missing fields.

`dependencies[]` MUST be a dense ordinary array without extra/symbol properties or accessor elements. Sparse arrays and Array subclasses are invalid.

These checks are part of canonical identity safety, not style validation.

## Name and version

Plugin/dependency names MUST match:

```regex
^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$
```

Plugin/dependency versions MUST be exact SemVer 2.0.0 values. Ranges, tags, workspace references, or leading `v` are invalid.

## Runtime descriptor

```text
runtime.kind = "js-esm"
runtime.abi = positive safe integer
```

ABI v1 consumes exactly one verified gzip artifact. There is no entry path because there is no multi-file runtime artifact.

A validator MAY accept future positive ABI numbers as structurally valid Plugin data; the runner/composition layer is responsible for rejecting unsupported ABI values before execution.

## Dependencies

Each chain-level runtime dependency contains exactly:

```text
name
version
pluginHash
```

`pluginHash` MUST be a 64-character lowercase hexadecimal DoubleSHA256 digest and is the authoritative identity.

Dependency names MUST be unique within one Plugin. `dependencies[]` is semantically set-like; validation returns a copy sorted by dependency `name` using UTF-8 byte order before PluginHash serialization.

Ordinary npm/pnpm/build dependencies are not Plugin dependencies. Build tooling SHOULD bundle normal source dependencies unless they intentionally remain independently resolved chain Plugins.

## ArtifactHash

```text
ArtifactHash = DoubleSHA256(exact artifact bytes)
```

For `js-esm` ABI v1, the exact artifact bytes are the gzip-compressed ESM bundle bytes that are published, embedded, mirrored, cached, and downloaded.

`ArtifactHash` MUST be serialized as 64-character lowercase hexadecimal.

Compression metadata is therefore part of exact artifact bytes. Current Core build tooling normalizes gzip metadata, but reproducible construction belongs to Plugin Dev SDK #23, not to `core.plugin` runtime verification.

## Embedded artifact

`artifact` is optional. When present:

1. it MUST be a string;
2. it MUST be canonical RFC 4648 Base64 using the standard alphabet and padding;
3. decode + re-encode MUST reproduce the exact input string;
4. `artifactHash(decodedBytes)` MUST equal `Plugin.artifactHash`.

Embedding does not change PluginHash. The same exact gzip bytes may be embedded in Record data, resolved from cache, mirror, registry, or other distribution channel and still identify the same Plugin.

## PluginHash

After validation:

```text
identity = {
  name,
  version,
  runtime,
  dependencies: dependencies sorted by UTF-8 name,
  artifactHash
}

PluginHash = DoubleSHA256(UTF8(JCS(identity)))
```

`artifact` MUST be excluded from identity.

JCS MUST follow the repository's existing RFC 8785/I-JSON rules, including valid Unicode scalar data and rejection of invalid numeric data such as non-finite numbers or negative zero where applicable.

## Public runtime API

The public `core.plugin` API MUST be limited to:

```text
PluginError
validatePlugin(plugin)
artifactHash(bytes)
pluginHash(plugin)
verifyArtifact(plugin, artifactBytes, expectedPluginHash?)
verifyEmbeddedArtifact(plugin, expectedPluginHash?)
```

`canonicalPlugin`, low-level JCS serialization, identity-construction helpers, build manifest helpers, and package construction helpers MUST NOT be public runtime API.

`artifactHash()` remains public because exact artifact hashing is itself a runtime verification primitive and may be reused by Plugin Dev SDK #23 without duplicating the protocol algorithm.

## Verification semantics

`validatePlugin(plugin)` MUST:

- validate exact shape and structural trust boundary;
- validate name/version/runtime/dependencies/digests;
- normalize dependency ordering in its returned value;
- when `artifact` exists, validate canonical Base64 and ArtifactHash.

`pluginHash(plugin)` MUST validate the Plugin and return the canonical PluginHash.

`verifyArtifact(plugin, bytes, expectedPluginHash?)` MUST:

1. validate the Plugin;
2. require `bytes` to be a `Uint8Array`;
3. require `artifactHash(bytes) === plugin.artifactHash`;
4. calculate PluginHash;
5. if `expectedPluginHash` is supplied, validate its digest form and require exact equality;
6. return the calculated PluginHash.

`verifyEmbeddedArtifact(plugin, expectedPluginHash?)` MUST:

1. validate the Plugin and its optional embedded artifact;
2. require embedded `artifact` to exist;
3. calculate PluginHash;
4. optionally compare expected PluginHash;
5. return the calculated PluginHash.

Malformed data MUST throw `PluginError`. There is no boolean soft-failure path for malformed identity/artifact data.

## Runtime artifact size

`core.plugin` MUST NOT reject an artifact merely because compressed bytes exceed an engineering threshold. The approximately 500 KiB compressed-size warning belongs to Dev SDK/build tooling.

`js-esm` ABI v1's 1 MiB decompressed runtime hard limit belongs to runner/runtime loading and is defined in `core-runtime-abi.md`; it is not an `artifactHash()` or Plugin descriptor-size rule.

## Distribution and metadata boundary

Human description, release notes, source URLs, package-manager metadata, registry/discovery metadata, build inputs, and reproducible-build provenance MUST NOT be added to Plugin runtime identity merely because they accompany a release.

Plugin Dev SDK is #23. Release/distribution channels are #24.

## Genesis boundary

Initial Core Plugins may carry embedded gzip artifacts so Genesis/bootstrap does not require an external registry. `core.plugin` defines no Genesis-specific validity path; Genesis #10 composes ordinary Plugin/Record/Block primitives.

PluginHash fixtures MUST be intentionally updated by #22 before Genesis #10 freezes Core Plugin identities.
