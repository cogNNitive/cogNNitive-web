# Validate your domaiNN

Validation in cogNNitive is deterministic: the core engine (`@cognnitive/nn-core`) evaluates structural integrity, schema compliance, and citation freshness.

## Validation Tools Overview

| Tool | Scope | When to use |
|---|---|---|
| `validate_knowledge` | Single `.md` file | Run after editing any kNNowledge document |
| `check_domain` | Entire domaiNN | Run before commits or PRs to verify global lineage |
| `check_citations` | Citations & sidecars | Run when source documents have been updated |

## Common Validation Errors and Fixes

- **`DANGLING_CITATION`**:
  - *Cause*: A heading in a source document was renamed or removed.
  - *Fix*: Update the `sources:: [...]` bracket in your document to the new heading identifier, or restore the heading in the source.
- **`SCHEMA_VIOLATION`**:
  - *Cause*: A required field defined in the bluepriNNt is missing or has an invalid type.
  - *Fix*: Check the bluepriNNt specification under `specs/bluepriNNts/<name>/spec_NN.md` and add the missing property.
- **`LINEAGE_DRIFT`**:
  - *Cause*: A file was added or deleted manually without synchronizing the manifest.
  - *Fix*: Ask your agent to run `sync_lineage` to refresh the manifest automatically.
