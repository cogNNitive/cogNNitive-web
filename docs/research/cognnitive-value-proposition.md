# cogNNitive Explained: Value Proposition, Differentiation & Import Modes

Drafted 2026-09-30 from a spoken brainstorming transcript. Every factual claim
below was verified against the working tree on the same date; the Appendix maps
each claim to the file that proves it. Anything the transcript *proposed* but the
code does not implement is labelled **[not implemented]** or **[needs design]** so
it is never mistaken for a shipped guarantee.

> **Published 2026-09-30.** The user-facing distillation lives in
> `docs/innfo/documentation/value-proposition.md` ("Why cogNNitive") and
> `docs/innfo/documentation/import-modes.md`. This file keeps the verification
> trail and the backlog.
>
> **Registered 2026-09-30.** Backlog items #1 and #2 are now OpenSpec changes:
> `openspec/changes/2026-09-30-external-watch-roots-session-digest/` (the
> session-start digest) and
> `openspec/changes/2026-09-30-source-convergence-strategies/` (the convergence
> strategies). Neither is implemented yet.

---

## 1. What cogNNitive is (one paragraph)

cogNNitive turns knowledge that is scattered across human brains, documents, and
data drops into a **living, structured knowledge base made of plain-text Markdown
files inside your own Git repository**. It runs a three-phase lifecycle —
**IMPORT → MANAGE → EXPORT** — with a human review loop back into IMPORT. A
software agent (any LLM-powered coding agent) does the structuring, but the
artifacts it produces are ordinary files you own and can open with Notepad.

> One-line pitch: *Instead of re-uploading documents to a chat every time, you
> import them once, normalise them once, and every future AI session reads exactly
> the slice it needs — with a citation back to the original.*

---

## 2. The problem: why "just use GPT / Gemini / a chat with files" falls short

The transcript's central comparison is **cogNNitive vs. talking directly to a
general model** (GPT, Gemini, Claude web UI, or an ad-hoc LangChain-style
pipeline). The naive alternative means, on every session:

1. **Re-selecting context by hand.** You pick files one by one and attach them.
2. **Re-processing the same files.** The model re-reads the whole document to
   answer a question about one paragraph.
3. **Paying in noise.** Irrelevant context dilutes attention and degrades answers.
4. **Losing the thread.** Nothing records *which* paragraph justified *which*
   statement, so verification is manual and unrepeatable.
5. **Renting your knowledge.** Your corpus lives in a vendor's account; export is
   lossy and the format is proprietary.

cogNNitive attacks each of those five, which is exactly the four benefits the
transcript names — **efficiency, traceability, review comfort & versatility, and
no vendor lock-in** — plus the setup-once philosophy underneath them.

---

## 3. The four pillars of value

| Pillar | What it means | Where it lives in the product |
| :--- | :--- | :--- |
| **Efficiency** | Import once, reuse forever; feed the model only the slice it needs. | Source normalisation + progressive-disclosure catalog + MCP bounded reads. |
| **Traceability** | Every model statement points to an exact heading in an exact source version. | `sources:: [file.md#heading-slug]` citations, per-source archive, lineage record. |
| **Versatility & review comfort** | Review in a text editor, a visual web app, or a conversation — same files. | Obsidian/VS Code, iNNfo Modeler, AI agents. Human feedback re-ingests. |
| **No vendor lock-in** | Plain Markdown + Git; you own the knowledge forever, and Git gives backup/collaboration. | Files on disk; `git` is the copy-of-record. |

### 3.1 Efficiency — the "set it up once" argument

The transcript's strongest point is that the expensive work happens **once**:

- A raw document is copied verbatim, fingerprinted with SHA-256, and normalised
  into Markdown **one time**. It is never re-processed on later sessions.
- A **sources catalog** (`sources_NN.md`) keeps a one-to-two-sentence summary of
  every source. An agent reads the summaries to decide *which* source to open,
  instead of loading all of them.
- **Progressive disclosure** is explicit in the design: very large sources split
  into `{basename}_summary.md` (cheap discovery) and `{basename}_source.md` (full
  text for deep citation).
- Because the agent asks for a bounded slice (a concept, an element, a line cap)
  rather than the whole corpus, token consumption drops and answer quality rises
  (less irrelevant context = less noise).

> **Claim to verify, not assume:** "mucho menos tokens". The mechanism is real and
> documented; the *magnitude* is not measured anywhere. See Improvement #5. Don't
> put a number in marketing copy until there is a benchmark.

### 3.2 Traceability — the argument that sells it to reviewers

