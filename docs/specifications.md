---
layout: default
title: iNNfo Specifications and Document Architecture
description: Level cascade (L0-L3), the front matter vs. Markdown body split, and the template composition (includes) model.
---

# iNNfo Specifications and Document Architecture

The **cogNNitive** ecosystem structures knowledge through the **iNNfo** specification system. Every document plays a role in a four-level cascade, where information is distributed rigorously between the **YAML front matter** (infrastructure metadata) and the **Markdown body** (domain and structure).

---

## 1. Specification Level Cascade

The iNNfo architecture defines four hierarchical, immutable levels:

| Level | Role | Main document | Purpose and syntax |
|---|---|---|---|
| **Level 0** | Meta-specification | `defiNNition` (`defiNNition_V_0-2-0_NN.md`) | Defines the meta-rules of the ecosystem, versioning (SemVer) and RFC 2119 vocabulary. |
| **Level 1** | Concrete specification | `iNNfo` (`iNNfo_V_0-5-0_NN.md`) | The adopted specification and Level-1 meta-template. Defines the `NN` syntax (`# NN`, `## NN`, `key:: value`) and the three root primitives: `Concept Definition`, `Field Definition`, and `Matrix Definition`. |
| **Level 2** | bluepriNNts (domain schemas) | `business`, `procedures`, `organization`, etc. | Instantiates the root primitives for a specific domain. Declares reusable schemas and composition dependencies (`includes`). Each carries a `blueprint_version`. |
| **Level 3** | kNNowledge documents | domain `*_NN.md` files | Concrete data and concepts. Lightweight documents that hold data plus a resolution pointer (`parent_spec`). Each carries a `knowledge_version` in front matter; the version never appears in the filename. |

The current Level-1 specification is `iNNfo_V_0-5-0`. The `Marker` primitive, the `item-markers` matrix, and the `set_marker` operation were **removed** in this revision: a document that still declares a marker is rejected with `MARKERS_REMOVED`, and `set_marker` fails with `UNKNOWN_OPERATION`. Flag markers became values of the built-in `tags` Field, valued markers became ordinary Fields, and matrix scales/cycles live directly on the `# NN Matrix Definition`.

---

## 2. Distribution Criterion: Front Matter vs. Markdown Body (`# NN`)

The boundary between the **YAML front matter** and the **Markdown body (`# NN`)** answers the design question: *"Is this a property for the resolver/infrastructure, or is it part of the knowledge model?"*.

### YAML front matter (registration and infrastructure metadata)
Answers: **"What is this file in the system, and how is it resolved?"**

This is the lightweight header that the resolver (`@cognnitive/nn-core`), the MCP server (`@cognnitive/nn-mcp`), and indexers need before (or without) parsing the full content tree.

* **Allowed metadata**: `level`, `spec_version`, `blueprint_version` (Level 2), `knowledge_version` (Level 3), `status`, `title`, `author`, `parent_spec` (the vertical pointer from a document to its parent blueprint/spec) and `includes` (Level-2 composition).

### Markdown body (structure and knowledge domain)
Answers: **"What schemas, concepts, properties or instances does this document contain?"**

It expresses the entire semantic model through the unified `NN` syntax:
* **Concept section (H1)**: `# NN <Concept>`
* **Element / instance (H2)**: `## NN <Concept>: <Element>`
* **Field properties**: `key:: value`
* **Descriptions and references**: Markdown prose with wikilinks `[[Element]]`.

---

## 3. Architectural Evolution (V_0-1-0 → V_0-2-0)

In the earliest specification versions (V_0-1-0), Level-2 bluepriNNts declared their schema definitions in YAML blocks inside the front matter (`concepts: []`, `fields: []`, `matrices: []`).

From **iNNfo V_0-2-0** onward, **schema blocks were removed from the front matter entirely**:

