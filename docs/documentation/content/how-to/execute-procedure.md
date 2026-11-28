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

When the same name appears in more than one scope, the agent resolves it by precedence: **model → nearest scope → … → domaiNN root (`procedures/`) → bluepriNNt**. The bluepriNNt is the floor, so a procedure of your domaiNN always outranks the one the bluepriNNt ships. A procedure that loses the clash is reported as shadowed, naming the winner; it is never dropped silently, and only the selected one is offered to run. If nothing declares the procedure you named, the agent says so — it never invents one.

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

Every run records `produce_artifact` changes for the artifacts it writes, so the domain keeps a trace of what ran and when. If execution had to deviate from the declared steps, the agent captures the deviation and offers to update the procedure so the spec stays true.

> [!NOTE]
> Procedures are the agent's SOPs, not a script you maintain by hand. If a procedure is missing or wrong, ask your agent to create or edit it — that change goes through a changeset like any other model change.

## See also

- [Review changesets](review-changesets.md) — how the agent proposes and applies changes to a procedure.
- [Sync lineage and back up a domaiNN](sync-and-backup.md) — the record the runs append to.
- [nn-innfo](../skills/nn-innfo.md) — the skill that owns procedure discovery and execution.

## Request a run from the domain console

An exported console never runs a procedure and never writes to your domaiNN: it records what you decide, and the owner of the domaiNN applies it. Open **Procedures**, choose a procedure included in the export, then choose **Start a run**, fill in the fields, and select **Request the run**. The request is not running yet: use **Save your response** and send the saved HTML to the owner, who applies it with `import_console`.

The run stays private until you decide: every answer is an exported draft that only changes the run's own private record when the owner imports it, and importing the same saved file again, or a later save that still carries your earlier answers, changes nothing a second time. When a run is complete its summary shows **Hand off this run** with two choices, **Send to the administrator** and **Register with the agent**. The choice is one more answer: save your response, and when the owner imports it the choice is recorded with the run. It adds nothing to the models of the domaiNN, and a run can only be handed off once.

Each choice also opens a window that says what to do next; it only guides you, and the choice itself stays the same undoable answer until you save. **Send to the administrator** tells you to use **Save your response** and then send or share the saved HTML file with the administrator, by whatever means you use. **Register with the agent** gives the same first step and a ready-to-paste prompt for your AI agent, with a **Copy prompt** button (if your browser does not allow copying, the prompt is selected for you to copy by hand). The prompt asks the agent to import your saved console with `import_console` and `apply`, which records your choice with the run (the run id and the choice are filled in); it asks only for that import and a report of its result, and the console itself sends nothing. **Show instructions** next to your choice opens the window again, **Close** or the Escape key dismisses it, and **Undo** still removes the choice.

The **Flow** card draws the procedure as a graph: one box per step with its status written in words (not only colour), one arrow per path, and the name of the outcome on each branch. The step the run is on pulses; with `prefers-reduced-motion: reduce` it is marked by a heavier outline instead. Select a box to open its step card. Selecting the step the run is on keeps the card following the run as it advances, while inspecting any other step keeps the card on it. To use the graph from the keyboard, press Tab to focus it, use the arrow keys to move between connected steps (down and up along a path, left and right between branches), and press Enter or Space to open the focused step. **Steps as a list** under the graph holds the same steps with their status and is reachable by Tab; it opens by default on a phone. The graph is an SVG drawing laid out for the width it has, so it needs no chart library.

The same applies to answering a step. On a human step the Runner has not started yet, the answer buttons (or **Mark as done**) save the start and your answer together, so one response is enough. The step your answer leads to is shown as **Next action: save your previous response** (preview only) until the owner imports it and sends you an updated export.

For Document SOP, choose an exported Markdown brief as **Description of the process**. An excerpt is shown if the export carried one. In **Name of the new SOP**, enter a name, not a path; the form shows the destination the procedure will use.

### Declare start fields

Keep Runner inputs as `kind: value`. Add `type` to reuse the matching editor widget: `string`, `number`, `boolean`, `select`, `multiselect`, `reference`, `markdown`, or `markdown_inline`. Omit `type` for a plain text field. Optional `label` and `description` explain the input; declare string `options` for `select` or `multiselect`. Typed values are submitted as JSON values: a number is numeric, a checkbox supplies `true` or `false`, and multiple selections supply an array. These keys only shape the console form; the Runner reads a slot's `name`, `kind`, `required` and `default`, so they do not change how direct MCP callers supply parameters.

A `select` with `source: markdown-files` lists the exported Markdown briefs (not iNNfo models). Preview text is bounded and may be unavailable, and the export must include files. A text slot with `output: { directory: procedures, suffix: _procedures_NN.md }` turns a name into a relative path and shows it before submission. The offline export cannot reserve the path or see files created since export, so the procedure must still check before it writes.
