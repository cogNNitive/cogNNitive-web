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
external file ─► sources/import/   (immutable verbatim copy + hash)
                       │
                       ├─ sources/staging/   (ephemeral extraction buffer — never citable)
                       │
                       └─ sources/nn/        (normalised Markdown — the ONLY citation target)
                       │
                       └─ sources/archive/   (snapshot of the previous version on change)
```

- The **verbatim original is never mutated, moved, or deleted** by the scanner.
- `sources/staging/` is *optional* — it only holds intermediate output when a
  separate tool (speech-to-text for audio, OCR for scans) produced one. It is
  ignored by scanners, Git, and models, and is **never a valid citation target**.
- Only `sources/nn/` (the normalised Markdown) can be cited.

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

Dynamic drops are ingested as **immutable timestamped snapshots**
(`<stem>_<YYYYMMDD-HHmmss>`), which form a *source family*. Existing citations
stay permanently valid because a new snapshot never overwrites an old one.

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

1. The scan detects the change by hash.
2. It **snapshots the previous normalised version** under
   `sources/archive/<basename>/V<N>/` before overwriting the active file.
3. It compares the heading structure of the old and new versions. If a
   downstream citation points at an altered or missing heading, it prints an
   `[IMPACT WARNING]` naming the affected models.
4. Running the impact audit on demand re-checks the whole workspace and suggests
   the closest matching heading for any broken anchor.

This is the mechanism that keeps a living base from silently rotting.

## 5. Why a source is never edited in place

It can be tempting to "just append the new rows" or "just overwrite the file with
corrected data". In cogNNitive that is deliberately not how it works, because a
source is a **citation target**:

- A citation like `sources:: [sales.md#q1]` means *"the numbers under this
  heading, in this file"*. Overwriting the file silently changes what that
  citation yields — no diff, no warning, no error.
- The per-source archive exists to answer *"what did the model see at time T?"*.
  Overwriting destroys the "previous" side of the comparison, so the impact
  warning can never fire.
- Re-importing an *unchanged* file is a no-op (the hash is identical), so the
  snapshot model costs nothing when nothing changed.

The safe pattern is therefore: **the source is superseded, never rewritten**, and
any change to the *meaning* is proposed as a reviewable update to the knowledge
model — with a diff, a confirmation, and a version bump.

## 6. Tabular data and row-level citation

A spreadsheet or CSV normalises into a **profile** (schema plus summary
statistics). The profile is an ingestion aid and is **not** a citation target. To
cite individual rows you curate the CSV with the row-key command, which writes an
RFC-4180 CSV under `sources/nn/` with a unique key in the first column. You then
cite a row directly:

```markdown
sources:: [import/sales.csv@2026-03]
```

The editor highlights the cited row when the source is opened.

---

> **Roadmap.** A future refinement is to make the *convergence* step explicit and
> declarative — a named strategy per source family (cite-only, upsert elements,
> replace field values) applied through a reviewable, diff-previewed procedure.
> As of today only the ingestion side is configurable; changing the model in
> response to a new source is a normal agent-guided edit.
