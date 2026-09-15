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
createdBy / signature -> 哪个 EntityPublicKey 对这条 Record 负责并确认
```

`pluginHash` 是 runner/runtime 使用的机器权威 identity；`plugin = name@version` 是被作者一并签名确认的人类可读声明。

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

RawRecord 包含 `plugin / pluginHash / createdBy / createdAt / data`。RecordId 承诺完整 `data`，普通 Record signature 使用 domain-separated Ed25519 signature over RecordId。

`core.record` 不 resolve 或执行 Plugin。runtime/composition 根据 `pluginHash` 加载 exact Plugin，并由具体 Plugin 执行协议规则。

## 当前 Entity 原则

`core.entity` 只定义链级 public-key identity data 与共享 `EntityPublicKey` 表示：

```text
Entity {
  publicKey
  introducedBy?
}
```

Core 不维护 Entity registry。首次注册、初始例外、重复注册、准入以及身份上链流程属于 Repo 包/composition layer。

`Record.createdBy` 与未来 `BlockHeader.packer` 只在 Core 层验证 EntityPublicKey 表示和对应密码学签名；是否已被 Repo 注册/授权属于外部状态。

## 当前 Block 原则

ordinary `core.block` contract 已完成 review：

```text
Block
├── header: BlockHeader
└── records: ordered Record[]
```

历史 Merkle 算法继续保留，但 odd-leaf duplication 会造成：

```text
recordsRoot([A,B,C]) == recordsRoot([A,B,C,C])
```

因此同一 Block 内 duplicate RecordId 被禁止。该规则只保证 confirmation container commitment 唯一，不承担业务 DAG 语义。

BlockId、Header signing 与 `verifyBlock` 边界见 [`block.md`](block.md) / `../spec/core-block.md`。Genesis bootstrap 例外仍由独立 review 处理。

## 文档地图

### [`source-baseline.md`](source-baseline.md)

只记录原始 `blockchain-service` 能够直接证明的内容，包括旧 Protocol/Record/Entity/Block 数据结构、RecordId/ProtocolHash/Merkle、BlockHeader 验签、Genesis 构造，以及普通 Record signing payload 的 source gap。

### [`architecture.md`](architecture.md)

记录当前 Core 总体边界：Plugin / Record / Entity / Block 的最小组合关系、artifact/Asset 分层、Record identity、Genesis、Runtime/Repo/Labour 与 Core 的边界。

### [`plugin.md`](plugin.md)

定义 `core.plugin` 当前模型：runtime / schema / exact dependencies / files、FileHash / PluginHash / JCS、optional embedded artifact、artifact verification、bundle-size guidance 与 Asset boundary。

### [`record.md`](record.md)

定义 `core.record` 当前模型：RawRecord / Record、协议来源/主体来源、JCS RecordId、完整 `data`、EntityPublicKey `createdBy`、domain-separated signature 与 runtime boundary。

### [`block.md`](block.md)

定义已审查的 ordinary Block confirmation contract：recordsRoot、duplicate RecordId integrity rule、BlockId、packer confirmation、ordering 与 `verifyBlock` boundary。

### [`genesis.md`](genesis.md)

保留 `Genesis = Block`、`Plugin = Record.data` 的结构，并规定 MVP Core bootstrap Plugin Records 携带完整 embedded artifact。历史 bootstrap identity/signature 例外仍待独立 review。

### [`ordering.md`](ordering.md)

冻结 Block confirmation、业务关系和 runtime arrival order 的分离。Plugin availability/resolution 与 Repo registration policy 都不进入通用 Record/Block primitive。

## Spec 与实现

[`spec/`](../spec/README.md) 是从已审查 docs 投影出的实现规格。Spec 不得自行补充设计。

当前：

- `core.plugin` 已实现；
- `core.record` 已实现；
- `core.entity` 已实现；
- ordinary `core.block` contract 已完成 review，issue #9 implementation-ready；
- Genesis bootstrap 例外仍待独立 review。
