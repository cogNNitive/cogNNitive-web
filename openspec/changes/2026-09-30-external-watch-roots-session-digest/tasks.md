# Tasks: Session-Start External Watch Root Digest

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350-450 total |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes (2: store+scan JSON → skill wiring+docs) |
| Delivery strategy | chained |
| Chain strategy | engine first, skill/docs second |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: engine first, skill/docs second
400-line budget risk: Medium

---

## Phase 1: Engine — State Store (TDD first)

- [x] 1.1 **RED — state store tests**: Write `skills/nn-trannsform/test/unit/test-watch-digest-store.js`: key builder is `(root, relPath, sha256)`; `ignore` suppresses the same hash and not a new one; `postpone` is re-offered; `import` is suppressed; a second write of identical input is byte-idempotent. `[external-watch-roots-session-digest:Requirement:Decision Persistence & Idempotence]`
- [x] 1.2 **GREEN — state store**: Implement `watch-digest-store.js` (read/write/upsert/prune; absent file = empty). `[external-watch-roots-session-digest:Requirement:Decision Persistence & Idempotence]`
- [x] 1.3 **Verify Phase 1**: `npm run lint`, `npm run typecheck`, `nn-trannsform` tests green.

## Phase 2: Engine — Scan JSON & Digest Command

- [x] 2.1 **RED — scan JSON test**: Assert `--scan-external --json` emits valid JSON with per-root status and per-item `NEW`/`EVOLVED_DYNAMIC`/`STATIC_ALERT`/`DISCONNECTED`. `[external-watch-roots-session-digest:Requirement:Session-Start Digest]`
- [x] 2.2 **GREEN — JSON output**: Add `--json` to `--scan-external` in `scripts/index.js` (reuse the existing classifier; no new scanning). `[external-watch-roots-session-digest:Requirement:Session-Start Digest]`
- [x] 2.3 **GREEN — digest + decide**: Add `--watch-digest` (render the filtered, un-decided items) and `--digest-decide <key> --status <ignore|postpone|import>` wiring the state store; `import` delegates to the existing timestamped ingestion. `[external-watch-roots-session-digest:Requirement:Session-Start Digest]`
- [x] 2.4 **Verify Phase 2**: `npm run lint`, `npm run typecheck`, `nn-trannsform` tests green.

## Phase 3: Non-Blocking Degradation

- [x] 3.1 **RED — degradation tests**: No roots declared → empty output; disconnected root → reported, session continues; scan failure → silent no-op with exit 0. `[external-watch-roots-session-digest:Requirement:Non-Blocking Degradation]`
- [x] 3.2 **GREEN — degradation**: Guard every failure path so the digest never blocks or throws. `[external-watch-roots-session-digest:Requirement:Non-Blocking Degradation]`
- [x] 3.3 **Verify Phase 3**: `npm run lint`, `npm run typecheck`, `nn-trannsform` tests green.

## Phase 4: Zero Unilateral Mutation Guard

- [x] 4.1 **RED — no-write test**: Running `--watch-digest` (or `--scan-external --json`) leaves `sources/import/` and `sources/nn/` byte-unchanged. `[external-watch-roots-session-digest:Requirement:Zero Unilateral Mutation]`
- [x] 4.2 **GREEN — guarantee**: Only the explicit `import` decision invokes ingestion; every other path is read-only. `[external-watch-roots-session-digest:Requirement:Zero Unilateral Mutation]`
- [x] 4.3 **Ensure `.cognnitive/` is untracked**: added `.cognnitive/` (and `**/.cognnitive/`) to the repo-root `.gitignore`; no tracked file lives under `.cognnitive/`. DEFERRED: propagating the pattern to the **workspace-emitted** `.gitignore` (nn-workspace-git Step 3a) — that skill pins its version in a contract test, so the extra pattern rides its next version bump. `[external-watch-roots-session-digest:Requirement:Decision Persistence & Idempotence]`

## Phase 5: Skills & Documentation

- [x] 5.1 `skills/nn-start/SKILL.md`: add the digest step to §1/§2 governance; bump frontmatter. `[external-watch-roots-session-digest:Requirement:Session-Start Digest]`
- [x] 5.2 `skills/nn-innfo/SKILL.md` §15: consult the shared state and skip already-decided items; bump frontmatter. `[external-watch-roots-session-digest:Requirement:Session-Start Digest]`
- [x] 5.3 `skills/nn-trannsform/SKILL.md`: document `--scan-external --json`, `--watch-digest`, `--digest-decide`, and the state file; bump frontmatter. `[external-watch-roots-session-digest:Requirement:Session-Start Digest]`
- [x] 5.4 `docs/innfo/documentation/import-modes.md`: document the session-start digest. `[external-watch-roots-session-digest:Requirement:Session-Start Digest]`

## Phase 6: Gates & Release Hygiene

- [x] 6.1 Full gates at the tip: `npm run lint`, `npm run typecheck`, the full test suite, `node scripts/check-integrity.js`.
- [ ] 6.2 Cut a `skills-v*` tag and re-pin `manifest/source.yaml` in the same batch (required because `skills/**` changed). **Version pins ARE synced** (`npm run sync:versions` → nn-start/nn-trannsform/nn-innfo bumped in frontmatter + `manifest/source.yaml` + `docs/skills/documentation/README.md`). The **tag itself** is the maintainer's release step (`nn-dev-release`).

---

## Apply notes (2026-09-30)

- Implemented on `dev`, **uncommitted**.
- New: `skills/nn-trannsform/scripts/lib/watch-digest-store.js`, `test/unit/test-watch-digest-store.js`. Modified: `scripts/lib/external-scanner.js` (`serializeScanResult`), `scripts/index.js` (`--scan-external --json`, `--watch-digest`, `--digest-decide`), `test/run.js`, the three SKILL.md files, `.gitignore`.
- `nn-trannsform` suite green (**538 passed**). `npm run lint` → 0 errors (warnings pre-existing). `npm run sync:versions` clean; `check:versions` green.
- `check-integrity` passes except the **Docs-Derived Facts guard** (`--against HEAD`): it compares the *working-tree* render against the `HEAD` copy of `docs/skills/documentation/README.md`, so it necessarily reports drift while the skill-version bump is uncommitted. The working-tree check (`node scripts/generate-docs-facts.mjs --check`) is green, and the guard turns green once this batch is committed.
- **Deferred:** workspace-emitted `.gitignore` pattern (see 4.3); the `skills-v*` tag (6.2).
