# LabourChain Core Specifications

`spec/` 是从已审查 `docs/` 投影出的开发规格。

```text
Ri0n72Y/blockchain-service
        -> historical Source Facts

docs/
        -> current requirements + architecture

spec/
        -> implementation projection

implementation + tests
```

`spec/` 不反向改写 `docs/`，也不替代原始 `blockchain-service` 对历史行为的事实记录。

## 实现纪律

如果 spec 标记某个行为为 blocker/open/pending review：

- 不得为了“跑通”自行选择一种语义；
- 不得用测试固定尚未被接受的设计；
- 应回到 docs 完成设计决策，再更新 spec。

历史 Source Gap 本身不自动阻塞当前实现。Current Design 可以显式定义新的版本化行为，但必须与历史事实区分。

## 当前 Core Plugin 集合

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` 是 `core.block` 的公开类型，不存在独立 `core.block-header` Plugin/spec。

## 当前规格状态

- [`core-plugin.md`](core-plugin.md) — 已定义并实现中的 Plugin data、FileHash/PluginHash、exact artifact verification、optional embedded artifact；
- [`core-record.md`](core-record.md) — pending source-aligned review，旧 activePluginState/S0 假设非规范；
- [`core-entity.md`](core-entity.md) — Entity public-key identity primitive；
- [`core-block.md`](core-block.md) — pending source-aligned review，旧 Plugin-state/GenesisId 假设非规范；
- [`genesis.md`](genesis.md) — `Genesis = Block` migration baseline，MVP Core Plugin Records 需要 embedded artifact，其余 bootstrap identity/signature 待 review；
- [`ordering.md`](ordering.md) — 只冻结 Block confirmation、业务关系和 runtime arrival order 的分离。

## Plugin artifact contract

当前 `core.plugin` identity：

```text
Plugin descriptor
  -> files[] { path, size, FileHash }
  -> canonical JCS identity form
  -> DoubleSHA256
  -> PluginHash
```

Plugin 可以额外携带：

```text
artifact?: {
  canonicalPath: canonicalBase64RawBytes
}
```

`artifact` 一旦存在必须完整覆盖 `files[]` 并通过 exact size/FileHash verification。

`artifact` 是存储方式，不进入 canonical Plugin identity。因此：

```text
embedded bytes
external bytes
local cache bytes
```

只要内容相同，都验证为同一个 PluginHash。

MVP 初始 Core Plugins 应把完整 executable artifact 随 Genesis Plugin Records 上链，从而不需要先建立 npm-style Plugin registry。

## Artifact / Asset boundary

Plugin artifact 只包含运行 Plugin 本身所需的代码、schema 与必要小型 runtime data。

大型模型、图片、视频、地图、词典、数据集、游戏资源包等内容应优先由更高层 Asset/Runtime 机制提供。

`core.plugin` 不依赖 Asset，也不定义 AssetId。

Build tooling 应报告 `sum(files[].size)`，大约超过 **500 KiB** 时给 warning，建议拆大型静态内容。该阈值不是 consensus validity rule。

## Identity / encoding boundary

```text
Entity public key -> identity encoding defined by core.entity
Signature         -> signature result, not Entity identity
RecordId          -> cryptographic digest
FileHash          -> DoubleSHA256 digest
PluginHash        -> DoubleSHA256 digest
RecordsRoot       -> reviewed under core.block
Block identity    -> reviewed under core.block
```

Digest 的当前 wire representation 使用 lowercase hexadecimal，除非对应 spec 后续另有明确版本化规定。

## Runner/server boundary

runner/server 负责：

```text
process / Cordis Context
Plugin artifact cache
optional external Plugin artifact fetch
Asset fetch/storage
persistence
transport/sync
secret-key storage
sandbox/capability policy
observability
```

链内 embedded artifact 让小型/必要 Plugin 不依赖 external registry；外部 resolver 仍可作为可选镜像、加速或历史可获得性能力。

Core spec 只规定 Plugin 自身确定性行为与显式验证输入。
