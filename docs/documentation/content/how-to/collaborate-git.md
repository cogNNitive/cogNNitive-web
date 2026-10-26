# Collaborate with Git

Git is an **optional** review and collaboration layer on top of your domaiNN. It carries branches and pull requests so people can review changes, but it never replaces the domain's own versions or changesets. Your domaiNN is the system of record; Git is transport.

No cogNNitive skill owns this workflow. If you want it, you use Git directly — a domain is ordinary files — or ask your agent to handle the Git steps for you.

## Private by default

A domaiNN routinely holds drafts, raw sources, and conversation transcripts that must not leak. Treat every new remote as **private**:

- If your host defaults new repositories to public, make it private **before** the first upload.
- Keep credentials out of the domain entirely.
- Keep scratch folders out of the record — they are never citable.

## Keep the bytes stable

Every domain ships with a small settings file that pins line endings. This is not cosmetic: a source's fingerprint is computed over its exact bytes, and the record is compared byte for byte. If Git rewrote line endings on checkout, a fingerprint would change even though the content did not, and the domain would look drifted on a clean machine. The pinned-line-endings setting prevents that.

> [!NOTE]
> Never remove the line-endings setting from a domain. If it goes missing, the agent's preflight reports a warning.

## Branch per change, review before merge

If you use Git, give each change its own branch and open a pull request rather than committing straight to the main branch. Before merging, have the change checked:

- the touched document validates against its bluepriNNt,
- the whole domain passes an integrity pass (which includes the drift gate),
- the byte-policy settings file is still in place.

Protect the main branch and require at least one approval, so a change cannot land unreviewed. You can ask your agent to run any of these checks for you.

## How changesets map onto commits

The changeset workflow and Git are complementary, not competing:

| Layer | Unit | Role |
|---|---|---|
| cogNNitive | the changeset | The semantic change: what changed, the evidence, the version bump, the audit trail. |
| cogNNitive | the document version | The system of record for a document's version. |
| Git | commit / branch / pull request | The transport and human review surface. |

A clean mapping is **one changeset per commit**:

1. Your agent proposes the change; it is recorded as a proposal.
2. You review it in the console and approve it, and the agent applies it. The applied change, the mutated documents, and the refreshed record move together.
3. Commit exactly those files on a branch, naming the changeset in the commit message.

Because the changeset is already the audit record, the commit does not need to restate the reasoning — link to it. And because a document's version is never the same as a commit id, do not try to derive one from the other: the changeset stays the source of truth.

## See also

- [Review changesets](review-changesets.md) — the changeset workflow in full.
- [Sync lineage and back up a domaiNN](sync-and-backup.md) — the drift gate and backups.
- [Validate a domaiNN](validate-domain.md) — the checks a PR should run.
