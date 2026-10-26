# Cognitivize documents with sidecars

**Cognitivize** is what your agent does to make a raw file citable without touching it: it reads the file and writes a small **sidecar** document next to it. The original file keeps its name, its location, and its exact bytes.

## What a sidecar is

A sidecar is a companion document named after the file it describes and placed right beside it:

```text
<file>.<ext>_sidecar_NN.md
```

For example, a notes file named `discovery-call.md` gets `discovery-call.md_sidecar_NN.md` next to it. The `_sidecar_NN.md` suffix marks it as a kNNowledge document; it is not a copy of your content, just the record that makes the file addressable.

## What the sidecar records

The sidecar holds the file's origin metadata — its name, its size, its detected format, when it was made citable, and a **fingerprint** of the file's exact bytes. That fingerprint is the change-detection key: it lets the agent tell whether the file has changed since it was last recorded.

For text-like files (Markdown, CSV, JSON) the sidecar is just metadata — the raw file itself is what gets cited. For binary files (PDF, Word, Excel) the sidecar also carries the **readable text** the agent extracted, and it is that text that gets cited.

## Why the original is never modified

Your raw file is the evidence. If it were rewritten, its fingerprint would no longer describe what you actually provided, and the whole audit trail would break. So cognitivizing:

- **reads** the file and writes only the sidecar;
- **never** moves, renames, or deletes the file;
- refreshes the sidecar **in place** when the file's bytes change.

Nothing is archived and nothing is snapshotted: a changed file simply gets its sidecar refreshed and a new fingerprint. A file the agent brought in from a link or a conversation is written once with a timestamp, so a later change to the external original lands as a separate entry and your earlier citations stay valid.

## How you trigger it

You do not run anything. Tell your agent what to make citable:

> Make these files citable.

> Refresh the sources for Aurora — some of them changed.

The agent finds the new and changed files and records them. Re-running on an unchanged file does nothing.

## When a source changes

If you edit a file that is already cited, its fingerprint no longer matches. The agent notices, refreshes the record, and warns you if any document cited a section that changed or disappeared. If a cited file is deleted, the agent reports it and keeps the sidecar rather than deleting anything without your consent.

> [!NOTE]
> The agent never rewrites or deletes a source on its own. Cleanup of superseded entries is only ever proposed for your approval.

## See also

- [Import and cite sources](import-sources.md) — how to cite the sidecar and the raw file.
- [Sync lineage and back up a domaiNN](sync-and-backup.md) — the sidecar feeds the lineage record.

## Under the hood

The agent cognitivizes through the `nn-sources` skill (any format) and the `nn-mcp` server (text, CSV, and JSON). See [CLI and scripts](../reference/cli.md) and [MCP tools](../reference/mcp-tools.md).
