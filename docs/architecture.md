# Current Architecture

本文记录 LabourChain/Core 当前接受的总体边界。历史事实依据见 [`source-baseline.md`](source-baseline.md)。

## Core 的职责

Core 只负责最小区块链确证结构，不负责劳动确证、项目组织、资产业务或 Cordis 插件生态治理。

当前 Core 包含四个 Protocol：

```text
core.protocol
core.record
core.entity
core.block
```

```mermaid
flowchart TB
    Core["Core"]
    Core --> P["Protocol data"]
    Core --> R["Record data"]
    Core --> E["Entity data"]
    Core --> B["Block + BlockHeader"]

    P --> RP["carried by Record.data"]
    E --> RE["carried by Record.data"]
    R --> BR["Block.records[]"]
```

`BlockHeader` 是 `core.block` 的公开类型，不存在独立 `core.block-header` Protocol。

## Protocol 与 Cordis Plugin

LabourChain 使用 **Protocol** 表示会被链上历史长期引用的稳定、版本化语义与 executable identity。**Plugin** 是 Cordis 的运行时组合与生命周期抽象。

```text
LabourChain Protocol
-> chain-facing stable semantics / identity

Cordis Plugin
-> runtime composition / lifecycle abstraction
```

Protocol implementation 通过 Cordis Plugin 执行，但 Core 不重新定义 Cordis 的 Plugin、Context、Fiber、Service、inject、provide、effect 或 lifecycle，也不建立第二套 Plugin Manager。

当前 runtime contract：

```text
Protocol.runtime.kind = "cordis-js-esm"
Protocol artifact = already-built Cordis Plugin ESM bundle
ESM exports exactly `plugin`
plugin.name = <name>@<version>
plugin.provide = protocol:<name>@<version>
Host -> ctx.plugin(plugin)
```

`plugin.inject` 声明 runtime dependency；`plugin.provide` 声明该 implementation 提供的 canonical Protocol service；`apply()` 中通过 `ctx.provide()` 实际注册该 service。

## Core 不承担劳动确证

Core 确认的是一组 Records 以确定的数据格式被放入区块，并形成连续、可验证的链历史。

它不直接判断劳动是否完成、劳动量、成果归属、Project 组织、Asset 演化或 Repository / Member 权限。这些语义由后续 `work.*`、`labour.*`、`repo.*`、`project.*` 等 Protocol 定义，并以普通 Record 进入链；其运行时 implementation 通过 Cordis Plugin 组合。

因此 Core confirmation chain 与 Labour / Asset / Project 等业务图正交。

## Protocol 是 Record.data

旧 Service 中 `Protocol` 本身就是普通 Record 的 `data`。当前设计保留这一组合关系，同时把旧 schema-only Protocol 演化为携带 exact executable implementation identity 的 Protocol。

```text
Record
├── protocol = core.protocol@version
├── protocolHash
├── createdBy
├── createdAt
├── signature
└── data = Protocol
```

`core.protocol` 只定义 Protocol data、executable identity 与 exact artifact verification：

```text
validateProtocol
artifactHash
protocolHash
verifyArtifact
verifyEmbeddedArtifact
```

`core.protocol` 可以验证 `dependencies[]` 作为链上 identity data 的 shape、name/version/hash、唯一性与 canonical order，但不导入 executable，因此不验证 descriptor 与 `plugin.inject` 的 dependency projection。该组合验证属于 Protocol Dev SDK 与 Repo Node/Host loader。

JCS canonical identity construction 保持 internal。构建、bundle、gzip、reproducible build、release preparation 属于 Protocol Dev SDK #23；发行与 discovery 属于 #24。

## 历史 Protocol 的演化

历史 Protocol 的 `schema / package / contributors / description` 不进入当前 executable identity。当前 Protocol 只保留 identity/runtime verification 所需的最小数据：

```text
name
version
runtime { kind, abi }
dependencies[]
artifactHash
artifact?
```

历史 CUE/schema 继续作为 Source Fact 保存，但不是当前 runtime schema。

恢复 `Protocol` 命名不是恢复旧 schema-only 模型，也不是为 Cordis 建立第二套 Plugin runtime；它恢复的是 LabourChain 链上语义对象本身的名称。

## Artifact identity 与存储分离

ABI v1 每个 Protocol 只有一个 exact gzip executable artifact：

```text
ArtifactHash = DoubleSHA256(exact gzip artifact bytes)
```

ArtifactHash 进入 ProtocolHash。可选 `artifact` 是 exact gzip bytes 的 canonical Base64 链内承载，不进入 ProtocolHash。

