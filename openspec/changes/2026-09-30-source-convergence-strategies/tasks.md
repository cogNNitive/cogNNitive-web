# Tasks: Source Convergence Strategies

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~400-520 total |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes (2: delta engine+CLI → apply/doc wiring) |
| Delivery strategy | chained |
| Chain strategy | engine first, apply/docs second |

Decision needed before apply: Yes (open decisions #1-#4 in the proposal)
Chained PRs recommended: Yes
Chain strategy: engine first, apply/docs second
400-line budget risk: Medium

---

## Phase 0: Resolve Open Decisions

- [ ] 0.1 Confirm where `convergence` / `key` are declared (domaiNN manifest vs. source catalog entry). `[source-convergence-strategies:Requirement:Declared Convergence Strategy]`
- [ ] 0.2 Confirm removed-key handling (flag-only vs. archive elements) and the `upsert` vs. `replace-values` difference. `[source-convergence-strategies:Requirement:Keyed Delta Proposal]`

## Phase 1: Delta Engine (TDD first)

- [ ] 1.1 **RED — delta tests**: Write `skills/nn-trannsform/scripts/lib/convergence-delta.test.js` over two fixtures: added/changed/removed keys and conflicts; missing/empty/duplicate key aborts; identical inputs are byte-identical; `cite-only` emits nothing. `[source-convergence-strategies:Requirement:Keyed Delta Proposal]`
- [ ] 1.2 **GREEN — keyed diff**: Implement `convergence-delta.js` with deterministic ordering and conflict detection. `[source-convergence-strategies:Requirement:Keyed Delta Proposal]`
- [ ] 1.3 **GREEN — key validation**: Reject a missing, empty, or duplicated key with a non-zero exit and no proposal. `[source-convergence-strategies:Requirement:Keyed Delta Proposal]`
- [ ] 1.4 **Verify Phase 1**: `npm run lint`, `npm run typecheck`, `nn-trannsform` tests green.

## Phase 2: CLI — `--converge`

- [ ] 2.1 **RED — CLI tests**: `--converge <family>` resolves the two newest snapshots, reads the declared strategy, and emits the proposal JSON; exits non-zero on invalid key. `[source-convergence-strategies:Requirement:Declared Convergence Strategy]`
- [ ] 2.2 **GREEN — wire `--converge`**: Implement the mode in `scripts/index.js`. `[source-convergence-strategies:Requirement:Declared Convergence Strategy]`
- [ ] 2.3 **GREEN — idempotence**: Record the applied target version; a proposal already applied, or identical snapshots, yields an empty proposal. `[source-convergence-strategies:Requirement:Idempotent Proposal]`
- [ ] 2.4 **Verify Phase 2**: `npm run lint`, `npm run typecheck`, `nn-trannsform` tests green.

## Phase 3: Read-Only Guarantee

- [ ] 3.1 **RED — no-write test**: `--converge` leaves `sources/import/` and `sources/nn/` byte-unchanged. `[source-convergence-strategies:Requirement:Read-Only Proposal]`
- [ ] 3.2 **GREEN — guarantee**: The mode only reads and prints; assert no write path is reachable. `[source-convergence-strategies:Requirement:Read-Only Proposal]`

## Phase 4: Apply Path (Reviewed Mutation)

- [ ] 4.1 **RED — apply tests**: A proposal applied through the feedback apply loop produces one model version bump and passes `validate_model`; a second apply is a no-op. `[source-convergence-strategies:Requirement:Reviewed Application]`
- [ ] 4.2 **GREEN — apply wiring**: Wire the proposal into the existing diff-preview → confirm → `apply_change` → single-bump path. `[source-convergence-strategies:Requirement:Reviewed Application]`

## Phase 5: Skills & Documentation

- [ ] 5.1 `skills/nn-trannsform/SKILL.md`: document the strategy declaration, `--converge`, and the read-only contract; frontmatter bump. `[source-convergence-strategies:Requirement:Declared Convergence Strategy]`
- [ ] 5.2 `skills/nn-innfo/SKILL.md`: add the convergence apply-procedure note (reuse the feedback apply loop); frontmatter bump. `[source-convergence-strategies:Requirement:Reviewed Application]`
- [ ] 5.3 `docs/innfo/documentation/import-modes.md`: move convergence from roadmap to shipped. `[source-convergence-strategies:Requirement:Declared Convergence Strategy]`

## Phase 6: Gates & Release Hygiene

- [ ] 6.1 Full gates at the tip: `npm run lint`, `npm run typecheck`, the full test suite, `node scripts/check-integrity.js`.
- [ ] 6.2 Cut a `skills-v*` tag and re-pin `manifest/source.yaml` in the same batch (required because `skills/**` changed).
