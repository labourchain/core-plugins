# Protocol Model

本文定义 LabourChain 当前 Protocol 数据模型、executable identity 与运行时验证边界。历史协议事实依据见 [`source-baseline.md`](source-baseline.md)；`cordis-js-esm` ABI v1 的加载规则见 [`runtime-abi.md`](runtime-abi.md)。

LabourChain 的 **Protocol** 是链上稳定、版本化、可被历史事实引用的语义对象。**Plugin** 是 Cordis 的运行时插件抽象。Protocol implementation 通过 Cordis Plugin 运行，但 `core.protocol` 不定义第二套 Plugin lifecycle。

## 基本结构

Protocol 作为普通 Record 的数据进入链：

```text
Record.data = Protocol
```

当前模型：

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

interface ProtocolDependency {
  name: string
  version: string
  protocolHash: ProtocolHash
}
```

`core.protocol` 定义链上 Protocol identity 与 exact executable artifact verification；不建立第二套 `ProtocolRelease` 类型，也不负责源码构建、发行渠道、下载、缓存、权限、SDK、Cordis lifecycle 或 artifact dependency projection validation。

历史 `Protocol.schema` / CUE 只保留为迁移事实，不属于当前 executable Protocol runtime model。

## Identity

Protocol name 使用 lowercase dotted namespace，version 使用 exact SemVer；`name@version` 是可读引用，精确 executable identity 是 `ProtocolHash`。

```text
ArtifactHash = DoubleSHA256(exact gzip artifact bytes)

ProtocolHash = DoubleSHA256(
  JCS({
    name,
    version,
    runtime,
    dependencies,
    artifactHash
  })
)
```

`dependencies[]` 在 canonical identity 中按 dependency name 的 UTF-8 顺序排序；同名 dependency 非法。dependency 的 `protocolHash` 是权威 identity，name/version 用于可读声明和 runtime service projection。

`artifactHash` 将最终 executable artifact 纳入 Protocol identity。Executable 内的 Cordis metadata、runtime-only inject 等内容只要改变 artifact bytes，就会通过 `artifactHash` 改变 ProtocolHash；它们不因此变成独立的结构化 Protocol 字段。

`artifact` 是 exact artifact bytes 的可选链内承载，使用 canonical RFC 4648 Base64。它本身不进入 ProtocolHash，因此同一 gzip bytes 无论来自 embedded Record、本地 cache、mirror 或其他 resolver，都表示同一个 Protocol。

如果 `artifact` 存在，它必须解码为与 `artifactHash` 完全一致的 bytes。

## Runtime ABI v1

```text
runtime.kind = "cordis-js-esm"
runtime.abi = 1
```

一个 Protocol 对应一个已经构建完成的 gzip executable artifact。解压后是 single-file ESM bundle，并明确导出唯一 runtime entry：

```ts
export const plugin = {
  name: '<protocol-name>@<version>',
  provide: 'protocol:<protocol-name>@<version>',
  inject: [],
  apply(ctx) {
    ctx.provide('protocol:<protocol-name>@<version>', implementation)
  },
}
```

该 `plugin` 是 Cordis object Plugin，由 Host 交给 `ctx.plugin()`。ABI v1 使用 Cordis 原生 `name` / `provide` / `inject` metadata 显式声明 runtime identity、提供能力和依赖；`apply()` 再通过 `ctx.provide()` 实际注册 capability，使其归当前 Fiber 生命周期管理。

Protocol capability 不通过任意 module exports 暴露。

因此 Protocol artifact 的交付边界是：

```text
already-built Cordis Plugin bundle
```

而不是源码包、需要节点安装的 npm package 或任意 ESM library namespace。Node 的解压、缓存、临时 materialization、ESM evaluation/import、Plugin validation 和 mount 是加载过程，不是 build。

release artifact filename 统一为：

```text
<protocol>-<version>.cordis-js-esm.gz
```

文件名属于 release metadata，不进入 ProtocolHash。

## Artifact 是否必须 embedded

“artifact 是 ready-to-mount”与“artifact bytes 是否直接放在链上”是两个独立维度。

Protocol descriptor 通过 `artifactHash` 记录最终 executable bytes；`artifact` 字段只是可选的 distribution/storage representation：

```text
Protocol descriptor
-> artifactHash identifies exact final executable bytes

