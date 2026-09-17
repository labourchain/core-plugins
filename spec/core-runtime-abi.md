# Core Protocol Runtime ABI Specification

Status: target ABI for the pre-v0.1.0 Cordis runtime migration. Design rationale lives in `docs/runtime-abi.md`.

## Runtime

Every initial Core Protocol MUST use:

```text
runtime.kind = "cordis-js-esm"
runtime.abi = 1
```

ABI v1 defines exactly one executable artifact for each Protocol. `runtime.entry`, `files[]`, schema paths, and multi-file artifact maps are not part of this model.

The artifact is an already-built gzip-compressed single-file ESM bundle. A Host consumes already-resolved exact bytes as:

```text
verify ArtifactHash / ProtocolHash through core.protocol
-> gunzip with a 1 MiB maximum output limit
-> import decompressed bytes as ESM
-> validate the Cordis Plugin runtime contract
-> validate semantic dependency projection
-> resolve exact Protocol dependencies
-> ctx.plugin(plugin)
```

A decompressed runtime larger than 1 MiB MUST be rejected before import. Protocols exceeding it SHOULD be split, or move non-executable content to Asset / Runtime.

The Host MUST NOT compile TypeScript, transpile Protocol source, install Protocol packages, run install scripts, rebundle a verified artifact, or introduce another RPC/lifecycle system around Cordis.

## Required ESM export

The imported ESM namespace MUST expose exactly one own enumerable runtime export:

```text
plugin
```

`plugin` MUST be a Cordis object Plugin with:

```ts
{
  name: '<protocol-name>@<version>',
  provide: 'protocol:<protocol-name>@<version>',
  inject: <Cordis Inject>,
  apply(ctx, config?) { ... }
}
```

Requirements:

- `plugin.name` MUST equal `<Protocol.name>@<Protocol.version>`;
- `plugin.provide` MUST equal `protocol:<Protocol.name>@<Protocol.version>`;
- `plugin.apply` MUST be callable;
- `plugin.inject` MUST be a Cordis-compatible Inject declaration and MUST contain every projected chain semantic dependency service name;
- runtime validation compares required service names after normalizing Cordis array/object Inject forms;
- additional runtime-only inject services MAY be present and do not enter ProtocolHash.

`plugin.provide` is the Cordis metadata declaration of the capability. `plugin.apply()` MUST perform the actual Fiber-owned registration of the same canonical service through Cordis, e.g. `ctx.provide(serviceKey, implementation)`.

The artifact MUST NOT expose the pure Core API namespace as additional ESM exports. Pure package APIs remain available through package subpaths and are wrapped behind the Protocol service inside the executable artifact.

## Cordis ownership

Protocol artifacts MUST NOT bundle a private Cordis runtime. Cordis is supplied by the Host and is the only plugin/dependency/lifecycle system.

The executable may be a structurally valid Cordis object Plugin without importing Cordis at runtime; Host-side validation/mounting uses the Host's Cordis implementation.

Current Core/Repository integration targets the `@deepseek-ai/cordis` runtime family already used by the Repository host.

## Protocol identity

The Core Protocol value MUST be equivalent to:

```ts
interface Protocol {
  name: string
  version: string
  runtime: {
    kind: 'cordis-js-esm'
    abi: number
  }
  dependencies: ProtocolDependency[]
  artifactHash: ArtifactHash
  artifact?: string
}
```

`artifactHash` MUST equal:

```text
DoubleSHA256(exact gzip artifact bytes)
```

`artifactHash` MUST participate in ProtocolHash. Optional embedded `artifact` MUST be canonical RFC 4648 Base64 of the exact gzip bytes and MUST NOT participate in ProtocolHash.

Therefore embedded, cached, mirrored, or otherwise resolved copies of the same exact bytes MUST identify the same Protocol.

## Dependencies

`dependencies[]` describes independently resolved chain-level semantic Protocol dependencies. `protocolHash` is the authoritative exact dependency identity. Dependency names MUST be unique and canonical identity MUST sort dependencies by name using UTF-8 byte order.

