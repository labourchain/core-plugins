# Core MVP Specification

Status: **draft / partially implemented**

This specification defines the minimum LabourChain Core behavior required to support trusted records, protocol registration, deterministic block packing/verification, genesis, and chain replay. It intentionally excludes Repo, LabourFlow, Board, persistence-engine, and transport semantics.

## 1. Architecture invariants

### CORE-ARCH-001 — deterministic protocol behavior
Status: planned

Core protocol functions that affect record ids, protocol ids, block contents, block hashes/roots, signatures, or chain validity **MUST** be deterministic for the same explicit inputs.

They **MUST NOT** read network state, database state, wall-clock time, environment variables, or mutable global state implicitly. Values such as timestamps, keys, protocol registries, and previous-block identifiers **MUST** be supplied explicitly by the caller/runtime.

### CORE-ARCH-002 — storage and transport independence
Status: planned

`@labourchain/core-protocols` **MUST NOT** require MongoDB, Redis, HTTP servers, DSH agents, LLMs, UI frameworks, or object storage in order to validate Core protocol data.

Persistence and transport adapters **MAY** call Core, but Core protocol validity **MUST NOT** depend on a particular adapter.

### CORE-ARCH-003 — application-domain isolation
Status: planned

Core **MUST NOT** define repository membership, member resume/profile, labour-record payload semantics, project semantics, or runtime indexes.

A domain protocol **MAY** build on `core.record` and `core.entity` primitives.

### CORE-ARCH-004 — versioned compatibility
Status: planned

A breaking change to deterministic protocol behavior **MUST** create an explicit new protocol version/specification. Migration refactors **MUST NOT** silently change existing v1 compatibility behavior.

### CORE-ARCH-005 — protocol document/schema/spec traceability
Status: planned

A migrated protocol **SHOULD** maintain a one-to-one semantic document paired with its CUE schema, plus an implementation spec that translates that protocol meaning into executable requirements.

The preferred mapping is:

```text
docs/protocols/core-record-v1.md
schemas/core/core_record_v1.cue
spec/core-record-v1.md
```

When a paired legacy Service protocol document is known to exist, missing migration of that document is a `source-migration-required` condition and **MUST NOT** be treated as permission to redesign existing semantics.

## 2. Protocol namespace

### CORE-NS-001 — Core protocol ids
Status: planned

Blockchain primitives in this repository use the `core.*` namespace.

The MVP target set is:

- `core.protocol`
- `core.record`
- `core.entity`
- `core.block`
- `core.blockheader`

Legacy `sys.repo` and `sys.member` **MUST NOT** be mechanically migrated into the Core namespace.

## 3. `core.protocol`

### CORE-PROTO-001 — descriptor baseline
Status: planned / legacy-compat

The first migrated `core.protocol` version **MUST** preserve the legacy descriptor information:

- `protocolId`
- `version`
- `package`
- `schema`
- `contributors`
- optional `description`

### CORE-PROTO-002 — protocol identity baseline
Status: planned / legacy-compat

Until an explicit versioned change is specified, migration tests **MUST** preserve the legacy protocol-id/hash construction from the Go genesis script:

1. canonicalize the CUE schema source using the legacy CUE formatting behavior;
2. concatenate `package`, `protocolId`, `version`, and canonical schema using the legacy delimiter/order;
3. apply the legacy double-SHA256 operation;
4. encode the result as lowercase hexadecimal.

Golden compatibility fixtures **SHOULD** be used so the TypeScript implementation can be compared with legacy Go output.

### CORE-PROTO-003 — executable runtime identity
Status: blocked

Before independent nodes can rely on executable smart-protocol behavior, the on-chain protocol identity **MUST** commit to the exact executable implementation/package identity used for validation/packing.

The existing schema does not yet specify how this binding is represented. Implementation **MUST NOT** invent an implicit binding. A follow-up spec/version decision is required.

### CORE-PROTO-004 — registration as chain state
Status: planned

Accepted `core.protocol` records **MUST** be sufficient to reconstruct the protocol registry by replaying the canonical chain from genesis, together with the version-defined bootstrap rule for `core.protocol` itself.

A runtime cache/index **MAY** accelerate this registry but **MUST NOT** be authoritative.

## 4. `core.entity`

