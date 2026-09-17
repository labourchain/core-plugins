# LabourChain Core Documentation

本目录维护 Core 的历史事实、当前需求与架构，以及进入实现前仍需审查的设计边界。

## 文档中的三种信息

- **Source Fact**：可以直接从原始 `Ri0n72Y/blockchain-service` 的 CUE、Go model/handler/script/test 等材料中确认；
- **Current Design**：当前已经接受、实现必须遵守的 LabourChain 需求与架构；
- **Open Question**：尚未进入实现规格的未决问题。

`blockchain-service` 是旧 Protocol 模型与行为的历史事实来源。Current Design 可以明确替代旧结构，但必须保留旧行为的来源记录，不能把新设计描述成旧事实。

## 当前 Core

```text
core.protocol
core.record
core.entity
core.block
```

Protocol 与 Entity 数据仍通过普通 `Record.data` 进入链；Block 只承载 Records，没有独立 Protocol release / S0 数据通路。

LabourChain 使用 **Protocol** 表示链上稳定、版本化、可被历史事实引用的语义与 executable identity；**Plugin** 保留给 Cordis runtime abstraction。二者不能作为同义词使用。

## 当前 Protocol 原则

Protocol 是小型可执行协议单元。当前 `core.protocol` 直接承诺一个 exact executable artifact：

```text
ArtifactHash = DoubleSHA256(exact gzip artifact bytes)
```

ProtocolHash 承诺 `name / version / runtime / dependencies / artifactHash`。可选 `artifact` 只是 exact gzip bytes 的 canonical Base64 链内承载，不进入 ProtocolHash。

`js-esm` ABI v1 只有一个 gzip executable artifact，因此没有 `runtime.entry`、`files[]`、FileHash manifest 或 runtime schema file。历史 CUE 只作为 Source Fact 保留。

节点当前验证顺序：

```text
resolve exact artifact bytes
-> verify ArtifactHash / ProtocolHash
-> bounded gunzip (<= 1 MiB)
-> import ESM
```

1 MiB 是解压后 runtime hard limit，也是 Protocol 工程边界；超过该规模应优先拆 Protocol 或把非执行内容移入 Asset / Runtime。约 500 KiB compressed artifact 只属于 Dev SDK/build tooling warning，不是 Core validity。

构建、bundle、gzip、reproducible build 属于 Protocol Dev SDK #23 的后续工作。当前 Core 发行先使用 GitHub Releases：raw gzip artifact 与 descriptor/manifest 作为 release assets，GitHub 只是分发渠道，不参与 Protocol validity。

`docs/`、`spec/`、tests 与历史材料不进入 runtime package 或链上 Protocol artifact。

## 当前 Record 原则

Record 是通用事实容器：

```text
protocol / protocolHash -> 协议来源
createdBy / signature   -> 主体来源
```

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

RawRecord 包含 `protocol / protocolHash / createdBy / createdAt / data`。普通 Record signature 使用 domain-separated Ed25519 signature over RecordId。

`core.record` 不 resolve 或执行 Protocol。runtime/composition 根据 `protocolHash` 解析 exact Protocol implementation。

## 当前 Entity 原则

`core.entity` 只定义链级 public-key identity data 与共享 `EntityPublicKey`：

```text
Entity {
  publicKey
  introducedBy?
}
```

Core 不维护 Entity registry。首次注册、初始例外、重复注册、准入以及身份上链流程属于 Repo 包/composition layer。

## 当前 Block 原则

ordinary `core.block` contract：

```text
Block
├── header: BlockHeader
└── records: ordered Record[]
```

历史 Merkle odd-leaf duplication 会造成：

```text
recordsRoot([A,B,C]) == recordsRoot([A,B,C,C])
```

因此同一 Block 内 duplicate RecordId 被禁止。该规则只保证 confirmation container commitment 唯一，不承担业务 DAG 语义。

## 文档地图

### [`source-baseline.md`](source-baseline.md)

记录旧 `blockchain-service` 可直接证明的 Protocol/Record/Entity/Block、hash/signature/Genesis 等 Source Facts。

### [`architecture.md`](architecture.md)

记录 Core 总体边界与 Protocol / Record / Entity / Block 的组合关系。

### [`protocol.md`](protocol.md)

定义单 artifact Protocol model、ArtifactHash / ProtocolHash、embedded artifact、最小 runtime verification API、size 与 SDK/distribution boundary。

### [`runtime-abi.md`](runtime-abi.md)

定义当前 `js-esm` ABI v1、gzip executable artifact、1 MiB bounded gunzip 与 Core build/runtime boundary。Protocol implementation 与 Cordis Plugin runtime 的进一步对齐由 #31 单独审查。

### [`release.md`](release.md)

定义当前 GitHub Release-only 发行流程、release assets、tag/version 规则、固定发行构建环境、identity regression gate 与 npm 延后边界。

### [`record.md`](record.md)

定义 RawRecord / Record、JCS RecordId、EntityPublicKey `createdBy` 与 domain-separated signature。

### [`block.md`](block.md)

定义 ordinary Block confirmation contract：recordsRoot、duplicate RecordId rule、BlockId、packer confirmation 与 `verifyBlock`。

### [`genesis.md`](genesis.md)

规定 `Genesis = Block`、`Protocol = Record.data`，复用 ordinary Record/Block identity/signature，并要求 MVP Core Protocol Records 携带完整 embedded artifact。

### [`ordering.md`](ordering.md)

冻结 Block confirmation、业务关系和 runtime arrival order 的分离。

## Spec 与实现

[`spec/`](../spec/README.md) 是从已审查 docs 投影出的实现规格。Spec 不得自行补充设计。

当前：

- `core.protocol` 单 artifact identity/runtime-verification contract 已由 #22 的实现基础重新命名；
- `core.record` 已实现；
- `core.entity` 已实现；
- ordinary `core.block` confirmation primitives 已实现；
- `js-esm` ABI v1 / bounded gzip artifact packaging 已实现；
- Protocol Dev SDK 由 #23 延后到 Core/Repo 边界完成后；
- GitHub Release-only release/distribution 由 #24 收敛；
- Protocol/Cordis runtime contract 由 #31 在 v0.1.0 前独立审查；
- Genesis #10 只继续收敛 deterministic assembly/fixture，不重新打开 ordinary Record/Block identity rules。
