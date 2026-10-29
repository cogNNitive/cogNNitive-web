---
name: nn-upgrade
description: Guided, consent-gated upgrade of user domaiNN workspaces. Upgrades bluepriNNt versions for adopted templates (Flow B), freezes unfrozen element slugs (--freeze-slugs), and points an old or broken domain at the new-domain recipe (create a new domain and import the old one as a Source). There is no in-place migration of an old domain. Triggers: template upgrade, upgrade templates, workspace upgrade, domain migration, migrate domain, migrar workspace, migrar dominio, actualizar plantillas.
version: "V_0-4-2"
last_updated: 2026-10-14
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

Guided domaiNN upgrade engine. Owns **consent-gated upgrades** detected by `nn-preflight`
(consent, backup, plan validation, recovery).

This skill does NOT migrate an old domain in place. An old or broken domain is replaced by a
new domain: create a new domain and import the old one as a Source. The old tree is kept
byte-identical under `sources/` and nothing in it is rewritten or deleted.

The skill ships two things:
1. **Flow B — bluepriNNt Version Upgrade** (`upgrade-available` detected): upgrades bluepriNNt
   versions for adopted models within a current domaiNN.
2. **The new-domain pointer** (an old or broken domain): the recipe below.

It also exposes one maintenance option, `--freeze-slugs`, the remedy named by the console's
`UNFROZEN_MODEL` error.

---

## Glossary

- **Dry run:** a read-only execution that produces a plan report plus a deterministic
  `planHash` and writes nothing. Always run first; show the report before asking consent.
- **planHash:** SHA over the normalized plan. The apply phase revalidates it: a mismatch
  aborts that domain with no partial writes (something changed between planning and applying).
- **Backup:** a timestamped copy of the whole domaiNN written **outside** the workspace, with
  a SHA-256 manifest (`manifest.sha256`). Required before the first write.
- **Rehydration (Flow B):** materializing the adopted (current catalog) bluepriNNt locally so
  `parent_spec` can be repointed, the version bumped, and the model re-validated. On
  validation failure, restore from the backup.
- **Never half-upgrade:** any failure restores the pre-upgrade state from the backup.

---

## Flow B: bluepriNNt Version Upgrade

### Phase B0 — Detect
Run the Tier-3 upgrade scan (via `nn-preflight` `--workspace-dir`) and present the per-model classification. This is the dry run: it writes nothing.

### Phase B1 — Inform & Consent
Present upgrade options. Consent is mandatory before any mutation.

### Phase B2 — Backup
Create a timestamped backup outside the workspace:
```bash
node skills/nn-upgrade/scripts/backup-workspace.js --workspace-dir <dir>
```

### Phase B3 — Impact Analysis
Diff the pinned and adopted schemas. Ask mapping questions only when the diff removes, renames, or re-types a definition in active use.

**Marker-bearing models**: a model whose documents still carry a `# NN Marker Definition` or an `item-markers matrix` is legacy. Do NOT ask marker mapping questions at upgrade time — report the `MARKERS_REMOVED` diagnostic and link to the `nn-innfo` recipe `MARKERS_REMOVED` (§8e-bis), which turns the diagnostic into a reviewable changeset.

### Phase B4 — Rehydrate & Validate
Hydrate adopted bluepriNNts, update frontmatter (`parent_spec`, `blueprint_name`), bump version, and re-validate through MCP. On validation failure, restore from the backup.

---

## Freezing slugs

When the console reports `UNFROZEN_MODEL`, freeze the element slugs of the domain's Level 3 models:
```bash
node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <dir> --freeze-slugs          # dry run
node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <dir> --freeze-slugs --apply  # write
```
The dry run lists the models and slugs it would freeze. `--apply` writes them in place. Present the dry run and get consent before `--apply`.

---

## Old or broken domain: create a new domain

When a domain is on the retired layout or cannot be upgraded, do not migrate it in place. Create a new domain and import the old one as a Source:
```bash
node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <old-dir> --import-as-source --new-domain-dir <new-dir>
```
This scaffolds a new domaiNN and copies the old tree byte-identically under the new domain's `sources/`. The old directory is never modified. The agent then derives the new domain's content from that Source (proposing changesets that cite it); the detailed recipe lives in the `init_domain` flow of the MCP.

---

## Core Rules

1. **Consent first**: No mutation before explicit user confirmation.
2. **Verified backup**: An out-of-tree backup with a SHA-256 manifest must exist before the first write of Flow B.
3. **Never half-upgrade**: A failed upgrade restores cleanly from the backup.
4. **Zero workspace pollution**: All temporary checkouts and backups stay outside the working tree.
5. **No in-place migration**: An old domain is imported as a Source into a new domain; nothing rewrites or deletes user data.
6. **No retired paths here**: This skill never names retired layouts or keys. Legacy detail lives in the procedure `upgrade_and_migrate_legacy_workspace_procedures_NN.md`; keep it that way.
