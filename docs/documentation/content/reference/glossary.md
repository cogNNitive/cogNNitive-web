# Glossary

Short definitions of the terms used across this documentation. The canonical vocabulary is defined machine-readably in [`iNNfo/specs/vocabulary.json`](../../../../iNNfo/specs/vocabulary.json); this page is the human-readable index.

| Term | Definition |
|---|---|
| **address** | The one syntax that points at a kNNowledge unit: `<hierarchical-id>[@<slug>[&<field>]]`, for example `villabotijos-today/pepper-mapache@00-gancho&voice`. References, change targets and citations of kNNowledge all use it. A title is never an address. See [Storage and identity](../concepts/storage-and-identity.md). |
| **artifact** | A producer output written under `artifacts/`. Artifacts are write-once: each output is a new family member named with a UTC suffix `_YYYYMMDDTHHmmssZ`, and existing bytes are never overwritten. |
| **blueprint_version** | The Level-2 frontmatter key that carries a bluepriNNt's version. It replaces the retired `template_version` key. |
| **bluepriNNt** | A Level-2 (L2) domain schema specification file that declares the concepts, elements, fields, and matrices a kNNowledge document must conform to. The retired aliases `template` and `app` are not used. |
| **changeset** | A sealed, recorded set of proposed graph mutations (operations) written under `changes/`. A mutating change to a kNNowledge model is synthesized into a changeset, reviewed, then applied. |
| **citation** | The `evidence` of an applied change: a pointer to a Source anchor, written with the pointer grammar `<path>@## <Heading>` (Markdown), `<csv>@<row>`, or `<json>@/<pointer>`. It is carried by the applied change, never by a model field. A citation whose target is a kNNowledge unit is an address, not a path. |
| **cognitivize** | The operation that creates or refreshes a raw file's co-located sidecar in place, leaving the original file untouched. It is surfaced through the `nn-sources` CLI (`--cognitivize <file\|dir>`) and the `cognitivize` MCP tool. |
| **collection** | The domain-wide set of instances of a concept, ordered by id. It is the same whether the instances are instance models or compact elements. |
| **compact storage** | A storage form declared per concept: all instances of the concept are elements of one kNNowledge document. A concept with no storage declaration is compact. |
| **concept** | A top-level section of an iNNfo document, introduced by the `# NN <Concept>` heading. A concept groups the elements that belong to it. |
| **console** | The user-facing UI that shows and reviews a domaiNN: the self-contained domain console (`domaiNN_console.html`, one per domaiNN). It replaces the retired Vue editor and hosted web app. |
| **defiNNition** | The Level-0 (L0) meta-specification language in which specifications are written. It is the root of the abstraction chain. |
| **distributed storage** | A storage form declared per concept (`storage:: distributed`): each instance is the root of its own kNNowledge document, an instance model, in its own folder. Child concepts stay elements of that document. |
| **domaiNN** | The container that holds a project's kNNowledge, bluepriNNts, sources, procedures, and artifacts. A domaiNN is itself a kNNowledge document. |
| **drift** | A divergence between the applied changes and the files on disk: a value edited by hand after the change that set it. `check_domain.provenance` reports it as `EDITED_WITHOUT_RECORD` in `check_domain.provenance` and `validate_knowledge`. |
| **element** | A named entry inside a concept, introduced by the `## NN <Concept>: <Element>` heading. An element carries fields and free-form prose. |
| **field** | A `key:: value` property declared on an element, concept, or document. Fields are the atomic values a schema defines and a document populates. |
| **hierarchical id** | The id of a kNNowledge document, derived only from its path and the declarations of its bluepriNNt. An instance model id is `<container-id>/<slug>`, for example `villabotijos-today/intro`. It changes when the instance moves. |
| **iNNfo** | The Level-1 (L1) concrete specification meta-template that defines the root primitives (Concept Definition, Field Definition, Matrix Definition). It is the language every bluepriNNt and kNNowledge document is written in. |
| **instance model** | The kNNowledge document of one instance of a distributed concept. Its root element is that instance, and its child concepts are elements. It lives at the path the placement rule gives. |
| **kNNowledge** | The Level-3 (L3) domain data model that conforms to a bluepriNNt. It is an uncountable noun: write "N kNNowledge documents". The retired alias `model` is not used. |
| **knowledge_version** | The Level-3 frontmatter key that carries a kNNowledge document's version. The version never appears in the file name; the retired key is `model_version`. |
| **lineage** | The record `<project>_cogNNitive_NN.md` that traces every Source, kNNowledge document, and artifact, together with the external watch roots and an append-only procedures log. |
| **model id** | The identifier of a kNNowledge document. A compact model's id is its file name without `_NN`, of the form `<name>_<blueprint>`; an instance model's id is hierarchical. It carries no version; the version lives in the `knowledge_version` frontmatter key. |
| **placement rule** | The path pattern a bluepriNNt declares with `placement::` on a distributed concept. It says where an instance model must live, for example `series/{slug}/`. |
| **sidecar** | A co-located `<file>.<ext>_sidecar_NN.md` document that records a raw file's hash, size, and metadata and, for binary files, a normalized body. It is a kNNowledge-level document that is never a model. |
| **slug** | The immutable identity of a concept, element, or matrix, declared with the `slug:: <slug>` key. Slugs stay stable across renames so citations and addresses keep resolving. |
| **source** | A raw or derived file brought into a domaiNN and made citable, living under `sources/import/` (or `sources/conversations/`) with a co-located sidecar. Sources are immutable; a changed file becomes a new write-once family member. |

## See also

- [Canonical vocabulary](../vocabulary.md)
- [The four levels](../concepts/levels.md)
- [Sources, citations and lineage](../concepts/sources-citations-lineage.md)
- [Storage and identity](../concepts/storage-and-identity.md)
