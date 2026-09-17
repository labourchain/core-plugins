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

## 当前 Core Protocol 集合

```text
core.protocol
core.record
core.entity
core.block
```

`BlockHeader` 是 `core.block` 的公开类型，不存在独立 `core.block-header` Protocol/spec。

LabourChain 的 **Protocol** 是链上稳定、版本化的语义与 identity；**Plugin** 保留给 Cordis runtime abstraction。Spec 不得把两者重新合并成一个术语。

## 当前规格状态

- [`core-protocol.md`](core-protocol.md) — 单 artifact Protocol data、ArtifactHash / ProtocolHash、strict chain-data validation、embedded/external artifact verification；
- [`core-runtime-abi.md`](core-runtime-abi.md) — 当前 `js-esm` ABI v1、single gzip executable artifact、1 MiB bounded gunzip 与 Core artifact build profile；
- [`release.md`](release.md) — GitHub Release-only 发行资产、tag/version gate、release build pin 与 npm 延后边界；
- [`core-record.md`](core-record.md) — ordinary Record primitive：JCS RecordId、Protocol 来源、EntityPublicKey 作者确认与 signature verification；
- [`core-entity.md`](core-entity.md) — Entity identity data 与共享 EntityPublicKey primitive；
- [`core-block.md`](core-block.md) — ordinary Block confirmation primitives：recordsRoot、BlockId、packer confirmation 与 `verifyBlock`；
- [`genesis.md`](genesis.md) — `Genesis = Block` baseline；MVP Core Protocol Records 携带 embedded artifact；
- [`ordering.md`](ordering.md) — Block confirmation、业务关系和 runtime arrival order 分离。

## Protocol artifact contract

```text
exact gzip artifact bytes
  -> DoubleSHA256
  -> ArtifactHash

Protocol identity
  = name / version / runtime / dependencies / artifactHash
  -> JCS
  -> DoubleSHA256
  -> ProtocolHash
```

Optional embedded artifact：

```text
artifact?: canonicalBase64(exact gzip artifact bytes)
```

`artifact` 不进入 ProtocolHash；embedded/cache/mirror/other resolver 取得的相同 bytes 验证为同一个 Protocol。

当前 `js-esm` ABI v1 只有一个 executable artifact，因此不再存在 `runtime.entry`、`files[]`、FileHash manifest 或 runtime schema file。

历史 CUE 仅作为 Source Fact 保留，不是当前 runtime schema。

## Runtime verification API

`core.protocol` 公开 API：

```text
ProtocolError
validateProtocol
artifactHash
protocolHash
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

1 MiB 既防 gzip-bomb 类异常展开，也约束单 Protocol implementation 规模。超过该规模应优先拆 Protocol 或将非执行内容移到 Asset / Runtime。

## Release contract

当前 `package.json.version` 是四个 Core Protocol 的统一 release version。构建输出每个 Protocol 的 versioned descriptor JSON 与 raw `.js-esm.gz`，并生成 `manifest.json`；`pnpm check` 必须从磁盘重新验证这些 release assets。

GitHub Release 仅作为分发渠道。tag 必须使用 `vMAJOR.MINOR.PATCH` 并与 generated manifest version 一致；Release job 固定当前 canonical build toolchain，创建 draft、上传完整资产后才发布。npm publishing 当前禁止。

## Record contract

```text
RawRecord = protocol / protocolHash / createdBy / createdAt / data
Record    = id / signature + RawRecord
RecordId  = DoubleSHA256(JCS(RawRecord))
```

`protocolHash` 是 runtime/composition 的机器权威 identity；`protocol = name@version` 是被签名的人类可读声明。

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

Protocol artifact 只包含运行 Protocol implementation 所需的代码与必要小型 runtime data。大型模型、图片、视频、地图、词典、数据集、游戏资源包等内容应由更高层 Asset / Runtime 提供。

`core.protocol` 不依赖 Asset，也不定义 AssetId。

## Identity / encoding boundary

```text
Entity public key -> base58btc 32-byte Ed25519 identity
Signature         -> signature result, not Entity identity
RecordId          -> DoubleSHA256(JCS(RawRecord)), lowercase hex
ArtifactHash      -> DoubleSHA256(exact gzip artifact bytes), lowercase hex
ProtocolHash      -> DoubleSHA256(JCS(canonical Protocol identity)), lowercase hex
RecordsRoot       -> ordered RecordId Merkle root, duplicate RecordIds forbidden
BlockId           -> DoubleSHA256(JCS(unsigned BlockHeader)), lowercase hex
```

## Runtime/composition boundary

runtime/composition layer 负责：

```text
process / Cordis Context
Protocol resolution by protocolHash
verify exact gzip artifact bytes
bounded gunzip / module loading
Cordis Plugin mounting / lifecycle
Protocol artifact cache / external fetch
Asset fetch/storage
persistence / transport / sync
secret-key storage / signing UX
Entity registration/admission policy
PoA authorization
sandbox/capability policy
observability
```

当前 ABI 只冻结已经实现的 artifact/load boundary；Protocol implementation 与 Cordis Plugin contract、`dependencies[]` 与 Cordis `inject` 的最终关系必须在后续 review 中显式确定。

## Deferred work

- #22 的 single-artifact identity/runtime-verification 基础已完成，#29 恢复其 Protocol 命名；
- #23 Protocol Dev SDK 延后到 Core/Repo package boundaries 完成后；
- #24 GitHub Release-only release/distribution flow 已收敛；
- Protocol/Cordis runtime alignment 在 v0.1.0 前继续审查；
- #10 finalizes Genesis after Protocol identities are stable.
