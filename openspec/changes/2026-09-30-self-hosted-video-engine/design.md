# Design: Self-Hosted Video Engine

## Context

Two subsystems must move from `innV0/VidGeNN` into this monorepo:

- **Parser** (`packages/core/src/parser/*`, TypeScript + peggy) and the **VUS spec**
  (`packages/core/specs/V_0-3-3.json`).
- **Render engine** (`apps/desktop/src-tauri/src/engine/*`, Rust) which ingests assets
  (TTS, lip-sync, media, text) and composes with FFmpeg.

cogNNitive's monorepo is TypeScript/Node (`iNNfo/packages/innfo-core`, `innfo-mcp`,
`pipeline-gates`). The chosen strategy (Option A) keeps it that way: **port, do not
bundle.** No Rust, no platform binaries.

## Architecture Seams

Two new workspace packages under `iNNfo/packages/`, each a deep module with a narrow
entry point:

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

iNNfo/packages/<video-engine>/
  src/
    plan.ts              # AST -> ordered scene plan (layers resolved, durations, assets)
    resolve.ts           # asset resolution relative to the script folder + escape guard
    ingest/              # tts.ts, lipsync.ts, media.ts, text.ts (provider calls)
    compose/
      filters.ts         # ken_burns/zoompan, drawtext, overlay, xfade
      scene.ts           # one scene -> one silent clip
      concat.ts          # scene clips -> video track
      audio.ts           # narration clips -> single audio track, ducking
    render.ts            # orchestrates -> renders/{ref}/master.mp4, thumbnail, voiceover
  index.ts               # export { render }
```

Dependency direction: `<video-engine>` → `<video-parser>`; both → nothing in VidGeNN.

## Data Flow

```
script.md ──(video-parser)──▶ AST
AST ──(plan.ts)──▶ ScenePlan[]  (layers, resolved asset paths, timing modes)
ScenePlan ──(ingest/*)──▶ per-scene provider assets (TTS wav, avatar mp4, images)
ScenePlan + assets ──(compose/*)──▶ per-scene clips ──(concat)──▶ silent video
narration ──(audio.ts)──▶ muxed audio ──▶ master.mp4
```

## FFmpeg Composition (replacing the Rust `engine/ffmpeg/*`)

| Rust module | Node equivalent | Technique |
|---|---|---|
| `compositor.rs` | `compose/scene.ts` | `filter_complex` per scene: image `scale`+`zoompan` (ken_burns), `drawtext` for text layers, `overlay` for avatars |
| `pipeline.rs` | `render.ts` | Build the graph; `-filter_complex` then `-c:v libx264` |
| `concat.rs` | `compose/concat.ts` | `concat` demuxer or `xfade` between scene clips |
| `filters.rs` | `compose/filters.ts` | `zoompan`, `fade`, `drawtext`, `amix`/`volume` |
| `assets/ingest/{tts,lipsync,media}.rs` | `ingest/*.ts` | Provider calls (Replicate MiniMax TTS, WaveSpeed InfiniteTalk, WaveSpeed/Replicate images) |
| `hardware.rs` | `compose/*` | Optional `-hwaccel` detection; fall back to CPU |
| `resolver/`, `project.rs` | `plan.ts`, `resolve.ts` | Property resolution + folder contract |

The engine mirrors the folder contract already enforced by `check-script.mjs`: all asset
paths resolve inside the video's own folder, `renders/` and `.anydeo/` are ephemeral and
gitignored (use `renders/{ref}/` — keep the `.anydeo/` name only if a scene plan needs a
scratch dir).

## Spec Hosting

The vendored `V_0-3-3.json` lives under the canonical hosting tree so
`canonical-spec-hosting` continues to hold:

```
iNNfo/packages/<video-parser>/specs/V_0-3-3.json
```

It is hashed in the same commit that pins it; `vus-spec.mjs` reads it from the package,
not from `VIDGENN_ROOT`. `manifest/source.yaml` loses the `external_specs` block.

## Skill & Procedure Repoint

- `vus-parse.mjs` imports the internal parser; when `VIDGENN_ROOT` is unset it no longer
  skips — it runs.
- `vus-spec.mjs` reads the package-local spec and verifies the hash against it.
- `generate_anydeo_script_NN.md`: the *Render Video* work changes from
  `tool:: [[VidGeNN]]` / `scope:: external` to an internal render invocation, and the
  `VidGeNN` tool entry is removed.

## Migration Order (why)

Parser + spec first: they are self-contained, immediately unblock `vus-parse` (today
broken by the three-hash drift), and carry a ready-made RED suite (the upstream parser
tests). The render engine is the large slice and lands second, verified by golden-frame
comparison against an existing VidGeNN render.
