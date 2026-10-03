---
title: "nn-upgrade — Guided Domain Layout Migration and bluepriNNt Upgrade"
description: "Consent-gated migration and upgrade of user domaiNN workspaces, with verified full-tree backup, schema migration, and automatic recovery."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn-upgrade
generator: https://cognnitive.com/skills/nn-design-presets
---

# nn-upgrade

**Skill**: `nn-upgrade` · **Role**: Consent-gated migration and bluepriNNt upgrade engine

Guided domaiNN upgrade and layout migration engine. Owns the **consent-gated migrations** detected by `nn-preflight`.

---

## Canonical Activation Gate Protocol (MANDATORY)

Delegates to `nn-preflight` (session greeting + deterministic preflight integrity check).

---

## Capabilities & Flows

### Flow A — Domain Layout Migration (`legacy-layout`)

Migrates legacy workspaces (`models/`, `specs/templates/`, `workspace_NN.md`, `export/`, `sources/nn|original|export|archive`, `_V_` kNNowledge names, legacy keys) to the canonical `domaiNN` / `kNNowledge` / `bluepriNNts` / `artifacts` structure:

1. **Min-MCP Check**: Requires `innfo-mcp` `>= 0.12.0`.
2. **Dry Run**: `node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <dir>` produces a plan report and deterministic `planHash`.
3. **Consent Gate**: User confirms execution with `[a] Apply domain migration / [b] Cancel`.
4. **Verified Full-Tree Backup**: Full-tree out-of-tree backup with `manifest.sha256`.
5. **In-Place Migration**: Applies language migration and schema maps with journal tracking (`journal.json`).
6. **Recovery & Import-as-Source**: Restores state on failure via `--restore <backupDir>`, or offers `--import-as-source --new-domain-dir <newDir>` for unmapped custom bluepriNNts.

### Flow B — bluepriNNt Version Upgrade (`upgrade-available`)

Upgrades bluepriNNt versions for adopted models within a canonical domaiNN:

1. **Detect** — run the upgrade scan (`nn-preflight --workspace-dir`) and present classification.
2. **Inform & Consent** — present `[a] (Recommended) Upgrade / [b] Continue`. No mutation without consent.
3. **Full-Tree Backup** — `scripts/backup-workspace.js` creates a timestamped full-tree backup outside the workspace.
4. **Impact Analysis** — diff the schemas; ask mapping questions only for removed / renamed / re-typed definitions in active use.
5. **Migrate & Validate** — hydrate adopted bluepriNNts, repoint `parent_spec`, apply mappings, bump version, and re-validate through `innfo-mcp`.
6. **Confirm** — report versions, gap kinds, mappings, validation outcomes, and backup path.

---

## Core Rules

- Consent first; verified full-tree backup before migrate; ask only on real impact; never half-migrate.
- Unlisted models / custom bluepriNNts without schema maps are preserved with language layer only or offered import-as-source.
- Interrupted runs are detected and recover cleanly with `--restore <backupDir>`.