# Genesis Specification

Status: reviewed composition baseline. Genesis is an ordinary Block containing ordinary Records. Ordinary Record/Block identity and signature rules are reused; remaining #10 work is deterministic assembly/fixture design.

## Source

Historical source:

- `Ri0n72Y/blockchain-service/cmd/script/main.go`
- `Ri0n72Y/blockchain-service/lib/model/types.go`
- historical system CUE schemas referenced by the Genesis script

Current design source:

- `docs/source-baseline.md`
- `docs/architecture.md`
- `docs/genesis.md`
- `docs/protocol.md`
- `docs/record.md`
- `docs/block.md`

## Required structural invariant

```text
Genesis = Block
Block.records[] = Record[]
Protocol bootstrap data = Record.data = Protocol
```

There is no independent `GenesisManifest` / `S0 Protocol artifact set` chain-data model.

## Initial Core Protocol Records

Initial Core Protocol data is carried in Records interpreted by `core.protocol`:

```text
core.protocol
core.record
core.entity
core.block
```

`BlockHeader` belongs to `core.block`; there is no independent `core.block-header` Protocol.

For MVP bootstrap, each initial Core Protocol Record MUST carry a complete valid embedded gzip `Protocol.artifact` as defined by `spec/core-protocol.md`.

Verification is:

```text
canonical Base64 decode
-> exact gzip artifact bytes
-> ArtifactHash
-> ProtocolHash
-> bounded gunzip (<= 1 MiB)
-> import ESM
```

The embedded artifact remains ordinary Protocol data inside Record.data; it is not an independent bootstrap package/state format and does not alter ProtocolHash.

## Ordinary Record contract

Genesis Protocol Records MUST use the ordinary current Record contract:

```text
RawRecord = protocol / protocolHash / createdBy / createdAt / data
RecordId = DoubleSHA256(JCS(RawRecord))
createdBy = EntityPublicKey
signature = domain-separated Ed25519 signature over RecordId
```

`core.record` MUST NOT contain a generic Genesis branch.

The historical behaviors below are Source Facts only and MUST NOT be retained without a new demonstrated bootstrap requirement:

```text
Protocol Record.id = ProtocolHash
createdBy = "Root"
unsigned bootstrap Protocol Records
special Genesis Record signature path
```

## Ordinary Block contract

Genesis Header MUST use the ordinary current `core.block` contract:

```text
recordsRoot = recordsRoot(ordered Genesis RecordIds)
previousBlock = "0"
BlockId = blockId(unsigned Header)
packer = EntityPublicKey
signature = domain-separated Ed25519 signature over BlockId
```

`previousBlock = "0"` is the Core first-link sentinel. No separate GenesisId or Genesis-specific BlockId/signature algorithm is defined.

`core.block` MUST NOT contain a generic Genesis branch.

## Deterministic assembly

Genesis construction MUST receive or derive one explicit deterministic Record order because Record order participates in RecordsRoot and therefore BlockId.

For explicit inputs, Genesis identity MUST depend only on declared values such as:

```text
ordered initial Protocol Records
Record author key(s)
Record createdAt values
packer key
Block createdAt
previousBlock = "0"
```

Hidden wall-clock values, filesystem enumeration, map/object iteration, registry lookup, package-manager state, or network fetch MUST NOT participate in Genesis identity.

A dedicated Genesis helper/fixture MAY be introduced only if it reduces repeated deterministic assembly logic. It MUST compose existing Protocol/Record/Block primitives rather than define a new public Core identity model.

## Bootstrap trust boundary

A node cannot verify the first Genesis bytes with zero trusted built-in logic.

The executable node MUST ship with a minimal trusted bootstrap verifier capable of parsing and verifying the ordinary Protocol / Record / Block contracts before chain-embedded Core Protocol artifacts can be loaded from Genesis.

Genesis-carried artifacts provide exact executable chain content and future recoverability/cacheability. They do not replace the verifier already shipped with the node.

The final import-to-Cordis-Plugin runtime contract is reviewed separately and MUST NOT be invented inside Genesis.

## Repository / domain boundary

Historical Root Member and Genesis Repository remain Source Facts but are not mandatory Core Genesis primitives.

If Repository/bootstrap composition needs initial Worker, Repo, Member, Entity-admission, or similar domain facts, they belong to higher-level ordinary Records and Protocols.

Whether the Genesis packer is admitted/authorized belongs to Repo/network/PoA policy. Core Genesis only requires an ordinary valid `EntityPublicKey` packer signature.

## Optional external distribution

Registry, mirror, CDN, Repo/object storage, P2P distribution, or local caches MAY later provide the same exact gzip Protocol artifact bytes.

These are optional distribution/availability mechanisms. They do not create a different ArtifactHash/ProtocolHash and are not required for MVP bootstrap.

## Large static resources

Core bootstrap artifacts SHOULD remain small and self-contained. Large models, datasets, images, maps, or resource packs SHOULD be externalized into higher-level Asset/Runtime mechanisms.

The approximately 500 KiB compressed-artifact warning is build/Dev SDK guidance only. The 1 MiB decompressed runtime limit is an ABI v1 runner safety rule. Neither is a Genesis/Block-specific validity rule.

## Prohibited design assumptions

Implementations MUST NOT assume:

```text
initial Protocols bypass Record.data
initial Protocols are issuer-less special release entities
Genesis constructs a separate S0 Protocol state/manifest
Genesis identity is a hash of a Protocol-entry manifest
ordinary core.record/core.block contain if-genesis branches
Protocol RecordId equals ProtocolHash
createdBy = "Root"
Genesis has a special signature contract
Root Member / Genesis Repository are Core identity primitives
```

## Current acceptance

Frozen before implementation:

```text
Protocol is data
Protocol data is carried by Record
Genesis is a Block
Genesis carries Protocol Records in Block.records[]
Genesis Records use ordinary core.record rules
Genesis Header uses ordinary core.block rules
previousBlock = "0" is the first-link sentinel
initial Core Protocol Records embed exact gzip artifacts
Protocol identity commits to ArtifactHash
embedded vs external storage does not change ProtocolHash
MVP Core bootstrap requires no external Protocol registry
Root Member / Genesis Repository / admission policy remain outside Core
```

Still open in #10:

```text
minimal Genesis assembly input/output shape
whether a dedicated deterministic fixture/helper is warranted
concrete fixture values used by the first implementation
```

## Tests

When Genesis assembly is implemented, tests MUST verify:

- deterministic explicit Record order;
- ordinary Record identity/signature behavior for initial Protocol Records;
- ordinary Block identity/signature behavior with `previousBlock = "0"`;
- embedded Core Protocol artifact verification/loading;
- repeated assembly from identical explicit inputs produces the same Genesis Block;
- no external Protocol registry is required for Core artifact availability.
