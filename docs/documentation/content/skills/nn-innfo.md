# nn-innfo

`nn-innfo` is the authoring, editing, and validation skill for **iNNfo** knowledge. It guides an
agent through creating and maintaining `*_NN.md` documents — both the Level-2 bluepriNNts that
define a domain schema and the Level-3 kNNowledge documents that instantiate it — and it owns the
canonical **Procedure Execution Protocol** that every other skill delegates to.

## The `nn-mcp` dependency

`nn-innfo` does not hand-resolve specifications, hand-validate documents, or guess syntax.
**Resolution, validation, and mutation are delegated to the `nn-mcp` server**, a deterministic
engine wrapping `@cognnitive/nn-core`. Key tools the skill drives:

| Tool | Role |
|---|---|
| `get_spec` | Resolve the Level-1 iNNfo specification. |
| `get_blueprint` | Resolve a Level-2 bluepriNNt from an explicit URL or a document's `parent_spec`. |
| `list_blueprints` | List available Level-2 bluepriNNts. |
| `validate_knowledge` | Validate a kNNowledge document against its bluepriNNt. |
| `init_knowledge` | Create a new Level-3 document (create-only, recorded as a change). |
| `propose_changeset` | Write a sealed changeset for review; never applies. |
| `apply_change` | Apply an intent-level change or changeset and re-validate. |
| `regenerate_console` | Regenerate and open the domain console. |

The skill's Golden Rule: the specification URL always comes from `parent_spec.url` or from the
user — never hardcoded or invented. When `nn-mcp` is unavailable, the skill falls back to
inspecting local files for the `# NN`, `## NN`, and `key:: value` syntax.

## Model Creation Wizard

Creating **any** kNNowledge document follows two separate, approved phases. No file is written
until the user confirms the plan for that phase. This is the step-by-step wizard.

### Phase A — BluepriNNt design (Level 2)

1. **Domain language alignment** — if the prompt or the sources are in a language other than
   English, the proposed Concepts, Field names, and Matrix titles are authored in that language.
2. **Base selection** — choose a canonical base: Business, Procedures, Organization, Metrics, or
   Blank (a 100% custom design).
3. **Customization only on request** — canonical bases are used as-is by default. A custom or
   Blank base is designed from scratch by consulting `get_spec` for the exact grammar of each
   primitive: Concepts, then Fields with their `type::`, then Matrices.
4. **Consolidated plan gate** — before writing the bluepriNNt file, the agent presents Concepts,
   Fields with types, and Matrices together in one block and asks for confirmation.

The bluepriNNt file is written as `<Blueprint>_spec_NN.md`, or `<Model>_<Blueprint>_spec_NN.md`
when specializing an existing base. The version lives in the `spec_version` frontmatter key, never
in the file name.

### Phase B — kNNowledge design (Level 3)

1. **Elements and crossings plan gate** — present which Elements will be created per Concept and
   which matrix crossings will be populated before writing content.
2. **Co-creation mode** — choose step-by-step (concept by concept, element by element) or full
   generation in a single draft.
3. **Naming and scaffolding** — create `{ModelName}_{Blueprint}_NN.md`. The stem ends with the
   bluepriNNt name; the version lives in the `knowledge_version` frontmatter key, not the file name.
4. **Validation and checklist** — validate with `validate_knowledge` and print the Visual
   Expectation Checklist pointing at the domaiNN console.

### Type and Matrix heuristics

- **Type heuristic** — before assigning `type:: string`, ask whether the field points to another
  Element or Concept. If yes, use `type:: reference`. Field names like `owner::`, `client::`, or
  `category::` are red flags.
- **Matrix heuristic** — a 1:N relationship with no cross-attributes is a `reference` field; an N:M
  relationship, or any relationship where each cross-point needs its own state, is a matrix.

## Editing and validation

Every content change a user should review goes through a **changeset**, never a direct file edit:
`propose_changeset` writes a sealed changeset under `changes/`, regenerates the domain console,
and opens it for review. On the user's OK, `apply_change` applies it and re-validates. Renames
(`rename_concept`, `rename_element`) also go through `apply_change`, so WikiLinks, matrices, and
cross-references update deterministically.

When the user selects **Audit & validate**, the skill runs deterministic syntactic validation and
then acts as an **Architecture Assistant**, evaluating four layers — Formal Correctness, Logical
Coherence, Semantic Coherence, and Solidity/Robustness — and explaining each finding's functional
impact with a one-click fix.

## Procedure execution

`nn-innfo` owns the canonical **Procedure Execution Protocol**: discovery from the active
document's `## NN Procedure:` sections, bluepriNNt `procedures:` frontmatter, and
`procedures/*_NN.md`; step ordering from the `next::` chain; output routing to `artifacts/`; and
delegation to the owning skill when a step declares an NN Tool or embedded skill. Other skills link
to this protocol rather than restating it.

## See also

- [nn](nn.md) — the front controller that routes authoring work here.
- [nn-sources](nn-sources.md) — the ingestion skill that provides citable sources.
- [The four levels](../concepts/levels.md) — L0–L3 and the domaiNN container.
- [MCP tools](../reference/mcp-tools.md) — the full `nn-mcp` tool surface.