```mermaid
flowchart TB
    A["exact gzip artifact bytes"] --> AH["ArtifactHash"]
    AH --> PH["ProtocolHash"]

    E["embedded Base64"] --> A
    C["local cache"] --> A
    M["mirror / other resolver"] --> A
```

因此相同 bytes 无论随 Record 上链、本地 cache、Repo/object storage、GitHub Release、HTTP mirror 或未来其他 resolver 取得，都验证为同一个 Protocol identity。

关键边界是：**ArtifactHash 承诺最终 ready-to-mount executable bytes，而不是源码。** Node 不根据源码重新生成 executable；构建发生在 Protocol 发布侧。

MVP 初始 Core Protocols 应携带 embedded artifact，从而不依赖独立 registry 完成 bootstrap。普通 Protocol 是否 embedded 是 storage/distribution 选择，不改变 artifact 的 executable 形态。

## Artifact 与 Asset 分层

Protocol artifact 只包含 Protocol implementation 运行所需的代码与必要小型 runtime data。大型模型、图片、视频、地图、词典、数据集或游戏资源包属于 Asset / Runtime 层，不应塞入 executable Protocol artifact。

```mermaid
flowchart TB
    P["Protocol"] --> A["ready-to-mount Cordis Plugin artifact"]
    A --> Chain["may embed on chain"]
    A --> External["or resolve externally"]
    P --> Run["runtime implementation"]
    Run --> Asset["large Assets"]
```

`core.protocol` 不依赖 Asset，也不定义 AssetId。

## Protocol 大小边界

```text
compressed artifact > ~500 KiB
-> build / Dev SDK warning only

uncompressed cordis-js-esm runtime > 1 MiB
-> ABI v1 hard reject before ESM evaluation/import
```

1 MiB 同时是资源安全边界与工程边界。超过该规模应优先拆分 Protocol implementation，或把非执行内容移入 Asset / Runtime。

## Record 是通用事实容器

Record common envelope：

```text
id
protocol
protocolHash
createdBy
createdAt
signature
data
```

Record 同时表达协议来源与主体来源：

```text
protocol / protocolHash
-> 哪个链上 Protocol 解释这条 Record

createdBy / signature
-> 哪个 Entity 对这条 Record 负责并确认
```

`protocolHash` 是 runtime/composition 使用的 exact Protocol identity；`protocol = name@version` 是人类可读声明，并作为签名事实参与 RecordId。

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

RawRecord 包含 `protocol / protocolHash / createdBy / createdAt / data`。`id` 与 `signature` 不参与 RecordId。

当 `Record.data = Protocol` 且携带 embedded artifact 时，embedded artifact 虽不进入 ProtocolHash，却进入该条 Record 的 RecordId；这是 executable identity 与 fact identity 的有意分离。

普通 Record 使用 domain-separated Ed25519 signature over RecordId。`core.record` 不 resolve 或执行 Protocol。

## Entity 是链级身份数据

```text
Entity {
  publicKey
  introducedBy?
}
```

`publicKey` 是稳定 `EntityPublicKey`。`introducedBy` 只记录可选引荐来源，不承担 ownership、membership、多签、权限或永久信任语义。

Member、Repository、Organization 等不是 Entity 子类；它们在领域 Protocol 中引用 `EntityPublicKey`。

`Record.createdBy`、`BlockHeader.packer` 与 `Entity.introducedBy` 使用同一 base58btc Ed25519 public-key representation。

## Block 是 Record 的确证容器

```text
Block
├── header: BlockHeader
└── records: Record[]
```

Block 负责批量承诺 Records、前后区块连续性和 packer confirmation；它不承担 Labour / Asset DAG 的业务拓扑。

ordinary Block 保留 ordered RecordId Merkle commitment，禁止 duplicate RecordId，BlockId 从 unsigned Header 派生，packer 对 BlockId 做 domain-separated Ed25519 confirmation。

Protocol availability、PoA authorization 与业务依赖不属于 standalone Block validity。

## Genesis 继续是 Block

历史 Service 的 Genesis 是实际 Block；当前仍保持：

```text
Genesis Block
└── records[]
    ├── Record<data = Protocol + embedded artifact>
    ├── Record<data = Protocol + embedded artifact>
    └── ...
```

不存在独立于 Record/Block 的第二套 S0 Protocol artifact 通路。

