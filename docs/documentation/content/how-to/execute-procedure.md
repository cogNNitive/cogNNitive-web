# Execute a procedure

A **procedure** is a reusable, step-by-step way of working that lives inside your domaiNN. You do not run it yourself: you ask your agent to run it, and the agent follows the procedure's declared steps in order, writing each output where the procedure says.

## What a procedure is

A procedure is a Level-3 kNNowledge document that conforms to the `procedures` bluepriNNt. Its body declares ordered **Work** steps, each with an input, an output, and a `next::` pointer to the following step. Because it is an ordinary kNNowledge document, it validates, versions, and is cited like any other.

## 1. Ask for the available procedures

Tell your agent something like *"what procedures can I run here?"* or *"run the monthly review procedure"*. The agent discovers the candidates from three scopes:

| Scope | Where procedures come from | Badge |
|---|---|---|
| **Model** | `## NN Procedure:` sections inside an active kNNowledge document. | `[model]` |
| **Blueprint** | The `procedures:` frontmatter of the parent bluepriNNt (also listed by the `list_blueprint_procedures` tool). | `[blueprint]` |
| **Domain** | `procedures/*_NN.md` files at the domaiNN root. | `[domain]` |

When the same name appears in more than one scope, the agent resolves it by precedence: **model → blueprint → domain**. If nothing declares the procedure you named, the agent says so — it never invents one.

## 2. Let the agent follow the steps

The agent reads the procedure's steps and works out the order: the **start step** is the one no other step points to, and each step's `next::` leads to the next. If a `next::` targets a step that does not exist, the agent stops and reports the broken reference instead of guessing.

Each step may declare:
- an **input** (a source, a document, or a value),
- an **output** (where the result is written),
- a **tool or embedded skill** that performs it.

## 3. Review the outputs

When a step declares an output destination, the agent writes the result there — usually **write-once** under `artifacts/`, with a UTC-suffixed name so earlier runs stay intact. When a step declares no destination, the agent asks you where to put it before writing.

If a step delegates to another skill (for example CLI ingestion to `nn-sources`), the agent loads that skill and lets it run the step rather than re-implementing it.

## 4. Keep the record

Every run appends `## NN Procedures:` entries to the lineage record, so the domain keeps a trace of what ran and when. If execution had to deviate from the declared steps, the agent captures the deviation and offers to update the procedure so the spec stays true.

> [!NOTE]
> Procedures are the agent's SOPs, not a script you maintain by hand. If a procedure is missing or wrong, ask your agent to create or edit it — that change goes through a changeset like any other model change.

## See also

- [Review changesets](review-changesets.md) — how the agent proposes and applies changes to a procedure.
- [Sync lineage and back up a domaiNN](sync-and-backup.md) — the record the runs append to.
- [nn-innfo](../skills/nn-innfo.md) — the skill that owns procedure discovery and execution.