- Citations are **element-level** and anchored to a **heading slug**, never to a
  line range: `sources:: [sources/import/commercial_pricing_memo.md@## Manhattan Commercial Rates]`.
  Line ranges are rejected as an error; a slug that no longer matches is a
  warning with a fuzzy "did you mean" suggestion.
- Each source keeps its **own version history inside the workspace** as
  **write-once family members**: a changed source becomes a new immutable member
  named with a UTC suffix (`_YYYYMMDDTHHmmssZ`), and the previous member keeps its
  bytes. That answers *"what exact version of this source did model X see at time
  T?"* even if no Git commit happened.
- A **lineage record** (`<Project>_cogNNitive_NN.md`) lists every Source,
  ModelRecord, Artifact, and pipeline run. The Procedures section is append-only,
  and the record's managed sections are guarded by a drift gate.
- **Drift detection**: when a living source changes, `--scan` compares the cited
  unit (heading, CSV row, or JSON Pointer) against the latest family member and
  prints `[IMPACT WARNING]` naming the downstream models whose citations no longer
  resolve. `--check-impact` audits the whole workspace on demand and exits
  non-zero on drift.

### 3.3 Versatility & review comfort

The same files are consumable three ways without conversion: a plain text editor,
the zero-install iNNfo Modeler web app, or an AI agent. Reviewer feedback is a
first-class input rather than an email thread: reviewer consoles export
structured JSON to `sources/import/feedback/`, which normalises into a source you
can cite (`#fb-001`), and a `reconcile_feedback` procedure carries accepted items
back into the model with a diff preview.

### 3.4 No vendor lock-in

The knowledge base is Markdown; the history is Git; the collaboration is
GitHub/GitLab. There is no proprietary store and no required cloud. (Git alone
does not *enforce* the write-once versioning contract — that is a native
convention — but Git is what gives shared history, rollback, and release anchors.
The two versioning systems are complementary; see
`docs/innfo/documentation/sources-citations-lineage.md`.)

---

## 4. How it works: import once, then leverage

### 4.1 Watched folders (External Watch Roots)

A domaiNN declares external folders to watch, in the lineage record:

```markdown
## NN External Watch Roots:
- Root: "D:/External_Drops/Client_Inputs"
  Cadence: "dynamic"
  Recursive: true
  Filter: ["*.pdf", "*.docx", "*.xlsx", "*.csv", "*.json"]
```

`Cadence` is only `dynamic` or `static` today. A scan inspects file metadata
(`mtimeMs`, size) as a fast path, hashes changed files, and classifies the change
as `NEW`, `EVOLVED_DYNAMIC`, `STATIC_ALERT`, or `DISCONNECTED`.

> **Correction to the transcript.** The transcript imagines the watched-folder
> check firing *automatically "when you start a session in a domaiNN"* and
> offering **ignore / postpone / import**. What actually exists is a
> **pre-authoring prompt**: when `nn-innfo` is about to author or audit a model
> that cites dynamic sources, it *offers* to scan external roots. There is no
> automatic session-start digest and no persisted "postpone" state. This is a real
> UX gap — see Improvement #2.

### 4.2 The ingestion pipeline (one-time, irreversible only by you)

```
external file ─► sources/import/   (immutable verbatim copy + UTC-suffixed name)
                       │
                       ├─ staging/                        (ephemeral extraction buffer — Whisper/OCR — never citable)
                       │
                       └─ <file>.<ext>_sidecar_NN.md      (co-located origin metadata; the raw file is the citation target)
```

- **Markdown is the point.** Markdown is the format LLMs handle natively, so
  normalisation is an *optimisation for AI consumption* — the argument the
  transcript makes well.
- **The verbatim original is never mutated, moved, or deleted** by the scanner.
- The sidecar is **co-located** with its raw file: there is no `sources/nn/` mirror
  tree. `sources/original/` and `sources/archive/` are retired and never resolved
  at runtime.
- `staging/` is *optional* and only used when a separate extraction tool
  (Whisper for audio, OCR for scans) produces an intermediate dump. It is ignored
  by scanners, Git, and models.

### 4.3 Progressive disclosure and the sources catalog

For each source, a catalog entry holds the *semantic* summary while the
normalised file holds the *physical/cryptographic* metadata (hash, timestamps):

```markdown
## NN Source: Master Rate Card 2026
type:: local_file
origin_uri:: sources/import/master_rate_card_2026.xlsx
format:: xlsx
summary:: Published hourly rates and surcharges by region for Q1 2026.
tags:: [pricing, sales]
status:: ready
source_model:: sources/import/master_rate_card_2026.xlsx_sidecar_NN.md
```

