# Record Model

本文定义 LabourChain 当前 Record 数据模型、RecordId、作者确认与 Plugin 协议来源边界。

历史事实依据见 [`source-baseline.md`](source-baseline.md)。当前设计继续保留旧 `RawRecord -> Record` 结构，但将旧 `protocol / protocolHash` 迁移为 `plugin / pluginHash`，并把 Record identity 统一收敛到 RFC 8785 JCS。

## Source baseline

旧 Service 的基础结构是：

```text
RawRecord
├── protocol
├── protocolHash
├── createdBy
├── createdAt
└── data

Record
├── id
├── signature
└── RawRecord
```

旧 `calcRecordID` 对 `data` 使用 Go `encoding/json` 的紧凑 JSON，然后与其他 RawRecord 字段按固定顺序拼接后执行 DoubleSHA256。

旧代码预留了 `signature` 字段，但当前可恢复源码没有建立普通 Record 的 signing payload 或验签规则。因此普通 Record signature 属于历史 source gap；当前 signing contract 是明确的 Current Design。

## Current data model

当前公共数据结构：

```ts
interface RawRecord {
  plugin: string
  pluginHash: PluginHash
  createdBy: EntityPublicKey
  createdAt: string
  data: unknown
}

interface Record extends RawRecord {
  id: RecordId
  signature: string
}
```

字段保持最小，不为不同业务类型增加独立确证通道。Plugin、Entity、Labour、Asset、Repository、Project 等都可以作为具体 Plugin 产生的 Record data 进入链。

## 两种来源

Record 同时表达两种不同来源：

```text
plugin / pluginHash
-> 协议来源
-> 这条 Record 由哪个链上 Plugin / 协议产生、签发

createdBy / signature
-> 主体来源
-> 哪个 Entity 对这条 Record 的产生负责并进行密码学确认
```

这两个关系不能混淆。

`createdBy` 不表示谁发布了 Plugin；Plugin 发布本身也只是另一条由 `core.plugin` 产生的 Record。

## Plugin declaration 与 PluginHash

`plugin` 是人类可读声明：

```text
name@version
```

例如：

```text
labour.work@0.1.0
```

`pluginHash` 是机器执行时使用的 exact Plugin identity。

```text
runner/runtime authority -> pluginHash
human review/confirmation -> plugin = name@version
```

runner 不要求通过 `pluginHash` 反查 Plugin 后再验证 `name/version`。`plugin` 是被作者一并确认的可读声明，因此仍然属于 RawRecord，并参与 RecordId 与 signature。

## RecordId

当前 Record identity 统一使用 RFC 8785 JSON Canonicalization Scheme（JCS）：

```text
RawRecord
-> validate JSON/I-JSON compatible values
-> RFC 8785 JCS
-> UTF-8 bytes
-> DoubleSHA256
-> lowercase hexadecimal RecordId
```

定义：

```text
RecordId = DoubleSHA256(JCS(RawRecord))
```

其中 RawRecord 完整包含：

```text
plugin
pluginHash
createdBy
createdAt
data
```

`id` 与 `signature` 不参与 RecordId。

JCS 是对旧实现“先形成稳定紧凑表示，再计算哈希”原则的跨语言收敛。当前实现不再复制 Go `encoding/json + ':' concatenation` 的具体编码方式。

## Record.data 完整参与 fact identity

RecordId 承诺完整 `data`，不对具体 Plugin payload 做 identity 特例。

因此当：

```text
Record.data = Plugin
```

且 Plugin 包含 optional embedded artifact 时，embedded bytes 也属于该条 Record 的事实内容。

这与 PluginHash 的语义不同：

```text
PluginHash
-> executable identity
-> artifact storage field 不参与 identity

RecordId
-> fact identity
-> 完整 Record.data 参与 identity
```

所以同一个 Plugin descriptor：

```text
Plugin with embedded artifact
Plugin without embedded artifact
```

可以具有相同 PluginHash，但如果分别作为两条 Record.data 写入链，它们具有不同 RecordId。这是预期行为，因为两条链上事实实际携带的数据不同。

## JCS / JSON data boundary

`data` 必须能够作为确定性的 JSON/I-JSON 数据参与 JCS。

允许：

```text
null
boolean
finite number
string with valid Unicode scalar data
array
plain JSON object
```

拒绝不能稳定表示为 JSON/JCS 的运行时值，例如：

```text
undefined
NaN / Infinity
BigInt
function / symbol
host object / class instance
accessor property
invalid Unicode / lone surrogate
```

业务 Plugin 可以进一步限制 `data`，但 `core.record` 只规定通用事实容器所需的 canonical JSON 边界。

## createdBy

普通 Record 的 `createdBy` 是 Entity public-key reference。

当前 Entity identity 使用 base58btc。对于 Ed25519：

```text
base58btcDecode(createdBy).length == 32 bytes
```

`createdBy` 本身参与 RecordId，因此主体声明也是事实 identity 的一部分。

## Signature

当前普通 Record signing contract 使用固定 domain：

```text
RECORD_SIGNING_DOMAIN = "labourchain:record:v1:"
```

对于合法 64-character lowercase hexadecimal RecordId：

```text
recordIdBytes = hexDecode(record.id)

signingPayload(record.id)
= UTF8(RECORD_SIGNING_DOMAIN)
  || recordIdBytes
```

普通 Record signature：

```text
signatureBytes
= Ed25519.Sign(authorSecretKey, signingPayload(record.id))
```

wire representation：

```text
signature = lowercase hex(signatureBytes)
```

Ed25519 signature 因此是 64 bytes / 128 lowercase hexadecimal characters。

验签必须先重新计算 RawRecord 的 RecordId，并确认 supplied `record.id` 与计算结果一致，再使用 `createdBy` 公钥验证 signature。

## core.record responsibilities

`core.record` 只负责通用 Record primitive：

```text
validateRawRecord
validateRecord
canonicalRecord
recordId
signingPayload
verifySignature
```

它不负责：

```text
resolve Plugin
执行 Plugin
判断 Plugin 是否允许产生该 Record
Plugin dependency resolution
Plugin availability / activation
Block order
Genesis bootstrap exception
Labour / Asset / Project business DAG
persistence / network arrival
```

Record 声明其协议来源；runtime/composition layer 根据 `pluginHash` 加载 exact Plugin，并由该 Plugin 执行自己的协议规则。

## createdAt

`createdAt` 是 Record 的被签名事实字段，并参与 RecordId。

当前 `core.record` 只要求它是 JCS 可表示的 string，不在通用 Core 中赋予 wall-clock、排序或可信时间语义。领域 Plugin 或 runtime 可以定义额外时间规则，但这些规则不改变 Record primitive。

## Genesis boundary

历史 Genesis 存在特殊 Record 行为，包括：

```text
Protocol Record.id 直接使用 ProtocolHash
createdBy = "Root"
bootstrap Records 没有普通 Record signature
```

这些 Source Facts 不进入普通 `core.record` 的 reusable API。

当前普通 Record contract 保持统一；Genesis 是否继续保留某些 bootstrap exception，由独立 Genesis / core.block review 决定。