1. **Self-Describing Meta-Template principle**: Level-2 bluepriNNts became ordinary iNNfo documents. Their schema is expressed in the body by instantiating the Level-1 root primitives (`# NN Concept Definition`, `# NN Field Definition`, etc.).
2. **Syntactic unification**: Two grammars no longer coexist (YAML for bluepriNNts vs. Markdown/NN for kNNowledge). The whole ecosystem speaks the same unified `NN` syntax.
3. **Human readability and Git diffs**: Markdown body content is vastly easier to audit, read, and compare in version control than a nested YAML block.

---

## 4. `includes:` Logic in Front Matter

In Level-2 bluepriNNts, template composition is performed through the `includes:` property in the **YAML front matter**:

```yaml
includes:
  - name: "business-model"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business-model/spec_NN.md"
  - name: "analysis"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/analysis/spec_NN.md"
```

### Why it lives in front matter
* **It is an infrastructure dependency declaration**: `includes:` is equivalent to an `import` or `require` of external dependencies (*ingredients*).
* **Static graph resolution (DAG)**: Because it lives in front matter, the resolver can build the directed acyclic dependency graph and fetch the remote or local files before starting the AST parse of the document body.
* **Horizontal additive composition**: It is an additive union (Blueprint A ∪ Blueprint B). It does not allow *overrides* or name collisions (a collision of non-identical names produces a validation error).

---

## 5. Architecture Decision: Self-Contained Headings (`## NN <Concept>: <Element>`)

At first glance, repeating the concept name in the level-2 heading (`## NN <Concept>: <Element>`) may look like unnecessary redundancy against a shorter convention such as `## NN <Element>` subordinated to a `# NN <Concept>`.

In the **iNNfo** architecture this decision is deliberate and responds to fundamental principles of compiler design, knowledge graphs, and operational robustness:

### 1. Self-contained parsing (context-free vs. stateful)
In CommonMark and standard Markdown, headings **are not closed syntactic containers**; they are open line markers. Relying on implicit hierarchy forces the parser to hold mutable state (`currentConcept`) while traversing the document.
By including `<Concept>: <Element>` in the H2:
* Each element is an **atomic, autonomous node** that can be processed without depending on a full-tree traversal.
* It simplifies fragment (chunk) processing in RAG, embedding, and partial-AST pipelines.
* In Git, the diff hunk context header (`@@ ## NN Problems: High Latency @@`) immediately preserves the identity of the modified concept.

### 2. Semantic checksum and structural integrity (fail-fast)
The redundancy acts as an integrity-check (*checksum*) mechanism:
* The specification formally requires the H2 `<Concept>` to match the `# NN <Concept>` of its container section.
* If a user or AI agent accidentally copies, pastes, or moves a block of elements under the wrong concept, the validator (`@cognnitive/nn-core` / `@cognnitive/nn-mcp`) detects a **Concept Mismatch** and rejects the document immediately.
* Without this rule, the parser would silently attribute the element to the wrong concept, corrupting the data-model semantics without raising any syntactic error.

### 3. Lessons from the industry (Obsidian and Dendron)
This problem has been validated empirically across the structured-notes tooling ecosystem:
* **Obsidian (Dataview)**: Treating Markdown headings as implicit hierarchies for attaching metadata (`key:: value`) caused complex queries to hit severe structural limitations, due to the lack of native block containment in Markdown.
* **Dendron**: Explicitly discarded heading hierarchies for schema definitions, choosing explicit *dot-notation* (`concept.element`) to guarantee that refactors and navigation never lost the parent relation.

### 4. Dual ergonomics: humans and AI agents
* **For humans**: In long documents (hundreds of lines) the prefix acts as an immediate visual *breadcrumb* while scrolling, avoiding the need to scroll back up to recall the active concept.
* **For AI agents**: In surgical edit operations (such as block replacement within constrained context windows), agents often do not hold the top-level H1 in memory. The explicit prefix prevents "scope hallucination" and guarantees precise insertions into the document.

---

## Related Links

- [iNNfo engine documentation](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/docs/documentation/specifications.md)
- [iNNfo specification V_0-5-0](https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/specs/iNNfo_V_0-5-0_NN.md)
