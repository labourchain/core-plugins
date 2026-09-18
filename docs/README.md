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

Protocol 是小型可执行协议单元。当前 runtime 为：

```text
runtime.kind = "cordis-js-esm"
runtime.abi = 1
```

一个 Protocol 对应一个已经构建完成的 gzip Cordis Plugin ESM bundle。ESM 明确导出唯一 runtime entry：

```text
plugin
```

其 runtime contract 显式声明：

```text
plugin.name = <name>@<version>
plugin.provide = protocol:<name>@<version>
plugin.inject = Cordis runtime dependencies
plugin.apply = callable
```

`plugin.provide` 是 Cordis metadata 声明，`apply()` 中使用 `ctx.provide()` 实际注册 canonical Protocol service。

release artifact filename 固定为：

```text
<protocol>-<version>.cordis-js-esm.gz
```

Node 获取 exact artifact 后执行：

```text
verify ArtifactHash / ProtocolHash
-> bounded gunzip (<= 1 MiB)
-> establish sandbox/capability execution boundary
-> evaluate/import ESM inside that boundary
-> validate explicit `plugin`
-> validate Protocol dependency consistency
-> resolve exact Protocol dependencies
-> ctx.plugin(plugin)
```

Node 不负责从源码重新 build、transpile、npm install 或 rebundle Protocol。Artifact identity verification 不替代代码执行隔离；具体 sandbox/capability 机制属于 Repo runtime。

```text
ArtifactHash = DoubleSHA256(exact final gzip artifact bytes)
```

ProtocolHash 的 canonical input 是 `name / version / runtime / dependencies / artifactHash`。可选 `artifact` 只是 exact gzip bytes 的 canonical Base64 链内承载，不进入 ProtocolHash。

Executable 内的 runtime metadata（包括非 Protocol 的 runtime-only inject）属于 artifact bytes，因此通过 `artifactHash` 参与 ProtocolHash；它们不因此成为独立的 `ProtocolDependency` 字段。

“ready-to-mount executable”与“bytes 是否 embedded on-chain”是两个不同维度。初始 Core Protocols 为 bootstrap 自包含而 embedded；普通 Protocol 可以通过 cache/release/mirror 获取同一 exact artifact，但 Node 始终加载已构建的 artifact，不现场生成另一份 executable。

链上 `Protocol.dependencies[]` 只记录其他链上 Protocol 依赖；`plugin.inject` 则描述 Plugin 的全部 runtime dependencies，因此还可以包含 DSH、agent loop 等不上链公共设施。Protocol Dev SDK 与 Repo Node/Host loader 只验证每个链上 dependency 在 runtime inject 中有对应 service；完整规则见 `runtime-abi.md`。当前 Core artifact build/release 不调用该通用 helper，`core.protocol` 只验证 `dependencies[]` 的链上数据与 identity 结构。

Protocol artifact 不通过任意 ESM exports 暴露 API，也不 bundle 第二份 Cordis runtime。

1 MiB 是解压后 runtime hard limit，也是 Protocol 工程边界；超过该规模应优先拆 Protocol 或把非执行内容移入 Asset / Runtime。约 500 KiB compressed artifact 只属于 Dev SDK/build tooling warning，不是 Core validity。

构建、bundle、gzip、reproducible build 属于 Protocol Dev SDK #23。当前 Core 发行使用 GitHub Releases；GitHub 只是分发渠道，不参与 Protocol validity。

`docs/`、`spec/`、tests 与历史材料不进入 runtime artifact。

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

记录 Core 总体边界、Protocol / Record / Entity / Block 的组合关系，以及 Protocol semantic dependency / Cordis runtime dependency 的分层。

### [`protocol.md`](protocol.md)

定义单 artifact Protocol model、ArtifactHash / ProtocolHash、embedded/external artifact、`cordis-js-esm` executable contract 与 build/runtime responsibility split。

### [`runtime-abi.md`](runtime-abi.md)

定义 `cordis-js-esm` ABI v1：ready-to-mount single gzip artifact、显式 `plugin` export、Cordis name/provide/inject/apply contract、Protocol dependency projection、Plugin Fiber 可逆生命周期、1 MiB bounded gunzip、Host execution boundary，以及 Host/Node 不重新构建 Protocol 的边界。

### [`release.md`](release.md)

定义当前 GitHub Release-only 发行流程、`.cordis-js-esm.gz` release assets、tag/version 规则、固定发行构建环境、identity regression gate 与 npm 延后边界。

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

- `core.protocol` single-artifact identity/runtime-verification 已实现，并使用 `cordis-js-esm` runtime kind；
- `core.record`、`core.entity` 与 ordinary `core.block` confirmation primitives 已实现；
- 四个 Core executable artifacts 只导出 `plugin` 的 thin Cordis Plugin wrapper，同时 package subpath API 保持纯实现；
- build/release gate 在 `core.protocol` 之外验证当前 Core Plugin 的 `name/provide/inject/apply`、实际 Cordis mount 与 Plugin Fiber dispose 后 service 撤销；通用 dependency projection validator 独立保留给后续 SDK/Repo 使用，不进入当前 artifact flow；
- release asset naming 使用 `.cordis-js-esm.gz`，当前 Core ProtocolHash fixtures 已冻结；
- Protocol Dev SDK 由 #23 延后到 Core/Repo 边界完成后；
- GitHub Release-only release/distribution 由 #24 收敛；
- Genesis #10 只继续收敛 deterministic assembly/fixture，不重新打开 ordinary Record/Block identity rules。
