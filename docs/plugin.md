# Plugin Model

本文定义 LabourChain 当前 Plugin 模型：Plugin 是什么、链上保存什么、如何形成稳定 identity、如何发布、如何被 runner 加载，以及源码和贡献历史如何追溯。

旧 `blockchain-service` 中的 `Protocol` 数据结构和 hash 行为属于历史事实，见 [`source-baseline.md`](source-baseline.md)。当前设计不继续维护一个与 Plugin 并列的 Protocol 实体。

## Current Design：Plugin 是链上不可变可执行包

Plugin 同时包含数据约束和确定性行为：

```text
Plugin
├── schema / public types
├── deterministic executable functions
├── runtime manifest
└── executable artifact content
```

它在能力上等价于 Smart Contract，但采用普通 package/plugin 的版本发布模型。

Plugin 以名称和版本发布，例如：

```text
core.block@0.1.0
repo.asset@0.2.1
```

一个已经发布的 Plugin release 不原地修改。内容变化通过新的版本或显式的后续 patch 事实表达；历史 release 始终可按其 `PluginHash` 精确取回。

当前 Core 基础插件是：

```text
core.plugin
core.record
core.entity
core.block
```

其中 `core.plugin` 定义普通 Plugin release 如何进入链状态。

## Current Design：运行对象是 artifact，不是 source checkout

链上真正被 runner 执行的是构建完成的 Plugin artifact，而不是 source checkout。

概念路径：

```text
source Repository
  -> build
  -> executable Plugin artifact
  -> canonical artifact identity
  -> PluginHash
```

runner 加载 Plugin 时：

```text
fetch artifact by PluginHash
  -> verify artifact
  -> resolve exact chain-plugin dependencies
  -> check runtime ABI
  -> load declared entry
  -> execute
```

runner 不为了执行已经发布的 Plugin 再：

```text
clone source repository
resolve npm/pnpm semver ranges
install dependency tree
run postinstall
compile TypeScript
bundle source
```

这些步骤属于 release 前的 build/provenance，而不是链执行路径。

## Current Design：artifact logical contents

Plugin artifact 是一个逻辑文件树，而不是某一种 tar/zip/gzip 文件格式。

第一版 artifact 包含至少：

```text
canonical manifest
schema / public runtime metadata
compiled or bundled runtime code
runtime-required static resources
```

不要求包含：

```text
TypeScript/source authoring tree
README
unit tests
Git history
package-manager source lockfile
compiler/bundler configuration
```

这些属于 Repository build provenance。

artifact 可以为了网络或存储被打包、压缩或拆分保存，但 archive/compression representation 不参与 `PluginHash`。同一 logical artifact 无论通过 gzip、zstd、object storage 或其他 transport 传递，只要 canonical manifest 和被其承诺的文件 bytes 相同，就具有同一个 `PluginHash`。

## Current Design：Artifact Manifest

每个 Plugin artifact 必须有一个 canonical manifest。第一版逻辑结构为：

```text
PluginManifest
├── name
├── version
├── runtime
│   ├── kind
│   ├── abi
│   └── entry
├── schema
├── dependencies[]
└── files[]
```

概念示例：

```json
{
  "name":"core.block",
  "version":"0.1.0",
  "runtime":{"kind":"js-esm","abi":1,"entry":"runtime.mjs"},
  "schema":"schema.cue",
  "dependencies":[
    {"name":"core.entity","version":"0.1.0","pluginHash":"..."}
  ],
  "files":[
    {"path":"runtime.mjs","size":12345,"hash":"..."},
    {"path":"schema.cue","size":678,"hash":"..."}
  ]
}
```

这里的 JSON 只是 manifest 的链上/交换表示。canonical bytes 由本文后述规则固定。

### `name`

Plugin 的稳定名称，例如：

```text
core.block
repo.asset
```

### `version`

该 release 的语义版本，例如：

```text
0.1.0
```

`name@version` 是人类可读 release reference；真正精确的内容 identity 是 `PluginHash`。

### `runtime`

第一版 runtime descriptor 包含：

```text
kind
abi
entry
```

其中：

```text
kind = js-esm
```

表示 artifact 入口是 JavaScript ESM runtime artifact。

`abi` 是 LabourChain Plugin runner ABI 版本，不是 Node.js patch/minor version。runner 必须明确声明自己支持哪些 ABI version；Plugin 不把某个 Cordis server 实现或具体 Node 安装路径写进 identity。

`entry` 是 artifact 内的 runtime entry path。

### `schema`

`schema` 指向 artifact 内用于该 Plugin 数据约束/public runtime metadata 的 canonical schema 文件。

第一版 Core 继续使用 CUE schema 时，该路径通常可以是：

