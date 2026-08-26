# Current Architecture

本文记录当前 LabourChain/Core 已接受的需求与架构。旧 Service 的历史事实依据见 [`source-baseline.md`](source-baseline.md)。

## Current Design：五部分 MVP

LabourChain 当前分为五个可独立演进的部分。

### Core

Core 提供最稳定的链级能力：

- Plugin artifact identity、release 与 activation；
- 可验证 Record envelope；
- Entity public-key identity primitive；
- Block 批量确证与连续存储历史；
- Genesis 与 initial Plugin state。

当前 Core Plugins：

```text
core.plugin
core.record
core.entity
core.block
```

### LabourFlow

LabourFlow 面向劳动事实输入：

- 劳动记录 UI；
- 自然语言 → structured Record Draft；
- 人工确认与签名；
- Member 履历/简历等输入体验。

### Board

Board 面向 Project：

- 用已有 Record / Asset 组织 Project；
- 展示进展；
- 规划、分析、回顾与投影；
- 将确认后的结论重新形成普通 Record。

Project 是事实与资产的组织层，不改变底层事实。

### Repo

Repo 是资产管理空间与组织成员挂载点：

- 保存/引用 Asset；
- 建立 Repository business Entity；
- 建立 Member/Repository 组织关系；
- 保存劳动事实与资产；
- 作为普通 Plugin release 的 issuer/releaser；
- 维护 Plugin artifact、源码、build inputs、commits 与贡献历史之间的 Asset/Labour graph。

### Runtime

Runtime 提供可替换的运行能力，例如：

- MongoDB / Redis；
- filesystem / object storage；
- ORM / index / cache / bridge；
- Plugin artifact fetch/cache；
- runner/server composition。

这些能力服务运行与查询，不改变 Core Plugin 对相同输入的确定性结果。

## Current Design：Plugin 统一语义

旧 `blockchain-service` 使用 `Protocol` 表示以 schema 为主的数据协议。

当前模型不再保留一个与 Plugin 并列的 Protocol 实体。`Protocol` 只用于 Historical Source；当前链上可执行规则统一称为 **Plugin**。

Plugin 是不可变、可版本发布的 executable package：

```text
Plugin
├── schema / public types
├── deterministic executable functions
├── runtime descriptor
└── executable artifact files
```

它在能力上相当于 Smart Contract，但工程模型更接近 package/plugin。

Plugin 以：

```text
name@version
```

发布；历史 release 不原地改写。

`BlockHeader` 是 `core.block` 的公开类型，不存在独立 `core.block-header` Plugin。

## Current Design：Plugin artifact 是执行事实

runner 执行已经构建完成的 artifact，而不是 source checkout。

```text
source / build inputs
        |
        v
      build
        |
        v
Plugin artifact
        |
        v
canonical PluginManifest
        |
        v
   PluginHash
```

`PluginHash` 是 executable artifact 的精确 content identity。

Plugin artifact 由 [`plugin.md`](plugin.md) 定义：

- 每个 runtime file 由 `FileHash = DoubleSHA256(raw bytes)` 锁定；
- canonical manifest 承诺 name/version、runtime kind/ABI/entry、schema path、exact chain-Plugin dependencies 与完整 file set；
- `PluginHash = DoubleSHA256(canonical PluginManifest bytes)`；
- archive/compression representation 不参与 identity。

因此不同 runner 只要验证同一个 PluginHash，就能确认自己取得的是同一个 executable Plugin artifact。

## Current Design：runtime lock 与 build lock 分离

普通 npm/pnpm dependency 不进入 runner 的动态 dependency resolution。

第一版要求：

```text
normal package dependency
    -> bundle/vendor at build time
    -> Plugin artifact
```

运行期外部依赖只保留：

1. versioned runner ABI；
2. 其他链 Plugin，并按 exact `PluginHash` 锁定。

runner 不执行：

```text
npm install
pnpm install
semver range resolution
postinstall
source compile/bundle
```

package-manager lockfile、compiler/bundler version、build config、source commit 等属于 Repository build provenance。

bit-for-bit reproducible build 是可选的更高层审计能力，不是 Plugin runtime validity 的前置条件。runtime validity 的核心是实际执行 artifact 与链上 PluginHash 完全一致。