An agent scans `sources_NN.md` (zero extra disk I/O) to choose what to open. This
is the concrete mechanism behind both the efficiency and the "less noise" claim.

### 4.4 Import modes — transcript taxonomy vs. reality

The transcript describes four import modes. Here is each one mapped to what the
code actually does:

| # | Transcript's mode | Reality today | Verdict |
| :-- | :--- | :--- | :--- |
| 1 | **One-off import** — copy verbatim, normalise, done forever. | Exactly the default `--scan` behaviour: verbatim copy to `sources/import/`, hash, cognitivize in place as a co-located sidecar. | ✅ Matches. Correct the wording "originals folder" → `sources/import/`. |
| 2 | **Dynamic append** — monthly sales report adds rows to a Sales concept, never a new source. | **Does not exist.** Dynamic drops ingest as **new write-once family members** (`<stem>_<YYYYMMDDTHHmmssZ>`) forming a *source family*. Nothing appends rows *into a concept*. | ⚠️ **Mismatch — and the transcript's version is the riskier design.** |
| 3 | **Dynamic overwrite** — same file, corrected year-to-date data replaces earlier months. | **Does not exist by design.** Overwriting a source would break every citation pointing at it. The shipped answer is a new immutable family member + `superseded_by::` in the lineage record. | ⚠️ **Mismatch — recommend keeping the write-once model.** |
| 4 | **Import from console artifacts / Word / Markdown for feedback** | **Exists**, but only for *structured reviewer feedback* (`sources/import/feedback/*.json` → cite by JSON Pointer → `reconcile_feedback`). Arbitrary Word/Markdown "feedback documents" are not a dedicated path. | 🟡 Partially matches; scope is narrower than described. |

**Why modes 2 and 3 as described are a design smell.** They mutate a source in
place. In cogNNitive a source is a *citation target*, and citations are pinned to
a file + heading. Appending to or overwriting `sources/import/<file>.md` silently
changes what an existing citation means — the exact "documentation rot" the
impact checker exists to prevent. The safe formulation of the transcript's real
intent is:

- **Transport layer (sources):** always add a new immutable family member.
- **Semantic layer (kNNowledge):** an *apply procedure* upserts the new rows into
  the Sales concept as elements, with a diff preview and human confirmation.

So the data converges in the **knowledge model**, not in the **source file**. This
preserves both the audit trail and citation stability. See Improvement #1.

### 4.5 Dynamic sources and impact checking (drift detection)

When a source that models cite changes over time, the scanner imports the new
bytes as a fresh write-once family member and warns when a cited unit no longer
resolves in the latest member:

```text
⚠️  [IMPACT WARNING] A newer member of "sources/import/commercial_pricing_memo" affects downstream models:
    - kNNowledge/Ghostbusters_Operations_NN.md (Standard Class IV Elimination):
      cites "commercial_pricing_memo.md@## Manhattan Commercial Rates" [unit_missing_in_latest]
```

`--check-impact` re-audits on demand and suggests the closest matching heading.
This is the operational answer to "how do I keep the base alive without silent
rot" — and it is a genuine differentiator versus a chat where nothing tracks
staleness.

### 4.6 Tabular data, an edge the transcript half-grasps

When a source is a spreadsheet or CSV, the ingested sidecar records a **profile**
(schema + summary statistics), which is an ingestion aid. A citation targets the
raw CSV (`sources:: [sources/import/sales.csv@R12&price]`) or a curated CSV that
is its own write-once artifact. The transcript mixes "CSV as another format
Markdown can work with" with "the normalised document" — they are two different
things. Correct this in any public copy.

---

## 5. Terminology corrections (important if this feeds documentation)

The transcript repeatedly says "model", "knowledge base", and "domain". The repo
pins a canonical vocabulary; using the old words in public docs will conflict with
it:

| Transcript says | Canonical term | Meaning |
| :--- | :--- | :--- |
| "model" | **kNNowledge** | The Level-3 domain data document (`models/*_NN.md` → `kNNowledge/`). |
| "template" / "app" | **bluepriNNt** | The Level-2 domain schema (formerly Template/App). |
| "knowledge base" / "domain" / "workspace" | **domaiNN** | The container of kNNowledge, bluepriNNts, sources, procedures. A domaiNN is itself a kNNowledge document. |
| "Cognitive" | **cogNNitive** | Product name. |

The transcript's own note — *"hay que unificar knowledge base y domain"* — is
**already resolved** by the canonical vocabulary: the container is `domaiNN`. A
rename change (`2026-09-29-nn-level-nomenclature-rename`) is in flight that also
moves `templates/` → `bluepriNNts/` and `models/` → `kNNowledge/`; avoid hard-coding
the old paths in any doc written now.