artifact present
-> exact gzip bytes embedded in Record.data

artifact absent
-> exact gzip bytes resolved from cache / release / mirror / other channel
```

无论 bytes 从哪里取得，它们都已经是最终 `cordis-js-esm` executable。Repo Node 不根据源码重新构建。

MVP Genesis Core Protocol Records 应 embedded 完整 artifact，以避免 bootstrap 依赖外部 registry；普通 Protocol 是否 embedded 可以由更高层发行/存储策略决定，不改变 Protocol identity。

## Chain semantic dependency

`dependencies[]` 表达链上 Protocol 语义依赖，而不是普通 Cordis runtime service dependency。

每个 dependency 精确记录：

```text
name
version
protocolHash
```

其中 `protocolHash` 是权威 exact dependency identity。

运行时 artifact 必须把每个 chain semantic dependency 投影为 Cordis required service dependency：

```text
protocol:<name>@<version>
```

因此概念关系是：

```text
Protocol.dependencies[]
-> exact Protocol dependency authority

plugin.inject
-> runtime service dependency
```

Host 按 `protocolHash` 解析并验证 exact implementation；Cordis `inject` 决定所需 service 未就绪时 Fiber 是否可以运行。

`protocol:` 是 Protocol capability 的保留 service namespace。SDK/build gate 与 Repo Node/Host loader必须验证：

```text
projectedProtocolServices = project(Protocol.dependencies[])
runtimeProtocolInjects = plugin.inject 中所有 protocol:* service

runtimeProtocolInjects == projectedProtocolServices
```

这样运行时不存在未由 `dependencies[]` 给出 exact ProtocolHash 的隐藏 Protocol dependency。

`plugin.inject` 可以额外包含 storage/logger 等非 Protocol runtime services。它们不写入 `Protocol.dependencies[]`；它们作为 executable artifact 的一部分，通过 `artifactHash` 参与 ProtocolHash。

### Validation ownership

`core.protocol` 只验证 `dependencies[]` 作为链上 Protocol data 的合法性：字段、name、exact SemVer、ProtocolHash、唯一性以及 canonical ordering。

它**不**导入 artifact，也不读取 `plugin.inject`，因此不验证 descriptor 与 executable 之间的 dependency projection。

该 projection 必须在两个边界验证：

```text
Protocol Dev SDK / build gate
-> validate plugin runtime contract
-> require protocol:* injects == project(Protocol.dependencies[])

Repo Node / Host loader
-> repeat the same validation on imported verified artifact
-> resolve each dependency by exact ProtocolHash
```

这样 `core.protocol` 保持纯 identity/verification primitive，Cordis-aware 组合逻辑留在真正持有 executable module 的 SDK/Node。SDK 的完整约束见 #23。

## Protocol capability service

Protocol implementation 对 runtime 暴露自身能力时使用 canonical service key：

```text
protocol:<name>@<version>
```

典型 thin wrapper：

```ts
import * as api from './implementation.js'