```text
schema.cue
```

### `dependencies[]`

这里只声明**运行期仍然作为独立链 Plugin 存在的依赖**。

每项必须精确包含：

```text
name
version
pluginHash
```

不允许：

```text
^1.2.0
>=1 <2
latest
workspace:*
```

或任何需要 runner 再执行版本解析的 floating range。

真正权威的是 `pluginHash`；`name` 与 `version` 用于可读性、状态解析和一致性检查。

第一版同一个 manifest 中 dependency `name` 必须唯一。如果某段第三方代码需要并存多个普通 package version，应在 build 时 bundle/vendor 到 artifact，而不是把普通 package dependency 暴露成链 Plugin dependency。

### `files[]`

`files[]` 承诺 artifact 所有参与运行或 schema/public metadata 的文件。

每项固定包含：

```text
path
size
hash
```

其中：

- `path` 是 canonical relative path；
- `size` 是 raw file bytes 长度；
- `hash = DoubleSHA256(raw file bytes)`；
- `hash` 使用 lowercase hexadecimal digest representation，不使用 Base58。

manifest 自身不是 `files[]` 中的文件；它是计算 `PluginHash` 的 canonical root metadata，因此不存在 manifest 自引用 hash。

## Current Design：canonical path rules

artifact path 使用 UTF-8、case-sensitive、POSIX `/` 分隔形式。

必须拒绝：

```text
absolute path
empty path
. segment
.. segment
backslash separator
NUL
重复 canonical path
```

也就是说：

```text
runtime.mjs
schema.cue
assets/table.bin
```

是正常路径，而宿主 OS 的 filesystem path normalization 不得改变 Plugin identity。

## Current Design：file hashing

每个 artifact file 先独立形成内容 digest：

```text
FileHash = DoubleSHA256(raw file bytes)
```

serialized form：

```text
64-char lowercase hexadecimal
```

因此 runner 可以流式下载/验证单个文件，而不需要先还原某种特定 archive bytes。

`size` 与 `hash` 都必须匹配实际 raw bytes。

## Current Design：canonical manifest

`PluginHash` 不直接 hash tar/zip/gzip bytes，而是 hash canonical manifest bytes。

canonical manifest 使用 compact UTF-8 JSON，字段顺序固定为：

```text
name
version
runtime
schema
dependencies
files
```

`runtime` 内字段顺序固定为：

```text
kind
abi
entry
```

每个 dependency 字段顺序固定为：

```text
name
version
pluginHash
```

`dependencies[]` 按：

```text
name
```

UTF-8 lexicographical ascending 排序；dependency name 必须唯一。

每个 file descriptor 字段顺序固定为：

```text
path
size
hash
```

`files[]` 按 canonical `path` 的 UTF-8 lexicographical ascending 排序；path 必须唯一。

canonical JSON 不包含：

```text
pretty-print whitespace
comments
unknown fields
host timestamps
uid/gid
filesystem mode
archive metadata
compression metadata
```

实现必须显式构造 canonical manifest bytes，不能依赖普通对象序列化时碰巧保持当前属性顺序。

## Current Design：PluginHash

`PluginHash` 是完整 executable artifact 的稳定 content identity。

```text
PluginHash = DoubleSHA256(canonical PluginManifest bytes)
```

serialized form：

```text
64-char lowercase hexadecimal
```

虽然 `PluginHash` 直接 hash 的是 manifest，但 manifest 中每一个 runtime file 都通过 exact `size + FileHash` 被承诺，因此 `PluginHash` transitively commits to every runtime-relevant artifact byte。

任何以下变化都必须改变 `PluginHash`：

```text
name/version
runtime kind/ABI/entry
schema path
exact chain-plugin dependency
runtime code bytes
schema bytes
runtime resource bytes
file path
file size
```

compression level、archive timestamp 或 transport representation 不改变 `PluginHash`。

## Current Design：runtime lock

LabourChain runtime lock 比普通 package-manager lock 更严格，但范围更小。

第一版固定为：

1. artifact 自身由 exact `PluginHash` 锁定；
2. 每个 runtime file 由 `FileHash` 锁定；
3. 普通 npm/pnpm dependencies 必须在 build 时 bundle/vendor 进 artifact；
4. runner 不执行普通 package-manager dependency resolution；
5. 外部链 Plugin dependency 必须按 exact `PluginHash` 锁定；
6. runner compatibility 由 versioned Plugin ABI 锁定；
7. runner 在执行前必须验证 manifest、文件和 dependency identity。

因此链上的 runtime lock 不需要复制一整份 `pnpm-lock.yaml` / `package-lock.json`。

