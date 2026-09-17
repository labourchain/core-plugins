# LabourChain Core Specifications

`spec/` 是从已审查 `docs/` 投影出的开发规格。

```text
Ri0n72Y/blockchain-service -> historical Source Facts
docs/                     -> current requirements + architecture
spec/                     -> implementation projection
implementation + tests
```

`spec/` 不反向改写 `docs/`，也不替代旧 `blockchain-service` 对历史行为的事实记录。

## 实现纪律

如果 spec 标记行为为 blocker/open/pending review，不得为了跑通自行选择语义；应回到 docs 完成设计决策后再更新 spec。

## 当前 Core Plugin 集合

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` 是 `core.block` 的公开类型，不存在独立 `core.block-header` Plugin/spec。

## 当前规格状态

- [`core-plugin.md`](core-plugin.md) — 单 artifact Plugin data、ArtifactHash / PluginHash、strict chain-data validation、embedded/external artifact verification；
- [`core-runtime-abi.md`](core-runtime-abi.md) — `js-esm` ABI v1、single gzip executable artifact、1 MiB bounded gunzip 与 Core artifact build profile；
- [`core-record.md`](core-record.md) — ordinary Record primitive：JCS RecordId、协议来源、EntityPublicKey 作者确认与 signature verification；
- [`core-entity.md`](core-entity.md) — Entity identity data 与共享 EntityPublicKey primitive；
- [`core-block.md`](core-block.md) — ordinary Block confirmation primitives：recordsRoot、BlockId、packer confirmation 与 `verifyBlock`；
- [`genesis.md`](genesis.md) — `Genesis = Block` baseline；MVP Core Plugin Records 携带 embedded artifact；
- [`ordering.md`](ordering.md) — Block confirmation、业务关系和 runtime arrival order 分离。

## Plugin artifact contract

```text
exact gzip artifact bytes
  -> DoubleSHA256
  -> ArtifactHash

Plugin identity
  = name / version / runtime / dependencies / artifactHash
  -> JCS
  -> DoubleSHA256
  -> PluginHash
```

Optional embedded artifact：

```text
artifact?: canonicalBase64(exact gzip artifact bytes)
```

`artifact` 不进入 PluginHash；embedded/cache/mirror/other resolver 取得的相同 bytes 验证为同一个 Plugin。

`js-esm` ABI v1 只有一个 executable artifact，因此不再存在 `runtime.entry`、`files[]`、`PluginFile`、FileHash manifest 或 runtime schema file。

历史 CUE 仅作为 Source Fact 保留，不是当前 runtime schema。

## Runtime verification API

`core.plugin` 公开 API：

```text
PluginError
validatePlugin
artifactHash
pluginHash
verifyArtifact
verifyEmbeddedArtifact
```

JCS serialization、canonical identity construction 与 build/package helpers 必须保持 internal。

## Runtime size boundary

```text
compressed artifact > ~500 KiB
-> build/Dev SDK warning only

uncompressed js-esm runtime > 1 MiB
-> ABI v1 hard reject before import
```

1 MiB 既防 gzip-bomb 类异常展开，也约束单 Plugin 规模。超过该规模应优先拆 Plugin 或将非执行内容移到 Asset / Runtime。

## Record contract

```text
RawRecord = plugin / pluginHash / createdBy / createdAt / data
Record    = id / signature + RawRecord
RecordId  = DoubleSHA256(JCS(RawRecord))
```

`pluginHash` 是 runner/runtime 的机器权威 identity；`plugin = name@version` 是被签名的人类可读声明。

## Entity boundary

```text
Entity {
  publicKey
  introducedBy?
}
```

首次/重复注册、初始例外、准入与身份上链流程属于 Repo/composition layer。

## Block contract

ordinary Block 保留 ordered RecordId Merkle 算法。由于 odd-leaf duplication：

```text
recordsRoot([A,B,C]) == recordsRoot([A,B,C,C])
```

因此同一 Block 禁止 duplicate RecordId。

## Artifact / Asset boundary

Plugin artifact 只包含运行 Plugin 本身所需的代码与必要小型 runtime data。大型模型、图片、视频、地图、词典、数据集、游戏资源包等内容应由更高层 Asset / Runtime 提供。

`core.plugin` 不依赖 Asset，也不定义 AssetId。

## Identity / encoding boundary

```text
Entity public key -> base58btc 32-byte Ed25519 identity
Signature         -> signature result, not Entity identity
RecordId          -> DoubleSHA256(JCS(RawRecord)), lowercase hex
ArtifactHash      -> DoubleSHA256(exact gzip artifact bytes), lowercase hex
PluginHash        -> DoubleSHA256(JCS(canonical Plugin identity)), lowercase hex
RecordsRoot       -> ordered RecordId Merkle root, duplicate RecordIds forbidden
BlockId           -> DoubleSHA256(JCS(unsigned BlockHeader)), lowercase hex
```

## Runner/server boundary

runner/server 与 composition layer 负责：

```text
process / Cordis Context
Plugin resolution by pluginHash
verify exact gzip artifact bytes
bounded gunzip / Plugin execution
Plugin artifact cache / external fetch
Asset fetch/storage
persistence / transport / sync
secret-key storage / signing UX
Entity registration/admission policy
PoA authorization
sandbox/capability policy
observability
```

## Deferred work

- #22 slim `core.plugin` runtime contract 已完成；
- #23 defines Plugin Dev SDK build/bundle/gzip/reproducible-build tooling;
- #24 defines release/distribution/discovery channels;
- #10 finalizes Genesis after Plugin identities are stable.
