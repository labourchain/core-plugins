# Core protocol documents

This directory contains the human-readable protocol documents paired with Core CUE schemas.

For a versioned protocol, keep the same logical name across the three maintenance layers:

```text
docs/protocols/core-record-v1.md
schemas/core/core_record_v1.cue
spec/core-record-v1.md
```

The protocol document describes meaning and intent. The CUE file describes structural constraints. The spec describes executable behavior and acceptance criteria.

When migrating from the legacy Service project, preserve the existing protocol document semantics first. Do not infer missing signing, confirmation, identity, or lifecycle rules solely from the CUE shape or Go implementation when a paired source document is known to exist.

## Current documents

- [`core-blockheader-v1.md`](core-blockheader-v1.md) ↔ [`../../schemas/core/core_blockheader_v1.cue`](../../schemas/core/core_blockheader_v1.cue) ↔ [`../../spec/core-blockheader-v1.md`](../../spec/core-blockheader-v1.md)

`core.record` and the remaining Core protocol documents will be added as their paired legacy documents are recovered/migrated.
