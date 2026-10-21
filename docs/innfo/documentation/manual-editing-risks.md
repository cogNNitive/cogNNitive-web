# Editing Models by Hand

iNNfo models are plain Markdown, so you *can* open a `_NN.md` file in a text editor and change it.
Nothing blocks that, but it is **unsupported for routine changes**: a hand edit bypasses the checks and
the change record that every supported path keeps for you. You own that risk. This page says what can
go wrong silently and what to do instead.

## What can go wrong

| Hand edit | What happens |
| :--- | :--- |
| Copy-pasting an element section (`## NN Concept: Name`) | The copy repeats the original's immutable `slug::`. The validator reports `DUPLICATE_SLUG` as an **error**, so the model no longer validates, and nothing downstream can tell the two elements apart. |
| Renaming an element or concept | List references, matrix entries and wikilinks that name it are not updated and dangle. In a model whose slugs are not frozen, the element also gets a new derived slug, so citations to it break. `apply_change` with `rename_element` updates the header, references, matrix entries and wikilinks in one transaction. |
| Changing a value | The element's content hash changes. A console built earlier is stale, a reviewer's *reviewed* mark turns into *changed*, and open review drafts are flagged *target changed*. No changeset records who changed what, or why, so the lineage History tab has nothing to show. |
| Editing a source, a sidecar, or an older member of a write-once family | Sidecar `sha256` values no longer match the raw bytes, and writes that depend on them stop with `HASH_MISMATCH`. Sources are fingerprinted so that drift is detectable; hand-fixing the hash hides the drift instead of resolving it. |
| Editing a changeset under `changes/` | A proposed changeset is sealed with `proposal_sha`. A tampered proposal is refused with `PROPOSAL_TAMPERED` and nothing is applied. |

Several of these fail only later, when something else reads the model: a stale console, a dangling
citation, or a rejected changeset. That distance between the edit and the symptom is the real hazard.

## What to do instead

Route every graph change through a changeset, which is validated before it is written and recorded
afterwards:

1. **Ask your AI agent.** It proposes the change with `propose_changeset`, the domain console opens so
   you can review it, and on your approval it applies it with `apply_change`.
2. **Review in the console.** Edit elements, then use **Export changes**. Hand
   the exported `_changes_NN.md` file to the agent, which applies it with `apply_change`. See the
   [reviewer guide](reviewer-guide).
3. **Use the typed operations** (`update_field`, `add_element`, `remove_element`, `rename_element`,
   `rename_concept`, `update_matrix_cell`) rather than copying sections. See [nn-mcp](nn-mcp).

If you do edit by hand:

- Never copy an element's `slug::` line. Delete it on the copy and give the copy a unique name.
- Run `validate_knowledge` on the model straight afterwards, then `regenerate_console` so the console
  matches.
- Review the Git diff before you commit; see [collaboration with Git](collaboration-git).
- Leave sources, sidecars and `changes/` files alone: they are write-once.

For validator messages and how to resolve them, see the [validator behavior](validator-behavior) page.
