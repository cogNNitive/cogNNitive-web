---
name: nn-upgrade
description: Guided, consent-gated migration and upgrade of user domaiNN workspaces. Supports three flows: (1) Domain Layout Migration from a legacy layout to the canonical domaiNN layout via migrate-domain.js, (2) bluepriNNt version upgrades for adopted templates, and (3) batch migration across sibling domaiNNs. Triggers: template upgrade, upgrade templates, workspace upgrade, domain migration, migrate domain, migrar workspace, migrar dominio, actualizar plantillas.
version: "V_0-3-0"
last_updated: 2026-10-07
metadata:
  source_type: original
license: MIT
compatibility: opencode, claude-code, cursor, any agent supporting skills
bundled_blueprints: []
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

This skill owns the **migration contract** (consent, backup, plan validation, recovery).
It does NOT own legacy knowledge: the per-layout maps (which retired paths map to which
canonical paths, which frontmatter keys are renamed, which schema maps apply) live in the
versioned procedure `upgrade_and_migrate_legacy_workspace_NN.md` and its data maps.
When a new retired layout appears, the procedure versions — this skill does not change.

Supports three distinct flows:
1. **Flow A — Domain Layout Migration** (`legacy-layout` detected): migrates a legacy
   domaiNN to the canonical `domaiNN` / `kNNowledge` / `bluepriNNts` / `artifacts` layout.
2. **Flow B — bluepriNNt Version Upgrade** (`upgrade-available` detected): upgrades bluepriNNt versions for adopted models within a canonical domaiNN.
3. **Flow C — Batch Domain Update** (`--dir <parent>`): orchestrates Flow A migration across many sibling domaiNNs in one parent directory via `batch-update.js`, reusing `migrate-domain.js` per domain.

---

## Glossary

- **Dry run:** a read-only execution that produces a plan report plus a deterministic
  `planHash` and writes nothing. Always run first; show the report before asking consent.
- **planHash:** SHA over the normalized migration plan. `--apply` revalidates it
  in-process: a mismatch aborts that domain with no partial writes (something changed
  between planning and applying).
- **Full-tree backup:** a timestamped copy of the whole domaiNN written **outside**
  the workspace, with a SHA-256 manifest (`manifest.sha256`). Required before the
  first write; every recovery path restores from it.
- **Rehydration (Flow B):** materializing the adopted (current catalog) bluepriNNt
  locally so `parent_spec` can be repointed, the version bumped, and the model
  re-validated. On validation failure, restore from the backup.
- **Never half-migrate:** any failure restores the pre-migration state from backup
  (`--restore <backupDir>`); an interrupted run is detected and recovered the same way.

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
The dry-run produces a detailed report (moved files, rewritten files, unmapped custom
bluepriNNts) plus a deterministic `planHash`. No files are written. For WHAT each
retired path maps to, see the procedure (`upgrade_and_migrate_legacy_workspace_NN.md`,
Layout Maps) — this skill does not enumerate retired paths.

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

## Flow C: Batch Domain Update

Orchestrates **Flow A** migration across many sibling domaiNNs in one parent directory.
A single CLI, `batch-update.js`, wraps `migrate-domain.js`: the batch is an aggregator,
never a fused transaction, and it reuses the migration unit instead of reimplementing it.
v1 covers **Flow A** (offline/deterministic layout migration) only — Flow B
(bluepriNNt version upgrade) batching is deferred. The batch tool never deletes
legacy/quarantine code.

### Phase C0 — Discovery / Scan
```bash
node skills/nn-upgrade/scripts/batch-update.js --dir <parent> --scan
```
Discovers sibling domaiNNs under `<parent>` (excluding `-backup-*`, `_archive`,
`_templates`, and dot-dirs), classifying each `ready` / `noop` / `blocked` / `skipped`,
and writes a re-runnable `<parent>/batch-plan.json` recording each domain's `path`,
op count, and `planHash`. Read-only with respect to domains (zero domain writes).
Add `--json` for machine-readable output.

### Phase C1 — Selection & Consent
Selection is non-interactive and expressed ONLY through `--only a,b` / `--exclude x,y`
and/or a frozen plan (`--plan <file>`) — there are no numbered menus. Present the plan
and request consent; the consent token is `--yes`. An empty selection applies nothing.

### Phase C2 — Apply
```bash
node skills/nn-upgrade/scripts/batch-update.js --dir <parent> --apply [--only a,b] --yes
```
Re-validates each selected domain's `planHash` in process (a mismatch aborts that domain
with no partial writes), then delegates to `migrate-domain.js --apply --plan-hash <hash>
--yes`. A soft per-parent lock (`<parent>/.nn-batch.lock`; `--force` bypasses it) guards
concurrent batches. Each domain keeps its own backup + `journal.json`; an aggregate
`<parent>/batch-journal-<stamp>.json` references them. Failure policy is
continue-on-failure: one bad domain never rolls back the good ones. Re-running skips
already-applied / `noop` domains with no new backup.

### Phase C3 — Rollback
```bash
node skills/nn-upgrade/scripts/batch-update.js --rollback <parent>/batch-journal-<stamp>.json --yes
```
Restores `applied` domains in **reverse order** via `migrate-domain.js --restore`.
Requires `--yes`. See the Core Rules below for the consent, verified full-tree backup,
and never-half-migrate guarantees this flow inherits.

---

## Core Rules

1. **Consent first**: No mutation before explicit user confirmation.
2. **Verified full-tree backup**: Out-of-tree backup + SHA-256 manifest must exist before the first write.
3. **Never half-migrate**: Failed migrations restore cleanly from backup.
4. **Zero workspace pollution**: All temporary checkouts and backups stay outside the working tree.
5. **Deterministic recovery**: Use `migrate-domain.js --restore <backupDir>` if any interrupted run is encountered.
6. **No retired paths here**: This skill never names retired layouts or keys. Legacy detail lives in the procedure and its maps; keep it that way.