MVP 初始 Core Protocols 携带完整 embedded gzip artifact，使节点只凭 Genesis/链数据即可取得解释链所需 executable content。这些 bytes 已经是最终 ready-to-mount `cordis-js-esm` artifacts；Genesis Node 负责 verify、bounded gunzip，并在自身 sandbox/capability execution boundary 内完成 ESM evaluation 与 Cordis mount，不现场构建 Core Protocol。

Genesis 的 deterministic assembly 由 #10 独立处理；`core.protocol` 不定义 Genesis-specific validity。

## Chain dependency 与 runtime dependency

`Protocol.dependencies[]` 只记录链上的 Protocol 依赖：

```text
name + version + exact ProtocolHash
```

它进入 ProtocolHash，因此属于 historical semantic identity。它不试图描述 implementation 运行时所需的全部 Plugin/Service。

每个链上 Protocol dependency 在运行时都必须有对应的 Cordis service dependency：

```text
protocol:<name>@<version>
```

Cordis `inject` 实际控制 Fiber runtime activation；Host 在挂载前按 chain dependency 的 ProtocolHash 解析并验证 exact implementation。

`plugin.inject` 描述 implementation 作为 Cordis Plugin 的全部 runtime dependencies，因此它可以是链上 `dependencies[]` 投影的超集。除链上 Protocol service 外，还可以包含 DSH、agent loop、storage、logger 等不上链的公共 runtime facilities。

因此只要求 `project(Protocol.dependencies[]) ⊆ plugin.inject`。SDK/Repo 只检查每个链上 dependency 在 runtime 中确实被声明；它们不把额外 inject 反向解释成链上 dependency。当前 Core artifact build/release 不调用该通用 projection validator。

额外 runtime inject 不写入 `Protocol.dependencies[]`；作为 executable artifact 的一部分，它们仍随 `artifactHash` 参与 ProtocolHash。

Protocol implementation 对外声明并提供自身 capability：

```text
plugin.provide = protocol:<name>@<version>
apply(ctx) -> ctx.provide(protocol:<name>@<version>, implementation)
```

Host 负责避免同一 isolation scope 内相同 `name@version` 对应不同 ProtocolHash 的歧义。

## Runtime 边界

Runtime/composition 提供：

```text
process / Host Cordis Context
Protocol resolution by ProtocolHash
artifact cache / external fetch
bounded gunzip
sandbox / capability execution boundary
ESM materialization/evaluation/import inside that boundary
explicit `plugin` export validation
plugin name/provide/inject/apply validation
Protocol dependency projection validation
ctx.plugin(plugin)
Cordis Fiber / Service / effect lifecycle
Asset fetch / storage
filesystem / object storage
network transport / sync
secret-key storage / signer
observability
```

ArtifactHash / ProtocolHash verification 只确认 exact bytes 与 identity，不把 artifact 变成可信代码。Repo Node 必须在 ESM 顶层代码被执行之前建立自身 sandbox/capability boundary；具体 sandbox 机制属于 Repo runtime 设计，不由 Core ABI 实现。

Runtime 不负责：

```text
compile/transpile Protocol source
npm install Protocol package
run install scripts
rebundle a verified Protocol
replace verified bytes with locally generated executable
```

Core Protocol 对相同显式输入必须给出确定性结果；Runtime 不改变 Core 数据模型。

普通 npm/pnpm/build dependency 在 Protocol build 阶段 bundle。`core.protocol` identity 只记录最终 artifact 与 exact chain semantic dependencies。

Protocol artifact 不 bundle 第二份 Cordis runtime；Cordis 由 Host 提供，并作为 LabourChain 唯一 runtime plugin/lifecycle system。

## Repo / Labour / Board / Flow 边界

Repo 管理 Repository、Member、Asset、源码/build provenance 等业务事实和资产，不反向成为 Core Protocol 的隐藏依赖。

劳动事实、劳动确认、劳动成果与价值关系由后续 `labour.*` / `work.*` Protocol 定义。Core 只保存并确认相应 Records；这些 Protocol 的运行时 implementation 复用 Host Cordis composition，而不是再建立一套 Plugin runtime。

## Current runtime status

当前四个 Core Protocol 已使用 `cordis-js-esm` ABI v1：

```text
runtime.kind = cordis-js-esm
*.cordis-js-esm.gz
ESM namespace = { plugin }
pure package API -> thin Cordis Plugin wrapper
```

build/release gate 在 `core.protocol` 之外检查当前 Core Plugin runtime contract 与 Cordis Plugin lifecycle；通用 Protocol dependency projection validator 独立保留给后续 SDK/Repo，不进入当前 Core artifact flow。`core.protocol` 本身保持 deterministic chain-data / identity / exact-artifact primitive。
