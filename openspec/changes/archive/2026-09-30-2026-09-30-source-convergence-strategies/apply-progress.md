# Apply Progress: Source Convergence Strategies

Status: **implemented** (Phases 0-5 + apply plan), on `dev`. Phase 6 release hygiene pending (maintainer).

## Resolved decisions (Phase 0)

| # | Decision | Choice |
|---|---|---|
| 1 | Where `convergence`/`key` are declared | domaiNN manifest (`## NN Source Family:` block in `domaiNN_NN.md`) |
| 2 | Removed keys | **flag-only** (never delete/archive) |
| 3 | `upsert` vs `replace-values` | differ **only** in change handling (`upsert` flags changed values; `replace-values` overwrites on apply) — same element lifecycle |
| 4 | Key arity | **single key only** (no composite) |

## Commits

| Commit | Scope |
| :--- | :--- |
| `ca64ba44` | `feat(nn-trannsform)`: keyed delta engine + `--converge` / `--converge-mark` CLI (Phases 1-3) |
| `1cc73520` | `docs(nn-trannsform)`: strategy declaration, read-only + idempotent contract, import-modes roadmap→shipped |
| `d5fe6513` | `docs(import-modes)`: placeholder in the `--converge-mark` example (docs-facts guard) |
| _(this)_ | `feat(nn-trannsform)`: `--converge --plan` apply plan (Phase 4) |

## What landed

- `skills/nn-trannsform/scripts/lib/convergence-delta.js` — pure keyed delta
  engine: `parseSourceFamilies`, `recordsFromContent` (CSV/JSON), `validateKey`,
  `computeDelta` (deterministic added/changed/removed), `buildProposal`
  (cite-only/identical/applied → empty), `buildApplyPlan`, `resolveFamilySnapshots`.
- `skills/nn-trannsform/scripts/index.js` — `--converge <family>`, `--converge --plan`,
  `--converge-mark <family> --version <v>`.
- `skills/nn-trannsform/scripts/lib/watch-digest-store.js` — additive `convergence`
  section in the shared `.cognnitive/watch-digest.json` (no second store);
  `getConvergence` / `recordConvergence` / `ignoredShas`.
- Docs: `import-modes.md` (roadmap→shipped), `nn-trannsform` §2a-5, `nn-innfo`
  apply note.

## Gates

- `convergence-delta.test.js` and `convergence-cli.test.js` — green (auto-collected
  by `scripts/verify.js`).
- `node skills/nn-trannsform/test/run.js` — 541 passed / 0 failed.
- `node scripts/check-integrity.js` — all gates pass.

## Deviations / follow-ups

- **Phase 4.1 (apply behavioural test)**: substituted — the model mutation is the
  already-tested `innfo-mcp apply_change` path; the new code is tested at the
  `buildApplyPlan` / `--plan` seam it owns.
- **Phase 5 frontmatter bump**: skill versions were **not** bumped (would force a
  `skills-v*` tag + `manifest/source.yaml` re-pin).
- **Phase 6.2**: cutting a `skills-v*` tag and re-pinning `manifest/source.yaml`
  is a maintainer release action (`nn-dev-release`), not done here by instruction.
- **Coordination**: `manifest/source.yaml` is shared with `feat/vus-parser-vendoring`;
  serialize the version bump / merge with that branch.
