# Glossary

Short definitions of the terms used across this documentation. The canonical vocabulary is defined machine-readably in [`iNNfo/specs/vocabulary.json`](../../../../iNNfo/specs/vocabulary.json); this page is the human-readable index.

| Term | Definition |
|---|---|
| **artifact** | A producer output written under `artifacts/`. Artifacts are write-once: each output is a new family member named with a UTC suffix `_YYYYMMDDTHHmmssZ`, and existing bytes are never overwritten. |
| **blueprint_version** | The Level-2 frontmatter key that carries a bluepriNNt's version. It replaces the retired `template_version` key. |
| **bluepriNNt** | A Level-2 (L2) domain schema specification file that declares the concepts, elements, fields, and matrices a kNNowledge document must conform to. The retired aliases `template` and `app` are not used. |
| **changeset** | A sealed, recorded set of proposed graph mutations (operations) written under `changes/`. A mutating change to a kNNowledge model is synthesized into a changeset, reviewed, then applied. |
| **citation** | A pointer from a kNNowledge element to a Source anchor, written with the pointer grammar `<path>@## <Heading>` (Markdown), `<csv>@<row>`, or `<json>@/<pointer>`. It is carried in a `type:: citation` field or the reserved `sources::` property. |
| **cognitivize** | The operation that creates or refreshes a raw file's co-located sidecar in place, leaving the original file untouched. It is surfaced through the `nn-sources` CLI (`--cognitivize <file\|dir>`) and the `cognitivize` MCP tool. |
| **concept** | A top-level section of an iNNfo document, introduced by the `# NN <Concept>` heading. A concept groups the elements that belong to it. |
| **console** | The user-facing UI that shows and reviews a domaiNN: the self-contained domain console (`domaiNN_console.html`, one per domaiNN). It replaces the retired Vue editor and hosted web app. |
| **defiNNition** | The Level-0 (L0) meta-specification language in which specifications are written. It is the root of the abstraction chain. |
| **domaiNN** | The container that holds a project's kNNowledge, bluepriNNts, sources, procedures, and artifacts. A domaiNN is itself a kNNowledge document. |
| **drift** | A divergence between the managed sections of the lineage record and a fresh projection of the filesystem. The drift gate reports it as `LINEAGE_DRIFT` in `nn-sources --lineage --check`, `scripts/verify.js`, and the `check_domain` MCP tool. |
| **element** | A named entry inside a concept, introduced by the `## NN <Concept>: <Element>` heading. An element carries fields and free-form prose. |
| **field** | A `key:: value` property declared on an element, concept, or document. Fields are the atomic values a schema defines and a document populates. |
| **iNNfo** | The Level-1 (L1) concrete specification meta-template that defines the root primitives (Concept Definition, Field Definition, Matrix Definition). It is the language every bluepriNNt and kNNowledge document is written in. |
| **kNNowledge** | The Level-3 (L3) domain data model that conforms to a bluepriNNt. It is an uncountable noun: write "N kNNowledge documents". The retired alias `model` is not used. |
| **knowledge_version** | The Level-3 frontmatter key that carries a kNNowledge document's version. The version never appears in the file name; the retired key is `model_version`. |
| **lineage** | The record `<project>_cogNNitive_NN.md` that traces every Source, kNNowledge document, and artifact, together with the external watch roots and an append-only procedures log. |
| **model id** | The canonical identifier of a kNNowledge document, of the form `<name>_<blueprint>`. It carries no version; the version lives in the `knowledge_version` frontmatter key. |
| **sidecar** | A co-located `<file>.<ext>_sidecar_NN.md` document that records a raw file's hash, size, and metadata and, for binary files, a normalized body. It is a kNNowledge-level document that is never a model. |
| **slug** | The immutable identity of a concept, element, or matrix, declared with the `slug:: <slug>` key. Slugs stay stable across renames so citations and addresses keep resolving. |
| **source** | A raw or derived file brought into a domaiNN and made citable, living under `sources/import/` (or `sources/conversations/`) with a co-located sidecar. Sources are immutable; a changed file becomes a new write-once family member. |

## See also

- [Canonical vocabulary](../concepts/vocabulary.md)
- [The four levels](../concepts/levels.md)
- [Sources, citations and lineage](../concepts/sources-citations-lineage.md)
