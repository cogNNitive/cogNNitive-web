# Review changesets

A **changeset** is how every meaningful change to your domaiNN happens: your agent proposes it, you review it in the console, you approve it, and the agent applies it — one recorded, reversible step. You never edit the domain's files by hand, and you never need to.

## Why changes go through a changeset

Editing a file by hand looks harmless and quietly breaks the guarantees your domain rests on: it leaves no record of who changed what, it lets citations go stale, it skips the version bump, it can detach an element from its identity, and it makes the domain's internal map disagree with the files. A changeset avoids all of that: the change is recorded, validated before anything is written, applied in one atomic step, and checked again afterward.

## The flow, from your seat

1. **You ask for a change.** Say what you want in your own words:

   > Update the founding team's equity split to 50/50.

   The agent works out the exact change, validates it, and writes a **proposal**. Nothing in your domain has changed yet.

2. **The console opens on the proposal.** The agent regenerates and opens the console, where the change appears as a diff you can inspect. You can also add your own drafts there — edit a field, leave a comment, or add a new element.

3. **You approve.** Back in the chat, reply **OK**.

4. **The agent applies it.** The change is written atomically, each touched document's version is bumped once, and the citations are updated to point at the change. The console refreshes to show the result.

> [!NOTE]
> The console is static and cannot call your agent on its own, so approval always comes back through the conversation. When the agent proposes or applies a change, it relays a short numbered notice telling you exactly what happened and what to do next.

## What you can change

You express changes as intent, and the agent turns them into the right operations. The kinds of change you can ask for include: updating an element field or a concept-level field, adding or removing an element, renaming an element or a concept, editing concept prose, adding, editing, or removing a matrix, leaving a comment for review, creating a whole new document, freezing element identities, and bumping a version. Some changes are refused when they would break a reference — the agent tells you why and offers an alternative.

## A changeset is itself a document

Every proposal is stored in the domain as a sealed, dated document under the changes area, carrying its status, its author, and the operations it contains. That record is the audit trail: because it already explains the change, a later commit or review does not need to restate the reasoning — it just links to it.

> [!NOTE]
> For large, mechanical batches, the agent can prepare the change document directly and apply it once you approve. For day-to-day work, the propose-and-review flow above is the norm.

## See also

- [Use the domain console](domain-console.md) — where the review happens.
- [Validate a domaiNN](validate-domain.md) — the diagnostics a rejected change returns.
- [Collaborate with Git](collaborate-git.md) — how changesets map onto commits.

## Under the hood

The agent proposes and applies changes through the `nn-mcp` server; the operation names and their parameters live in [MCP tools](../reference/mcp-tools.md).
