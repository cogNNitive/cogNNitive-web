# Tasks: Self-Hosted Video Engine

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2500-3500 total |
| 400-line budget risk | High |
| Chained PRs recommended | Yes (3 slices: parser+spec → skill repoint → render engine) |
| Delivery strategy | chained |
| Chain strategy | slice 1 unblocks `vus-parse`; slice 2 repoints the skill/manifest; slice 3 renders |

Decision needed before apply: Yes — a golden render reference from VidGeNN for the
engine slice (Phase 3.5).
Chained PRs recommended: Yes
Chain strategy: parser+spec first, then repoint, then the render engine.
400-line budget risk: High

---

## Phase 0: Restore Point (pre-migration)

- [ ] 0.1 Cut an annotated checkpoint tag before any migration commit:
      `git tag -a checkpoint/self-hosted-video-engine-<YYYYMMDD> -m "Pre migration: retire VidGeNN"`.
      `[nn-dev-development:§6]`

## Phase 1: Vendored Spec + Parser Package (TDD first)

- [ ] 1.1 **RED — port upstream parser tests**: import the `@anydeo/core` parser suites
      (round-trip, corpus, property-based, audit) into
      `iNNfo/packages/<video-parser>/src/parser/*.test.ts`. `[video-script-parser:Requirement:Port Parser Behaviour]`
- [ ] 1.2 **GREEN — vendor the spec**: place `V_0-3-3.json` under the package `specs/`
      and add a hash check. `[video-script-parser:Requirement:Vendored VUS Spec]`
- [ ] 1.3 **GREEN — port the parser**: `vus.peggy`, generated `vus_parser.js`, `Parser.ts`,
      `lowering.ts`, `ast.ts`, `SemanticValidator.ts`, `ShortcutImporter.ts`,
      `PropertyUtils.ts`, `types.ts`, and `rules/`. `[video-script-parser:Requirement:Port Parser Behaviour]`
- [ ] 1.4 **GREEN — package entry point**: export `parse`, `validate`, `VUS_SPEC`.
      `[video-script-parser:Requirement:Vendored VUS Spec]`
- [ ] 1.5 **Verify Phase 1**: `npm run lint` + `npm run typecheck` + package tests green;
      no `VIDGENN_ROOT`, no external repo.

## Phase 2: Skill + Manifest Repoint

- [ ] 2.1 **RED — parse without VIDGENN_ROOT**: test that `vus-parse.mjs` runs to
      completion with `VIDGENN_ROOT` unset against a valid sample script.
      `[video-script-skill:Requirement:Internal Parser Resolution]`
- [ ] 2.2 **GREEN — consume the internal package**: `vus-parse.mjs` / `vus-spec.mjs`
      import the internal parser and the vendored spec; remove the `VIDGENN_ROOT` skip.
      `[video-script-skill:Requirement:Internal Parser Resolution]`
- [ ] 2.3 **GREEN — drop the external pin**: remove the `vus_spec` external block from
      `SKILL.md` and the `external_specs` entry from `manifest/source.yaml`.
      `[video-script-skill:Requirement:Self-Hosted Spec Pin]`
- [ ] 2.4 **Verify Phase 2**: `check-script` + `vus-parse` on the workspace sample;
      `check:spec-urls` and `check-integrity` green.

## Phase 3: Render Engine (TDD first)

- [ ] 3.1 **RED — rendered master fixture**: a minimal 2-scene script renders to a
      playable `master.mp4`; assert duration, resolution, and a non-empty audio stream.
      `[video-render-engine:Requirement:Rendered Master Artifact]`
- [ ] 3.2 **GREEN — plan + resolve**: `plan.ts` / `resolve.ts` — AST → scene plan with
      escape-guarded asset resolution. `[video-render-engine:Requirement:Scene Planning]`
- [ ] 3.3 **GREEN — FFmpeg composition**: `compose/*` — per-scene graph (ken_burns,
      drawtext, overlay), concat, and audio mux. `[video-render-engine:Requirement:FFmpeg Composition]`
- [ ] 3.4 **GREEN — provider ingestion**: `ingest/*` — TTS, talking-avatar, and image
      assets via the providers the script declares. `[video-render-engine:Requirement:Provider Asset Ingestion]`
- [ ] 3.5 **Verify Phase 3**: golden-frame comparison against an existing VidGeNN render
      of the same script. `[video-render-engine:Requirement:FFmpeg Composition]`
- [ ] 3.6 **GREEN — finalize flow**: `renders/{ref}/master.mp4` is promotable by the
      unchanged `finalize-video.mjs`. `[video-render-engine:Requirement:Rendered Master Artifact]`

## Phase 4: Procedure + Docs Purge

- [ ] 4.1 `generate_anydeo_script_NN.md`: make *Render Video* internal and delete the
      `VidGeNN` tool entry. `[video-render-engine:Requirement:Internal Render Step]`
- [ ] 4.2 `docs/innfo/documentation/template-video.md` and the video docs: remove
      VidGeNN / Anydeo references.
- [ ] 4.3 Grep gate: zero `VidGeNN` / `Anydeo` hits across the monorepo (git history
      excluded).
- [ ] 4.4 Release: cut a `skills-v*` / `templates-v*` tag **and** re-pin
      `manifest/source.yaml` in the same batch (`nn-dev-development` §4e).

## Phase 5: Final Gates

- [ ] 5.1 `npm run lint`, `npm run typecheck`, the full test suite, and
      `node scripts/check-integrity.js`.
- [ ] 5.2 Archive VidGeNN (maintainer action, after green).
