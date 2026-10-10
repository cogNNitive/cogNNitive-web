# Import Modes & Dynamic Sources

A knowledge base is only alive if new information can enter it. This page
explains **what happens when a file lands**, and how the base stays coherent when
a source an existing model already cites changes over time.

There are two distinct questions, and conflating them is the source of most
confusion:

1. **Ingestion** — how does a raw file become a citable source?
2. **Convergence** — how does the knowledge model absorb what that source says?

cogNNitive keeps these separate on purpose: sources are **append-only and
immutable**, while knowledge is **convergent**.

---

## 1. Where a file lands

```
external file ─► sources/import/   (immutable verbatim copy + UTC-suffixed name)
                       │
                       └─ <file>.<ext>_sidecar_NN.md   (co-located origin metadata; the raw
                                                          file is the citation target)
                       │
staging/               (ephemeral extraction buffer — never citable)
```

- The **verbatim original is never mutated, moved, or deleted** by the scanner.
- The sidecar is **co-located** with its raw file. There is no `sources/nn/`
  mirror tree and no `sources/archive/`.
- `staging/` is *optional* — it only holds intermediate output when a separate
  tool (speech-to-text for audio, OCR for scans) produced one. It is ignored by
  scanners, Git, and models, and is **never a valid citation target**.
- The **raw file** is citable for markdown, CSV, and JSON; a **binary** file is
  cited through the body of its co-located sidecar
  (`sources/import/report.pdf_sidecar_NN.md@## Findings`).

## 2. Watched folders (External Watch Roots)

A domaiNN can watch external folders without daemons or background processes. The
folders are declared in the lineage record:

```markdown
## NN External Watch Roots:
- Root: "D:/External_Drops/Client_Inputs"
  Cadence: "dynamic"
  Recursive: true
  Filter: ["*.pdf", "*.docx", "*.xlsx", "*.csv", "*.json"]
- Root: "Z:/Vault/Legal"
  Cadence: "static"
  Recursive: false
  Filter: ["*.pdf"]
```

A scan uses file metadata (mtime, size) as a fast path, hashes only the files
that changed, and classifies each change:

| Class | Meaning |
| :--- | :--- |
| `NEW` | A file appeared that was never ingested. |
| `EVOLVED_DYNAMIC` | A file in a `dynamic` root changed. |
| `STATIC_ALERT` | A file in a `static` root changed — unexpected, human review advised. |
| `DISCONNECTED` | A watched root is no longer reachable. |

Dynamic drops are ingested as **immutable write-once members**
(`<stem>_<YYYYMMDDTHHmmssZ>`), which form a *source family*. Existing citations
stay permanently valid because a new member never overwrites an old one. The
`static`/`dynamic` cadence only controls how often a watch root is re-checked; it
does not change whether imports are suffixed. Watch roots are only ever read —
an import never writes to a watch root.

### Session-start digest

Watching is not only an on-demand scan: when a session opens in a domaiNN that
declares watch roots, cogNNitive offers a single digest of what changed and lets
you decide per item:

- **ignore** — suppress that exact content; it is never offered again.
- **postpone** — leave it for now; it is offered again next session (the default).
- **import** — bring it in as an immutable timestamped snapshot.

Decisions are remembered per file **content** (by hash), so an edited file is
offered again while an unchanged, ignored one is not. The digest is read-only:
producing it never touches `sources/`, and it does nothing at all when a domaiNN
declares no watch roots — so it can never delay or block a session.

## 3. Ingestion strategies

| Strategy | Behaviour | Available today |
| :--- | :--- | :--- |
| **One-off** | Copy verbatim, normalise once, done. | Yes — the default scan. |
| **Snapshot series** | Each new drop in a dynamic root becomes a new immutable, timestamped source in a family. | Yes — `--scan-external`. |
| **Reviewer feedback** | Structured feedback JSON from a reviewer console ingests as a normalised source you can cite item by item (`#fb-001`). | Yes — `sources/import/feedback/`. |

## 4. Dynamic sources and impact checking

When a source that models cite changes over time (quarterly metrics, edited
interview notes, updated price lists):

