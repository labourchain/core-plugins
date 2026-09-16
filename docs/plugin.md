# Plugin Model

本文定义 LabourChain 当前 Plugin 数据模型、artifact identity 与运行时验证边界。历史协议事实依据见 [`source-baseline.md`](source-baseline.md)；`js-esm` ABI v1 的具体加载与打包规则见 [`runtime-abi.md`](runtime-abi.md)。

## 基本结构

Plugin 作为普通 Record 的数据进入链：

```text
Record.data = Plugin
```

当前 `core.plugin@0.1.0` 的公共数据结构为：

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
```

`core.plugin` 不建立第二套 `PluginRelease` 类型，也不负责发行渠道、权限、SDK、下载、缓存或网络生命周期。

当前 `schema` 字段是旧 Protocol 模型迁移后的兼容字段。#20 不修改该数据模型；是否删除 `Plugin.schema`、是否进一步简化 `files[]` / artifact 结构，以及哪些公开 helper 应迁移到 Plugin Dev SDK，由 #22 单独 review。

## Name、version 与 identity

Plugin name 使用 lowercase dotted namespace，例如：

```text
core.plugin
core.record
repo.asset
work.labour
```

Plugin version 使用 exact SemVer，不接受 range、tag 或 workspace reference。

`name@version` 是可读引用，精确 executable identity 是 `PluginHash`。

当前 identity 经过严格 shape/value validation、dependency/file canonical ordering 与 RFC 8785 JCS 后计算：

```text
PluginHash = DoubleSHA256(canonical Plugin identity bytes)
```

`artifact` 是 bytes 的承载方式，不进入 canonical Plugin identity；但 `files[]` 中的 path / size / FileHash 进入 identity，因此 PluginHash 会传递性承诺 exact artifact bytes。

## Runtime ABI v1

当前 executable runtime 固定为：

```text
runtime.kind = "js-esm"
runtime.abi = 1
runtime.entry = "runtime.mjs.gz"
```

`runtime.entry` 指向实际发布、上链和下载的 gzip executable bundle。节点加载顺序为：

```text
verify exact artifact bytes
-> bounded gunzip
-> import decompressed ESM
-> expose ESM module namespace
```

Base64 只是 `Plugin.artifact` 当前 JSON 表示中的 binary wire encoding，不是另一种 executable identity。

当前 host baseline 是 Node.js 22 compatible ESM，以及 Core 所需的 `node:crypto` / `Buffer` 等 Node host capability。Node/Cordis 的具体部署版本、sandbox、process lifecycle 不进入 PluginHash。

## Plugin 大小原则

Plugin 是**小型可执行协议单元**，不是大型应用或资源包容器。

ABI v1 对**解压后的单个 executable runtime**设置 **1 MiB hard limit**：

```text
runtime <= 1 MiB  -> 可进入加载流程
runtime > 1 MiB   -> runner 必须在 import 前拒绝
```

这个限制同时承担两个职责：

1. 防止小型 gzip artifact 在节点内存中异常膨胀，提前阻断 gzip-bomb 类资源耗尽；
2. 主动约束 Plugin 的工程边界。若 executable 已超过 1 MiB，默认应重新审查架构：优先拆成多个职责更明确的 Plugin，或把非执行内容移入 Asset / Runtime，而不是继续扩大单个上链 Plugin。

1 MiB 不是对“业务复杂度”的鼓励额度，而是一个宽松的上界。Core Plugin 当前解压后的 runtime 只有约 4–18 KiB，正常 Plugin 应远低于该上限。

另有约 **500 KiB compressed artifact** 的工程 warning。它只用于开发阶段提示 artifact 偏大，不是 validity rule：

```text
compressed > ~500 KiB
-> tooling warning

