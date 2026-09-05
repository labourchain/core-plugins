# LabourChain Core Documentation

本目录维护 Core 的历史事实、当前需求与架构，以及进入实现前仍需审查的设计边界。

## 文档中的三种信息

- **Source Fact**：可以直接从原始 `Ri0n72Y/blockchain-service` 的 CUE、Go model/handler/script/test 等材料中确认；
- **Current Design**：当前已经接受、实现必须遵守的 LabourChain 需求与架构；
- **Open Question**：尚未进入实现规格的未决问题。

`blockchain-service` 是旧 Protocol 模型与行为的历史事实来源。Current Design 可以明确替代旧结构，但必须保留旧行为的来源记录，不能把新设计描述成旧事实。

## 当前术语

当前设计统一使用 **Plugin** 表示包含 schema 与 deterministic executable behavior 的链上协议包。`Protocol` 只在历史上下文中保留。

当前 Core Plugin 集合：

```text
core.plugin
core.record
core.entity
core.block
```

Plugin 本身仍是普通 `Record.data`。Block 只承载 Records，没有独立 Plugin release / S0 数据通路。

## 当前 Plugin artifact 原则

Plugin descriptor 通过 `files[]` 的 `path + size + FileHash` 承诺 exact executable artifact，并由 `PluginHash` 形成稳定 identity。

Plugin 可以可选携带完整 embedded artifact：

```text
Record.data = Plugin
Plugin.artifact? = { canonicalPath: canonicalBase64Bytes }
```

相同 executable bytes 无论链内 embed、来自本地 cache，还是由外部 resolver 取得，都验证为同一个 PluginHash。

小型、必要的 Plugin 优先把完整 artifact 随 Record 上链。MVP Genesis 中解释链所需的 Core Plugins 应自包含 executable artifact，使节点不依赖独立 Plugin registry 即可启动。

大型模型、图片、数据集、地图、词典、资源包等静态内容应优先拆为更高层 Asset/Runtime 资源。构建工具应在 executable artifact 大约超过 500 KiB 时给 warning；该阈值不属于 Core validity。

## 当前 Record 原则

Record 是通用事实容器，同时记录协议来源与主体来源：

```text
plugin / pluginHash -> 哪个链上协议产生/签发这条 Record
createdBy / signature -> 哪个 Entity 对这条 Record 负责并确认
```

`pluginHash` 是 runner/runtime 使用的机器权威 identity；`plugin = name@version` 是被作者一并签名确认的人类可读声明。

RecordId 当前定义为：

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

RawRecord 包含 `plugin / pluginHash / createdBy / createdAt / data`。RecordId 承诺完整 `data`，普通 Record signature 使用 domain-separated Ed25519 signature over RecordId。

`core.record` 不 resolve 或执行 Plugin。runtime/composition layer 根据 `pluginHash` 加载 exact Plugin，并由具体 Plugin 执行协议规则。

## 文档地图

### [`source-baseline.md`](source-baseline.md)

只记录原始 `blockchain-service` 能够直接证明的内容，包括旧 Protocol/Record/Entity/Block 数据结构、RecordId/ProtocolHash/Merkle、BlockHeader 验签、Genesis 构造，以及普通 Record signing payload 的 source gap。

### [`architecture.md`](architecture.md)

记录当前 Core 总体边界：

- `Plugin / Record / Entity / Block` 的最小组合关系；
- Plugin 是 `Record.data`；
- embedded artifact 与 external artifact 使用同一个 content identity；
- executable artifact 与大型 Asset 分层；
- Record 的协议来源/主体来源与 JCS RecordId；
- Genesis 继续是 Block；
- Runtime/Repo/Labour/Board/Flow 与 Core 的边界。

### [`plugin.md`](plugin.md)

定义 `core.plugin` 当前模型：

- Protocol → executable Plugin 的必要迁移；
- runtime / schema / exact dependencies / files；
- FileHash / PluginHash / JCS canonicalization；
- optional embedded artifact；
- Base64/size/FileHash verification；
- 约 500 KiB 的 tooling warning；
- 大型内容拆 Asset；
- MVP Core bootstrap 不依赖 Plugin registry。

### [`record.md`](record.md)

定义 `core.record` 当前模型：

- RawRecord / Record；
- `plugin/pluginHash` 协议来源；
- `createdBy/signature` 主体来源；
- `RecordId = DoubleSHA256(JCS(RawRecord))`；
- 完整 `data` 参与 fact identity；
- base58btc Ed25519 `createdBy`；
- domain-separated Record signature；
- `core.record` 与 Plugin runtime/composition 的边界。

### [`block.md`](block.md)

当前只保留 Block/BlockHeader 的 source-aligned review gate。具体 Block identity、签名与验证规则仍需后续审查。

### [`genesis.md`](genesis.md)

保留 `Genesis = Block`、`Plugin = Record.data` 的结构，并规定 MVP Core bootstrap Plugin Records 携带完整 embedded artifact。普通 Record contract 已固定；历史 bootstrap RecordId/createdBy/signature 特例是否继续保留仍待 Genesis/Block review。

### [`ordering.md`](ordering.md)

只冻结 Block confirmation、业务关系和 runtime arrival order 的分离。Plugin availability/resolution 属于 runtime/Block composition，不进入 `core.record` 的通用 primitive。

## Spec 与实现

[`spec/`](../spec/README.md) 是从已审查 docs 投影出的实现规格。Spec 不得自行补充设计。

当前：

- `core.plugin` 已实现；
- `core.record` 当前设计已完成，进入实现；
- `core.block` 与 Genesis 的部分 bootstrap 规则仍处于 source-first review gate；
- `core.entity` 按其独立 spec 审查/实现。
