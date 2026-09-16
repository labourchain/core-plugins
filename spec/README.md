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

- [`core-plugin.md`](core-plugin.md) — 已定义并实现的 Plugin data、FileHash/PluginHash、strict chain-data validation、exact artifact verification、optional embedded artifact；
- [`core-record.md`](core-record.md) — 已定义并实现 ordinary Record primitive：JCS RecordId、协议来源、EntityPublicKey 作者确认与 signature verification；
- [`core-entity.md`](core-entity.md) — 已定义并实现 Entity identity data 与共享 EntityPublicKey primitive；注册/准入流程属于 Repo 包；
- [`core-block.md`](core-block.md) — 已定义并实现 ordinary Block confirmation primitives：recordsRoot、BlockId、packer confirmation 与 `verifyBlock`；
- [`genesis.md`](genesis.md) — `Genesis = Block` migration baseline，MVP Core Plugin Records 需要 embedded artifact，bootstrap identity/signature 特例仍待 review；
- [`ordering.md`](ordering.md) — Block confirmation、业务关系和 runtime arrival order 分离。

## Plugin artifact contract

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

`artifact` 是存储方式，不进入 canonical Plugin identity。因此 embedded/external/local-cache bytes 只要内容相同，都验证为同一个 PluginHash。

MVP 初始 Core Plugins 应把完整 executable artifact 随 Genesis Plugin Records 上链，从而不需要先建立 npm-style Plugin registry。

## Record contract

```text
RawRecord
= plugin / pluginHash / createdBy / createdAt / data

Record
= id / signature + RawRecord
```

```text
plugin / pluginHash -> protocol source
createdBy / signature -> actor source
```

`pluginHash` 是 runner/runtime 使用的机器权威 identity；`plugin = name@version` 是被签名的人类可读声明。

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

RecordId 承诺完整 RawRecord，包括完整 `data`。普通 signature 使用固定 domain-separated Ed25519 signature over RecordId。

`core.record` 不 resolve/execute Plugin，不包含 activation、Block availability、Entity registration state 或 Genesis exception。

## Entity boundary

```text
Entity {
  publicKey
  introducedBy?
}
```

`core.entity` 负责 EntityPublicKey 的 Base58btc / 32-byte Ed25519 表示验证，以及 Entity data 的 exact shape。

首次/重复注册、初始例外、准入与身份上链流程属于 Repo 包/composition layer。Core 的 `Record.createdBy` / `BlockHeader.packer` 验证并不自行证明该 identity 已被 Repo 注册或授权。

## Block contract

ordinary Block 保留历史 ordered RecordId Merkle 算法，并从 unsigned Header 派生 BlockId。

由于历史 odd-leaf duplication 存在：

```text
recordsRoot([A,B,C]) == recordsRoot([A,B,C,C])
```

`core.block@0.1.0` 禁止同一 Block 中 duplicate RecordId；`recordsRoot(recordIds)` 与 `verifyBlock(block)` 都拒绝重复值。

实现提供：

```text
recordsRoot(recordIds)
blockId(rawHeader | header)
blockSigningPayload(blockId)
verifyHeader(header)
verifyBlock(block)
```

该规则只保护 confirmation-container commitment，不引入业务 DAG、Plugin activation 或 Repo registration state。

## Artifact / Asset boundary

Plugin artifact 只包含运行 Plugin 本身所需的代码、schema 与必要小型 runtime data。

大型模型、图片、视频、地图、词典、数据集、游戏资源包等内容应优先由更高层 Asset/Runtime 机制提供。

`core.plugin` 不依赖 Asset，也不定义 AssetId。

Build tooling 的约 500 KiB warning 是 docs 中的工程建议，不属于 consensus validity，也不要求 Core validator 实现该阈值。

## Identity / encoding boundary

```text
Entity public key -> base58btc 32-byte Ed25519 identity defined by core.entity
Signature         -> signature result, not Entity identity
RecordId          -> DoubleSHA256(JCS(RawRecord)), lowercase hex
FileHash          -> DoubleSHA256(raw bytes), lowercase hex
PluginHash        -> DoubleSHA256(canonical Plugin identity), lowercase hex
RecordsRoot       -> ordered RecordId Merkle root, duplicate RecordIds forbidden
BlockId           -> DoubleSHA256(JCS(unsigned BlockHeader)), lowercase hex
```

## Runner/server boundary

runner/server 与 composition layer 负责：

```text
process / Cordis Context
Plugin resolution by pluginHash
Plugin execution
Plugin artifact cache
optional external Plugin artifact fetch
Asset fetch/storage
persistence
transport/sync
secret-key storage / signing UX
Entity registration/admission policy through Repo package
PoA authorization
sandbox/capability policy
observability
```

Core specs 只规定相同显式输入下的确定性数据/验证行为。