uncompressed runtime > 1 MiB
-> ABI v1 hard reject
```

大型模型、图片、视频、地图、词典、数据集、游戏资源包、参考文档等内容不应作为 executable Plugin 上链，应优先进入更高层 Asset / Runtime 机制。

## Artifact layout

#20 的 `js-esm` ABI v1 将每个 Core Plugin 构建为单文件 ESM，再 gzip：

```text
source/lib entry
-> single ESM bundle
-> runtime.mjs.gz
```

当前 Core artifact 暂时包含：

```text
runtime.mjs.gz
schema.json
```

`schema.json = {}` 仅用于满足 `core.plugin@0.1.0` 仍存在的 `Plugin.schema` 合同，不是权威 schema，也不参与 runtime validation。历史 CUE 不再进入当前 runtime artifact。

初始 Core Plugins 使用：

```text
dependencies = []
```

`core.record` / `core.block` 所需的相对源码依赖在构建阶段 bundle 进入自身 `runtime.mjs.gz`，不再作为重复 helper artifact 文件单独发布。

## Files 与 FileHash

`files[]` 描述当前 Plugin identity 承诺的 artifact 文件：

```text
path
size
hash
```

```text
FileHash = DoubleSHA256(exact file bytes)
```

path 使用 canonical relative POSIX path；file path 必须唯一，canonicalization 时按 UTF-8 path 排序。

对于 ABI v1，`runtime.mjs.gz` **本身就是被承诺的 executable file**。因此 gzip bytes，包括规范化后的 gzip header 和压缩 payload，直接进入 FileHash；不能再把 gzip 当作 identity 之外的临时运输包装。

当前 Core 构建把 gzip header 规范化为：

```text
no optional fields
MTIME = 0
OS = 255
```

节点验证的是已经发布的 exact gzip bytes。从源码跨不同环境重新得到完全相同 gzip bytes 的 reproducible-build 工具链属于 Plugin Dev SDK #23，而不是节点 runtime validity。

## Embedded artifact

`artifact?` 允许 Plugin Record 直接携带完整 artifact bytes。当前 ABI v1 的 Core Plugin 形态类似：

```json
{
  "artifact": {
    "runtime.mjs.gz": "<canonical Base64 of gzip bytes>",
    "schema.json": "e30K"
  }
}
```

规则：

- key 必须对应 `files[]` 中声明的 canonical path；
- value 必须是 canonical RFC 4648 Base64；
- embedded artifact 必须完整覆盖 `files[]`；
- Base64 解码后的 exact bytes 必须匹配对应 `size` 与 `FileHash`；
- `runtime.entry` 与当前兼容 `schema` path 必须属于该 artifact。

因此同一 exact artifact bytes 无论来自链内 embedded data、本地 cache 或外部 mirror，都验证为同一个 Plugin identity。

## Dependencies

`dependencies[]` 只描述运行时仍作为独立链 Plugin 存在的依赖，使用 exact `pluginHash` 作为权威 identity。

普通 npm/pnpm/build dependency 不属于该列表。ABI v1 的 Core Plugins 当前选择自包含 bundle，因此全部使用空依赖列表。

未来只有确实需要由 runner 独立解析、验证和加载的链级 Plugin dependency 才应进入 `dependencies[]`。

## Runtime verification

当前 `core.plugin` 提供：

```text
validatePlugin(plugin)
canonicalPlugin(plugin)
fileHash(bytes)
pluginHash(plugin)
verifyArtifact(plugin, files, expectedPluginHash?)
verifyEmbeddedArtifact(plugin, expectedPluginHash?)
```

这些 API 目前混合了 runtime verification 与部分构建/开发辅助能力。#22 会重新审查最小 runtime contract；构建、bundle、gzip、descriptor construction、发布准备和体积分析应进入 Plugin Dev SDK #23。

runner/composition layer 负责：

```text
resolve Plugin by PluginHash
verify exact artifact bytes
bounded gunzip executable bundle (<= 1 MiB output)
load/import runtime
cache/fetch policy
process / Cordis Context composition
```

`core.plugin` 不负责 package registry、distribution channel 或 Asset fetch。Plugin 实际如何发布和发现由 #24 单独讨论，不预设 npm 是 canonical channel。

## Genesis 与 bootstrap

Genesis 继续是普通 Block；初始 Core Plugin 通过普通 Plugin Records 进入链。

为了让新节点在没有外部 registry 的情况下获得解释链所需代码，初始：

```text
core.plugin
core.record
core.entity
core.block
```

应携带完整 embedded gzip artifact。节点可以：

```text
读取 Genesis Plugin Record
-> 验证 Plugin / FileHash / PluginHash
-> 取得 runtime.mjs.gz
-> bounded gunzip
-> load runtime
-> 继续解释和同步链
```

Genesis 的 RecordId、签名、BlockHeader、PoA/bootstrap 组合等问题由 Genesis #10 独立审查；`core.plugin` 不定义 Genesis-specific validity path。
