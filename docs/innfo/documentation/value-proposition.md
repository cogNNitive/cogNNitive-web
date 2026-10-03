# Why cogNNitive

cogNNitive turns knowledge scattered across human minds, documents, spreadsheets
and data drops into a **living, structured knowledge base made of plain-text
Markdown files inside your own Git repository**. An AI agent does the
structuring; the artifacts are ordinary files you own and can open with any text
editor.

The pitch in one line:

> Instead of re-uploading documents to a chat every time, you import them once,
> normalise them once, and every future AI session reads exactly the slice it
> needs — with a citation back to the original.

---

## The problem with talking straight to a general model

Attaching files to a chat (GPT, Gemini, Claude, or an ad-hoc scripted pipeline)
works, but it costs you on every single session:

| Friction | What it costs you |
| :--- | :--- |
| You re-select context by hand | Time, and the risk of forgetting a relevant file |
| The model re-reads whole documents | Tokens, latency, and attention diluted by irrelevant text |
| Nothing records *which* paragraph justified *which* statement | Manual, unrepeatable verification |
| Answers drift as the corpus grows | No warning when a change breaks a downstream claim |
| The corpus lives in a vendor account | Lossy export, proprietary format, rented knowledge |

cogNNitive is the same workflow with those five frictions removed — not by a
smarter model, by **structure around the model**.

---

## The four pillars

| Pillar | What it means | Mechanism |
| :--- | :--- | :--- |
| **Efficiency** | Import once, reuse forever; feed the model only the slice it needs. | Source normalisation, a sources catalog of short summaries, and bounded model reads. |
| **Traceability** | Every model statement points to an exact heading in an exact source version. | `sources::` citations, write-once source families, the lineage record. |
| **Versatility & review comfort** | Review in a text editor, a visual web app, or a conversation — same files. | Text editors, iNNfo Modeler, AI agents; reviewer feedback re-ingests. |
| **No vendor lock-in** | Plain Markdown plus Git; the knowledge is yours forever. | Files on disk; Git is the copy-of-record and the collaboration layer. |

### Efficiency

The expensive work happens **once**. A raw file is copied verbatim, fingerprinted
with a hash, and cognitivized in place a single time — it is never
re-processed in later sessions. A catalog entry keeps a one-to-two-sentence
summary of every source, so an agent decides *what* to open from the summaries
instead of loading everything. Large sources can split into a cheap summary file
and a full-text file. Because the agent asks for a bounded slice rather than the
whole corpus, it reads less and answers with less noise.

### Traceability

Citations are anchored to a heading, never to a line range:
`sources:: [sources/import/pricing_memo.md@## Manhattan Rates]`. Each source keeps
its own version history inside the workspace as write-once family members,
answering *"what exact version did this model see at time T?"* even if no commit
was made. A lineage record ties Sources, ModelRecords, and Artifacts together, and
an impact check warns you when a living source changes in a way that breaks a
downstream citation.

### Versatility & review comfort

The same files are readable three ways without conversion — a plain editor, the
zero-install web modeler, or an AI agent. Reviewer feedback is a first-class
input: reviewer consoles export structured feedback that re-enters the pipeline
and can be applied to the model with a diff preview.

### No vendor lock-in

The knowledge base is Markdown, the history is Git, the collaboration is
GitHub or GitLab. There is no proprietary store and no required cloud. Git gives
shared history, rollback, and release anchors; a native versioning convention
gives each artifact an immutable identity. The two are complementary — see
[Sources, Citations & Lineage](sources-citations-lineage) for the boundary.

---

## What cogNNitive is NOT

Clear boundaries keep the ecosystem honest:

- **Not a database engine** — models are Markdown files in your repository.
- **Not a closed SaaS platform** — it runs locally, or in your browser.
- **Not a script runner** — `_NN.md` documents are declarative data, nothing more.
- **Not a one-shot converter** — the lifecycle is continuous, verified, reversible.

---

## Where to go next

- [Import Modes & Dynamic Sources](import-modes) — what happens when a new file lands.
- [Sources, Citations & Lineage](sources-citations-lineage) — how provenance is tracked.
- [Lifecycle Walkthrough](lifecycle-walkthrough) — the end-to-end pipeline by example.
