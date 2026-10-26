# Model a domain from scratch

This is the full hands-on walkthrough, driven entirely by prompts to your local AI coding agent. You will scaffold a domaiNN, bring in a source, model an element that cites it, produce an artifact, propose a change, and read the lineage record that ties it all together.

The example is a small coffee-subscription business, **Aurora Roasters**, so every step stays easy to follow. The agent works in your language; the prompts below are shown in English.

## What you will build

By the end, your domaiNN holds a manifest, a citable source, a kNNowledge document that cites it, a write-once artifact, a recorded change, and a lineage record:

```text
Aurora/
├── domaiNN_NN.md                     # the manifest (Level-3 container)
├── kNNowledge/
│   └── Aurora_business_NN.md         # a kNNowledge document
├── sources/
│   └── import/
│       ├── discovery-call.md         # raw source
│       └── discovery-call.md_sidecar_NN.md   # its co-located sidecar
├── artifacts/
│   └── Aurora_Monthly_Review_<stamp>.md      # a write-once deliverable
├── changes/
│   └── Aurora_<stamp>_changes_NN.md  # a recorded change
└── Aurora_cogNNitive_NN.md           # the lineage record
```

## Step 1 — Scaffold the domaiNN

> Create a domaiNN called Aurora.

The agent builds the manifest, the folder skeleton, and the small bits that keep source fingerprints stable across machines. An empty domaiNN is always scaffolded, never hand-built.

**How you approve:** scaffolding the standard layout is safe and reversible, so the agent proceeds and tells you where the domaiNN landed. Interrupt if you wanted a different name or location.

## Step 2 — Bring in a raw source

Knowledge starts outside the tool. Save an ordinary file into `sources/import/` — untouched, exactly as your team produced it:

```text
Aurora/sources/import/discovery-call.md
```

```markdown
# Discovery call — Aurora Roasters

## Founding team
Maya Ortiz (head roaster) and Tomás Reyes (operations) are equal co-founders.

## The offer
Two 250 g bags a month, roaster's choice, 32 USD per month, shipping included.
```

Nothing has touched this file yet — it is bytes on disk, not a citable Source. Tell your agent:

> Import everything in `sources/import` and make it citable.

The agent scans the folder and writes a **sidecar** next to each raw file. The sidecar carries the file's origin metadata — its hash, size, and format — and the raw file itself is never moved, renamed, or rewritten. For text files like this one, the raw file is the citation target; a binary (PDF, DOCX, XLSX, image) instead carries a normalized text body in its sidecar, and only that body is citable.

**How you check it worked:** a sidecar appears beside the raw file, and the console's Sources view lists it as citable.

## Step 3 — Model an element that cites a heading

A kNNowledge document is modeled from a **bluepriNNt**. Ask your agent:

> Create a business kNNowledge document for Aurora and add a Founding Team element that cites the discovery call.

The agent scaffolds the document from the `business` bluepriNNt and adds the element, pointing its source at the exact heading the claim came from (`## Founding team`). The heading text after the anchor is matched against the source, so the citation resolves to that precise section — no line numbers, and the path is always written in full.

**How you approve:** the agent records the new document and element as a proposed change rather than writing files directly. You review it in Step 5.

## Step 4 — Produce an artifact

An **artifact** is a deliverable the agent generates under `artifacts/`. Ask for one:

> Produce a monthly review artifact for Aurora from the business model.

The agent writes a **write-once** deliverable whose name carries a UTC timestamp, and it cites the kNNowledge document it drew from. Re-run it on unchanged input and it writes nothing; change the input and it writes a new family member beside the old one, so earlier citations still resolve.

**How you check it worked:** the new file appears under `artifacts/` and the console lists it as a deliverable.

## Step 5 — Propose and apply a change

The supported way to mutate a kNNowledge document is a **changeset** — never a direct edit. Ask your agent:

> Change the founding team's relationship to "Equal Co-founders (50/50)", citing the discovery call.

The agent writes a sealed changeset with status *proposed* under `changes/`, regenerates the domain console, and opens it so you can review the diff.

**How you review:** inspect the change in the console and add comments if you want. When you are satisfied, reply **OK**; the agent applies the change atomically, re-validates, bumps the document's version once, and re-points the mutated element's source at the change that touched it — which in turn carries the evidence. The agent never applies anything without your approval. See [Review changesets](../how-to/review-changesets.md).

## Step 6 — Read the lineage record

The lineage record (`Aurora_cogNNitive_NN.md`) ties everything together. Ask your agent:

> Show me the lineage record.

It presents three **projected** sections — Sources, ModelRecords, and Artifacts — each derived from the files on disk, plus an append-only journal of every pipeline run. The projected sections are a pure function of the domaiNN's files: if someone edits one by hand, the drift gate reports the mismatch, and the fix is always regeneration by the agent, never a hand edit. See [Sync lineage and back up a domaiNN](../how-to/sync-and-backup.md).

## Where everything lives

| Path | Role | How it may change |
|---|---|---|
| `domaiNN_NN.md` | Domain manifest (Level-3 container). | Through a changeset. |
| `sources/import/` | Raw, immutable sources and their co-located sidecars. | Write-once; new members, never edits. |
| `kNNowledge/*_NN.md` | Level-3 kNNowledge documents with citations. | Through a changeset. |
| `artifacts/` | Generated and curated outputs. | Write-once (UTC-suffixed). |
| `changes/` | The record of every proposed and applied change. | Append-only. |
| `<Project>_cogNNitive_NN.md` | The lineage record: projected views plus a run journal. | Derived; never hand-edited. |
| `staging/` | Ephemeral extraction buffer. | Never citable, never projected. |

## See also

- [Create your first domaiNN](first-domain.md) — the five-minute version.
- [Import and cite sources](../how-to/import-sources.md) — the citation grammar.
- [Sources, citations and lineage](../concepts/sources-citations-lineage.md) — the provenance chain.

## Under the hood

The agent drives all of this through the `nn-mcp` server and the cogNNitive skills. For the exact tool and command surface — changeset operations, the scan and lineage commands, and the sidecar format — see [MCP tools](../reference/mcp-tools.md) and the [CLI reference](../reference/cli.md). You never need to run any of it yourself.
