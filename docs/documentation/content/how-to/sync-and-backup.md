# Sync lineage and back up a domaiNN

The lineage record is your domaiNN's map: a derived document that lists every source, every kNNowledge document, and every artifact. This guide is about keeping that map honest and protecting your domain before a risky change. In both cases you ask your agent — you do not edit the record or copy folders by hand.

## Keep the map in sync

The record has four sections. Three of them are **projected** — regenerated from what is actually on disk every time a source is added, cognitivized, or a change is applied:

- the list of **Sources**,
- the list of **documents**,
- the list of **artifacts**.

The fourth section is a **journal** of what has run, and it is only ever appended to, never regenerated.

You normally do not have to think about this — the agent keeps the projection current as part of its work. If you want to be sure, just ask:

> Is my domain's record in sync?

> Rebuild the domain map.

The agent recomputes the three projected sections from the files and reports the result.

## The drift problem

Because the record is derived, its only real failure is **drift**: the stored text disagreeing with a fresh projection. That happens when a managed section is edited by hand. When the agent checks, it compares the managed sections against a fresh projection and reports drift if they differ.

**The fix is always regeneration, never a hand edit.** Ask your agent:

> Fix the drift in my domain's record.

The same drift is surfaced in a full validation pass and in the optional Git layer's checks.

> [!NOTE]
> The drift check depends on the domain keeping its line endings exactly as written; a settings file the domain ships pins this. If that file is ever missing, the agent's preflight warns you — leave it in place.

## Reconcile the document list

The domain also keeps a manifest listing its documents. When documents are added, removed, or renamed outside the normal flow, the manifest can fall out of step. Ask the agent to reconcile it:

> Reconcile my domain's manifest.

The agent first shows you the difference it would make, then applies it once you approve. It appends new entries, archives entries whose file is gone, and brings back entries whose file returned — and it never touches entries you wrote by hand.

## Back up before a risky change

Back up **before** the first mutation of anything risky, and keep the copy outside the domain folder. Because a domain is just files, an ordinary copy of the folder is a complete snapshot.

Tell your agent:

> Back up my domain before we start.

For a guided migration or upgrade, the agent takes a **verified** backup: a timestamped full copy outside the domain, together with a fingerprint manifest so the copy can be checked. It leaves out `.git`, dependency folders, and build output.

> [!NOTE]
> cogNNitive never deletes on its own. Superseded entries are only ever *proposed* for cleanup, and removal happens only with your explicit consent. A backup is additive safety, not a substitute for consent.

## The optional Git layer

Git is an optional review and collaboration layer on top of a domain. It never replaces the record or the changesets. If you use it, treat branches as review gates. See [Collaborate with Git](collaborate-git.md).

## See also

- [Validate a domaiNN](validate-domain.md) — the diagnostics that surface drift.
- [Collaborate with Git](collaborate-git.md) — the optional Git review layer.
- [Sources, citations and lineage](../concepts/sources-citations-lineage.md) — the provenance chain behind the record.

## Under the hood

The agent syncs the record and reconciles the manifest through the `nn-mcp` server, and takes migration backups with the `nn-upgrade` skill. See [MCP tools](../reference/mcp-tools.md) and [CLI and scripts](../reference/cli.md).