For each dependency:

```text
{name, version, protocolHash}
-> required runtime service name
protocol:<name>@<version>
```

The projection relation is:

```text
project(Protocol.dependencies[]) ⊆ normalizedServiceNames(plugin.inject)
```

This projection MUST be validated by:

- Protocol Dev SDK / current release build gate before publishing the artifact;
- Repo Node / Host loader after importing the verified artifact and before mounting it.

`core.protocol` MUST NOT perform this projection validation. It validates `dependencies[]` only as chain data and Protocol identity input.

Initial `core.protocol`, `core.entity`, `core.record`, and `core.block` artifacts use `dependencies = []`; their source-level imports are bundled into the single executable artifact.

## Public `core.protocol` runtime API

The public deterministic API remains limited to:

```text
ProtocolError
validateProtocol
artifactHash
protocolHash
verifyArtifact
verifyEmbeddedArtifact
```

Cordis Plugin/module validation, Inject normalization, dependency projection, build/package construction, and mounting helpers MUST stay outside `core.protocol`.

## Build profile

Artifact generation MUST:

- use TypeScript `6.0.3`;
- use esbuild `0.28.2`;
- bundle for Node 22 as one ESM output;
- construct a thin Cordis Plugin wrapper around the relevant Core implementation;
- emit exactly the `plugin` runtime export;
- emit no sourcemap or legal-comment side file;
- reject a decompressed ESM bundle larger than 1 MiB;
- validate `plugin` metadata/shape and dependency projection before release;
- gzip the bundle at level 9;
- normalize the gzip header to no optional fields, `MTIME = 0`, and `OS = 255` before hashing;
- set `artifactHash` from the exact gzip bytes;
- use canonical Base64 only when embedding those bytes in `Protocol.artifact`;
- exclude timestamps, absolute paths, filesystem ordering, host metadata, and network inputs from Protocol descriptor identity.

The gzip bytes themselves are the published executable artifact bytes. Reproducible reconstruction from source across arbitrary build environments is Protocol Dev SDK #23 work; runtime validity verifies exact published bytes and does not rebuild source.

## Build and smoke verification

`pnpm build:artifacts` MUST, for all four Core Protocols:

1. build one thin Cordis Plugin ESM bundle and reject it if it exceeds 1 MiB;
2. import the uncompressed built module for build-time runtime-contract validation;
3. require the ESM namespace to contain exactly `plugin`;
4. require canonical `plugin.name`, `plugin.provide`, callable `plugin.apply`, valid Inject form, and dependency projection;
5. smoke-mount the imported plugin through the Host Cordis runtime and verify the canonical provided service becomes available;
6. dispose the mounted Fiber/Context cleanly;
7. gzip the bundle and normalize gzip metadata;
8. calculate `artifactHash` from the exact gzip bytes;
9. build the embedded Protocol value with `runtime.kind = "cordis-js-esm"`;
10. pass `verifyEmbeddedArtifact()`;
11. bounded-gunzip the embedded artifact with a 1 MiB maximum output;
12. report decompressed runtime size, gzip artifact size, and Base64 wire size.

Release verification MUST independently reread and re-import emitted artifacts from disk rather than trusting only the build-time module object.

Regression tests MUST verify both that exactly 1 MiB is accepted and that a small gzip input expanding beyond 1 MiB is rejected before import.

## Distribution boundary

The release artifact filename is:

```text
<protocol>-<version>.cordis-js-esm.gz
```

The filename is release metadata and does not participate in ProtocolHash.

`docs/`, `spec/`, tests, source history, migration material, build inputs, human description, release notes, registry metadata, and package-manager metadata MUST NOT become part of Protocol runtime identity merely because they accompany a release.

Build/bundle/compression/reproducible-build helpers belong to Protocol Dev SDK #23. Release/discovery channels belong to #24. Neither is a runtime dependency of `core.protocol`.

Historical CUE remains Source Fact only and is not a current runtime schema.

Genesis #10 may consume the generated ordinary Protocol values / ProtocolHashes; this spec introduces no Genesis-specific validity path.
