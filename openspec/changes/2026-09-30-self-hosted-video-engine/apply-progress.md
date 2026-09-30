# Apply Progress: Vendor the VUS Parser (Phases 0-2)

Branch `feat/vus-parser-vendoring`. Tasks done: 0.1, 1.1-1.5, 2.1-2.5. Phases 3-4 not started.

## Commits

- ff68613e test(video-parser): port upstream VUS parser suites as RED scaffold (13 suites fail to load)
- 39f856cb feat(video-parser): vendor the VUS spec V_0-3-3 with a hash check
- bdd2ba3d feat(video-parser): port the VUS parser, validator and entry point
- 6053916d chore(video-parser): register the package in root scripts, lint and CI
- f42c9468 feat(nn-video-script): parse and pin against the in-repo VUS parser and spec
- 6d51ee22 refactor(manifest): drop the external VUS spec pin and flip the skill capability spec

## Package

`iNNfo/packages/innfo-video-parser` (`@cognnitive/innfo-video-parser`): NodeNext + `.js`
specifiers, `rootDir: "."` (so the vendored spec under `specs/` compiles), entry
`parse(text, title?)` -> `{ project, issues }`, `validate(project)` -> issues,
`VUS_SPEC` `{ version, sha256, spec }` (hash taken over the package's own file, never the
`dist/` copy that `tsc` re-serializes).

## Dropped upstream tests

- `parser/Integration.test.ts` + its snapshot: needs the external Anydeo demo library.
- `parser/VUSAudit.test.ts`: same demo library, plus `BatchParser`.
- `tests/master_feature_test.test.ts`: demo library + `ResolverManager` + `AssetRepository`.
- `tests/rule_parity.test.ts`: Tauri IPC mock + `RulesManager` (desktop-app runtime).
- `batch/BatchParser.test.ts`, `config/voice-single-source.test.ts`: not parser closure.
- `SemanticValidator.test.ts`: only the "External Demo Audits" block removed.
- `rules/*.json` fragments: not imported by anything (rules are built from the spec).

## Deviations

- Upstream `vus_parser.js` kept byte-exact; regenerating from the verbatim grammar changes
  parse output (`//ANYDEO_SPEC:` literal length 13 vs 12). See package README.
- `noImplicitAny: false`, `allowJs` (generated parser), lint override
  `no-case-declarations: warn` for the package; `prefer-const` autofixed; prettier applied
  (whitespace only; generated parser and spec excluded via `.prettierignore`).
- `ParseResult` is now exported from `Parser.ts` (was a non-exported interface).
- Spec vendored before its hash test was committed (test ran green immediately).
- `vus_spec` pin kept in SKILL.md frontmatter (it never named an external repo; it now
  verifies against the vendored file). `external_specs` removed from `manifest/source.yaml`.
- Skills run the parser through `node --import tsx/esm` (tsx is a devDependency of the
  package); no build step is needed for `verify.js`.

## Findings

- The workspace sample `ghostbusters-recruitment-spot/script.md` fails the real parser:
  unknown layer property `layer_generation_text` (was hidden by the old skip).
  `vus-parse.test.mjs` pins that behaviour; fix the sample, then expect exit 0.
- `scripts/manifest/check-parity.js` (+ test) still carries the generic `external_specs` /
  `VIDGENN_ROOT` mechanism; now dead for this skill. Left for Phase 3.
- Grep gate: the vendored spec and VUS `ANYDEO_SPEC` header syntax legitimately contain
  "Anydeo"; the gate must exclude them.
