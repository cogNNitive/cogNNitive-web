# nn-upgrade

`nn-upgrade` is the guided, **consent-gated** upgrade engine for a domaiNN. It owns the upgrades
that [nn-preflight](nn-preflight.md) detects: consent, backup, plan validation, and recovery. It
ships two capabilities and one maintenance option:

1. **Flow B — bluepriNNt version upgrade** (an `upgrade-available` classification): upgrades
   bluepriNNt versions for adopted documents within a current domaiNN.
2. **The new-domain pointer** (an old or broken domain): a recipe, not an in-place migration.
3. **`--freeze-slugs`** — the remedy named by the console's `UNFROZEN_MODEL` error.

## Consent, backups, and safety

- **Dry run first** — a read-only execution produces a plan report plus a deterministic `planHash`
  and writes nothing. Always run it first and show the report before asking for consent.
- **`planHash`** — a SHA over the normalized plan. The apply phase revalidates it; a mismatch
  aborts that domain with no partial writes.
- **Verified backup** — a timestamped copy of the whole domaiNN written **outside** the workspace,
  with a SHA-256 manifest (`manifest.sha256`), is required before the first write.
- **Never half-upgrade** — any failure restores the pre-upgrade state from the backup.

## Flow B — bluepriNNt version upgrade

| Phase | What happens |
|---|---|
| **B0 — Detect** | Run the Tier-3 upgrade scan via `nn-preflight --workspace-dir` and present the per-document classification. This is the dry run. |
| **B1 — Inform & consent** | Present the upgrade options. Consent is mandatory before any mutation. |
| **B2 — Backup** | Create the timestamped backup outside the workspace. |
| **B3 — Impact analysis** | Diff the pinned and adopted schemas. Ask mapping questions only when the diff removes, renames, or re-types a definition in active use. |
| **B4 — Rehydrate & validate** | Hydrate the adopted bluepriNNts, update frontmatter (`parent_spec`, `blueprint_name`), bump the version, and re-validate through `nn-mcp`. On failure, restore from the backup. |

```bash
node skills/nn-upgrade/scripts/backup-workspace.js --workspace-dir <dir>
```

### Marker-bearing documents

A document whose source still carries a `# NN Marker Definition` or an `item-markers matrix` is
legacy. Do **not** ask marker-mapping questions at upgrade time. Report the `MARKERS_REMOVED`
diagnostic and hand off to the [nn-innfo](nn-innfo.md) recipe of the same name, which turns the
diagnostic into a reviewable changeset.

## Freezing slugs

When the console reports `UNFROZEN_MODEL`, freeze the element slugs of the domain's Level-3
documents:

```bash
node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <dir> --freeze-slugs          # dry run
node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <dir> --freeze-slugs --apply  # write
```

The dry run lists the documents and slugs it would freeze; `--apply` writes them in place. Present
the dry run and get consent before `--apply`.

## Old or broken domain: create a new domain

There is **no in-place migration**. When a domain is on the retired layout or cannot be upgraded,
create a new domain and import the old one as a **source**:

```bash
node skills/nn-upgrade/scripts/migrate-domain.js --domain-dir <old-dir> --import-as-source --new-domain-dir <new-dir>
```

This scaffolds a new domaiNN and copies the old tree byte-identically under the new domain's
`sources/`. The old directory is never modified and nothing the user wrote is deleted. The agent
then derives the new domain's content from that source by proposing changesets that cite it; the
detailed recipe lives in the `init_domain` flow of the MCP.

## Core rules

1. **Consent first** — no mutation before explicit user confirmation.
2. **Verified backup** — an out-of-tree backup with a SHA-256 manifest must exist before the first
   write of Flow B.
3. **Never half-upgrade** — a failed upgrade restores cleanly from the backup.
4. **Zero workspace pollution** — temporary checkouts and backups stay outside the working tree.
5. **No in-place migration** — an old domain is imported as a source into a new domain; nothing
   rewrites or deletes user data.

## See also

- [nn-preflight](nn-preflight.md) — the Tier-3 scan that detects available upgrades.
- [nn-innfo](nn-innfo.md) — the `MARKERS_REMOVED` recipe and changeset flow.
- [The specification chain](../concepts/specifications.md) — how `parent_spec` resolution and versioning work.
