# Validate a domaiNN

Validation is how you know your domaiNN is still sound: every document matches its bluepriNNt, every citation still points at something real, and the domain's internal map agrees with the files. You do not run the checks yourself — you ask your agent, and it reports back in plain language.

## Ask your agent to validate

Tell your agent what you want checked. From the `nn` job loop this is the `[m] Model` stage, but a plain sentence works just as well:

> Validate my domain.

> Check this document against its bluepriNNt.

> Does anything in Aurora look broken?

The agent runs the checks and gives you a summary: which documents are sound, which have problems, and what each problem means for you. Validating changes nothing — it is a read-only health check.

## What you can ask it to check

- **One document** — the agent checks it against the bluepriNNt it declares.
- **The whole domain** — the agent checks every document and the links between them.
- **A single citation** — the agent follows one source reference end to end and tells you whether the file and the section it points at still exist.

## Reading what comes back

Every problem carries the same short code each time it appears, so you can search for it and act on it. You do not need to know the codes — the agent translates them — but here is what the common ones mean and how to react.

| What the agent may report | What it means | What to do |
|---|---|---|
| A cited document moved or is missing | A document cites a source file that is no longer at the recorded path. | Restore the file, or ask the agent to re-point the citation. |
| A cited section no longer exists | The source file is there, but the heading it points at was renamed or removed. | Ask the agent to re-point the citation at the right section. |
| A citation is malformed | The reference does not follow the citation grammar. | Ask the agent to fix the reference. |
| A binary file is cited directly | Media and office files must be cited through their citable companion, not the binary itself. | Ask the agent to cite the companion document. |
| A citation points into scratch space | Files in scratch folders are not part of the record and cannot be cited. | Ask the agent to bring the file into the domain's sources properly. |
| A spreadsheet has no usable key | Row-level citations need a unique, non-empty first column. | Ask the agent to curate the file so it can be cited row by row. |
| Two elements share an identity | Each element needs its own unique slug. | Ask the agent to give each element a distinct slug. |
| A document is missing its bluepriNNt link or version | The document header is incomplete or invalid. | Ask the agent to repair the header. |
| A document's structure does not match its bluepriNNt | Required sections or concepts are absent. | Ask the agent to realign the document with its bluepriNNt. |
| The lineage record has drifted | A derived section of the domain's map was edited outside the normal flow. | Ask the agent to regenerate the record — never fix it by hand. |
| A source companion does not match its file | The sidecar's recorded subject disagrees with its name. | Ask the agent to re-run the source's cognitivization. |

> [!NOTE]
> Validation never blocks you and never edits anything. When it finds a problem, the fix goes through the normal review flow — the agent proposes the change, you approve it. See [Review changesets](review-changesets.md).

## See also

- [Validator behavior](../concepts/validator-behavior.md) — severity, ordering, and the resolution order.
- [Import and cite sources](import-sources.md) — the citation grammar the diagnostics refer to.
- [Sync lineage and back up a domaiNN](sync-and-backup.md) — the drift gate in practice.

## Under the hood

The agent drives validation through the `nn-mcp` server — a single-document check, a whole-domain pass, and a citation-resolution step — and relays the results in user terms. The repository's own build gate is separate and not part of your domaiNN. See [MCP tools](../reference/mcp-tools.md).
