# Current Architecture

本文记录 LabourChain/Core 当前接受的总体边界。历史事实依据见 [`source-baseline.md`](source-baseline.md)。

## Core 的职责

Core 只负责最小区块链确证结构，不负责劳动确证、项目组织、资产业务或插件生态治理。

当前 Core 包含四个 Plugin：

```text
core.plugin
core.record
core.entity
core.block
```

```mermaid
flowchart TB
    Core["Core"]
    Core --> P["Plugin data"]
    Core --> R["Record data"]
    Core --> E["Entity data"]
    Core --> B["Block + BlockHeader"]

    P --> RP["carried by Record.data"]
    E --> RE["carried by Record.data"]
    R --> BR["Block.records[]"]
```

`BlockHeader` 是 `core.block` 的公开类型，不存在独立 `core.block-header` Plugin。

## Core 不承担劳动确证

Core 确认的是一组 Records 以确定的数据格式被放入区块，并形成连续、可验证的链历史。

它不直接判断劳动是否完成、劳动量、成果归属、Project 组织、Asset 演化或 Repository / Member 权限。这些语义由后续 `work.*`、`labour.*`、`repo.*`、`project.*` 等 Plugin 定义，并以普通 Record 进入链。

因此 Core confirmation chain 与 Labour / Asset / Project 等业务图正交。

## Plugin 是 Record.data

旧 Service 中 `Protocol` 本身就是普通 Record 的 `data`。当前迁移保留这一组合关系，只把 schema-only Protocol 演化为 executable Plugin。

```text
Record
├── plugin = core.plugin@version
├── pluginHash
├── createdBy
├── createdAt
├── signature
└── data = Plugin
```

`core.plugin` 只定义 Plugin data、executable identity 与 exact artifact verification：

```text
validatePlugin
artifactHash
pluginHash
verifyArtifact
verifyEmbeddedArtifact
```

JCS canonical identity construction 保持 internal。构建、bundle、gzip、reproducible build、release preparation 属于 Plugin Dev SDK #23；发行与 discovery 属于 #24。

## Protocol 到 Plugin 的迁移

历史 Protocol 的 `schema / package / contributors / description` 不进入当前 runtime identity。当前 executable Plugin 只保留运行所需的最小身份：

```text
name
version
runtime { kind, abi }
dependencies[]
artifactHash
artifact?
```

历史 CUE/schema 继续作为 Source Fact 保存，但不是当前 runtime schema。

## Artifact identity 与存储分离

ABI v1 每个 Plugin 只有一个 exact gzip executable artifact：

```text
ArtifactHash = DoubleSHA256(exact gzip artifact bytes)
```

ArtifactHash 进入 PluginHash。可选 `artifact` 是 exact gzip bytes 的 canonical Base64 链内承载，不进入 PluginHash。

```mermaid
flowchart TB
    A["exact gzip artifact bytes"] --> AH["ArtifactHash"]
    AH --> PH["PluginHash"]

    E["embedded Base64"] --> A
    C["local cache"] --> A
    M["mirror / other resolver"] --> A
```

因此相同 bytes 无论随 Record 上链、本地 cache、Repo/object storage、HTTP mirror 或未来其他 resolver 取得，都验证为同一个 Plugin identity。

MVP 初始 Core Plugins 应携带 embedded artifact，从而不依赖独立 Plugin registry 完成 bootstrap。

## Artifact 与 Asset 分层

Plugin artifact 只包含 Plugin 本身运行所需的代码与必要小型 runtime data。

大型模型、图片、视频、地图、词典、数据集或游戏资源包属于 Asset / Runtime 层，不应塞入 executable Plugin。

```mermaid
flowchart TB
    P["Plugin"] --> A["small executable artifact"]
    A --> Chain["may embed on chain"]
    P --> Run["runtime"]
    Run --> Asset["large Assets"]
```

`core.plugin` 不依赖 Asset，也不定义 AssetId。

## Plugin 大小边界

Plugin 是小型可执行协议单元。

