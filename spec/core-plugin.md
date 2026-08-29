# `core.plugin` Specification

Status: defined for Plugin data, executable artifact identity, canonicalization, and runtime artifact verification.

## Source

Historical source:

- `Ri0n72Y/blockchain-service/schemas/system/sys_protocol_v1.cue`
- `Ri0n72Y/blockchain-service/lib/model/types.go`
- `Ri0n72Y/blockchain-service/cmd/script/main.go::calcProtocolID`
- `Ri0n72Y/blockchain-service/cmd/script/main.go` Genesis construction

Current design source:

- `docs/source-baseline.md`
- `docs/architecture.md`
- `docs/plugin.md`

The migration rule is source-first: preserve the old Service structure unless executable Plugin requirements force a change.

Historical `Protocol` is replaced by `Plugin`; there is no parallel Protocol entity.

## Responsibility

`core.plugin` defines the `Plugin` data carried by `Record.data` and deterministic runtime validation over that data and its artifact bytes.

It does not define a separate Plugin release entity or state machine.

Out of scope:

```text
Repository / Member issuer rules
SDK / CLI / publishing
release authorization
activation / recommendation / deprecation / abandonment
packer or network policy
Core Profile / distribution selection
artifact fetch/cache/storage
source/build provenance
Record/Block ordering rules
```

## Source-aligned Record relation

Historical Service behavior:

```text
Record.data = Protocol
```

Current migration:

```text
Record.data = Plugin
```

A Plugin chain fact is therefore an ordinary Record interpreted by the relevant `core.plugin` version. `core.plugin` itself only validates the Plugin payload/artifact; common Record identity/signature and Block confirmation belong to `core.record` / `core.block`.

## Public data model

The implementation must expose equivalents of:

