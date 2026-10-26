# Integrations and discipline overlaps

cogNNitive sits at the intersection of two questions: *how do we plug external tools into
an agent's workflow?* and *which established disciplines is this actually built on?* This
page answers both precisely, without pretending cogNNitive replaces any of them.

## Part A — MCP vs CLI

An external capability can reach an AI agent in two ways. They are not competitors; each
fits a different shape of work.

| | **MCP server** | **CLI** |
|---|---|---|
| Interface | Tools with declared input schemas, called over a protocol | Commands run in a shell |
| Agent sees | A typed tool with named arguments | Free-form command line and raw stdout/stderr |
| Discovery | The agent introspects the tool's schema before calling | The agent must know the command and parse its output |
| Configuration | Declared once in the client's MCP config | Depends on the shell environment |
| Best for | Structured, interactive, exploratory calls | Batch jobs, pipelines, and heavy local processing |

cogNNitive uses **both, on purpose**:

- Its semantic operations — reading, resolving, validating, proposing and applying
  changesets, querying, cognitivizing — are exposed through the `nn-mcp` server, so an
  agent can call them with typed arguments. See [MCP tools](../reference/mcp-tools.md).
- Its heavy ingestion and batch work — scanning a folder, converting a PDF, refreshing a
  single source, curating a CSV — runs through the `nn-sources` CLI, where a long-running
  local process is the right tool. See
  [CLI and scripts](../reference/cli.md).

The same split applies to third-party tools. A media-generation or cloud service that
publishes an MCP server can be called with schema-checked arguments and credentials kept
in the MCP process environment; the same service as a CLI is invoked from the shell and
its text output parsed. Neither is "better" in the abstract — the choice follows whether
the work is interactive and typed (MCP) or batch and local (CLI).

## Part B — Discipline overlaps

cogNNitive does not invent a new discipline. It recombines several established ones on a
shared substrate: plain Markdown, optional Git, and deterministic validation. What
follows is what each shares — and where the overlap stops.

### Model-Driven Engineering

The four-level chain (`defiNNition → iNNfo → bluepriNNt → kNNowledge`) is a
**metamodeling architecture**: a meta-specification defines the language used to describe
bluepriNNts, which are the metamodels against which concrete kNNowledge is validated. The
resolver walks the parent chain and validation is deterministic. This is the same problem
solved by OMG's MOF/MDA layers and by DSL tooling.

*Where it stops:* cogNNitive does not generate code and does not perform PIM-to-PSM
transformations. Its output is validated knowledge and derived artifacts, not executable
software.

### Knowledge Management

The lifecycle turns **tacit** input (what is in people's heads and meetings) and
**explicit** input (documents and spreadsheets) into a living base that is enriched on
each pass — the classic tacit/explicit cycle.

*Where it stops:* classic knowledge management usually stops at capture, classification,
and search. cogNNitive adds a verifiable contract (validation against a bluepriNNt) and
origin traceability, but it does not replace an organisation's knowledge-management
practice.

### Enterprise Architecture

The level-2 bluepriNNts act as domain **viewpoints**, and matrices act as typed
relationship matrices between domains — the same conceptual scaffolding found in
frameworks such as TOGAF and notations such as ArchiMate.

*Where it stops:* cogNNitive provides the **language** to model architecture. It does not
implement an architecture development method or a governed enterprise repository.

### Ontology Engineering

Concepts, elements, typed fields, and references compose a directed graph with backlinks
and an open, cross-cutting tag layer — structurally analogous to a knowledge graph or a
controlled vocabulary.

*Where it stops:* the graph is **descriptive**. There is no inference engine, no axioms,
and no automated reasoning.

### Docs as Code

Documentation is treated as source code: plain Markdown, versioned in Git, reviewed
through branches and pull requests, and built automatically, with the repository as the
single source of truth. cogNNitive's own site is generated this way.

*Where it stops:* Docs as Code optimises authoring and publishing. cogNNitive layers a
validated semantic model and an agent-consumption channel on top, which Docs as Code does
not prescribe.

### Personal Knowledge Management

Local-first Markdown, `[[WikiLinks]]`, a navigable graph, and index notes are shared with
personal knowledge-management tools.

*Where it stops:* those tools are personal and schema-free. cogNNitive keeps the same
linking intuition but adds a mandatory schema, deterministic validation, and source
traceability, so the knowledge scales from one person to a team and to an agent.

## The differentiator

The value is not any single overlap but their **intersection**: metamodeling plus
knowledge management plus deterministic validation, on a Markdown and Git substrate, with
an agent-consumption channel. No one of these disciplines covers all of it at once — and
cogNNitive does not claim to.

## See also

- [Ecosystem architecture](ecosystem.md)
- [The four levels](levels.md)
- [The knowledge lifecycle](knowledge-lifecycle.md)
- [MCP tools](../reference/mcp-tools.md)
- [CLI and scripts](../reference/cli.md)
