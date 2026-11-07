# Synchronize an external origin

A **Synchronization** keeps a local copy of something that lives outside your domaiNN (another domaiNN on a shared drive, a folder of reference files, a file behind an `https://` URL). It is explicit: nothing runs in the background and nothing is scanned when a session starts. You decide when to refresh, and the refresh is recorded.

## Declare it

Add one element per origin to the sources catalog `sources/sources_NN.md` (`init_domain` scaffolds the file):

```markdown
## NN Synchronization: Organization
alias:: org
origin_uri:: D:/Shared/Organization
kind:: folder
state:: active
```

| Field | Meaning |
|---|---|
| `alias` | A slug that names the mirror folder. It must be unique and a safe path segment (`SYNC_ALIAS_INVALID`, `SYNC_ALIAS_DUPLICATE`). |
| `origin_uri` | A local path or an `https://` URL. A URL needs `kind: file`. |
| `kind` | `file` or `folder`. |
| `state` | `active` is refreshed; `paused` is skipped. |

## Refresh it

```bash
node skills/nn-sources/scripts/index.js --sync          # every active Synchronization
node skills/nn-sources/scripts/index.js --sync org      # only the alias "org"
```

The origin is only read, never written. An origin inside your domaiNN, or your domaiNN inside the origin, is refused. If the origin is unreachable, the existing mirror is kept, a warning is printed and the command exits with 1.

Where things land:

- **Models** (the `_NN.md` documents the origin itself would discover) are mirrored under `sources/sync/<alias>/`, keeping their relative path. A file that disappeared at the origin disappears from the mirror. Do not edit a mirror by hand: the next refresh replaces it.
- **Other files** of a plain folder, or a downloaded URL, become write-once members of `sources/import/<alias>/` with a sidecar that records `synchronization`, `origin_uri`, `origin_path` and `retrieved_at`.
- A domaiNN origin (a folder holding `domaiNN_NN.md`) contributes models only.

## Record the refresh

When something changed, the command prints a ready `propose_changeset` payload: one `comment` change targeting `sources/sync/<alias>`, with the per-file `before -> after` sha256 values in its notes. Ask your agent to apply it. The command never writes the change itself, and when nothing changed it prints nothing.

## Point at a mirrored element

Use a `reference` field whose value is the path form `sources/sync/<alias>/<path>_NN.md@<slug>`:

```markdown
responsable:: sources/sync/org/organization_NN.md@gerente
```

`check_domain` resolves it against the mirror. If the origin renames or removes the target you get `REF_ELEMENT_NOT_FOUND` (or `REF_MODEL_NOT_FOUND` when the file or alias is gone) on your field after the next refresh, which is exactly the signal you want.

### Freeze slugs at the origin

An element slug is derived from its title until it is frozen. If the origin owner edits a title, every reference to the old slug breaks. Run the freeze at the origin so the slugs stay stable:

```bash
node skills/nn-update/scripts/migrate-domain.js --domain-dir <origin-dir> --freeze-slugs --apply
```

## See also

- [Sync lineage and back up a domaiNN](sync-and-backup.md)
- [Import and cite sources](import-sources.md)
- [nn-sources](../skills/nn-sources.md)
