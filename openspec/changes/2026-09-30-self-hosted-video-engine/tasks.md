# Tasks: Vendor the VUS Parser and Retire the VidGeNN Pin

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900-1,300 total (parser port + vendored spec + repoint + purge) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes (2 slices: parser+spec → skill repoint + purge) |
| Delivery strategy | chained |
| Chain strategy | slice 1 unblocks `vus-parse`; slice 2 repoints the skill/manifest and purges |

Decision needed before apply: No.
Chained PRs recommended: Yes
Chain strategy: parser+spec first, then repoint + purge.
400-line budget risk: Medium

---

## Phase 0: Restore Point (pre-migration)

- [x] 0.1 Cut an annotated checkpoint tag before any migration commit:
      `git tag -a checkpoint/vus-parser-vendoring-<YYYYMMDD> -m "Pre migration: retire the VidGeNN pin"`.
      `[nn-dev-development:§6]`

## Phase 1: Vendored Spec + Parser Package (TDD first)

- [x] 1.1 **RED — port upstream parser tests**: import the `@anydeo/core` parser suites
      (round-trip, corpus, property-based, audit) into
      `iNNfo/packages/<video-parser>/src/parser/*.test.ts`. `[video-script-parser:Requirement:Port Parser Behaviour]`
- [x] 1.2 **GREEN — vendor the spec**: place `V_0-3-3.json` under the package `specs/`
      and add a hash check. `[video-script-parser:Requirement:Vendored VUS Spec]`
- [x] 1.3 **GREEN — port the parser**: `vus.peggy`, generated `vus_parser.js`, `Parser.ts`,
      `lowering.ts`, `ast.ts`, `SemanticValidator.ts`, `ShortcutImporter.ts`,
      `PropertyUtils.ts`, `types.ts`, and `rules/`. `[video-script-parser:Requirement:Port Parser Behaviour]`
- [x] 1.4 **GREEN — package entry point**: export `parse`, `validate`, `VUS_SPEC`.
      `[video-script-parser:Requirement:Vendored VUS Spec]`
- [x] 1.5 **Verify Phase 1**: `npm run lint` + `npm run typecheck` + package tests green;
      no `VIDGENN_ROOT`, no external repo.

## Phase 2: Skill + Manifest Repoint

- [x] 2.1 **RED — parse without VIDGENN_ROOT**: test that `vus-parse.mjs` runs to
      completion with `VIDGENN_ROOT` unset against a valid sample script.
      `[video-script-skill:Requirement:Internal Parser Resolution]`
- [x] 2.2 **GREEN — consume the internal package**: `vus-parse.mjs` / `vus-spec.mjs`
      import the internal parser and the vendored spec; remove the `VIDGENN_ROOT` skip.
      `[video-script-skill:Requirement:Internal Parser Resolution]`
- [x] 2.3 **GREEN — drop the external pin**: remove the `vus_spec` external block from
      `SKILL.md` and the `external_specs` entry from `manifest/source.yaml`.
      `[video-script-skill:Requirement:Self-Hosted Spec Pin]`
- [x] 2.4 **GREEN — flip the capability spec**: update
      `openspec/specs/video-script-skill/spec.md` so the pin resolves to the vendored
      file, with no `VidGeNN` reference. `[video-script-skill:Requirement:Self-Hosted Spec Pin]`
- [x] 2.5 **Verify Phase 2**: `check-script` + `vus-parse` on the workspace sample;
      `check:spec-urls` and `check-integrity` green.

## Phase 3: Procedure + Docs Purge

- [ ] 3.1 `generate_anydeo_script_NN.md`: delete the residual `tool:: [[VidGeNN]]`
      reference (the canonical `generate_video_script_NN.md` already renders internally
      via `video-engine-cli.mjs`; no render change is in scope). `[video-script-skill:Requirement:Owned Skill With No External Dependency]`
- [ ] 3.2 `docs/innfo/documentation/template-video.md` and the video docs: remove
      VidGeNN / Anydeo references.
- [ ] 3.3 Grep gate: zero `VidGeNN` / `Anydeo` hits across the monorepo (git history
      excluded).
- [ ] 3.4 Release: cut a `skills-v*` tag **and** re-pin `manifest/source.yaml` in the
      same batch (`nn-dev-development` §4e).

## Phase 4: Final Gates

- [ ] 4.1 `npm run lint`, `npm run typecheck`, the full test suite, and
      `node scripts/check-integrity.js`.
- [ ] 4.2 Archive VidGeNN (maintainer action, after green).

---

## Scope note (2026-09-30)

The previous version of this change also planned a Node + FFmpeg **render engine** (Phase 3)
and a golden-frame comparison against VidGeNN. That work is **already shipped** as the
`cognnitive-video-engine` capability (`video-engine-cli.mjs`, `remotion-scene-compiler.mjs`,
`asset-synthesizer.mjs`, `tts-generator.mjs`), and the canonical procedure
`generate_video_script_NN.md` already orchestrates it internally. The render capability and
its tasks were removed; `specs/video-render-engine/` was deleted. What remains is the VUS
parser + vendored spec + pin removal + purge.
