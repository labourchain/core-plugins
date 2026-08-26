# LabourChain Core Plugins

[English](README.en.md)

`@labourchain/core-plugins` 是 LabourChain 的核心链插件工程。

它负责定义和实现 LabourChain 最基础的链上执行规则：Plugin 如何作为不可变、可版本发布的链上包存在，Record 如何描述和确认事实，Entity 如何提供公钥身份，Block 如何将一批有序 Record 确证并形成连续公共历史，以及整条链如何从唯一的 Genesis 开始运行。

原始 [`Ri0n72Y/blockchain-service`](https://github.com/Ri0n72Y/blockchain-service) 只作为历史协议行为的事实来源。当前需求与架构直接维护在 `docs/`，实现用 `spec/` 从已审查 docs 投影。

## 当前核心模型

LabourChain 中的 **Plugin** 是包含 schema / public types 与确定性 executable functions 的不可变链上包。它在能力上相当于以太坊语境中的 Smart Contract，但工程模型更接近 package/plugin：按名称和版本发布，已发布版本不原地修改，更新通过新的版本或后续 patch 事实完成。

当前 Core 基础插件为：

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` 是 `core.block` 的公开类型，不再作为独立插件。

Plugin 的链上执行对象是已经构建完成的 **artifact**，而不是必须 clone/build 的源码仓库。runner 获取 artifact、验证其 PluginHash，然后直接加载对应运行时代码。源码、lockfile、构建配置、提交历史等开发材料属于 Repository/Asset provenance，不是运行 Plugin 必须携带的内容。

普通 Plugin release 由 Repository 发行。release Record 的 `createdBy` 使用 Repository 的 Entity public key；沿该 public key 可以解析 Repository，再沿其 Asset / Labour Record 关系追溯源码、构建输入、commit/asset 与贡献历史。Genesis 中的初始 Core plugins 是唯一 bootstrap 例外，不要求先存在一个发行 Repository。

## 两个正交结构

LabourChain 同时存在：

- **Core Block Chain**：对 Record 的批量确证与连续存储历史；
- **Labour / Asset DAG**：Record、Asset、源码、构建产物与成果之间的业务/贡献关系，形态更接近 Git commit DAG。

Block 负责确证，Record 承载事实。Labour / Asset DAG 不参与通用 Core Block validity。

Genesis 是整条链的唯一先验例外。它直接建立初始 Plugin state；从第一个普通 Block 开始，Plugin、Record、Entity 和 Block 都进入严格的非例外规则。

## Identity、digest 与 Record confirmation

只有 Entity key material 与 Entity public-key reference 使用 Base58；当前固定为 base58btc / Bitcoin alphabet。

```text
Entity public key -> Base58, may appear on chain
Entity secret key -> Base58, local only, never on chain
```

Signature 不是 identity，不使用 Base58。RecordId、PluginHash、RecordsRoot、BlockId 等属于 DoubleSHA256 digest，当前 wire representation 使用 lowercase hexadecimal。

普通 `core.record@0.1.0` 先由 RawRecord 派生 RecordId，再由 `createdBy` 对 domain-separated RecordId payload 做 Ed25519 签名；签名本身使用 lowercase hexadecimal。这把事实内容 identity 与作者/发行者确认分开，同时避免为签名再引入一套 `data` 序列化规则。

## 文档与开发规格

当前需求与架构维护在 [`docs/`](docs/README.md)：

- [`docs/source-baseline.md`](docs/source-baseline.md) — 原始 `blockchain-service` 能够直接确认的历史事实；
- [`docs/architecture.md`](docs/architecture.md) — 当前 LabourChain/Core 总体需求与架构；
- [`docs/plugin.md`](docs/plugin.md) — Plugin package、artifact、release identity、依赖锁定与 provenance；
- [`docs/block.md`](docs/block.md) — `core.block`、BlockHeader、Merkle、签名、BlockId 与验证模型；
- [`docs/genesis.md`](docs/genesis.md) — Genesis 奇点与初始 Plugin 集合；
- [`docs/ordering.md`](docs/ordering.md) — Plugin 生效、Block 确证与业务关系顺序的分离。

开发用投影维护在 [`spec/`](spec/README.md)。

## 工程阶段

当前 Foundation 的核心需求、架构和实现规格已经完成定义，已知设计 blocker 已清零。当前 PR 只做 docs/spec 的最终一致性审查；审查通过后进入具体 Core Plugin implementation，不再继续扩张 foundation 设计范围。
