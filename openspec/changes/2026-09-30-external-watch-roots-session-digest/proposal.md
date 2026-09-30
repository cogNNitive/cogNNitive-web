# Proposal: Session-Start External Watch Root Digest

## Why

External watch roots already work: a domaiNN declares `## NN External Watch Roots:`,
and `nn-trannsform --scan-external` classifies changes as `NEW` /
`EVOLVED_DYNAMIC` / `STATIC_ALERT` / `DISCONNECTED`. But the **only trigger is the
pre-authoring prompt** inside `nn-innfo` §15: it fires when an agent is about to
author or edit a model, not when a session opens. So a new client drop sitting in a
watched folder is invisible until the user happens to author something and remembers
to ask. That makes "watched folders" a manual feature, when its entire value is that
the base is checked **for you**.

The gap is a trigger, not a scanner: the classification engine, the immutable
timestamped ingestion, and the impact check all exist.

## What Changes

- **Session-start digest.** When a session opens inside a domaiNN (`nn-start`
  governance step), if the domaiNN declares external watch roots, offer exactly one
  digest of what changed — a rendering of the existing `--scan-external` output.
- **Three per-item decisions.** For each changed item: `ignore` / `postpone` /
  `import`.
  - `import` → the existing immutable timestamped snapshot ingestion.
  - `postpone` → not imported, re-offered next session (the default).
  - `ignore` → remembered **by content hash**; the same file content is never
    re-offered.
- **Persisted decision state.** A workspace-local `.cognnitive/watch-digest.json`
  (untracked) keyed by `(root, relative path, sha256)`, so decisions survive across
  sessions and machines that share the folder.
- **Non-blocking by design.** If the scan cannot run (no Node, offline, root
  disconnected, no roots declared), the digest degrades to a silent no-op and the
  session continues normally.

## Capabilities

### New Capabilities
- `external-watch-roots-session-digest`: the session-start trigger, the digest
  rendering, the three decisions, the persisted state, and the non-blocking
  degradation contract.

### Modified Capabilities
- None. Classification (`dynamic-sources-impact-check`) and ingestion are unchanged;
  this change adds a rendering and decision layer **on top of** the existing scanner
  output.

## Impact

### Affected areas
- `skills/nn-start/SKILL.md` §1/§2 — add the digest step to session governance.
- `skills/nn-trannsform/scripts/index.js` — expose the scan result as stable JSON
  (`--scan-external --json`) if not already emitted; add the state store.
- `skills/nn-innfo/SKILL.md` §15 — the pre-authoring prompt reads the same state and
  skips items already offered/decided, so the user is not asked twice.
- Workspace `.gitignore` — exclude `.cognnitive/`.
- `docs/innfo/documentation/import-modes.md` — document the session-start digest.

### Verification
- Unit: the state store keys by sha256 and is idempotent; a repeated hash is
  suppressed; a `postpone` is re-offered; `ignore` is not.
- Unit: classification output is stable and machine-readable.
- Behaviour: with no roots declared, the digest emits nothing and does not change
  session start; with a disconnected root, session start completes and reports the
  root.

### Rollback
Additive and non-mutating. Revert the commits; delete the state file. No persisted
workspace format changed, so nothing to migrate.

### Dependencies
- Builds on `--scan-external` (`skills/nn-trannsform`) and the `nn-start` governance
  protocol. No blocking dependency.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| The digest nags every session | High if unmanaged | `ignore`-by-hash + `postpone` default; only offered when roots are declared |
| Double prompt with `nn-innfo` §15 pre-authoring | Med | shared state file; the pre-authoring prompt reads and skips offered items |
| State file leaks into Git | Med | `.cognnitive/` added to the workspace `.gitignore`; assert it stays untracked |
| Silent unilateral import | Low | `import` only on an explicit choice (Zero Unilateral Mutation) |
| Scan latency stalls session start | Med | fast-path (mtime+size) already exists; cap and degrade silently |

### Success criteria
- [ ] A new drop in a declared root is surfaced at session start without the user
      asking.
- [ ] Choosing `ignore` suppresses that exact content forever; `postpone` re-offers
      next session.
- [ ] The digest alone never writes to `sources/`; only `import` does.
- [ ] No output and no delay when roots are absent or the scan is unavailable.

### Out of scope
- A filesystem daemon or background watcher.
- Auto-import without an explicit choice.
- Cross-workspace aggregation.
- Retention or compaction policy for the state file.

### Resolved decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Trigger point | Session start, from `nn-start` governance |
| 2 | Classification source | Reuse `nn-trannsform --scan-external`; no new scanner |
| 3 | Decisions | `ignore` / `postpone` / `import`, per item |
| 4 | State location | `.cognnitive/watch-digest.json` (workspace-local, untracked) |
| 5 | Default action | `postpone` (do nothing now) |
| 6 | Degradation | Silent no-op when roots absent or scan unavailable |