传统 lockfile 解决 source build dependency resolution；Plugin artifact 已经是 resolution/build 后的最终执行产物。

## Current Design：build lock / provenance

package-manager lockfile 仍然非常重要，但属于 Repository build provenance。

一个可审计 build 可以沿 Asset/Labour graph 保存：

```text
source/commit Assets
package-manager lockfile Asset
build config Assets
package manager + exact version
compiler/bundler + exact version
runtime/toolchain metadata
build command
build Labour Record
produced Plugin artifact Asset
expected PluginHash
```

这允许后续验证：

```text
same recorded build inputs
  -> rebuild
  -> produced artifact
  -> PluginHash == recorded PluginHash ?
```

但第一版不要求一个 Plugin release 必须先证明 bit-for-bit reproducible build 才能被链接受。

Core 的执行信任边界是：

> runner 执行的 artifact 是否与链确证的 `PluginHash` 完全一致。

source → build → same artifact 是更高层的 provenance / supply-chain / labour audit 能力。

## Current Design：普通 Plugin release 由 Repository 发行

普通 Plugin 的 issuer/releaser 是 Repository。

Plugin release 通过普通 Record 进入链时：

```text
Record.createdBy = Repository public key
```

这里的 public key 是 Repository 作为 Entity 的 Base58 public-key identity。

`BlockHeader.packer` 不是 Plugin issuer。packer 只证明某个 Entity key 对 Block confirmation 做了签名；Plugin release identity 来自 release Record 的 Repository author。

普通 release 至少需要能够确定：

```text
name
version
PluginHash
artifact Asset
```

exact release Record shape 由 `core.plugin` spec 与 Repo/Asset plugin 的组合边界继续投影；Core 不在 Plugin manifest 中重复写 source repository URL。

## Current Design：source 与贡献历史沿 Repository / Asset graph 追溯

Plugin artifact 本身属于 Asset。

从 release Record 可以沿链恢复 provenance：

```text
Plugin release Record
  -> createdBy Repository public key
  -> Repository
  -> Plugin artifact Asset
  -> source/build/commit Assets
  -> Labour Records
  -> contribution / version DAG
```

因此 Plugin manifest/declaration 不包含：

```text
sourceRepo
Git URL
source commit URL
contributors copied from repository
```

源码在哪里、由哪些劳动和 commits 构建出来，应通过 Repository 所管理的 Asset / Labour graph 追溯。

Plugin artifact Asset 的内容 identity 与 `PluginHash` 必须一致或具有由对应 Asset plugin 明确定义的一一映射。

Genesis 初始 Core Plugins 是唯一 bootstrap 例外：它们在 Repository 和普通 Plugin release 规则成立之前直接存在，因此不要求一个预先存在的 issuing Repository。

## Current Design：版本与不可变性

Plugin 名称和版本用于人类和依赖声明；`PluginHash` 用于精确内容寻址。

普通 release 的解析结果必须最终固定到 exact PluginHash：

```text
PluginRef
  name@version
      |
      v
exact PluginHash
```

同一个 issuer 下，同一个 `name@version` 不得在链状态中被重新绑定到另一份 `PluginHash`。

更新必须形成新的不可变链事实：

```text
new semantic version
or explicit later patch/version fact
```

旧 artifact 与旧 PluginHash 始终可取回。

## Current Design：runner verification

runner 在加载一个 Plugin artifact 前至少执行：

1. parse manifest；
2. 拒绝 unknown/noncanonical manifest shape；
3. canonicalize manifest；
4. 计算并匹配 `PluginHash`；
5. 检查 `files[]` path uniqueness/order；
6. 对每个 file 检查 byte size 与 `FileHash`；
7. 检查 `runtime.entry` 与 `schema` 都存在于 `files[]`；
8. 检查 runner 支持 manifest 声明的 runtime kind / ABI；
9. 按 exact `PluginHash` 解析所有 chain-plugin dependencies；
10. 只有全部成功后才加载 runtime entry。

runner 不因为 `name@version` 看起来匹配就跳过 PluginHash verification。

## Resolved design：Executable Plugin identity

旧 `ProtocolHash` 只承诺 descriptor/schema，无法证明不同节点执行相同函数实现。

当前模型用：

```text
PluginHash
= DoubleSHA256(canonical manifest)
= transitive commitment to executable artifact bytes
```

直接作为 executable Plugin implementation identity。

因此“不同 runner 如何确认自己执行的是同一个 Plugin 实现”这一问题在 Plugin artifact 层已经解决。

剩余需要由独立 runner/server 工程继续定义的是 ABI 的宿主实现、sandbox/capability policy 与实际加载机制，而不是 Plugin identity 本身。
