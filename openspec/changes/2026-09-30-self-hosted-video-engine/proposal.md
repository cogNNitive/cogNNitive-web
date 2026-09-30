# Proposal: Vendor the VUS Parser and Retire the VidGeNN Pin

## Why

The last external dependency of the video bluepriNNt is the **VUS parser and its
spec**, both of which still live in `innV0/VidGeNN`:

- `skills/nn-video-script/scripts/vus-spec.mjs` resolves
  `$VIDGENN_ROOT/packages/core/specs/V_0-3-3.json` and
  `vus-parse.mjs` runs the parser through `$VIDGENN_ROOT/packages/core/src/index.ts`.
  With `VIDGENN_ROOT` unset both **skip**, so `vus-parse` cannot run on a machine with
  no VidGeNN checkout.
- `manifest/source.yaml` still declares the `external_specs` (Vus, `repo: innV0/VidGeNN`)
  block, and `openspec/specs/video-script-skill/spec.md` still **requires** the spec to
  be pinned exclusively to `VidGeNN/packages/core/specs/V_0-3-3.json`.

The **render engine is already self-hosted** and is out of scope here: the shipped
`cognnitive-video-engine` capability (`openspec/specs/cognnitive-video-engine/spec.md`)
provides `video-engine-cli.mjs` (Remotion compile/render/preview), the
`remotion-scene-compiler`, deterministic asset cache, TTS synthesis, and the canonical
procedure `generate_video_script_NN.md` already orchestrates it internally. The legacy
`generate_anydeo_script_NN.md` is now only a deprecation redirect. So the earlier
"port a Rust/Tauri render engine" scope is dropped as already delivered.

Two of the three historical hash mismatches are also gone: `skills/nn-video-script/SKILL.md`
and `manifest/source.yaml` now agree on the spec hash (`d617aadc…`). What remains is the
**external repository dependency itself**, which this change removes.

## What Changes

- **Vendored VUS specification.** Host `V_0-3-3.json` inside the monorepo under the
  canonical spec hosting base and make it the single source of truth (one declared
  hash, no `external_specs`).
- **Internal VUS parser.** Port the peggy grammar and its TypeScript wrapper into a new
  cogNNitive package so `vus-parse` runs with no `VIDGENN_ROOT` and no external repo.
- **Skill repoint.** `skills/nn-video-script` drops the VidGeNN pin, the
  `vus_spec` frontmatter block and the `VIDGENN_ROOT` skip; `vus-parse.mjs` /
  `vus-spec.mjs` consume the internal parser and the vendored spec.
- **Manifest and docs purge.** Remove the `external_specs` entry from
  `manifest/source.yaml`, flip `openspec/specs/video-script-skill/spec.md` to the
  self-hosted pin, and remove remaining `VidGeNN` / `Anydeo` references from the video
  skill, the deprecated procedure and the video docs.

## Capabilities

### New Capabilities
- `video-script-parser`: the cogNNitive-owned VUS parser package and the vendored VUS
  specification it reads, replacing the external repo dependency.

### Modified Capabilities
- `video-script-skill`: the skill no longer forks from, or pins to, VidGeNN; it resolves
  the parser and spec from the monorepo.

## Impact

### Affected areas
- **New package** `iNNfo/packages/<video-parser>`: ported `vus.peggy`, generated parser,
  `Parser.ts`, `lowering.ts`, `ast.ts`, `SemanticValidator.ts`, `ShortcutImporter.ts`,
  `PropertyUtils.ts`, `types.ts`, `rules/`, and the vendored `specs/V_0-3-3.json`.
- `skills/nn-video-script/scripts/{vus-parse.mjs,vus-spec.mjs,vus-parse-runner.mjs}`,
  its `SKILL.md` frontmatter, and the `vus-spec-pin` / `vus-parse` tests.
- `manifest/source.yaml` (drop the `nn-video-script` `external_specs` block).
- `openspec/specs/video-script-skill/spec.md` (self-hosted pin).
- `iNNfo/specs/bluepriNNts/video/procedures/generate_anydeo_script_NN.md` (drop the
  residual VidGeNN tool reference) and `docs/innfo/documentation/template-video.md`.

### Verification
- Unit: the ported parser reproduces the upstream VUS round-trip and corpus suites; the
  vendored spec hash matches the single declared pin.
- Integration: `check-script` → `vus-parse` → (existing) render runs with `VIDGENN_ROOT`
  unset and no VidGeNN checkout present.
- CI parity: `npm run check:spec-urls` and `node scripts/check-integrity.js` pass; no
  file references `VidGeNN` or `Anydeo` after the change.

### Rollback
Additive: the parser package is new; the skill, procedure and manifest edits revert
cleanly. The old VidGeNN pin can be restored in one commit if needed.

### Dependencies
- Builds on the shipped `cognnitive-video-engine` capability (render half already done).
- Non-blocking; the parser + spec slice immediately unblocks `vus-parse`.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Parser port diverges from `@anydeo/core` behaviour | Med | Reuse the upstream peggy grammar + its test suites as the port's RED suite |
| Scope creep into porting the anydeo desktop app | Med | Explicitly out of scope: parser + spec only; the render engine already ships |
| Docs / prose still reference VidGeNN after the change | Med | Final grep gate: zero `VidGeNN` / `Anydeo` hits |

### Success criteria
- [ ] `vus-parse` runs green with `VIDGENN_ROOT` unset and no VidGeNN checkout.
- [ ] Exactly one declared spec hash; no `external_specs` entry references another repo.
- [ ] `grep` for `VidGeNN` / `Anydeo` across the monorepo returns zero hits.
- [ ] `openspec/specs/video-script-skill/spec.md` requires only the vendored pin.

### Out of scope
- The render engine (already shipped as `cognnitive-video-engine`).
- The Anydeo desktop application (Tauri UI), AI chat, stock, forge, suggestion services.
- Changing the VUS syntax itself.

### Resolved decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Spec hosting | Vendor `V_0-3-3.json` under the canonical hosting base in the monorepo |
| 2 | Parser strategy | Port the peggy grammar + TS wrapper; reuse upstream tests as RED |
| 3 | Render engine | Out of scope — already shipped as `cognnitive-video-engine` |
| 4 | VidGeNN | Read-only *migration source* only; archived once this change lands |
