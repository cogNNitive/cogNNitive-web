# nn-preflight

`nn-preflight` is the **environment readiness and integrity gate** for cogNNitive workflows. It runs
deterministic checks, reports blockers, warnings, and confirmations, and it never fabricates a pass
for a check that was not run. It also owns two shared contracts: the **canonical activation gate**
that every other skill delegates to, and the **canonical skill-location reference**.

## The activation gate

Every cogNNitive skill executes the same canonical activation gate before answering any question or
running any task. The gate has three parts:

1. **Session greeting banner** — print `🔧 You're using skill: <skill-name> (<emoji>)` as the very
   first output line (session-scoped: once per conversation).
2. **Deterministic integrity runner**:
   ```bash
   node scripts/preflight-check.js
   ```
   The fallback path is `node ~/.agents/skills/nn-preflight/scripts/preflight-check.js`.
3. **Exit-code handling with a consent gate**:

| Exit code | Meaning | Action |
|---|---|---|
| `0` | All components installed and up to date. | Proceed without interrupting the user. |
| `1` | Warnings, outdated components, or unnormalized sources. | HALT, show the report, and ask for consent before updating. |
| `2` | Runtime blocker. | Abort and inform the user that Node.js >= 18 is required. |

Consumer skills must delegate to this protocol rather than duplicating the script command, paths,
or exit-code branching. `nn` is the sole gate owner for a session; other skills skip the check when
`nn` already ran it.

## Tier 1 checks (always run)

- **Preflight and integrity runner** — verifies Node.js >= 18, manifest reachability, installed
  skills against pinned commits, `nn-mcp` bundle availability, skill dependencies
  (`node_modules`), and packaged bluepriNNts. With `--workspace-dir <dir>` it also audits domaiNN spec
  freshness and runs the **Universal Source Integrity Audit** across `sources/import/` and
  `sources/conversations/`.
- **Node.js** — require >= 18.
- **`nn-mcp` availability** — call `nn-mcp_list_knowledge`; if unavailable, fall back to checking
  that the bundle exists at `~/.agents/mcp/nn-mcp.bundle.js` or `.cogNNitive/mcp-bundle.js`.
- **Skill dependencies integrity** — every installed skill with a `package.json` has a resolvable
  `node_modules`.
- **domaiNN layout** — the expected directories exist (`sources/`, `conversations/`,
  `artifacts/`, `kNNowledge/`, `procedures/`, and the index). There are no fallbacks to retired
  folders: a domain still on the retired layout is replaced, not classified.

### Source integrity audit

When `--workspace-dir` is provided, the audit discovers raw files across `sources/import/` and
`sources/conversations/` (sidecars are not sources; `staging`, `archive`, and dot folders are
skipped) and verifies that every raw file has a co-located sidecar whose `sha256` matches the hash
of the raw bytes. It classifies findings as:

| Finding | Meaning |
|---|---|
| `unnormalized` | Raw file with no sidecar — actionable warning. |
| `stale` | Sidecar hash mismatch — actionable warning. |
| `dangling` | Sidecar whose raw file is gone — warning only; preserved. |
| `raw-media` | Untranscribed media binary — informational; does not flip the exit code. |
| `text-policy-missing` | `.gitattributes` lacks `* -text`; line-ending conversion can break raw-byte hashes. |

Actionable findings recommend `node skills/nn-sources/scripts/index.js --scan` or
`--cognitivize <path>`. The audit emits a structured `sources_integrity` payload in `--json` mode.

## Tier 2 checks (optional — iNNfo output workflows)

- **iNNfo output workspace structure** — for Level-3 workflows, verify the model directory holds
  `*_NN.md` files and that the index exists with its entry point.
- **Semantic link validation** — parse every Level-3 document and verify that each path in its
  `sources:: [...]` metadata exists physically in the workspace; report missing or dangling
  sources as warnings.

## Tier 3 checks (informational — workspace upgrades)

When `--workspace-dir` is provided and the workspace contains Level-3 documents, the upgrade scan
(`scripts/upgrade-check.js`) fetches the committed Level-2 catalog
(`iNNfo/specs/bluepriNNts/catalog.json`, overridable with `--template-catalog-url`) and classifies
each document's pinned `parent_spec` against the catalog's adopted version: `current`,
`upgrade-available` (with major/minor/patch gap), `ahead`, or `unlisted`.

Available upgrades are **informational** — they never flip the exit code to a blocker. If the
catalog is unreachable, the scan degrades to a non-blocking `offline` notice. Migration is handled
by [nn-upgrade](nn-upgrade.md), never by preflight.

## Report format

The report presents exactly three sections — **Blockers**, **Warnings**, and **OK** — as bullet
lists, followed by the language-preference footer. A check that was not run must not be listed as
OK. If a blocker exists, the invoking skill asks the user before continuing.

## Canonical skill-location reference

`reference/skill-locations.md` is the canonical record of installed skill and MCP-bundle locations,
plus a manual-only PowerShell reference for junction/symlink detection. It is consumed by
[nn-skills-lifecycle](nn-skills-lifecycle.md) and by every skill that needs a path; consuming skills
must not hardcode paths. Automated install, update, and sync come from the bootstrap manifest
instead — see [nn-skills-lifecycle](nn-skills-lifecycle.md).

## See also

- [nn](nn.md) — the front controller and sole gate owner per session.
- [nn-upgrade](nn-upgrade.md) — the owner of the upgrade flow Tier 3 detects.
- [nn-skills-lifecycle](nn-skills-lifecycle.md) — manifest-pinned install and update.
- [Install and connect an AI agent](../how-to/install-agent.md) — the setup this gate verifies.