## Current Design：Repository 是普通 Plugin issuer

普通 post-Genesis Plugin release 的 issuer/releaser 是 Repository。

```text
Plugin release Record.createdBy
= Repository public key
```

Repository public key 使用 `core.entity` 的 base58btc Entity identity。

`BlockHeader.packer` 与 Plugin issuer 是不同语义：

```text
createdBy -> 谁发行这条 Plugin release fact
packer    -> 谁签署这个 Block confirmation
```

Plugin manifest/release 不重复保存 source repository URL。

沿 release Record 可以恢复 provenance：

```text
Plugin release Record
  -> createdBy Repository public key
  -> Repository
  -> Plugin artifact Asset
  -> source/build/commit Assets
  -> Labour Records
  -> contribution / version DAG
```

Plugin artifact 本身属于 Asset。源码与构建历史由 Repo/Asset/Labour graph 追溯，而不是塞进 executable manifest。

Genesis initial Plugins 是唯一 issuer-less bootstrap 例外。

## Current Design：Entity identity 与 digest 分离

只有 Entity key material 与 Entity public-key reference 使用 Base58。

Base58 固定为 base58btc / Bitcoin alphabet：

```text
123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
```

只做 raw bytes ↔ Base58 text，不使用 Base58Check checksum/version byte/prefix。

```text
Entity public key -> Base58, on chain allowed
Entity secret key -> Base58, local only, never on chain
```

Repository、Member、Record.createdBy、BlockHeader.packer 等字段如果其语义是 Entity public-key reference，就使用该表示。

Signature 不是 identity，也不使用 Base58。

以下值是 DoubleSHA256-derived digest，当前 wire representation 为 lowercase hexadecimal：

```text
RecordId
FileHash
PluginHash
RecordsRoot
BlockId
GenesisId
```

## Current Design：Record 是事实节点

Record 是 LabourChain 的基本事实单位。

当前 common envelope：

```text
id
plugin
pluginHash
createdBy
createdAt
signature
data
```

其中：

```text
plugin     = exact name@version
pluginHash = exact executable PluginHash
```

Record 由 exact active Plugin 解释和验证；仅 name/version 匹配而 PluginHash 不同不算同一个 Plugin。

Record 可以表达：

- labour fact；
- ordinary Plugin release；
- organization/member fact；
- Asset fact；
- Project fact；
- 其他由对应 Plugin 定义的事实。

### RecordId 与签名分层

RecordId 继续承诺 unsigned/common Record 内容：

```text
plugin
pluginHash
createdBy
createdAt
data
```

当前 `core.record@0.1.0` 明确定义新的普通 Record signing contract，而不再等待无法从旧仓库恢复的 signing payload。

验证者必须先按 RecordId 规则重新计算 Record 内容并确认：

```text
record.id == recordId(rawRecord)
```

随后构造签名 payload：

```text
RECORD_SIGNING_DOMAIN = "labourchain:record:v1:"

signingPayload(record.id)
= UTF8(RECORD_SIGNING_DOMAIN)
  || hexDecode(record.id)
```

其中 `record.id` 必须是 64-char lowercase hexadecimal，并解码为 32 bytes。

普通 Record 使用 `createdBy` 对应的 Ed25519 Entity key 对该 payload 签名：

```text
signature
= Ed25519.Sign(createdBy secret key, signingPayload(record.id))
```

验证时：

1. 重新计算并比对 RecordId；
2. 将 `createdBy` 从 base58btc 解码为 32-byte Ed25519 public key；
3. 将 `signature` 从 lowercase hex 解码为 64 bytes；
4. 对 `signingPayload(record.id)` 执行 Ed25519 verification。

`signature` 的 wire representation 固定为 128-char lowercase hexadecimal。

签名只覆盖已经验证过的 RecordId，是因为 RecordId 已经承诺完整 RawRecord 内容。这样不会再为签名引入第二套 `data` canonicalization。固定 domain prefix 则避免把 Record signature 当成对任意 32-byte digest 的通用签名复用。

`signature` 不参与 RecordId；改变 signature 不改变该事实的内容 identity，但会改变/破坏 author confirmation validity。

