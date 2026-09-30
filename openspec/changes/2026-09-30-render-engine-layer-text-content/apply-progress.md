# Apply Progress: Scene compiler reads `layer_text_content` for text layers

## Status

Implemented on `feat/vus-parser-vendoring` worktree (`cogNNitive-vus`).

## Phases

### Phase 1 — Compiler fix (done)

- 1.1, 1.2: replaced the six `layer_generation_text` reads in
  `remotion-scene-compiler.mjs` with `layer_text_content` and removed the
  legacy `text` fallback.

### Phase 2 — Tests (done)

- 2.1: `video-engine-cli.test.mjs` sample now uses `layer_text_content`.
- 2.2: `scene-compiler.test.mjs` and `video-engine-cli.test.mjs` both green.
  Render proof: a `conceptCallout` with `layer_text_content: HELLO` produces
  `config.label === "HELLO"`.

### Phase 3 — Spec delta + gates (partially done)

- 3.1: `openspec/specs/cognnitive-video-engine/spec.md` delta applied.
- 3.2–3.3: pending — run lint, typecheck, package tests, `verify.js`,
  `check-integrity.js`.
- 3.4: lands in next `skills-v*` tag (maintainer).

## Open questions

None. Awaits the maintainer for the release batch (tags / re-pin / merge).

## Notes

- This change is separate from `2026-09-30-self-hosted-video-engine`.
- Touches `skills/**`, so it belongs in the next skills tag, not the current
  in-flight release batch (unless the maintainer folds it in).