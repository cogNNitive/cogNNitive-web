# Create your first domaiNN

> [!NOTE]
> This tutorial takes about five minutes. You drive a local AI coding agent — Claude Code, OpenCode, Antigravity, or Cursor — that has the cogNNitive skills and the `nn-mcp` server installed. You express intent in plain language; the agent does the work, and you review the result in the console.

A **domaiNN** is the container that holds your knowledge: kNNowledge documents, bluepriNNts, sources, procedures, and artifacts. In this tutorial you create one, bring in a single raw file, and turn it into a cited kNNowledge document that passes validation — all by talking to your agent.

> [!TIP]
> The agent works in whatever language you write in. The prompts below are in English; use your own language and the agent answers and acts in it.

## 1. Connect your agent

Open your agent in the folder where you want to work and paste this single instruction:

> I want to use https://cognnitive.com/use

The agent fetches the bootstrap manifest, installs the cogNNitive skills, and registers the `nn-mcp` server. When it is ready, start the job loop by typing `/nn` — the agent greets you and offers the menu:

```text
[s] Sources  ·  [m] Model  ·  [r] Review & Deliverables  ·  [p] Procedures  ·  [h] Help  ·  [x] Cancel
```

**How you check it worked:** the agent lists its capabilities and shows the `nn` menu without errors. If something is missing, see [Install and connect an AI agent](../how-to/install-agent.md).

## 2. Create the domaiNN

> Create a new domaiNN here called "My Domain".

The agent scaffolds the standard layout and announces what it created. You will see:

| Path | What it holds |
|---|---|
| `domaiNN_NN.md` | The domain manifest (itself a kNNowledge document). |
| `kNNowledge/` | Your Level-3 kNNowledge documents. |
| `sources/import/` | The drop box for raw files you bring in. |
| `sources/conversations/` | Promoted conversation transcripts. |
| `artifacts/` | Every generated or curated output. |
| `procedures/` | Procedure definitions. |
| `changes/` | Proposed and applied changesets. |
| `staging/` | Scratch space (never citable). |

**How you approve:** building the standard layout is safe and reversible, so the agent proceeds without stopping you. It tells you where the domaiNN landed; if you wanted a different name or location, say so before it continues. It will not scaffold into a folder that already holds other work.

## 3. Bring in a source

Knowledge starts outside the tool. Save any text file — meeting notes, a short brief, a spec — into `sources/import/`:

```text
My-Domain/sources/import/meeting-notes.md
```

Then tell your agent:

> Import everything in `sources/import` and make it citable.

The agent scans the folder and, for each file, writes a **sidecar** next to it (`meeting-notes.md_sidecar_NN.md`) that records the file's hash and metadata. The raw file is never moved, renamed, or rewritten — it stays exactly as you saved it.

**How you check it worked:** a sidecar appears beside each raw file, and the console's Sources view lists them as citable.

## 4. Create your first kNNowledge document

A kNNowledge document is modeled from a **bluepriNNt** — a reusable domain schema. Ask your agent:

> Create a business kNNowledge document for My Domain, and model a customer element that cites the meeting notes.

The agent scaffolds the document from the `business` bluepriNNt, adds the element, and points its source at the exact heading the claim came from. It records the creation as a proposed change — never a silent edit.

**How you approve:** see the next step.

## 5. Review and approve

Every change the agent makes to your knowledge is a **changeset**: proposed, reviewed, then applied. The agent writes the proposal, regenerates the domain console, and opens it.

**How you review:** the console shows the change as a diff you can inspect. Add comments or corrections there if you want. When it looks right, reply **OK** to your agent; it applies the change atomically, bumps the document's version once, and re-points the citation at the change that touched it. Nothing is applied until you approve. See [Review changesets](../how-to/review-changesets.md).

## 6. Validate

Ask your agent to check the result:

> Validate the domaiNN and fix anything that is wrong.

The agent reports in plain language. A clean domaiNN resolves every citation. If a heading was mistyped, it tells you which element and heading do not match and offers the closest match; if a file moved, it flags the broken link. You approve any fix as a new changeset.

## What you built

You now have a domaiNN with a manifest, a citable source, and a validated kNNowledge document that cites a heading of that source. That is the smallest complete cogNNitive unit: a claim, its evidence, and a container that tracks both.

## Next steps

- [Model a domain from scratch](domain-from-scratch.md) — a longer walkthrough that adds an artifact, a change, and the lineage record.
- [The four levels](../concepts/levels.md) — the concepts behind `defiNNition`, `iNNfo`, `bluepriNNt`, and `kNNowledge`.
- [Import and cite sources](../how-to/import-sources.md) — the full citation grammar.

## Under the hood

The agent works through the `nn-mcp` server and the cogNNitive skills; you never call them yourself. For the exact tool and command surface behind these steps, see [MCP tools](../reference/mcp-tools.md) and the [CLI reference](../reference/cli.md).