export const plugin = {
  name: 'core.record@0.1.0',
  provide: 'protocol:core.record@0.1.0',
  inject: [],
  apply(ctx) {
    ctx.provide('protocol:core.record@0.1.0', api)
  },
}
```

`plugin.provide` 是声明；`ctx.provide()` 是实际 service 注册。ABI/build/Node validation 要求两者都指向同一个 canonical Protocol service key。

该 service key 不包含自身 ProtocolHash，避免 executable bytes 内嵌自身 hash 导致自引用。Host 在 mount 前已经知道并验证 descriptor 的 exact ProtocolHash，并负责拒绝同一 isolation scope 内相同 `name@version` 对应多个不同 ProtocolHash 的歧义。

Cordis service registration 的生命周期属于 Plugin Fiber。Runtime validation 应验证 mount 后 canonical service 可见，并在该 Plugin Fiber dispose 后确认 service 已撤销；这是 Protocol Plugin 可逆性的基本生命周期要求。

## Protocol 大小原则

Protocol implementation 是小型可执行协议单元，不是大型应用或资源包容器。

ABI v1 对解压后的单个 executable runtime 设置 **1 MiB hard limit**：

```text
runtime <= 1 MiB  -> 可进入 ESM evaluation/loading 流程
runtime > 1 MiB   -> Host 必须在 ESM evaluation/import 前拒绝
```

这个限制同时用于阻断 gzip-bomb 类异常展开，并主动约束 Protocol implementation 的工程边界。若 executable 超过 1 MiB，应优先拆成职责更明确的 Protocol，或把模型、字典、数据集、图片等非执行内容移入 Asset / Runtime。

约 **500 KiB compressed artifact** 的提示只属于开发工具 warning，不是 Core validity rule。构建、bundle、gzip、体积分析和 release preparation 属于 Protocol Dev SDK #23。

## Runtime verification API

`core.protocol` 的公共验证 API 保持最小：

```text
ProtocolError
validateProtocol(protocol)
artifactHash(bytes)
protocolHash(protocol)
verifyArtifact(protocol, artifactBytes, expectedProtocolHash?)
verifyEmbeddedArtifact(protocol, expectedProtocolHash?)
```

其中：

- `validateProtocol()` 验证 Protocol shape、runtime descriptor、`dependencies[]` 链上数据、digest 格式，以及可选 embedded artifact 的 canonical Base64 / ArtifactHash；
- `artifactHash()` 计算 exact artifact bytes 的 hash；
- `protocolHash()` 计算 canonical Protocol identity；
- `verifyArtifact()` 验证外部取得的 exact artifact bytes；
- `verifyEmbeddedArtifact()` 验证 Protocol 自带的 embedded artifact。

`core.protocol` 不负责 ESM import、`plugin` shape、`plugin.provide`、`plugin.inject` projection、`ctx.plugin()`、dependency availability 或 Fiber lifecycle。

## Build / distribution boundary

发布侧负责生成最终 executable：

```text
source
-> bundle ordinary source/build dependencies
-> thin Cordis Plugin wrapper
-> single ESM
-> validate explicit plugin export
-> validate name/provide/inject/apply runtime contract
-> validate exact protocol:* dependency projection
-> validate mount + Plugin Fiber disposal reversibility
-> deterministic gzip
-> ArtifactHash / ProtocolHash
```

消费侧负责：

```text
resolve exact bytes
-> verify Protocol/artifact identity through core.protocol
-> bounded gunzip
-> establish sandbox/capability execution boundary
-> evaluate/import ESM inside that boundary
-> validate explicit plugin export/runtime contract
-> validate exact protocol:* dependency projection
-> resolve exact dependency ProtocolHashes
-> mount through Host Cordis
```

Artifact verification解决 identity，不解决代码执行安全。Repo Node 必须在 ESM 顶层代码执行前建立 sandbox/capability boundary；具体机制属于 Repo runtime，不属于 `core.protocol`。

以下内容不属于 `core.protocol` identity：source repository、build inputs、release notes、human description、registry/discovery metadata、package-manager metadata、reproducible-build tooling、Cordis runtime/Fiber state。

Protocol Dev SDK 由 #23 设计；release / discovery channel 由 #24 设计。它们不能反向成为 `core.protocol` 的运行时依赖。

## Genesis 与 bootstrap

Genesis 继续是普通 Block；初始 Core Protocol 通过普通 Protocol Records 进入链。为避免 bootstrap 依赖外部 registry，初始 `core.protocol / core.record / core.entity / core.block` 应携带完整 embedded gzip artifact。

节点可以：

```text
读取 Genesis Protocol Record
-> validate Protocol
-> verify embedded gzip artifact
-> bounded gunzip
-> establish execution boundary
-> evaluate/import ESM
-> validate explicit `plugin`
-> validate dependency projection
-> mount through Cordis
-> 继续解释和同步链
```

Genesis 的 ordinary Record/Block 组合由 #10 独立处理；`core.protocol` 不定义 Genesis-specific validity path。

## Current implementation

四个 Core Protocol 已按本模型生成 executable artifact：

```text
runtime.kind = cordis-js-esm
*.cordis-js-esm.gz
ESM namespace = { plugin }
pure package API -> thin Cordis Plugin wrapper -> canonical Protocol service
```

build/release gate 在 `core.protocol` 之外验证 Plugin runtime contract、exact `protocol:*` dependency projection、实际 Cordis mount 与 Plugin Fiber dispose 后的 service 撤销。当前四个 Core Protocol 的链级 `dependencies[]` 均为空；普通源码依赖被 bundle 到对应单 artifact 中。
