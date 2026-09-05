# LabourChain Core Plugins

[English](README.en.md)

`@labourchain/core-plugins` 是 LabourChain 的核心链插件工程。

原始 [`Ri0n72Y/blockchain-service`](https://github.com/Ri0n72Y/blockchain-service) 是历史协议行为的 Source Fact。当前需求与架构维护在 [`docs/`](docs/README.md)，实现规格从已审查 docs 投影到 [`spec/`](spec/README.md)。

## Core

当前 Core Plugins：

```text
core.plugin
core.record
core.entity
core.block
```

核心组合关系保持旧 Service 的结构：

```text
Plugin / Entity / domain data
        -> Record.data
Record[]
        -> Block.records[]
```

`BlockHeader` 是 `core.block` 的公开类型，不存在独立 `core.block-header` Plugin。

## Plugin 与 artifact

Plugin 是从旧 schema-only `Protocol` 演化而来的 executable protocol package。

它通过：

```text
runtime
schema
dependencies[]
files[] { path, size, FileHash }
```

形成 exact executable identity：

```text
PluginHash = DoubleSHA256(canonical Plugin identity)
```

每个 FileHash 又承诺 raw file bytes。

Plugin 可以额外携带完整 artifact：

```text
artifact?: {
  canonicalPath: canonicalBase64RawBytes
}
```

内嵌 artifact 与链外取得的相同 bytes 使用同一个 PluginHash。小型、必要的 Plugin 优先随 Record 上链；MVP Genesis 中的 Core Plugins 应自包含 executable artifact，使新节点不依赖独立 npm-style Plugin registry 即可取得解释链所需的代码。

大型模型、图片、视频、地图、词典、数据集或资源包应优先拆到更高层 Asset/Runtime。构建工具建议在 executable artifact 大约超过 500 KiB 时给 bundle-size warning；这只是 docs 中的工程建议，不是共识有效性限制。

## Record

普通 Record 现在固定为：

```text
RawRecord
= plugin / pluginHash / createdBy / createdAt / data

Record
= id / signature + RawRecord
```

其中：

```text
plugin / pluginHash -> 协议来源
createdBy / signature -> 主体来源
```

`pluginHash` 是 runner/runtime 使用的机器权威 identity；`plugin = name@version` 是被签名的人类可读声明。

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

RecordId 承诺完整 RawRecord，包括完整 `data`。普通 Record signature 使用固定 domain-separated Ed25519 signature over RecordId。

`core.record` 不 resolve 或执行 Plugin，也不维护 activation / same-block state。runtime 根据 `pluginHash` 加载 exact Plugin，并由 Plugin 执行协议规则。

## 当前审查状态

`core.plugin` 已实现 Plugin identity、external/embedded artifact verification。

`core.record` 已完成设计并进入实现。`core.block` 与 Genesis 的 Block/Header 以及历史 bootstrap Record 例外仍按旧 Service 做 source-first review；此前引入的 Plugin activation/S0/Repository issuer 状态机已经撤销。

## 文档

- [`docs/source-baseline.md`](docs/source-baseline.md) — 历史 Source Facts；
- [`docs/architecture.md`](docs/architecture.md) — 当前 Core 总体架构；
- [`docs/plugin.md`](docs/plugin.md) — Plugin、artifact、Asset boundary 与 runtime verification；
- [`docs/record.md`](docs/record.md) — Record、JCS identity 与 author confirmation；
- [`docs/block.md`](docs/block.md) — Block source-review boundary；
- [`docs/genesis.md`](docs/genesis.md) — Genesis = Block 与 Core bootstrap artifact；
- [`docs/ordering.md`](docs/ordering.md) — confirmation/business/runtime order 分离；
- [`spec/`](spec/README.md) — 实现投影。