### CORE-ENTITY-001 — identity primitive
Status: planned / legacy-compat

The first migrated `core.entity` version **MUST** preserve the legacy identity primitive fields required by the existing schema:

- `publicKey`
- `contributors`
- `protocolHash`
- optional `type`

Core **MUST NOT** assign organization-membership, profile, resume, repository, or project semantics to this primitive.

## 5. `core.record`

### CORE-REC-001 — record envelope
Status: planned / legacy-compat

The first migrated `core.record` version **MUST** preserve the legacy envelope fields:

- `id`
- `protocol`
- `protocolHash`
- `createdBy`
- `createdAt`
- `signature`
- `data`

### CORE-REC-002 — legacy record-id calculation
Status: planned / legacy-compat

The migration implementation **MUST** reproduce the legacy Go `calcRecordID` output for compatibility fixtures.

The legacy operation is:

1. serialize `data` using the compatibility serialization contract represented by legacy Go `encoding/json` behavior;
2. concatenate `protocol`, `protocolHash`, `createdBy`, `createdAt`, and serialized `data` using the legacy delimiter/order;
3. apply double SHA-256;
4. encode the result as lowercase hexadecimal.

The TypeScript implementation **MUST** use explicit canonicalization/compatibility logic rather than relying on unspecified object-property ordering.

### CORE-REC-003 — referenced protocol validation
Status: planned

An ordinary record **MUST** reference a protocol id/version and `protocolHash` that resolve to an accepted protocol definition under the current replay state.

The record payload **MUST** satisfy the referenced protocol schema/runtime validation rules before the record is accepted for packing.

### CORE-REC-004 — trusted record signature
Status: source-migration-required / legacy-compat

An ordinary non-bootstrap record **MUST** carry the creator confirmation signature defined by the legacy Service protocol document paired with `sys_record_v1.cue`.

That signing contract already exists as protocol source material. Before implementation, the paired legacy document **MUST** be recovered/migrated into `docs/protocols/core-record-v1.md`, and its signing semantics **MUST** be translated into a dedicated `spec/core-record-v1.md` with deterministic test vectors.

Implementation **MUST NOT** infer or replace the signing payload from the CUE field list, `calcRecordID`, or unrelated Go code while the paired protocol document is still absent from this repository.

This requirement is a source-migration task, not a new protocol-design blocker.

### CORE-REC-005 — bootstrap exception
Status: planned

Genesis bootstrap records **MAY** use a version-defined bootstrap creator/signature exception when required to create the first trusted state. That exception **MUST** be limited to genesis construction/verification and **MUST NOT** be accepted for ordinary post-genesis records.

## 6. `core.blockheader` v1

The human-readable protocol document is [`../docs/protocols/core-blockheader-v1.md`](../docs/protocols/core-blockheader-v1.md).
The detailed implementation compatibility contract is defined in [`core-blockheader-v1.md`](core-blockheader-v1.md).

### CORE-BH-001 — legacy header shape
Status: implemented / legacy-compat

The migrated v1 header contains:

- `hash`
- `previousHash`
- `createdAt`
- `packer`
- `signature`

### CORE-BH-002 — signed payload
Status: implemented / legacy-compat

The Ed25519 signature payload **MUST** be the UTF-8 JSON serialization of exactly these fields in this order:

1. `hash`
2. `previousHash`
3. `createdAt`
4. `packer`

`signature` **MUST NOT** be included in its own signed payload.

### CORE-BH-003 — key/signature encoding
Status: implemented / legacy-compat

The current migrated verifier **MUST** interpret `packer` and `signature` as hexadecimal values, matching the legacy Go implementation.

The CUE/Go encoding mismatch is a known compatibility issue and **MUST NOT** be silently corrected within v1 migration work.

## 7. `core.block`

### CORE-BLOCK-001 — ordered record set
Status: planned / legacy-compat

A block **MUST** contain a header and an ordered list of records.

Record order **MUST** be preserved because the legacy Merkle algorithm and any sequential replay semantics depend on it.

### CORE-BLOCK-002 — record verification before packing
Status: planned

A packer **MUST NOT** include a record that fails its Core envelope/id/protocol/signature checks or the referenced protocol's validation rules.

