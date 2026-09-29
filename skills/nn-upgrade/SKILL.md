---
name: nn-upgrade
description: Guided, consent-gated migration and upgrade of user domaiNN workspaces. Supports two flows: (1) Domain Layout Migration from legacy models/workspace layout to canonical domaiNN/kNNowledge layout via migrate-domain.js, and (2) bluepriNNt version upgrades for adopted templates. Triggers: template upgrade, upgrade templates, workspace upgrade, domain migration, migrate domain, migrar workspace, migrar dominio, actualizar plantillas.
version: "V_0-2-0"
last_updated: 2026-09-29
metadata:
  source_type: original
license: MIT
compatibility: opencode, claude-code, cursor, any agent supporting skills
bundled_templates: []
---

# nn-upgrade

## Canonical Activation Gate Protocol (MANDATORY)

Every cogNNitive skill MUST execute the canonical activation gate defined in `nn-preflight`
(session greeting banner + deterministic preflight integrity check). Do NOT duplicate the
script execution commands or the exit-code conditional branching here — delegate:

```markdown
## 0. Activation Gate
Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check).
```

## Role

Guided domaiNN upgrade and layout migration engine. Owns **consent-gated migrations** detected
by `nn-preflight`.

Supports two distinct flows:
1. **Flow A — Domain Layout Migration** (`legacy-layout` detected): migrates legacy workspaces (`models/`, `specs/templates/`, `workspace_NN.md`, legacy keys) to the canonical `domaiNN` / `kNNowledge` / `bluepriNNts` structure.
2. **Flow B — bluepriNNt Version Upgrade** (`upgrade-available` detected): upgrades bluepriNNt versions for adopted models within a canonical domaiNN.

---

## Flow A: Domain Layout Migration (`legacy-layout`)

When `nn-preflight` reports verdict `legacy-layout`:

### Phase A0 — Min-MCP Gate Check
Layout migration requires `innfo-mcp` `>= 0.12.0`. If MCP is below the minimum, halt and instruct the user to update the MCP server first.

### Phase A1 — Dry Run & Report
Run `migrate-domain.js` in dry-run mode:
```bash
node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <dir>
```
The dry-run produces a detailed report of moved files, rewritten files, and unmapped custom bluepriNNts, plus a deterministic `planHash`. No files are written.

### Phase A2 — Consent Gate
Present the dry-run report and request explicit confirmation:
```markdown
⚠️ Legacy layout detected. Migration will convert the domain to the canonical domaiNN/kNNowledge layout.
Plan Hash: <hash>

[a] (Recommended) Apply domain migration now
[b] Cancel and keep legacy layout
```
On `[b]`, cancel and perform no writes.

### Phase A3 — Verified Backup & In-Place Migration
Execute the migration with the confirmed `planHash`:
```bash
node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <dir> --apply --plan-hash <hash> --yes
```
- Performs a timestamped full-tree out-of-tree backup with SHA-256 manifest.
- Applies language migration and schema maps in place with journaling (`journal.json`).
- Validates the migrated domain via MCP (`validate_knowledge` with `domain: true`).

### Phase A4 — Failure Recovery & Import-as-Source
- **Failure**: Any failure automatically restores the pre-migration state from the backup via `node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <dir> --restore <backupDir>`.
- **Import-as-Source Alternative**: For domains with unmapped custom bluepriNNts or complex hand-edited legacy structures, offer the import-as-source exit:
  ```bash
  node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <dir> --import-as-source --new-domain-dir <newDir>
  ```
  This scaffolds a fresh canonical domaiNN and imports the legacy tree byte-identically into `sources/legacy/` with complete provenance and citation lineage.

---

## Flow B: bluepriNNt Version Upgrade

### Phase B0 — Detect
Run the Tier-3 upgrade scan (via `nn-preflight` `--workspace-dir`) and present the per-model classification.

### Phase B1 — Inform & Consent
Present upgrade options. Consent is mandatory before any mutation.

### Phase B2 — Backup
Create a timestamped full-tree backup outside the workspace:
```bash
node skills/nn-upgrade/scripts/backup-workspace.js --workspace-dir <dir>
```

### Phase B3 — Impact Analysis
Diff the pinned and adopted schemas. Ask mapping questions only when the diff removes, renames, or re-types a definition in active use.

### Phase B4 — Migrate & Validate
Hydrate adopted bluepriNNts, update frontmatter (`parent_spec`, `blueprint_name`), bump version, and re-validate through MCP. On validation failure, restore from backup.

---

## Core Rules

1. **Consent first**: No mutation before explicit user confirmation.
2. **Verified full-tree backup**: Out-of-tree backup + SHA-256 manifest must exist before the first write.
3. **Never half-migrate**: Failed migrations restore cleanly from backup.
4. **Zero workspace pollution**: All temporary checkouts and backups stay outside the working tree.
5. **Deterministic recovery**: Use `migrate-domain.js --restore <backupDir>` if any interrupted run is encountered.