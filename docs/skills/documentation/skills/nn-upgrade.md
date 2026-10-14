---
title: "nn-upgrade — Guided bluepriNNt Upgrade and New-Domain Import"
description: "Consent-gated upgrade of user domaiNN workspaces with a verified backup, plus the pointer that replaces an old domain with a new one."
html_url: https://cognnitive.com/skills/documentation/#/skills/nn-upgrade
generator: https://cognnitive.com/skills/nn-design-presets
---

# nn-upgrade

**Skill**: `nn-upgrade` · **Role**: Consent-gated bluepriNNt upgrade engine

Guided domaiNN upgrade engine. Owns the **consent-gated upgrades** detected by `nn-preflight`. There is no in-place migration of an old domain: an old or broken domain is replaced by a new domain that imports the old one as a Source.

> Contract split: the skill owns consent, backup, plan validation and recovery. The legacy detector and the step tables live in the procedure `upgrade_and_migrate_legacy_workspace_NN.md`, not here.

---

## Canonical Activation Gate Protocol (MANDATORY)

Delegates to `nn-preflight` (session greeting + deterministic preflight integrity check).

---

## Glossary

- **Dry run** — read-only plan report + deterministic `planHash`, zero writes. Always first.
- **planHash** — SHA over the normalized plan; the apply phase revalidates it and aborts that domain on mismatch (no partial writes).
- **Backup** — timestamped copy of the whole domaiNN **outside** the workspace + SHA-256 manifest (`manifest.sha256`), before the first write.
- **Rehydration** (Flow B) — materialize the adopted bluepriNNt locally, repoint `parent_spec`, bump version, re-validate; restore on failure.

---

## Capabilities & Flows

### Flow B — bluepriNNt Version Upgrade (`upgrade-available`)

Upgrades bluepriNNt versions for adopted models within a current domaiNN:

1. **Detect** — run the upgrade scan (`nn-preflight --workspace-dir`) and present classification.
2. **Inform & Consent** — present `[a] (Recommended) Upgrade / [b] Continue`. No mutation without consent.
3. **Backup** — `scripts/backup-workspace.js` creates a timestamped backup outside the workspace.
4. **Impact Analysis** — diff the schemas; ask mapping questions only for removed / renamed / re-typed definitions in active use.
5. **Rehydrate & Validate** — hydrate adopted bluepriNNts, repoint `parent_spec`, apply mappings, bump version, and re-validate through `innfo-mcp`.
6. **Confirm** — report versions, gap kinds, mappings, validation outcomes, and backup path.

### Freezing slugs

`node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <dir> --freeze-slugs [--apply]` freezes the element slugs of every Level 3 model (dry run unless `--apply`). It is the remedy named by the console's `UNFROZEN_MODEL` error.

### Old or broken domain — create a new domain

`node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <old-dir> --import-as-source --new-domain-dir <new-dir>` scaffolds a new domaiNN and copies the old tree byte-identically under its `sources/`. The old directory is never modified.

---

## Core Rules

- Consent first; verified backup before upgrade; ask only on real impact; never half-upgrade.
- No in-place migration: an old domain is imported as a Source into a new domain.
- No retired paths in the skill: legacy detail lives in the procedure.
