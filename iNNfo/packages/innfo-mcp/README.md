# @cognnitive/innfo-mcp

Model Context Protocol (MCP) server wrapping `@cognnitive/innfo-core` for the `cogNNitive` ecosystem. Exposes deterministic tools over stdio transport for knowledge parsing, validation, multi-tier blueprint resolution, transitive asset discovery, safe reachability pruning, and intent-level mutations.

---

## Tool Reference

### Knowledge & Spec Tools

- **`list_knowledge`**: Scans the domaiNN `kNNowledge/` directory for valid iNNfo knowledge documents.
- **`read_knowledge`**: Parses an iNNfo knowledge document by ID into structured AST/JSON.
- **`get_spec`**: Resolves the Level-1 iNNfo specification from an explicit URL or knowledge `parent_spec.url`.
- **`get_blueprint`**: Resolves a Level-2 blueprint document from a URL or knowledge parent chain.
- **`validate_knowledge`**: Validates a Level-3 knowledge document against its blueprint schema, returning diagnostics.
- **`validate_knowledge_url`**: Validates a knowledge document fetched directly from a URL without local disk writes.
- **`validate_blueprint`**: Validates a Level-2 blueprint against its Level-1 spec.
- **`init_knowledge`**: Initializes or scaffolds a Level-3 knowledge file with canonical frontmatter and section structure.
- **`apply_change`**: Applies deterministic intent mutations (add field, rename concept/element, `bump_version`).
- **`query_units`**: Queries atomic knowledge units and citations across the domain.
- **`resolve_sources`**: Resolves raw source provenance links and citations.

### Blueprint Package & Discovery Tools

- **`list_blueprints`**: Scans and lists all Level-2 spec blueprints available across 4 local tiers (workspace package, workspace flat, global cache, installed skills).
- **`hydrate_blueprint`**: Hydrates (copies) a Level-2 spec blueprint from global or skill stores into the active workspace package directory (`specs/bluepriNNts/<name>/<version>/`) atomically with write-once cache immutability.
- **`list_blueprint_procedures`**: Discovers procedures defined in a blueprint and its transitively included blueprints up to depth 10, deduplicating by procedure `id`.
  - Arguments: `knowledge_id`, `blueprint_name`, `version`, `url`, `root`.
- **`list_blueprint_skills`**: Discovers agent skills defined in a blueprint and its transitively included blueprints up to depth 10, deduplicating by skill `name`.
  - Arguments: `knowledge_id`, `blueprint_name`, `version`, `url`, `root`.

### Domain Management Tools

- **`sync_domain_manifest`**: Synchronizes domaiNN manifest entries with on-disk `kNNowledge/` documents.
- **`check_domain`**: Validates domaiNN structure, entrypoint `domaiNN_NN.md`, and integrity.

---

## Versioned Tool Envelopes

Every successful tool result is a **versioned machine envelope**. The payload keys are preserved at the top level alongside a `version` field of the form `innfo-<tool>@<major>`:

```json
{
  "version": "innfo-validate-knowledge@1",
  "valid": true,
  "errors": [],
  "warnings": []
}
```

Tools returning a list wrap it under a named key:

```json
{
  "version": "innfo-list-knowledge@1",
  "knowledge": [ { "id": "Ghostbusters_V_0-1-0_business_NN" } ]
}
```

Consumers MUST check `version` before parsing a result. Optional fields may be added within a major version; a breaking shape or meaning change requires a new major (bumping the envelope contract in `@cognnitive/innfo-core`, `src/envelope.ts`). Helpers: `envelope(contract, payload)`, `envelopeList(contract, key, items)`, `envelopeVersion(contract, major)`.

---

## Frontmatter Composition & `alias` Syntax

When a Level-2 blueprint composes peer blueprints via `includes`, explicit frontmatter `alias` maps resolve naming collisions prior to schema merging:

```yaml
---
level: 2
blueprint_version: "V_0-2-0"
title: "Composite Domain Blueprint"
parent_spec:
  name: "iNNfo_V_0-3-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"
includes:
  - name: "business"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/business/V_0-2-0/spec_NN.md"
    alias:
      concepts:
        "Task": "BusinessTask"
      fields:
        "Item.status": "Item.business_status"
  - name: "projects"
    url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/projects/V_0-2-0/spec_NN.md"
    alias:
      concepts:
        "Task": "ProjectTask"
procedures:
  - id: "domain-audit"
    name: "Domain Audit"
    path: "procedures/audit_NN.md"
skills:
  - name: "nn-domain-agent"
    repo: "cogNNitive/actioNN"
    path: "skills/nn-domain-agent"
---
```

---

## 4-Tier Resolution Architecture

`innfo-mcp` resolves blueprint dependencies across four fallback tiers:

1. **Workspace Package Directory**: `./specs/bluepriNNts/<name>/<version>/`
2. **Workspace Flat Fallback**: `./bluepriNNts/<name>_V_<version>_NN.md` or `./specs/`
3. **Global User Cache**: `~/.agents/bluepriNNts/<name>/<version>/`
4. **Installed Skills Directory**: `~/.agents/skills/*/bluepriNNts/<name>/<version>/`
