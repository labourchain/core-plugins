# LabourChain Core Specifications

`spec/` 是从已审查 `docs/` 投影出的开发规格。

事实与设计层级：

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

## 使用方式

每份 spec 应明确：

- Source：依据哪些 `docs/` 与原始 Service 文件；
- Inputs / State：实现接收哪些输入、依赖哪一阶段状态；
- Required behavior：已经确定、可以直接实现的行为；
- Validation / Failure：什么情况下必须拒绝；
- Tests：哪些测试具有独立失效价值；
- Blockers / Open：哪些行为尚未被 docs 决定，因此不得自行实现。

当前阶段不建立稳定 requirement 编号。使用自然语言标题和 source path 做追踪，进入维护期后再决定是否编号。

## 实现纪律

实现只能落在对应 spec 已经确定的行为范围内。

如果 spec 标记某个行为为 blocker/open：

- 可以实现与该问题无关的独立部分；
- 不得为了“跑通”自行选择一种语义；
- 不得用测试固定尚未被接受的设计；
- 应回到 docs 先完成设计决策，再更新 spec。

历史 Source Gap 本身不自动阻塞当前实现。只要 docs 已显式定义一个新的 versioned Current Design，spec 应按当前设计实现，同时保留历史差异记录。

## 当前术语与 Core Plugin 集合

当前模型统一使用 Plugin；`Protocol` 只在 Historical Source 段描述旧 `blockchain-service` 时保留。

当前 Core Plugins：

```text
core.plugin
core.record
core.entity
core.block
```

`BlockHeader` 是 `core.block` 的公开类型，不存在独立 `core.block-header` Plugin/spec。

## 当前规格

- [`core-plugin.md`](core-plugin.md) — canonical Plugin artifact、FileHash/PluginHash、runtime lock、Repository-issued release、activation；
- [`core-record.md`](core-record.md) — 当前 Record envelope、RecordId、domain-separated Ed25519 author signature、exact Plugin resolution、payload dispatch；
- [`core-entity.md`](core-entity.md) — Entity base58btc key identity 与 PluginHash boundary；
- [`core-block.md`](core-block.md) — BlockHeader、Merkle、Header verification、`blockId()`、ordinary Block validation；
- [`genesis.md`](genesis.md) — canonical Genesis manifest、full initial Plugin artifacts、GenesisId 与 S0 recognition；
- [`ordering.md`](ordering.md) — Plugin activation、Block confirmation 与业务关系顺序的分离。

## Identity / digest boundary

只有 Entity key material 与 Entity public-key reference 使用 Base58/base58btc。

```text
Entity public key -> Base58, on-chain allowed
Entity secret key -> Base58, local only
Signature         -> lowercase-hex signature result, not Base58
RecordId          -> DoubleSHA256 digest
FileHash          -> DoubleSHA256 digest
PluginHash        -> DoubleSHA256 digest
RecordsRoot       -> DoubleSHA256/Merkle digest
BlockId           -> DoubleSHA256 digest
GenesisId         -> DoubleSHA256 digest
```

当前 digest wire representation 使用 lowercase hexadecimal。

不得因为某个值“是 ID”就自动把它编码成 Base58。

## Record signing contract

`core.record@0.1.0` 的普通 Record 签名已经确定：

```text
record.id
= RecordId(rawRecord)

signingPayload
= UTF8("labourchain:record:v1:")
  || hexDecode(record.id)

signature
= Ed25519.Sign(createdBy key, signingPayload)
```

验证必须先重算并比对 RecordId，再使用 base58btc `createdBy` public key 验证 128-char lowercase-hex Ed25519 signature。

历史 `blockchain-service` 没有可确认的普通 Record signing payload；这一点作为 Source Gap 保留，而不是继续阻塞当前版本化 contract。

## Plugin artifact/runtime lock

第一版 runtime lock 已确定：

1. runtime file 由 exact FileHash 锁定；
2. canonical PluginManifest 承诺 runtime descriptor、schema、exact chain-Plugin dependencies 与完整 runtime file set；
3. `PluginHash = DoubleSHA256(canonical PluginManifest bytes)`；
4. 普通 npm/pnpm dependencies 在 build 时 bundle/vendor；
5. runner 不执行普通 package-manager dependency resolution；
6. external chain Plugin dependency 按 exact PluginHash 解析；
7. runner compatibility 通过 versioned Plugin ABI 表达。

package-manager lockfile、compiler/bundler/toolchain 与 source commit 属于 Repository/Asset build provenance，不属于 runtime Plugin identity。

## Genesis identity

Genesis canonical identity 已确定：

```text
sorted exact initial Plugin entries
  -> canonical Genesis manifest
  -> DoubleSHA256
  -> GenesisId
```

Genesis package 同时提供每个 entry 对应的完整 Plugin artifact。每个 artifact 再独立通过 PluginHash verification。

Genesis 不需要 ordinary Repository issuer、createdAt、packer 或 signature。

## Runner/server boundary

驱动这些 Plugins 的 runner/server 不属于本仓库的实现规格。

进程启动、Plugin artifact fetch/storage、数据库/文件持久化、HTTP/sync transport、secret-key storage、canonical-chain selection、packer authorization、sandbox/capability policy 等运行策略，应在独立 runner/server 工程中形成可启动和验收的 spec。

Core spec 只规定 Plugin 自身的确定性行为，以及调用者为了验证/组合这些 Plugins 需要提供的显式输入。

Labour / Asset DAG 不属于 Core Block validity。业务关系由相应领域 Plugin 定义和解释。

## Foundation status

当前 Foundation 已没有会阻塞具体 Core Plugin implementation 的已知设计 blocker。

已经确定：

- Plugin artifact identity / runtime lock；
- Genesis canonical identity / ordering；
- ordinary Block identity/linkage；
- ordinary Record signature contract；
- Entity identity / digest encoding boundary；
- Plugin activation ordering 与 Labour/Asset DAG boundary。

进入实现前只剩 docs/spec 最终一致性审查；如果审查发现新的实质矛盾，应回到 docs 修正，而不是在实现中静默补洞。
