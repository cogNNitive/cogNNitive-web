# Proposal: Self-Hosted Video Engine (retire VidGeNN / Anydeo)

## Why

The cogNNitive video bluepriNNt cannot run autonomously: two of its moving parts live
outside this monorepo, in `innV0/VidGeNN`.

1. **VUS spec + parser.** `skills/nn-video-script` pins the VUS specification to
   `VidGeNN/packages/core/specs/V_0-3-3.json`, and `vus-parse.mjs` resolves the parser
   through `VIDGENN_ROOT`. The pin is broken *today*: three divergent sha256 values
   coexist for the same `V_0-3-3.json` — the skill's `SKILL.md` (`72630624…`), the
   manifest's `external_specs` (`d617aadc…`, commit `4c05a58`), and a local checkout
   (`7240a0bf…`). `vus-spec.mjs` therefore refuses to answer and `vus-parse` cannot run.
2. **Render engine.** The *Render Video* work of the canonical procedure
   `iNNfo/specs/templates/video/procedures/generate_anydeo_script_NN.md` delegates to
   VidGeNN (`tool:: [[VidGeNN]]`, *"runs outside iNNfo's own tooling"*). That engine is a
   Rust/Tauri application that composes with FFmpeg plus Remotion.

The video bluepriNNt is a shipped cogNNitive capability; it must not depend on a
repository cogNNitive intends to archive. This change makes the video engine
self-hosted so VidGeNN can be retired.

## What Changes

- **Vendored VUS specification.** Host `V_0-3-3.json` inside the monorepo under the
  canonical spec hosting base, and make it the single source of truth (killing the
  three-hash drift).
- **Internal VUS parser.** Port the Anydeo VUS parser (TypeScript/peggy) into a
  cogNNitive package so `vus-parse` runs with no `VIDGENN_ROOT` and no external repo.
- **Skill repoint.** `skills/nn-video-script` drops the VidGeNN pin and `VIDGENN_ROOT`;
  `vus-parse.mjs` / `vus-spec.mjs` consume the internal parser and the vendored spec.
- **Self-hosted render engine.** Add a Node + FFmpeg engine that turns a validated
  script plus its assets into `renders/{ref}/master.mp4`, replacing the VidGeNN render
  step of the video procedure (which becomes an internal work, not an external tool).
- **Manifest and docs purge.** Remove the `external_specs` (VidGeNN) entry from
  `manifest/source.yaml` and every VidGeNN/Anydeo mention from the video bluepriNNt,
  the procedure, the skill, and the docs.

## Capabilities

### New Capabilities
- `video-script-parser`: the cogNNitive-owned VUS parser package and the vendored VUS
  specification it reads, replacing the external repo dependency.
- `video-render-engine`: the Node + FFmpeg engine that renders a validated script into a
  `master` video, its per-scene composition, and its provider-backed asset ingestion.

### Modified Capabilities
- `video-script-skill`: the skill no longer forks from, or pins to, VidGeNN; it resolves
  parser and spec from the monorepo.

## Impact

### Affected areas
- **New package** `iNNfo/packages/<video-parser>`: ported `vus.peggy`, generated parser,
  `Parser.ts`, `lowering.ts`, `ast.ts`, `SemanticValidator.ts`, `ShortcutImporter.ts`,
  `rules/`, and the vendored spec.
- **New package** `iNNfo/packages/<video-engine>`: scene planner, FFmpeg compositor,
  audio mux, provider asset ingestion (TTS/avatar/image), `renders/{ref}/` output.
- `skills/nn-video-script/scripts/{vus-parse.mjs,vus-spec.mjs,check-script.mjs}` and
  `SKILL.md`.
- `iNNfo/specs/templates/video/procedures/generate_anydeo_script_NN.md` (the *Render
  Video* work and its `VidGeNN` tool entry).
- `manifest/source.yaml` (drop `external_specs` for `nn-video-script`).
- `docs/innfo/documentation/template-video.md` and the video template docs.

### Verification
- Unit: the ported parser reproduces the pre-existing VUS round-trip and corpus test
  suites; the engine composes a minimal 2-scene script into a playable `master.mp4`.
- Integration: `check-script` → `vus-parse` → render on the workspace sample episode,
  with no `VIDGENN_ROOT` set and no VidGeNN checkout present.
- CI parity: `npm run check:spec-urls` and `node scripts/check-integrity.js` pass; no
  file in the monorepo references `VidGeNN` or `Anydeo` after the change.

### Rollback
Additive: the parser/engine packages are new; the skill, procedure, and manifest edits
revert cleanly. The old VidGeNN pin can be restored in one commit if needed.

### Dependencies
- Non-blocking for the *authoring/validation* half (parser + spec vendoring): it can land
  first and immediately unblocks `vus-parse`.
- The render engine half is larger and may be delivered as a second slice.

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Rust render semantics (ken_burns, xfade, drawtext, audio ducking) not reproduced | High | Golden-frame comparison against an existing VidGeNN render; start with a minimal scene set |
| Parser port diverges from `@anydeo/core` behaviour | Med | Reuse the upstream peggy grammar + its test suites as the port's RED suite |
| Provider ingestion (TTS/avatar) semantics differ | Med | Port against the same WaveSpeed/Replicate contracts the scripts already declare |
| Scope creep into porting the whole anydeo desktop app | High | Explicitly out of scope: only parser + render are migrated |

### Success criteria
- [ ] `vus-parse` runs green with `VIDGENN_ROOT` unset and no VidGeNN checkout.
- [ ] A validated script renders to `renders/{ref}/master.mp4` end-to-end inside the
      monorepo.
- [ ] `grep` for `VidGeNN` / `Anydeo` across the monorepo returns zero hits.
- [ ] VidGeNN is safe to archive.

### Out of scope
- The Anydeo desktop application (Tauri UI), AI chat, stock, forge, and suggestion
  services.
- Remotion-based animated scene components, unless a migrated scene requires them.
- Changing the VUS syntax itself.

### Resolved decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Render engine technology | **Option A**: rewrite in Node + FFmpeg (no Rust, no binaries) |
| 2 | Spec hosting | Vendor `V_0-3-3.json` under the canonical hosting base in the monorepo |
| 3 | Parser strategy | Port the peggy grammar + TS wrapper; reuse upstream tests as RED |
| 4 | Sequencing | Parser + spec first (unblocks `vus-parse`), render engine second |
| 5 | VidGeNN | Read-only *migration source* only; archived once this change lands |
