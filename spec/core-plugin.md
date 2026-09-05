# `core.plugin` Specification

Status: defined for Plugin data, executable artifact identity, optional chain-embedded artifact bytes, canonicalization, and runtime artifact verification.

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
- `docs/genesis.md`

The migration rule is source-first: preserve the old Service structure unless executable Plugin requirements force a change.

Historical `Protocol` is replaced by `Plugin`; there is no parallel Protocol entity.

## Responsibility

`core.plugin` defines the `Plugin` data carried by `Record.data` and deterministic validation over that data and its executable artifact bytes.

It does not define a separate Plugin release entity or state machine.

Out of scope:

```text
Repository / Member issuer rules
SDK / CLI / publishing implementation
release authorization
activation / recommendation / deprecation / abandonment
packer or network policy
Core Profile / distribution selection
artifact registry/cache/storage implementation
Asset implementation
source/build provenance
Record/Block ordering rules
```

## Source-aligned Record relation

Historical Service:

```text
Record.data = Protocol
```

Current migration:

```text
Record.data = Plugin
```

A Plugin chain fact is therefore an ordinary Record interpreted by the relevant `core.plugin` version. Common Record identity/signature and Block confirmation belong to `core.record` / `core.block`.

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
  artifact?: PluginArtifact
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

type PluginArtifact = Record<string, string>
type PluginHash = string
type FileHash = string
```

`PluginArtifact` maps canonical artifact path to canonical RFC 4648 Base64 text representing raw file bytes.

`PluginHash` and `FileHash` are 32-byte DoubleSHA256 digests serialized as 64-character lowercase hexadecimal strings.

`Plugin` is the public data type. `PluginManifest` or `PluginRelease` must not exist as a second public entity for the same logical data.

## Protocol migration

Historical fields map as follows:

```text
protocolId   -> name
version      -> version
schema text  -> schema artifact path
package      -> removed
contributors -> removed from Plugin runtime data
description  -> removed from Plugin runtime data
```

New executable-Plugin fields:

```text
runtime
dependencies
files
artifact?
```

`artifact?` is storage/transport for exact bytes already committed by `files[]`; it is not a second content identity.

## Required executable capabilities

`core.plugin` must provide deterministic equivalents of:

```text
validatePlugin(plugin)
canonicalPlugin(plugin)
fileHash(bytes)
pluginHash(plugin)
verifyArtifact(plugin, files, expectedPluginHash?)
verifyEmbeddedArtifact(plugin, expectedPluginHash?)
```

Low-level hash/JCS/path/Base64 helper functions need not be public Plugin API.

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

Plugin and dependency versions are exact SemVer 2.0.0 versions. Range/tag/workspace resolution is not part of Plugin identity.

## Runtime descriptor

```text
runtime.kind = "js-esm"
runtime.abi = positive IEEE-754 safe integer
runtime.entry = canonical artifact path
```

`runtime.entry` must resolve to a declared `files[]` entry.

ABI identifies LabourChain Plugin runner ABI, not Node/Cordis/deployment versions.

## Schema

`schema` is a canonical artifact path and must resolve to a declared `files[]` entry.

Historical Protocol stored inline CUE schema text. Current Plugin commits to exact raw schema bytes through `files[]` / FileHash, so raw formatting/comment changes change PluginHash.

## Dependencies

Each chain Plugin runtime dependency contains exactly:

```text
name
version
pluginHash
```

Dependency name must be unique inside one Plugin. `dependencies[]` is semantically set-like; Core sorts a validated copy by dependency `name` using UTF-8 lexical order before JCS serialization.

Ordinary npm/pnpm/build dependencies are bundled/handled before runtime. `core.plugin` does not fetch, activate, authorize or lifecycle-manage dependencies.

## Artifact file descriptors

Each `files[]` entry contains exactly:

```text
path
size
hash
```

`path` is UTF-8, case-sensitive, canonical relative POSIX form using `/` and valid Unicode scalar data.

Reject absolute/empty paths, `.` or `..` segments, backslashes, NUL, empty segments, and lone surrogate/invalid Unicode.

File paths must be unique.

`size` is a non-negative safe integer; negative zero is invalid.

```text
FileHash = DoubleSHA256(raw file bytes)
```

`files[]` is semantically set-like. Core sorts a validated copy by canonical path using UTF-8 lexical order before JCS serialization.

Archive/compression/host metadata is excluded from Plugin identity.

## Embedded artifact

`artifact` is optional. When present it is an object:

```text
canonical path -> canonical RFC 4648 Base64
```

Requirements:

1. `artifact` must be an object, not an array/null;
2. every key must be a canonical artifact path;
3. every key must correspond to exactly one `files[]` descriptor;
4. the object must contain exactly the complete `files[]` path set;
5. every value must be canonical RFC 4648 Base64 with standard alphabet and padding;
6. decoding and re-encoding the bytes must reproduce the exact input Base64 string;
7. decoded byte length must equal descriptor `size`;
8. `fileHash(decodedBytes)` must equal descriptor `hash`.

Empty files use the canonical Base64 empty string `""`.

An embedded artifact with missing/extra paths, alternate/noncanonical Base64, wrong size or wrong FileHash is invalid Plugin data.

## Canonical Plugin identity

`canonicalPlugin(plugin)` canonicalizes the **identity form** of Plugin.

It must:

1. validate the complete Plugin shape, including optional embedded artifact if present;
2. reject duplicate dependency names/file paths;
3. sort `dependencies[]` by dependency name;
4. sort `files[]` by path;
5. omit the `artifact` storage field from the identity form;
6. serialize the remaining Plugin descriptor using RFC 8785 JCS;
7. return exact UTF-8 canonical bytes.

Therefore:

```text
Plugin with correct embedded artifact
Plugin with artifact omitted
```

must produce identical canonical Plugin bytes and identical PluginHash when all identity descriptors are equal.

Object input property order and dependency/file input order have no identity meaning.

Unknown Plugin fields are invalid in `core.plugin@0.1.0`.

## PluginHash

```text
PluginHash = DoubleSHA256(canonicalPlugin(plugin))
```

PluginHash directly commits to:

```text
name / version
runtime kind / ABI / entry
schema path
exact dependency identities
file paths
file sizes
FileHash values
```

Every FileHash commits to raw file bytes, so PluginHash transitively commits to exact executable content without hashing the embedded Base64 transport representation itself.

Changing artifact storage location or adding/removing a correct embedded representation must not change PluginHash.

Changing actual executable bytes requires a changed FileHash and therefore changes PluginHash.

## External artifact verification

`verifyArtifact(plugin, files, expectedPluginHash?)` receives actual file bytes explicitly.

It must:

1. validate Plugin data;
2. require exactly the declared logical file set;
3. validate supplied paths;
4. compare declared size with actual byte length;
5. calculate/compare each FileHash;
6. calculate PluginHash from canonical identity data;
7. validate/compare optional `expectedPluginHash`;
8. return the calculated PluginHash.

It performs no hidden source clone, build, package-manager install, persistence or network fetch.

## Embedded artifact verification

`verifyEmbeddedArtifact(plugin, expectedPluginHash?)` requires `plugin.artifact` to exist.

It must decode the embedded Base64 object into exact raw bytes and apply the same file-set/size/FileHash/PluginHash verification as `verifyArtifact()`.

If `artifact` is absent, `verifyEmbeddedArtifact()` rejects with an explicit missing-artifact error; the caller may instead resolve bytes externally and call `verifyArtifact()`.

## Artifact and Asset boundary

Executable artifact files are only the files required to load/run the Plugin and its schema/runtime behavior.

Large static resources such as models, images, video, maps, dictionaries, datasets or game resource packs should normally be represented by higher-level Asset/Runtime mechanisms and fetched by the running Plugin when needed.

`core.plugin` does not contain Asset identifiers or an Asset resolver.

## Bundle-size tooling guidance

Plugin build tooling should report total raw executable artifact size:

```text
sum(files[].size)
```

Tooling should warn around **500 KiB** and suggest moving large static content to Assets.

This threshold is non-normative for consensus validity. `validatePlugin`, `verifyArtifact`, Block validation and network consensus must not reject a Plugin solely because it is larger than 500 KiB.

## Public API boundary

Package root should expose only Plugin data/types, validation/hash/artifact-verification capabilities, and the error type needed to consume them.

Implementation helpers such as raw DoubleSHA256, JCS recursion, Base64 parsing, path assertions, UTF ordering or Unicode scanning remain internal unless another Core spec establishes a shared primitive API.

## Genesis relation

Genesis remains a Block containing Records. Initial Plugin data remains `Record.data = Plugin`.

For the MVP, the initial Core Plugin Records for:

```text
core.plugin
core.record
core.entity
core.block
```

must/shall be constructed with complete embedded artifacts by the Genesis/bootstrap implementation so a node can obtain Core executable content without an external Plugin registry.

This requirement does not create an independent `S0` artifact-set format. The bytes remain part of each Plugin Record's data.

Exact Genesis RecordId/signature/Header behavior remains deferred to its dedicated review.

## Failure cases

Reject at least:

- non-object or unknown/missing Plugin fields;
- invalid Plugin/dependency name or version;
- malformed runtime descriptor;
- invalid schema/runtime/file path or Unicode;
- duplicate dependency name/file path;
- unsafe ABI/file size or negative-zero size;
- malformed dependency PluginHash;
- missing runtime entry/schema descriptor;
- malformed embedded artifact object;
- missing/extra embedded artifact path;
- noncanonical Base64;
- embedded decoded size/FileHash mismatch;
- external artifact file-set/size/FileHash mismatch;
- optional expected PluginHash mismatch.

Do not reject only because dependency/file input arrays are not pre-sorted or because artifact size exceeds the tooling warning threshold.

## Tests

Meaningful tests must cover:

- fixed FileHash/JCS/PluginHash fixture remains stable;
- PluginHash equality with embedded artifact present vs omitted;
- canonical Base64 embedded artifact success;
- embedded exact file-set enforcement;
- embedded noncanonical/malformed Base64 rejection;
- embedded byte size/FileHash mismatch rejection;
- `verifyEmbeddedArtifact()` success and missing-artifact rejection;
- external `verifyArtifact()` behavior remains equivalent;
- object-property and dependency/file input order independence;
- duplicate dependency/file rejection;
- name/version/path/Unicode/numeric constraints;
- runtime entry/schema existence;
- executable byte/path/size mutation affecting PluginHash;
- no 500 KiB validity rejection;
- no artificial `core.record` / `core.entity` dependency in the `core.plugin` fixture.

Tests must not cover Plugin issuer, release state, activation, lifecycle policy, Core Profile, Asset implementation, SDK or network governance as `core.plugin` behavior.
