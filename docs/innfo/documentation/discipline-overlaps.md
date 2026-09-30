# Disciplines cogNNitive Overlaps With

cogNNitive does not invent a new discipline: it **recombines several well-established ones** on a shared substrate — plain Markdown, Git version control, and deterministic validation. This document maps those overlaps and explains what each shares.

---

## Core Overlaps

### 1. Model-Driven Engineering / Metamodeling (MDE · MDA · MOF)

iNNfo's four-level cascade (`defiNNe` → `iNNfo` → apps → models) is a formal **metamodeling architecture**: a meta-specification (Level 0) defines the language used to describe apps (Level 2), which in turn are the metamodels against which concrete instances (Level 3) are validated. The resolver walks the parent chain, validation is deterministic, and references are immutable (*write-once*). Structurally, this is the same problem solved by **OMG MOF/MDA** (M3→M0 layers) and DSL engineering tooling (Eclipse EMF, Xtext).

Unlike MOF/MDA, iNNfo does not generate code or PIM→PSM transformations: its output is validated knowledge models and derived artifacts (dashboards, summaries), not executable artifacts.

### 2. Knowledge Management (KM)

The commercial positioning is explicit: a *Knowledge Evolution Framework* that turns **tacit** knowledge (what lives in the team's heads) and **explicit** knowledge (PDFs, DOCX, spreadsheets, meetings) into a living base that is validated and enriched on every pass. This is Nonaka–Takeuchi's tacit↔explicit cycle, with the addition of deterministic validation and AI-agent consumption. The `A ⇄ K` paradigm makes the cycle explicit: any file goes in, is decomposed into structured knowledge, and is recomposed into another artifact, reversibly.

Classic KM usually stops at capture, classification, and search; cogNNitive adds a verifiable contract (validation against an app) and origin traceability.

### 3. Enterprise Architecture (EA)

The Level 2 apps (`business`, `organization`, `procedures`) operate as domain *viewpoints*, and intersection matrices (for example `WORK → ROLES`) act as relationship matrices between domains. Together —metamodel + viewpoints + typed relationships + matrices— they reproduce the conceptual scaffolding of frameworks such as **TOGAF** and notations such as **ArchiMate**.

cogNNitive does not implement an ADM (Architecture Development Method) or a governed EA repository; it provides the *language* to model the architecture, not the corporate governance process.

### 4. Ontology Engineering / Knowledge Graphs

iNNfo defines itself as a **Knowledge Network** with five formal levels of relationships (hierarchical/taxonomic, structural via matrix, by attribute, contextual via mention, and submodel composition), plus WikiLinks and an open taxonomy with progressive enhancement. Concepts, elements, typed fields, and references compose a directed graph with backlinks, structurally analogous to an RDF/OWL graph and to SKOS schemas for controlled vocabularies. It is also 100% compatible with Google Cloud's **OKF v0.1** (Open Knowledge Format).

It is a *descriptive* graph, with no inference engine or automated reasoning: there are no axioms, subsumption, or OWL-DL-style reasoners.

---

## Direct Overlaps

### 5. Docs as Code

Documentation is treated as source code: plain text (Markdown) versioned in Git, reviewed through branches and pull requests, built and published automatically, with the repository as the single source of truth. cogNNitive's own public website is a Jekyll site generated from `docs/`, and the design deliberately favors readable Git diffs and write-once versioned artifacts over real-time collaboration.

Docs as Code optimizes the *authoring and publishing* of documentation; cogNNitive layers a validated semantic model and an agent-consumption channel (`innfo-mcp`) on top, which Docs as Code does not prescribe.

### 6. Personal Knowledge Management (PKM) — Obsidian, Logseq and peers

There is a category of tools —**Personal Knowledge Management (PKM)**, also called *networked note-taking* or *Tools for Thought*— whose best-known exponent is **Obsidian**, alongside **Logseq**, Roam Research, Notion, Tana, Dendron, Foam, and Athens. Their core mechanic is **bidirectional linking (backlinks)** over local Markdown, with a graph view, block references, and atomic notes, often following Niklas Luhmann's **Zettelkasten** method. iNNfo shares their substrate (local-first Markdown, WikiLinks `[[...]]`, navigable graph, index notes of the *Map of Content* kind) and, in fact, **learns from their limitations**: the specification explicitly cites Obsidian and Dendron to justify decisions such as making each element a self-contained node robust to refactoring.

PKM is personal and atomic: loose notes meant to be understood by a person, with no mandatory schema and no validation. cogNNitive scales it to the team and the agent: the same act of linking, but with a **mandatory schema, deterministic validation, source traceability, and MCP consumption**. Put another way, iNNfo is to PKM what a metamodel is to a pile of notes: the same network intuition, but with a verifiable contract.

---

## The Differentiator

The value of cogNNitive does not lie in any one of these disciplines on its own, but in their **intersection**: formal metamodeling + knowledge management + deterministic validation + Git/Markdown substrate + AI-agent consumption. None of the disciplines above covers all five at once.