1. The scan detects the change by hash and imports it as a **new write-once
   family member**; the previous member keeps its immutable bytes.
2. Existing citations keep resolving against the bytes they were written
   against — the old member is never rewritten or archived.
3. It compares the cited unit (heading, CSV row, or JSON Pointer) against the
   latest member. If a downstream citation's unit no longer resolves in the
   latest member, it prints an `[IMPACT WARNING]` naming the affected models.
4. Running the impact audit on demand re-checks the whole workspace and suggests
   the closest matching heading for any broken anchor.

This is the mechanism that keeps a living base from silently rotting.

## 5. Why a source is never edited in place

It can be tempting to "just append the new rows" or "just overwrite the file with
corrected data". In cogNNitive that is deliberately not how it works, because a
source is a **citation target**:

- A citation like `sources:: [sources/import/sales.md@## Q1]` means *"the numbers under this
  heading, in this file"*. Overwriting the file silently changes what that
  citation yields — no diff, no warning, no error.
- The write-once family answers *"what did the model see at time T?"*: every
  version has its own immutable path. Overwriting would destroy the "previous"
  side of the comparison, so the impact warning can never fire.
- Re-importing an *unchanged* file is a no-op (the hash is identical), so the
  family model costs nothing when nothing changed.

The safe pattern is therefore: **the source is superseded, never rewritten**, and
any change to the *meaning* is proposed as a reviewable update to the knowledge
model — with a diff, a confirmation, and a version bump.

## 6. Tabular data and row-level citation

A spreadsheet or CSV normalises into a **profile** (schema plus summary
statistics). The profile is an ingestion aid and is **not** a citation target. To
cite individual rows you curate the CSV with the row-key command, which writes an
RFC-4180 CSV as a write-once artifact under `artifacts/` with a unique key in the
first column. You then cite a row directly:

```markdown
sources:: [sources/import/sales.csv@2026-03]
```

The editor highlights the cited row when the source is opened.

## 7. Convergence strategies

The convergence step is now explicit and declarative. A source **family** (the
timestamped snapshot series sharing a filename stem) declares, in the domaiNN
manifest, how a new snapshot should converge into the model:

```markdown
## NN Source Family: youtube_analytics_monthly
strategy:: upsert
key:: video_id
concept:: VideoMetric
```

- `cite-only` (default) — the family behaves exactly as before: new snapshots are
  citable, and changing the model is a normal agent-guided edit.
- `upsert` — a new snapshot yields a read-only *proposal* that **adds** new keys
  and **flags** changed values for review; applying it does not overwrite a value
  without a decision.
- `replace-values` — same, but applying overwrites the changed values.

`key` is required for a non-default strategy: a single column/field that is
unique and non-empty across the snapshot. A missing, empty, or duplicated key
aborts with a non-zero exit and no proposal.

The proposal is produced by:

```bash
node skills/nn-sources/scripts/index.js --converge youtube_analytics_monthly --src <workspace>
```

It is **read-only**: it compares the two newest members of the family and never
writes `sources/import/` or the model. It reuses the session-start
watch-digest state (`.cognnitive/watch-digest.json`), so an item the user already
`ignore`d is not re-proposed, and it is **idempotent**: an already-applied
proposal yields an empty one.

Adding `--plan` turns the proposal into the exact ordered `apply_change`
operations (one `add_element` per new key, one `update_field` per changed value
for `replace-values`, and a single final `bump_version`); it requires the family
to declare a target `concept::`. `upsert` never overwrites a changed value — those
values arrive under `review` for an explicit decision.

Applying the plan is a normal reviewed mutation — a diff preview, a
confirmation, `apply_change`, and a single version bump — the same shape as
reviewer feedback. After applying, mark the family applied so re-running
`--converge` is a no-op:

```bash
node skills/nn-sources/scripts/index.js --converge-mark youtube_analytics_monthly --version <model-version> --src <workspace>
```

Removed keys are **flag-only**: convergence lists them but never deletes or
archives a model element. Prose and unstructured families stay `cite-only` —
convergence applies to keyed tabular data only.