Genesis initial Plugin artifacts 不经过普通 Record signing path。

## Current Design：Block 是确证与存储结构

Block 的意义是：

> 一组有序 Record 在某个链位置被正式收录和确证。

```text
Genesis -> B1 -> B2 -> B3 -> ...
```

`core.block` 拥有：

```text
Block / BlockHeader
recordsRoot()
signingPayload()
verifyHeader()
blockId()
verifyBlock()
```

`BlockId` 由最终 signed BlockHeader 的 canonical bytes 做 DoubleSHA256 得到。

第一个普通 Block：

```text
B1.previousBlock = GenesisId
```

后续普通 Block：

```text
Bn.previousBlock = blockId(Bn-1.header)
```

Block 不承担 Labour/Asset 业务因果语义。

## Current Design：Plugin activation

验证 ordinary Block `N` 时，使用 Block 开始前已经存在的 immutable `activePluginState`。

```text
Plugin release confirmed in Block N
        -> active from Block N+1
```

同一个 Block 内的新 Plugin 不能立即被后续 Record 使用，也不能满足另一个新 Plugin 的 runtime dependency。

外部 chain-Plugin dependency 必须按 exact PluginHash 在 pre-Block state 中解析。

Genesis 是唯一 bootstrap path：其 initial Plugin set 作为完整 `S0` 一次性验证和建立。

## Current Design：Genesis 是 initial Plugin artifact set

Genesis 不再伪装成普通 Record/Block release 流程。

它直接包含完整 initial Plugin artifacts，并有 canonical Genesis manifest：

```text
plugins[]
  -> { name, version, pluginHash }
```

entries 按 `name@version` UTF-8 lexical ascending 排序。

```text
GenesisId
= DoubleSHA256(canonical Genesis manifest bytes)
```

每个 `pluginHash` 又承诺对应完整 executable artifact，因此 GenesisId 传递承诺整个 initial executable Plugin set。

Genesis 不需要：

```text
createdBy
createdAt
Repository issuer
packer
signature
ordinary RecordId
```

普通 Repository-issued Plugin release 从 Block 1 之后开始。

## Current Design：Core confirmation chain 与 Labour / Asset DAG 正交

Labour、源码、构建和成果关系更接近 Git DAG：

```text
R1 ----> R3 ----> R6
 \        ^
  -> R2 -> R4
```

而 Core confirmation chain 是：

```text
Genesis -> B1 -> B2 -> B3
```

两者没有一一对应关系，也不互相决定合法性。

Core 不要求 Block Record 按业务 DAG 做拓扑排序，也不从 Block 顺序反推 labour causality、Asset lineage 或 Project membership。

业务引用的完整性/合理性由对应领域 Plugin 与其消费方决定。

## Current Design：三种时间/顺序分离

至少区分：

```text
business/created time
runtime receive time
block confirmation time
```

因此：

```text
arrival order
!= business causal order
!= block confirmation order
```

## Current Design：runner/server 与业务身份分离

运行 Plugin 的计算实例不是 Repository 或 Member 业务实体。

Repository 可以发行 Plugin，但 runner/server 不因此成为该 Repository。

runner/server 负责：

- process startup / Plugin loading；
- Plugin artifact fetch/cache；
- persistence；
- transport/sync；
- Entity secret-key storage / signer；
- packer authorization；
- canonical-chain policy；
- runtime sandbox/capability policy；
- deployment/observability。

Core Plugins 只规定 host-agnostic deterministic behavior 与显式验证输入。

## Foundation design gate

旧 `blockchain-service` 的当前可见材料不能证明普通 Record 的 signing payload；这一点现在作为历史 source gap 保留在 `source-baseline.md`，不再让当前 Core 无限等待不可恢复的旧语义。

`core.record@0.1.0` 已通过上述 domain-separated RecordId signing contract 显式定义新的版本化行为。

因此当前 foundation 的核心设计 blocker 已全部解决：

- Plugin artifact identity / runtime lock；
- Genesis identity；
- ordinary Block identity/linkage；
- ordinary Record signature payload。

该签名决策已经投影到 `spec/core-record.md`。当前剩余 gate 只是 docs/spec 最终一致性审查；审查通过后进入具体 Core Plugin implementation。