```text
compressed artifact > ~500 KiB
-> build / Dev SDK warning only

uncompressed js-esm runtime > 1 MiB
-> ABI v1 hard reject before import
```

1 MiB 同时是资源安全边界与工程边界。超过该规模应优先拆分 Plugin，或把非执行内容移入 Asset / Runtime。

## Record 是通用事实容器

Record common envelope：

```text
id
plugin
pluginHash
createdBy
createdAt
signature
data
```

Record 同时表达协议来源与主体来源：

```text
plugin / pluginHash
-> 哪个链上 Plugin / 协议解释这条 Record

createdBy / signature
-> 哪个 Entity 对这条 Record 负责并确认
```

`pluginHash` 是 runtime/runner 使用的 exact Plugin identity；`plugin = name@version` 是人类可读声明，并作为签名事实参与 RecordId。

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

RawRecord 包含 `plugin / pluginHash / createdBy / createdAt / data`。`id` 与 `signature` 不参与 RecordId。

当 `Record.data = Plugin` 且携带 embedded artifact 时，embedded artifact 虽不进入 PluginHash，却进入该条 Record 的 RecordId；这是 executable identity 与 fact identity 的有意分离。

普通 Record 使用 domain-separated Ed25519 signature over RecordId。`core.record` 不 resolve 或执行 Plugin。

## Entity 是链级身份数据

```text
Entity {
  publicKey
  introducedBy?
}
```

`publicKey` 是稳定 `EntityPublicKey`。`introducedBy` 只记录可选引荐来源，不承担 ownership、membership、多签、权限或永久信任语义。

Member、Repository、Organization 等不是 Entity 子类；它们在领域 Plugin 中引用 `EntityPublicKey`。

`Record.createdBy`、`BlockHeader.packer` 与 `Entity.introducedBy` 使用同一 base58btc Ed25519 public-key representation。

## Block 是 Record 的确证容器

```text
Block
├── header: BlockHeader
└── records: Record[]
```

Block 负责批量承诺 Records、前后区块连续性和 packer confirmation；它不承担 Labour / Asset DAG 的业务拓扑。

ordinary Block 保留 ordered RecordId Merkle commitment，禁止 duplicate RecordId，BlockId 从 unsigned Header 派生，packer 对 BlockId 做 domain-separated Ed25519 confirmation。

Plugin availability、PoA authorization 与业务依赖不属于 standalone Block validity。

## Genesis 继续是 Block

历史 Service 的 Genesis 是实际 Block；当前仍保持：

```text
Genesis Block
└── records[]
    ├── Record<data = Plugin + embedded artifact>
    ├── Record<data = Plugin + embedded artifact>
    └── ...
```

不存在独立于 Record/Block 的第二套 S0 Plugin artifact 通路。

MVP 初始 Core Plugins 携带完整 embedded gzip artifact，使节点只凭 Genesis/链数据即可取得解释链所需 executable content。

Genesis 的 Record/Block bootstrap 特例由 #10 独立审查；`core.plugin` 不定义 Genesis-specific validity。

## Runtime 边界

Runtime/composition 提供：

```text
process / Cordis Context
Plugin resolution by PluginHash
artifact cache / external fetch
bounded gunzip / module loading
Asset fetch / storage
filesystem / object storage
network transport / sync
secret-key storage / signer
sandbox / capability policy
observability
```

Core Plugin 对相同显式输入必须给出确定性结果；Runtime 不改变 Core 数据模型。

普通 npm/pnpm/build dependency 在 Plugin build 阶段处理。`core.plugin` runtime identity 只记录最终 artifact 与 exact chain Plugin dependencies。

## Repo / Labour / Board / Flow 边界

Repo 管理 Repository、Member、Asset、源码/build provenance 等业务事实和资产，不反向成为 Core Plugin 的隐藏依赖。

劳动事实、劳动确认、劳动成果与价值关系由后续 `labour.*` / `work.*` package 定义。Core 只保存并确认相应 Records。
