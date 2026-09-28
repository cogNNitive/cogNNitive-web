---
title: "nn-upgrade — Guided Workspace Template Upgrade"
description: "Consent-gated migration of a workspace to the latest adopted iNNfo templates, with backup and re-validation."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn-upgrade
generator: https://cognnitive.com/skills/nn-design-presets
---

# nn-upgrade

**Skill**: `nn-upgrade` · **Role**: Consent-gated migration

Guided workspace template upgrade. Owns the migration that `nn-preflight` Tier 3 only
*detects*: preflight reports `upgrade-available` models; this skill migrates them with a
backup, a schema-impact analysis, and a re-validation gate.

---

## Canonical Activation Gate Protocol (MANDATORY)

Delegates to `nn-preflight` (session greeting + deterministic preflight integrity check).

---

## Workflow

1. **Detect** — run the Tier-3 upgrade scan (`nn-preflight --workspace-dir`) and present
   the per-model classification (`current` / `upgrade-available` / `ahead` / `unlisted`).
2. **Inform & consent** — present `[a] (Recommended) Upgrade / [b] Continue`. No mutation
   without consent.
3. **Backup** — `scripts/backup-workspace.js` creates a timestamped backup **outside** the
   workspace (`models/`, `specs/`, `sources/nn/`, `procedures/`, `index.md`). Manual
   fallback instructions shown if it fails.
4. **Impact analysis** — diff the pinned vs adopted template schema; ask mapping questions
   **only** for removed / renamed / re-typed definitions the model uses.
5. **Migrate** — hydrate the adopted template (write-once), repoint `parent_spec`, apply
   agreed mappings, bump `model_version`, re-validate each model through `innfo-mcp`.
   A failed validation is restored from the backup.
6. **Confirm** — before/after report (versions, gap kind, mappings, validation outcome,
   backup path).

## Core Rules

- Consent first; backup before migrate; ask only on real impact; never half-migrate.
- Unlisted models (local specializations) are reported, never auto-rebased.
- Detection lives in `nn-preflight`; this skill never re-implements it.