---

## 6. The document-management angle

The transcript proposes benchmarking cogNNitive against a classic document manager
(Alfresco) and deciding what to build natively versus what to delegate to Git.
That is a **research task, not a shipped feature** — label it clearly.

Starting map (to be validated by the actual research):

| DM capability | cogNNitive today | Likely answer |
| :--- | :--- | :--- |
| Versioning | Per-source archive + native write-once semver + Git | Native, already strong |
| Check-in / check-out | — | Delegate to Git / branch model |
| Approval workflow | Reviewer feedback JSON + `reconcile_feedback` diff preview | Partially native |
| Audit trail | Lineage record + `git log` | Native |
| Full-text search | Sources catalog summaries + scanner index | Partial; no dedicated FTS |
| Permissions / ACL | — | Delegate to GitHub/GitLab |
| Retention / records policy | — | Out of scope; state it |

> The transcript's instinct — *"present this as an option and delegate a big bag
> of it to Git rather than building it"* — is the right architectural call. Keep
> the boundary explicit so nobody expects Alfresco-grade ACLs.

---

## 7. Assessment of the explanation itself

**What works**

- The **"configure once, benefit forever"** framing is the strongest hook: it is
  concrete (import once, normalise once) and directly contrasts with the
  chat-every-time alternative.
- The **efficiency → tokens → less noise → better answers** chain is a real,
  documented mechanism, not hand-waving.
- **Drift detection** is an under-sold differentiator: nobody expects a knowledge
  base to tell you *which* downstream statement just broke. Lead with it.
- The **four import modes** idea is genuinely useful as a *teaching frame* — it
  gives users a mental model for "what happens when a new file lands".

**What to fix**

- **Terminology drift.** "model / domain / knowledge base / Cognitive / Lambe"
  appear interchangeably. A knowledge product's credibility is its vocabulary;
  pin the canonical terms (§5).
- **Mixing present and future.** The Alfresco comparison and the "append rows to
  a concept" feature are *backlog*, not *product*. Public copy must not imply they
  exist.
- **One unverified quantitative claim.** "Mucho menos tokens" needs a measured
  number or softer wording.
- **Repetition and speech artifacts.** The raw stream repeats the import idea
  three times and is interrupted by unrelated conversation. A written version
  should be deduplicated and ordered.
- **Order of presentation.** Structure as: *problem → one-line promise → four
  pillars → how it works (import modes) → trust mechanisms (traceability,
  drift) → boundaries (what it is NOT)*. That is the shape the existing
  `docs/index.md` already uses; align with it.

**Recommended split for reuse in documentation**

1. **Public "Why cogNNitive" page** — pillars + problem contrast. Consolidate the
   value-prop material currently scattered across `README.md`, `docs/index.md`,
   `docs/innfo/about.md`, and `docs/use-cases.md`.
2. **Public "Import modes & dynamic sources" page** — §4.4 + §4.5 + a diagram.
   This is the single most useful new page; nothing documents import modalities
   in one place today.
3. **Internal backlog** — §8 as a tracked issue/openspec change, not a doc page.

---

## 8. Improvement backlog

Ranked by value-to-effort. Each notes the tradeoff so the decision is explicit.

### 8.1 Functional

> **Refined model (adopted for the docs).** The transcript conflates two axes.
> Split them: **ingestion strategy** (how a source family receives drops —
> `one-off | snapshot-series | feedback`, all shipped) and **convergence
> strategy** (how the knowledge model absorbs the data — `cite-only | upsert |
> replace-values`, none configurable yet). Principle: *sources are append-only
> and immutable; knowledge converges.* Published summary:
> `docs/innfo/documentation/import-modes.md`.

1. **Make "convergence strategy" a first-class, declarative property of a source
   family** — values: `cite-only | upsert | replace-values`. *Why:* users (and
   the transcript) already think in these modes; today the only configurable
   knob is ingestion `Cadence`. *Tradeoff:* both `upsert` and `replace-values`
   must **write to the knowledge model via a reviewable procedure**, never
   overwrite the source file — that is what preserves citation stability. This
   replaces the earlier framing of "import mode `append-family`/`replace-family`"
   because those names implied source mutation.