```ts
interface Plugin {
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

`PluginHash` and `FileHash` are 32-byte DoubleSHA256 digests serialized as 64-character lowercase hexadecimal strings.

`Plugin` is the public data type. `PluginManifest` must not exist as a second public entity for the same logical data.

## Protocol migration

The historical Protocol fields map as follows:

```text
protocolId   -> name
version      -> version
schema text  -> schema artifact path
package      -> removed
contributors -> removed from Plugin runtime data
description  -> removed from Plugin runtime data
```

New fields required by executable Plugin migration:

```text
runtime
dependencies
files
```

`contributors`, description, repository location, source commit, build inputs and similar provenance may exist in higher-level Records/Assets but are not Plugin runtime identity fields.

## Required executable capabilities

`core.plugin` must provide deterministic equivalents of:

```text
validatePlugin(plugin)
canonicalPlugin(plugin)
fileHash(bytes)
pluginHash(plugin)
verifyArtifact(plugin, files, expectedPluginHash?)
```

These functions are runtime validation capabilities, not SDK or release-management functions.

Low-level hash/JCS/path helper functions need not be public Plugin API.

## Plugin name grammar

Plugin and dependency names match exactly:

```regex
^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$
```

Accepted:

```text
core.plugin
repo.asset
work.labour
labour-flow.record-v2
```

Rejected:

```text
core
Core.plugin
core plugin
core@plugin
core..plugin
```

## Version grammar

Plugin and dependency versions are exact SemVer 2.0.0 versions.

Accepted:

```text
0.1.0
1.2.3-alpha.1
1.2.3+build.7
```

Rejected:

```text
v1.2.3
1.2
01.2.3
^1.2.3
>=1 <2
latest
workspace:*
```

No SemVer range or tag resolution is part of Plugin runtime identity.

## Runtime descriptor

First-version runtime descriptor:

```text
runtime.kind = "js-esm"
runtime.abi = positive IEEE-754 safe integer
runtime.entry = canonical artifact path
```

`runtime.entry` must resolve to a declared `files[]` entry.

The ABI identifies the LabourChain Plugin runner ABI. It does not identify a Node.js version, Cordis implementation version, deployment path, process lifecycle or sandbox policy.

## Schema

`schema` is a canonical artifact path and must resolve to a declared `files[]` entry.

Historical Protocol stored inline CUE schema text and calculated ProtocolHash after CUE formatting. Current Plugin stores a path and commits to the exact raw schema bytes through `files[]` / FileHash.

Therefore raw schema byte changes, including formatting/comment changes, change PluginHash. This is an explicit migration change required by exact artifact identity.

## Dependencies

Each chain Plugin runtime dependency contains exactly:

```text
name
version
pluginHash
```

`pluginHash` is authoritative. `name` / `version` must describe that exact dependency identity when resolved by the runner/composition layer.

Dependency name must be unique inside one Plugin.

`dependencies[]` is semantically set-like for identity purposes. Input order is not validity and is not identity.

Before JCS serialization, `core.plugin` must sort a validated copy by dependency `name` using UTF-8 lexicographical ascending order.

Ordinary npm/pnpm/build dependencies are not represented here. A runtime artifact must be self-contained except for exact chain Plugin dependencies declared by this field.

`core.plugin` does not itself fetch, activate, authorize or lifecycle-manage dependencies.

## Artifact files

Each declared file contains exactly:

```text
path
size
hash
```

`path` is UTF-8, case-sensitive, relative POSIX form using `/` and valid Unicode scalar data.

Reject at least:

```text
absolute path
empty path
. segment
.. segment
backslash separator
NUL
lone surrogate / invalid Unicode
```

File paths must be unique.

`size` must be a non-negative IEEE-754 safe integer. Negative zero is invalid.

For each file:

```text
FileHash = DoubleSHA256(raw file bytes)
```

The serialized hash is 64-character lowercase hexadecimal.

`files[]` is also semantically set-like for identity purposes. Input order is not validity and is not identity.

Before JCS serialization, `core.plugin` must sort a validated copy by canonical `path` using UTF-8 lexicographical ascending order.

Archive/compression/host metadata such as mtime, uid/gid, filesystem mode, archive entry order or compression settings does not participate in identity.

## Canonical Plugin

`canonicalPlugin(plugin)` must:

1. validate exact Plugin shape and values;
2. reject duplicate dependency names and file paths;
3. normalize `dependencies[]` by canonical name order;
4. normalize `files[]` by canonical path order;
5. serialize the resulting Plugin using RFC 8785 JSON Canonicalization Scheme (JCS);
6. return the exact UTF-8 canonical bytes.

Object input property order has no identity meaning.

Array input order for the two set-like arrays has no identity meaning because Core canonicalizes them before JCS.

JCS requirements include deterministic object-property ordering, no insignificant whitespace, valid Unicode/I-JSON data, no Unicode normalization, and canonical primitive serialization.

Unknown Plugin fields are invalid in `core.plugin@0.1.0`.

## PluginHash

```text
PluginHash = DoubleSHA256(canonicalPlugin(plugin))
```

Changing any of the following changes PluginHash:

```text
name / version
runtime kind / ABI / entry
schema path
exact dependency identity
file path
file size
file bytes
```

Changing only the input ordering of `dependencies[]` or `files[]` must not change PluginHash.

The Plugin commits transitively to exact executable artifact bytes because every declared file is locked by `path + size + FileHash`.

## Runtime artifact verification

`verifyArtifact(plugin, files, expectedPluginHash?)` receives Plugin data and actual file bytes explicitly. It must not perform hidden source clone, build, package-manager install, persistence or network fetch.

It must at least:

1. call equivalent Plugin validation/canonicalization rules;
2. require exactly the declared logical file set;
3. require every supplied file path to be canonical;
4. require `runtime.entry` and `schema` in the declared set;
5. compare each declared `size` with actual byte length;
6. calculate and compare each FileHash;
7. calculate PluginHash from canonical Plugin data;
8. if `expectedPluginHash` is supplied, validate its encoding and require exact equality;
9. return the calculated PluginHash on success.

A matching `name@version` is never sufficient when PluginHash differs.

Runtime kind/ABI support and dependency resolution are runner/composition checks around loading the verified Plugin. They must use the exact validated Plugin data, but `core.plugin` does not own artifact fetching or global runtime state.

## Public API boundary

The package root should expose only the Plugin data/types, validation/hash/artifact-verification capabilities, and an error type needed to consume them.

Implementation helpers such as raw DoubleSHA256, JCS recursion, path assertions, UTF ordering, or Unicode scanning are internal unless another Core spec later establishes a shared primitive API.

## Genesis relation

Historical Genesis contains Protocol Records inside the Genesis Block. Current migration preserves the structural rule that Plugin is Record data rather than creating an independent initial Plugin state format.

`core.plugin` therefore defines no issuer-less Genesis Plugin entry and no `S0` artifact-set recognition path.

Exact Genesis RecordId/signature/Header bootstrap behavior is deferred to the dedicated `core.record` / `core.block` / Genesis review against source.

## Failure cases

Reject at least:

- non-object or unknown/missing Plugin fields;
- invalid dotted Plugin/dependency name;
- invalid/non-exact SemVer;
- malformed runtime descriptor;
- invalid schema/runtime/file path;
- invalid Unicode/lone surrogate;
- duplicate dependency name;
- duplicate file path;
- unsafe ABI/file size or negative-zero file size;
- malformed dependency PluginHash;
- missing runtime entry/schema file descriptor;
- actual artifact file-set mismatch;
- file size mismatch;
- FileHash mismatch;
- calculated PluginHash mismatch with optional expected value.

Do not reject only because dependency/file input arrays are not pre-sorted.

## Tests

Meaningful tests must cover:

- fixed FileHash / RFC 8785 canonical Plugin / PluginHash fixture;
- object-property input order independence;
- dependency/file input order independence;
- canonical sorting result;
- duplicate dependency/file rejection;
- dotted Plugin name grammar;
- exact SemVer 2.0.0 grammar;
- invalid Unicode/lone surrogate rejection;
- safe ABI/file size and negative-zero rejection;
- runtime entry/schema existence;
- file byte/path/size mutation affecting identity;
- exact artifact file-set and FileHash verification;
- malformed/mismatched expected PluginHash rejection;
- `core.plugin` fixture requiring no artificial `core.record` / `core.entity` dependency;
- dependency canonicalization tested with a separate consumer Plugin fixture.

Tests must not cover Plugin issuer, release state, activation, lifecycle policy, Core Profile, SDK or network governance as `core.plugin` behavior.
