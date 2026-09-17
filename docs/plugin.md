# Plugin Model

本文定义 LabourChain 当前 Plugin 数据模型、executable identity 与运行时验证边界。历史协议事实依据见 [`source-baseline.md`](source-baseline.md)；`js-esm` ABI v1 的加载规则见 [`runtime-abi.md`](runtime-abi.md)。

## 基本结构

Plugin 作为普通 Record 的数据进入链：

```text
Record.data = Plugin
```

当前模型：

```ts
interface Plugin {
  name: string
  version: string
  runtime: {
    kind: 'js-esm'
    abi: number
  }
  dependencies: PluginDependency[]
  artifactHash: ArtifactHash
  artifact?: string
}

interface PluginDependency {
  name: string
  version: string
  pluginHash: PluginHash
}
```

`core.plugin` 只定义链上可执行 Plugin 的 identity 与验证规则，不建立第二套 `PluginRelease` 类型，也不负责构建、压缩、发行渠道、下载、缓存、权限、SDK 或生命周期。

历史 `Protocol.schema` / CUE 只保留为迁移事实，不再属于当前 executable Plugin runtime model。

## Identity

Plugin name 使用 lowercase dotted namespace，version 使用 exact SemVer；`name@version` 是可读引用，精确 executable identity 是 `PluginHash`。

```text
ArtifactHash = DoubleSHA256(exact gzip artifact bytes)

PluginHash = DoubleSHA256(
  JCS({
    name,
    version,
    runtime,
    dependencies,
    artifactHash
  })
)
```

`dependencies[]` 在 canonical identity 中按 dependency name 的 UTF-8 顺序排序；同名 dependency 非法。dependency 的 `pluginHash` 是权威 identity，name/version 用于可读性和一致性。

`artifact` 是 exact artifact bytes 的可选链内承载，使用 canonical RFC 4648 Base64。它不进入 PluginHash，因此同一 gzip bytes 无论来自 embedded Record、本地 cache、mirror 或其他 resolver，都表示同一个 Plugin。

如果 `artifact` 存在，它必须解码为与 `artifactHash` 完全一致的 bytes。

## Runtime ABI v1

```text
runtime.kind = "js-esm"
runtime.abi = 1
```

ABI v1 只有一个 executable artifact，因此不再需要 `runtime.entry` 或多文件 manifest。runner 已知 `js-esm` ABI v1 的 artifact 是 gzip-compressed ESM bundle：

```text
resolve exact artifact bytes
-> verify ArtifactHash / PluginHash
-> bounded gunzip
-> import decompressed ESM
-> expose ESM module namespace
```

Base64 只是 embedded artifact 的 JSON wire encoding，不是另一种 artifact identity。

当前 host baseline 是 Node.js 22 compatible ESM，以及 Core 所需的 `node:crypto` / `Buffer` 等 Node capability。host 部署版本、Cordis Context、sandbox 与 process lifecycle 不进入 PluginHash。

## Plugin 大小原则

Plugin 是**小型可执行协议单元**，不是大型应用或资源包容器。

ABI v1 对解压后的单个 executable runtime 设置 **1 MiB hard limit**：

```text
runtime <= 1 MiB  -> 可进入加载流程
runtime > 1 MiB   -> runner 必须在 import 前拒绝
```

这个限制同时用于阻断 gzip-bomb 类异常展开，并主动约束 Plugin 的工程边界。若 executable 超过 1 MiB，应优先拆成职责更明确的 Plugin，或把模型、字典、数据集、图片等非执行内容移入 Asset / Runtime，而不是继续扩大单个上链 Plugin。

1 MiB 是宽松上限，不是推荐目标。当前 Core Plugin 解压后的 runtime 只有约 4–18 KiB，正常 Plugin 应远低于该上限。

约 **500 KiB compressed artifact** 的提示只属于开发工具 warning，不是 Core validity rule。构建、bundle、gzip、体积分析和 release preparation 属于 Plugin Dev SDK #23。

## Runtime verification API

`core.plugin` 的公共运行时 API 收敛为：

```text
PluginError
validatePlugin(plugin)
artifactHash(bytes)
pluginHash(plugin)
verifyArtifact(plugin, artifactBytes, expectedPluginHash?)
verifyEmbeddedArtifact(plugin, expectedPluginHash?)
```

其中：

- `validatePlugin()` 验证 Plugin shape、runtime descriptor、dependencies、digest 格式，以及可选 embedded artifact 的 canonical Base64 / ArtifactHash；
- `artifactHash()` 计算 exact artifact bytes 的协议 hash；
- `pluginHash()` 计算 canonical Plugin identity；
- `verifyArtifact()` 验证外部取得的 exact artifact bytes；
- `verifyEmbeddedArtifact()` 验证 Plugin 自带的 embedded artifact。

JCS serialization、canonical identity construction 等实现细节保持 internal，不作为开发者构造 API。未来 Dev SDK 可以复用公开 cryptographic primitives，但节点加载 Plugin 不依赖 Dev SDK。

## Distribution boundary

以下内容不属于 `core.plugin` runtime identity：

```text
source repository
build inputs
release notes
human description
registry / discovery metadata
package-manager metadata
reproducible-build tooling
```

Plugin Dev SDK 由 #23 设计；release / discovery channel 由 #24 设计。它们不能反向成为节点验证 Plugin 的依赖。

## Genesis 与 bootstrap

Genesis 继续是普通 Block；初始 Core Plugin 通过普通 Plugin Records 进入链。为避免 bootstrap 依赖外部 registry，初始 `core.plugin / core.record / core.entity / core.block` 应携带完整 embedded gzip artifact。

节点可以：

```text
读取 Genesis Plugin Record
-> validate Plugin
-> verify embedded gzip artifact
-> bounded gunzip
-> load runtime
-> 继续解释和同步链
```

Genesis 的 RecordId、签名、BlockHeader、PoA/bootstrap 组合等由 Genesis #10 独立审查；`core.plugin` 不定义 Genesis-specific validity path。