Full trusted packing depends on migrating the existing ordinary-record signature contract into the Core record protocol document/spec and implementing it.

### CORE-BLOCK-003 — legacy Merkle root
Status: planned / legacy-compat

For the migrated v1 behavior, the records root **MUST** reproduce the legacy recursive algorithm:

- zero records -> empty string;
- one record id -> that id;
- pairs -> `DoubleSHA256(left + right)`;
- odd final id at a level -> duplicate the final id and hash the pair;
- repeat until one value remains.

Compatibility fixtures **MUST** cover zero, one, even, and odd record counts.

### CORE-BLOCK-004 — legacy `hash` meaning
Status: planned / legacy-compat

For v1 migration, `core.blockheader.hash` **MUST** continue to carry the value produced by the legacy records-Merkle-root calculation.

Any future split between `recordsRoot` and a full block identifier **MUST** be introduced through an explicit new protocol version/spec.

### CORE-BLOCK-005 — chain linkage
Status: planned

For non-genesis blocks, `previousHash` **MUST** match the version-defined identifier of the immediately preceding accepted block/header.

The exact v1 identifier semantics **MUST** remain compatible with the legacy `hash` meaning until versioned otherwise.

### CORE-BLOCK-006 — packer signature
Status: planned

A block **MUST** be rejected when `core.blockheader` signature verification fails.

Authority/authorization policy for which packer key is permitted belongs to the node/Repo authorization composition and **MUST NOT** be silently hard-coded into the cryptographic header verifier.

## 8. Genesis

### CORE-GEN-001 — genesis sentinel
Status: planned / legacy-compat

The first migrated genesis behavior **MUST** use `previousHash = "0"`, matching the legacy Go script.

### CORE-GEN-002 — Core protocol bootstrap
Status: planned

Genesis construction **MUST** be able to register the Core protocols required to interpret the initial chain state.

The bootstrap rule for `core.protocol` self-description **MUST** be deterministic and explicitly tested.

### CORE-GEN-003 — external domain bootstrap contributions
Status: planned

The generic Core genesis builder **MUST** accept explicit bootstrap records contributed by other loaded domains (for example the initial Repo identity/authority record) without importing those domain packages directly.

Core genesis **MUST NOT** hard-code Repo, LabourFlow, or Board semantics.

### CORE-GEN-004 — deterministic inputs
Status: planned

Genesis creation **MUST** receive timestamps, keys, protocol descriptors, and contributed bootstrap records as explicit inputs.

Tests **MUST** be able to reproduce identical genesis output from identical inputs.

## 9. Replay and chain validation

### CORE-CHAIN-001 — append-only validation
Status: planned

Given genesis plus an ordered sequence of blocks, Core **MUST** be able to validate the sequence without consulting an external authoritative database.

### CORE-CHAIN-002 — reconstructable protocol registry
Status: planned

Replay **MUST** reconstruct protocol-registration state from accepted chain facts and deterministic bootstrap rules.

### CORE-CHAIN-003 — disposable indexes
Status: planned

Loss of MongoDB, Redis, or other derived indexes **MUST NOT** cause loss of canonical chain truth. Such indexes **MUST** be rebuildable from chain data and protocol implementations.

## 10. Verification gates

### CORE-TEST-001 — project check
Status: implemented for current slice

Every completed implementation slice **MUST** pass:

```bash
pnpm check
```

which includes typecheck, tests, and build.

### CORE-TEST-002 — legacy compatibility fixtures
Status: planned

Where behavior is migrated from Go or legacy protocol documents, the corresponding spec slice **SHOULD** include golden input/output fixtures generated or independently checked against the legacy implementation/source contract.

### CORE-TEST-003 — spec traceability
Status: planned

Tests for Core protocol behavior **SHOULD** reference the relevant requirement ids in test names or comments so implementation coverage can be traced back to this specification.

## 11. Explicitly deferred from this repository

The following are outside this Core protocol MVP spec:

- Repo membership/authorization protocol design;
- LabourFlow record payload/profile schemas;
- Board/project schemas and projections;
- HTTP endpoint design;
- persistence adapter implementation;
- MongoDB/Redis ORM/indexing;
- object-storage asset content;
- private-record disclosure/zero-knowledge verification;
- multi-authority consensus and authority rotation.
