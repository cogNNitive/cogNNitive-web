# Design: Vendor the VUS Parser and Retire the VidGeNN Pin

## Context

One subsystem remains outside this monorepo: the **VUS parser** and the **VUS spec**,
both in `innV0/VidGeNN` (`packages/core/src/parser/*`, `packages/core/specs/V_0-3-3.json`).
cogNNitive's monorepo is TypeScript/Node, so the strategy is **port, do not bundle**: no
Rust, no platform binaries.

The **render engine is not in scope**: it is already self-hosted by the shipped
`cognnitive-video-engine` capability (`skills/nn-video-script/scripts/video-engine-cli.mjs`,
`remotion-scene-compiler.mjs`, `asset-synthesizer.mjs`, `tts-generator.mjs`,
`render-thumbnail.mjs`), and the canonical procedure `generate_video_script_NN.md`
invokes it internally. Nothing in this change touches rendering.

## Architecture Seam

One new workspace package under `iNNfo/packages/`, a deep module with a narrow entry
point:

```
iNNfo/packages/<video-parser>/
  src/
    vus.peggy            # grammar (ported verbatim)
    vus_parser.js        # generated (committed, as upstream does)
    Parser.ts            # parse(text) -> AST
    lowering.ts  ast.ts  SemanticValidator.ts  ShortcutImporter.ts
    PropertyUtils.ts  types.ts
    rules/               # api_options.json, system.json, categories.json, properties/
  specs/V_0-3-3.json     # vendored, hashed, single source of truth
  index.ts               # export { parse, validate, VUS_SPEC }
```

Dependency direction: nothing in the monorepo depends on VidGeNN; the package depends on
nothing outside the workspace.

## Data Flow

```
script.md ──(vus-parse.mjs)──▶ <video-parser>.parse ──▶ AST ──▶ validate ──▶ diagnostics
                                   ▲
                     specs/V_0-3-3.json (vendored, hashed)
```

`vus-spec.mjs` reads the vendored spec from the package and verifies the declared hash;
it never reads `VIDGENN_ROOT`.

## Spec Hosting

The vendored `V_0-3-3.json` lives under the canonical hosting tree so
`canonical-spec-hosting` continues to hold:

```
iNNfo/packages/<video-parser>/specs/V_0-3-3.json
```

It is hashed in the same commit that pins it. `manifest/source.yaml` loses the
`external_specs` block, and `openspec/specs/video-script-skill/spec.md` is flipped from
the VidGeNN pin to the vendored one.

## Skill & Procedure Repoint

- `vus-parse.mjs` imports the internal parser; when `VIDGENN_ROOT` is unset it no longer
  skips — it runs.
- `vus-spec.mjs` reads the package-local spec and verifies the hash against it.
- `generate_anydeo_script_NN.md` (deprecation redirect): remove the residual
  `tool:: [[VidGeNN]]` reference. No render change — the canonical procedure already
  renders internally.

## Migration Order (why)

Parser + spec first: they are self-contained, immediately unblock `vus-parse` (blocked
today by the missing external checkout), and carry a ready-made RED suite (the upstream
parser tests). The repoint + purge follows and needs no new runtime.