2. **Session-start watched-folder digest with persisted postpone state.**
   *Why:* the expectation (check on session open, offer
   `ignore / postpone / import`) is the natural UX and is currently missing — the
   only trigger is the pre-authoring prompt in `nn-innfo`. *Shape:* at session
   start in a domaiNN, read `## NN External Watch Roots:`, run
   `--scan-external`, present the classified deltas (`NEW` / `EVOLVED_DYNAMIC` /
   `STATIC_ALERT` / `DISCONNECTED`) with three actions, and persist the postpone
   set so a dismissed drop is not re-offered every session. *Tradeoff:* needs a
   small state file (a workspace cache); note there is already an untracked
   `.cognnitive/cache/` directory in this checkout whose role is unverified.
   *Touch points:* `nn-start` (session front controller), `nn-trannsform`
   (`--scan-external`), `nn-innfo` (pre-authoring prompt already exists).
3. **Source-family-aware citations** — allow a citation to resolve to "the latest
   snapshot of family X" instead of pinning one timestamped file. *Why:* today a
   monthly drop forces manual re-pointing. *Tradeoff:* trades citation
   *stability* for *freshness*; make it opt-in, keep exact-pin as the default.
4. **Alfresco/DM feature research and a native-vs-Git boundary decision** (§6).
   *Why:* turns the transcript's open question into a documented scope line.
5. **A token-efficiency benchmark** — one before/after measurement
   (chat-with-files vs. progressive-disclosure catalog) to back the claim.
   *Why:* converts the strongest marketing point from assertion to evidence.

### 8.2 Usability

6. **Publish the "Import modes & dynamic sources" page** and link it from
   `docs/index.md` §1 and the nn-trannsform skill.
7. **A single canonical "Why cogNNitive" page** to replace the current four-way
   scatter of value-prop copy.
8. **Add a "what importing costs" note** — one sentence telling the user that
   re-importing an unchanged file is a no-op thanks to the SHA-256 check.

### 8.3 Correctness / consistency

9. **Sweep the transcript into canonical vocabulary** (§5) before any public use.
10. **Do not implement in-place source append/overwrite** (§4.4) — the shipped
    write-once family model is correct; converge in the knowledge model instead.
11. **Clarify CSV profile vs. curated CSV vs. the raw source** wherever the
    lifecycle is explained (§4.6).

---

## Appendix: claim → proof

> Line numbers were correct at draft time (2026-09-30). The `nn-level-nomenclature-rename`
> wave shifted some `SKILL.md` lines and moved `iNNfo/specs/templates/` → `iNNfo/specs/bluepriNNts/`;
> treat the file paths as authoritative and the line numbers as approximate.

| Claim in this document | Verified in |
| :--- | :--- |
| IMPORT → MANAGE → EXPORT lifecycle | `README.md:9-21`, `docs/index.md:21-77` |
| Immutable originals + SHA-256 + staging + cognitivize-in-place | `README.md:19`, `skills/nn-trannsform/SKILL.md:122-144` |
| `staging/` never a citation target | `skills/nn-trannsform/SKILL.md:194` |
| Citation grammar; source/citation/lineage terms | `docs/innfo/documentation/sources-citations-lineage.md:9-18,24-44` |
| Sources catalog + progressive-disclosure summaries | `iNNfo/specs/bluepriNNts/sources/spec_NN.md:61-64,86-88`; `skills/nn-trannsform/SKILL.md:179-192` |
| Two-tier `_summary` / `_source` split | `sources-citations-lineage.md:56-61` |
| External Watch Roots, `dynamic`/`static`, `--scan-external` | `skills/nn-trannsform/SKILL.md:227-251` |
| Pre-authoring (not session-start) prompt | `skills/nn-innfo/SKILL.md:682-688` |
| Source family evolution guidance | `skills/nn-trannsform/SKILL.md:250-251` |
| Dynamic sources + impact warnings + `--check-impact` | `skills/nn-trannsform/SKILL.md:209-225`; `docs/innfo/documentation/lifecycle-walkthrough.md:140-153` |
| Per-source archive / version chain | `sources-citations-lineage.md:195-218` |
| Heading-slug citations; line ranges rejected | `sources-citations-lineage.md:81-83` |
| Lineage record sections + `--check` drift | `sources-citations-lineage.md:92-110` |
| Git vs. native semver (complementary) | `sources-citations-lineage.md:149-281` |
| Zero vendor lock-in (Markdown + Git) | `README.md:50`, `docs/index.md:97` |
| Reviewer feedback ingestion + `reconcile_feedback` | `skills/nn-trannsform/SKILL.md:200-207` |
| Row-level CSV citation + `--curate-csv` | `skills/nn-trannsform/SKILL.md:253-264` |
| Canonical vocabulary (kNNowledge / bluepriNNt / domaiNN) | `docs/innfo/documentation/vocabulary.md:11-19`; `AGENTS.md` |
