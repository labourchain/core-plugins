# `core.plugin` Specification

Status: defined for Plugin artifact identity, runtime lock, ordinary release, and activation.

## Source

Historical source for the predecessor `Protocol` concept:

- `Ri0n72Y/blockchain-service/schemas/system/sys_protocol_v1.cue`
- `Ri0n72Y/blockchain-service/lib/model/types.go`
- `Ri0n72Y/blockchain-service/cmd/script/main.go::calcProtocolID`

Current design source:

- `docs/architecture.md`
- `docs/plugin.md`
- `docs/genesis.md`
- `docs/ordering.md`

Historical `Protocol` behavior is compatibility/source material only. The current model uses `Plugin` / `PluginHash` and does not expose a parallel `Protocol` entity.

## Plugin identity

The current Core Plugin is:

```text
core.plugin@0.1.0
```

The initial Core Plugin set is:

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` is a type owned by `core.block`; there is no `core.block-header` Plugin.

## Public artifact model

The implementation must expose equivalents of:

```ts
interface PluginManifest {
  name: string
  version: string
  runtime: {
    kind: 'js-esm'
    abi: number
    entry: string
  }
  schema: string
  dependencies: PluginDependency[]
  files: PluginFile[]
}

interface PluginDependency {
  name: string
  version: string
  pluginHash: PluginHash
}

interface PluginFile {
  path: string
  size: number
  hash: FileHash
}

