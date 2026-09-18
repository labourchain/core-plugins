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

LabourChain 的 **Protocol** 是链上稳定、版本化的语义与 exact executable identity；**Plugin** 保留给 Cordis runtime abstraction。Spec 不得把两者重新合并成一个术语。

## 当前规格状态

- [`core-protocol.md`](core-protocol.md) — 单 artifact Protocol data、ArtifactHash / ProtocolHash、strict chain-data validation、embedded/external artifact verification，以及明确排除 Cordis-aware dependency projection；
- [`core-runtime-abi.md`](core-runtime-abi.md) — 已实现的 `cordis-js-esm` ABI v1、ready-to-mount Cordis object Plugin、canonical service、链上 dependency 到 runtime inject 的单向投影、Plugin lifecycle、Host execution boundary 与 1 MiB bounded gunzip；
- [`release.md`](release.md) — `.cordis-js-esm.gz` GitHub Release-only 发行资产、tag/version gate、runtime verification、identity regression gate 与 npm 延后边界；
- [`core-record.md`](core-record.md) — ordinary Record primitive：JCS RecordId、Protocol 来源、EntityPublicKey 作者确认与 signature verification；
- [`core-entity.md`](core-entity.md) — Entity identity data 与共享 EntityPublicKey primitive；
- [`core-block.md`](core-block.md) — ordinary Block confirmation primitives：recordsRoot、BlockId、packer confirmation 与 `verifyBlock`；
- [`genesis.md`](genesis.md) — `Genesis = Block`，复用 ordinary Record/Block identity/signature，MVP Core Protocol Records 携带 embedded artifact；
- [`ordering.md`](ordering.md) — Block confirmation、业务关系和 runtime arrival order 分离。

## Protocol artifact contract

```text
runtime.kind = "cordis-js-esm"
runtime.abi = 1

exact gzip Cordis Plugin artifact bytes
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

`artifact` 不进入 ProtocolHash；embedded/cache/release/mirror 取得的相同 bytes 验证为同一个 Protocol。

ABI v1 只有一个 executable artifact，解压后 ESM namespace 只允许：

```text
plugin
```

其最小 runtime contract：

```text
plugin.name    = <name>@<version>
plugin.provide = protocol:<name>@<version>
plugin.inject  = Cordis Inject
plugin.apply   = callable
```

`apply()` 使用 `ctx.provide()` 实际提供同一个 canonical Protocol service。artifact 不额外导出纯 API namespace，也不 bundle 第二份 Cordis runtime。

Executable runtime metadata 属于 artifact bytes，因此通过 `artifactHash` 参与 ProtocolHash；只有链级 Protocol 依赖额外写入结构化 `Protocol.dependencies[]`。

## Dependency validation boundary

`Protocol.dependencies[]` 只记录链上的 exact Protocol dependency：

```text
name + version + ProtocolHash
```

`core.protocol` 只验证它作为 Protocol data/identity input 的：

```text
shape / name / exact SemVer / digest / uniqueness / canonical order
```

它不导入 artifact，不读取 `plugin.inject`，也不验证 dependency projection。

`dependencies[]` 到 runtime inject 的单向 inclusion 规则由 `core-runtime-abi.md` 定义，并由两个边界验证：

```text
Protocol Dev SDK
Repo Node / Host loader
```

当前 Core artifact build/release 不调用通用 projection validator；该 helper 独立保留供后续 SDK/Repo 使用。

Host 另外按 `protocolHash` 解析并验证 exact dependency implementation。`plugin.inject` 还可以包含 DSH、agent loop、storage、logger 等不上链 runtime dependencies；这些不成为 `ProtocolDependency` entries。

## Runtime verification API

`core.protocol` 公开 API 保持：

```text
ProtocolError
validateProtocol
artifactHash
protocolHash
verifyArtifact
verifyEmbeddedArtifact
```

JCS serialization、canonical identity construction、Cordis Plugin validation、Inject normalization、dependency projection、sandboxing 与 build/package helpers 必须保持在 `core.protocol` 之外。

## Runtime size boundary

```text
compressed artifact > ~500 KiB
-> build/Dev SDK warning only

uncompressed cordis-js-esm runtime > 1 MiB
-> ABI v1 hard reject before ESM evaluation/import
```

1 MiB 既防 gzip-bomb 类异常展开，也约束单 Protocol implementation 规模。超过该规模应优先拆 Protocol 或将非执行内容移到 Asset / Runtime。

## Release contract

当前 `package.json.version` 是四个 Core Protocol 的统一 release version。构建输出每个 Protocol 的 versioned descriptor JSON 与：

```text
<protocol>-<version>.cordis-js-esm.gz
```

并生成 `manifest.json`。`pnpm check` 必须从磁盘重新验证 exact nine-file release set、canonical filenames、descriptor/manifest/actual diagnostics、runtime Plugin contract、actual Cordis mount、Plugin Fiber disposal 后 service 撤销与 frozen Core ProtocolHash fixtures。

GitHub Release 仅作为分发渠道。tag 必须使用 `vMAJOR.MINOR.PATCH` 并与 generated manifest version 一致；Release job 固定当前 canonical build toolchain，先验证 tag commit 属于 `main`，再安装项目依赖，创建 draft、上传完整资产后才发布。npm publishing 当前禁止。

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

## Genesis contract

Genesis 复用普通 Core primitive：

```text
Genesis = ordinary Block
Genesis.records[] = ordinary Record[]
previousBlock = "0"
```

初始 Core Protocol Records 使用 ordinary RecordId / EntityPublicKey / author signature；Genesis Header 使用 ordinary RecordsRoot / BlockId / packer signature。#10 剩余工作只收敛 deterministic assembly input/output 与是否需要 fixture/helper。

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
process / Host Cordis Context
Protocol resolution by ProtocolHash
verify exact gzip artifact bytes through core.protocol
bounded gunzip
sandbox/capability execution boundary before ESM evaluation
ESM materialization/evaluation/import inside that boundary
Cordis Plugin contract validation
chain dependency inclusion validation
exact dependency ProtocolHash resolution
ctx.plugin(plugin) / Cordis lifecycle
Protocol artifact cache / external fetch
Asset fetch/storage
persistence / transport / sync
secret-key storage / signing UX
Entity registration/admission policy
PoA authorization
observability
```

它不重新 build、install 或 rebundle 已验证的 Protocol artifact，也不建立第二套 Plugin Manager/Runner/Service Container。

## Deferred work

- #22 的 single-artifact identity/runtime-verification 基础已完成，#29 恢复其 Protocol 命名；
- #31 Protocol/Cordis runtime alignment 已完成并形成当前 `cordis-js-esm` ABI v1；
- #23 Protocol Dev SDK 仍延后，并明确承担 developer-side Cordis runtime/dependency validation；
- #24 GitHub Release-only release/distribution flow 已收敛；
- #10 只收敛 deterministic Genesis assembly/fixture details，不重新打开 ordinary Core identity rules。