type PluginHash = string
type FileHash = string
```

`PluginHash` and `FileHash` are 32-byte DoubleSHA256 digests serialized as 64-character lowercase hexadecimal strings. They are not Base58 identities.

## Required executable capabilities

`core.plugin` must provide deterministic equivalents of:

```text
canonicalManifest(manifest)
fileHash(bytes)
pluginHash(manifest)
verifyArtifact(manifest, files, expectedPluginHash?)
validateRelease(inputs)
applyRelease(state, acceptedRelease)
```

Exact TypeScript names may vary only if the exported behavior remains explicit and testable.

The Plugin must not clone source repositories, invoke package managers, rebuild artifacts, persist files, or perform network fetches implicitly. Artifact bytes/resolution are explicit caller inputs.

## Canonical file paths

Artifact file paths are UTF-8, case-sensitive, relative POSIX paths using `/`.

Reject a path containing any of:

```text
absolute path
empty path
. segment
.. segment
backslash separator
NUL
```

Canonical file paths must be unique.

Host filesystem normalization must not change Plugin identity.

## File hashing

For every file declared in `files[]`:

```text
FileHash = DoubleSHA256(raw file bytes)
```

Serialized result:

```text
64-char lowercase hexadecimal
```

The declared `size` must equal the raw byte length and the declared `hash` must equal the calculated FileHash.

## Manifest canonicalization

Canonical manifest bytes are compact UTF-8 JSON with no insignificant whitespace.

Top-level field order is exactly:

```text
name
version
runtime
schema
dependencies
files
```

`runtime` field order is exactly:

```text
kind
abi
entry
```

Dependency field order is exactly:

```text
name
version
pluginHash
```

`dependencies[]` is sorted by dependency `name` using UTF-8 lexicographical ascending order. Dependency names must be unique.

File descriptor field order is exactly:

```text
path
size
hash
```

`files[]` is sorted by canonical `path` using UTF-8 lexicographical ascending order. Paths must be unique.

Unknown manifest fields are invalid in this Plugin version.

Canonical identity excludes archive/compression/host metadata such as:

```text
mtime
uid/gid
filesystem mode
archive entry order
compression level
compressor metadata
```

Implementations must construct canonical bytes explicitly rather than rely on incidental JavaScript object property ordering.

## PluginHash

Plugin identity is:

```text
PluginHash = DoubleSHA256(canonical PluginManifest bytes)
```

The manifest transitively commits to all runtime-relevant artifact bytes because every file is locked by exact `path + size + FileHash`.

Changing any of the following changes PluginHash:

```text
name/version
runtime kind/ABI/entry
schema path
exact chain-Plugin dependency
file path
file size
file bytes
```

Changing archive/compression representation without changing logical artifact content must not change PluginHash.

## Runtime descriptor

First-version runtime descriptor rules:

```text
runtime.kind = "js-esm"
runtime.abi  = positive integer ABI version
runtime.entry = canonical artifact path
```

`runtime.entry` must resolve to one of the manifest `files[]` entries.

`runtime.abi` identifies the LabourChain Plugin runner ABI. It is not a Node.js minor/patch version and does not identify a particular Cordis server implementation.

A runner may only load a Plugin when it supports the declared runtime kind and ABI.

## Schema path

`schema` is a canonical artifact path and must resolve to one of the manifest `files[]` entries.

For the current Core generation, CUE may be used as the schema representation, but PluginHash commits to the exact schema file bytes rather than reconstructing identity from a separate historical Protocol hash algorithm.

## Runtime dependency lock

Ordinary npm/pnpm dependencies must be bundled or vendored into the artifact during build.

Runtime code must not require the runner to perform package-manager resolution such as:

```text
npm install
pnpm install
resolve semver range from registry
run package install scripts
```

Only chain Plugin dependencies remain external at Plugin runtime.

Every `dependencies[]` item is exact:

```text
name
version
pluginHash
```

Floating ranges such as `^1.2.0`, `latest`, `workspace:*`, or equivalent are invalid.

`pluginHash` is authoritative. `name` and `version` must match the resolved dependency artifact manifest.

For ordinary post-Genesis release/activation, each dependency must resolve to an already-active Plugin in the state established before the containing Block begins. A Plugin released in Block N cannot satisfy another new Plugin's runtime dependency in that same Block.

Genesis is the only separate bootstrap path: its initial Plugin set is verified as a complete S0 set according to `spec/genesis.md`.

## Artifact verification

`verifyArtifact(manifest, files, expectedPluginHash?)` must at least:

1. validate manifest field shape and representation;
2. validate canonical paths and uniqueness;
3. validate dependency ordering/uniqueness and exact PluginHash representation;
4. validate file ordering/uniqueness;
5. require `runtime.entry` and `schema` to exist in `files[]`;
6. require exactly the declared file set for the logical artifact;
7. compare each declared size with raw bytes;
8. calculate and compare every FileHash;
9. canonicalize the manifest;
10. calculate PluginHash;
11. compare PluginHash with `expectedPluginHash` when supplied.

An implementation must not consider a matching `name@version` sufficient when PluginHash differs.

## Ordinary release payload

A normal Plugin release enters chain state through an ordinary `core.record` Record whose payload minimally contains:

```text
name
version
pluginHash
```

The Record does not need to copy:

```text
source repository URL
source commit URL
package-manager lockfile
build config
full Plugin manifest
```

The caller must supply or resolve the exact artifact identified by `pluginHash` so `core.plugin` can verify it before the release becomes active.

Artifact storage/Asset linkage is owned by Repo/Asset domain capabilities. Core receives artifact content/resolution as an explicit validation input and does not invent a storage system.

## Repository issuer rule

An ordinary post-Genesis Plugin release is issued by a Repository:

```text
releaseRecord.createdBy = Repository public key
```

The public key uses the Entity base58btc representation.

`core.plugin` must not confuse the release issuer with `BlockHeader.packer`.

Because Repository is a domain entity outside Core, release validation receives an explicit caller/domain capability that can establish whether `createdBy` resolves to an active Repository identity. Core must not query persistence or infer Repository status from key shape alone.

Genesis initial Plugins are the only issuer-less bootstrap exception.

## Release immutability

The release key is conceptually:

```text
issuer Repository + name + version
```

For the same issuer, an already-confirmed `name@version` must not later resolve to a different PluginHash.

Plugin content changes require a new immutable release fact, normally a new semantic version or a future explicitly versioned patch mechanism.

Old PluginHash values and artifacts remain addressable.

## Activation order

Ordinary release in Block N is validated using the active Plugin state from the end of Block N-1.

If the complete Block is accepted, valid Plugin releases are applied to produce the state for Block N+1.

The new Plugin is not active for validating another Record in Block N.

## `validateRelease` inputs

Release validation receives at least:

```text
releaseRecord
resolvedArtifact
activePluginState
repositoryIssuerResolver
```

The resolver/capability is an explicit interface supplied by the composition layer; it must not be hidden database access inside `core.plugin`.

## `validateRelease` behavior

A normal release must:

1. pass the complete `core.record` envelope / RecordId / author-signature validation;
2. be authored by an Entity public key that resolves as a Repository issuer;
3. contain valid `name/version/pluginHash` payload fields;
4. resolve an artifact whose calculated PluginHash equals the payload `pluginHash`;
5. require artifact manifest `name/version` to equal release payload `name/version`;
6. require every chain Plugin dependency to resolve by exact PluginHash in the pre-Block active state;
7. reject re-binding of the same issuer + name + version to another PluginHash;
8. return an accepted immutable release suitable for applying only after full Block acceptance.

## Build provenance boundary

Package-manager lockfiles, source commits, compiler/bundler versions, build commands, and reproducible-build evidence are not runtime Plugin identity fields.

They belong to Repository / Asset / Labour provenance and may be used to rebuild and compare the resulting PluginHash.

A normal Plugin is not invalid merely because bit-for-bit reproducible build evidence is absent. Runtime validity requires the executed artifact to match the chain-confirmed PluginHash.

## Failure cases

Reject at least:

- malformed or noncanonical manifest data;
- unknown manifest fields;
- invalid/duplicate paths;
- file size/hash mismatch;
- PluginHash mismatch;
- missing runtime entry/schema file;
- unsupported/malformed runtime descriptor at runner load boundary;
- floating runtime dependency range;
- dependency name collision;
- dependency `name/version` inconsistent with resolved PluginHash;
- required chain Plugin dependency not active in pre-Block state;
- ordinary release not authored by a Repository identity;
- release payload and artifact manifest `name/version` mismatch;
- attempted same-issuer `name@version` rebind to another PluginHash.

## Tests

Meaningful tests should cover:

- canonical manifest fixture and deterministic PluginHash;
- file byte mutation changes FileHash and PluginHash;
- file path/size mutation changes PluginHash;
- archive/compression representation does not affect PluginHash;
- file/dependency sorting rules;
- duplicate/invalid path rejection;
- unknown field rejection;
- `runtime.entry` / `schema` existence;
- exact dependency PluginHash resolution;
- floating dependency rejection;
- source package-manager lockfile not being required at runtime;
- valid Repository-issued release;
- non-Repository issuer rejection through the explicit resolver contract;
- same issuer + same name/version cannot be rebound;
- release in Block N becomes active only for Block N+1.

## Resolved predecessor identity issue

Historical `ProtocolHash` committed to descriptor/schema only and therefore did not identify executable behavior.

The current `PluginHash` commits transitively to the exact executable artifact and is the implementation identity used by runners and chain state.

No separate `runtimeHash`, bundle hash, or executable-identity blocker remains in the current model.
