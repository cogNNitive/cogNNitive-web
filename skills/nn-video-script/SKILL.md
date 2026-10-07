---
name: nn-video-script
description: |
  iNNfo-native skill for authoring, compiling, and rendering cogNNitive Video scripts inside a workspace's Series/Video hierarchy. Supports Remotion scene compilation, deterministic SHA-256 asset caching, headless MP4 rendering, and thumbnail composition. Triggers: video script, cognnitive video, remotion video, series script, nn-video-script, {{slot}}, script_template.md, finalize video, render video script.
version: "V_0-4-0"
last_updated: 2026-09-29
license: MIT
vus_spec:
  version: "V_0-3-3"
  sha256: "d617aadcc85ad5816ca0b447e28032b14c1fc64bac65f550fa4149bd4f7cedda"
engine:
  package: "@remotion/renderer"
  version: "4.0.0"
depends_on:
  providers:
    - name: wavespeed
      env: WAVESPEED_API_KEY
      purpose: TTS and image/video media synthesis
    - name: replicate
      env: REPLICATE_API_TOKEN
      purpose: Fallback media synthesis
  optional_mcp:
    - wavespeed
metadata:
  engine: "cogNNitive Video Engine"
  renderer: "Remotion Headless CLI"
---

# cogNNitive Video Script Engine Skill

Provides end-to-end video script authoring, deterministic TTS/media asset synthesis, Remotion scene compilation, and headless rendering for cogNNitive.

## 0. Activation Gate

Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check), same as every other cogNNitive skill.

## 1. Engine Architecture & Remotion Compilation

The video engine operates headlessly through programmatic modules:
- **Vendored Parser Mirror (`scripts/lib/innfo-video-parser.generated.mjs`)**: The VUS parser bundled as a committed, self-contained ESM artifact (zod + spec embedded). Resolves by relative path — no npm package, no monorepo checkout, no `tsx`. Drift-guarded by `scripts/verify.js`.
- **Scene Compiler (`scripts/remotion-scene-compiler.mjs`)**: Compiles Markdown/VUS video scripts into frame-accurate Remotion Composition Manifests with sequence tracks, transitions, lower-thirds (`lowerThird`), kinetic titles (`kineticTitle`), and concept callouts (`conceptCallout`).
  - `kineticTitle` optional big-text controls (defaults unchanged when absent): `heading_size` / `subheading_size` (px; setting either adds a text shadow and wraps long titles) and `anchor` (`top` | `center` | `bottom`).
- **Deterministic Asset Cache (`scripts/cache-manager.mjs`)**: Content-addressed SHA-256 cache under `.cognnitive/cache/video/` with isolated subdirectories (`tts/`, `images/`, `temp/`).
- **Asset Synthesizer (`scripts/asset-synthesizer.mjs` / `scripts/tts-generator.mjs`)**: Synthesizes TTS voiceover tracks and image/motion assets, measuring audio durations via `@remotion/media-parser` (no FFmpeg-from-PATH).
- **Engine Installer (`scripts/ensure-engine.mjs`)**: Idempotent, consent-gated install of the Remotion renderer runtime with a size + first-render browser notice.
- **Video Engine CLI (`scripts/video-engine-cli.mjs`)**: Headless CLI providing `compile`, `render`, and `preview` commands; Remotion is the only renderer.

## 2. Scope of This Skill in the Authoring Workflow

This skill owns **authoring, validating, compiling, rendering, and finalizing** one video's `script.md` inside a Series folder:

1. **Author** `script.md` from the Series' `script_template.md`, following the `{{slot}}` convention (`references/series-template-convention.md`) and syntax notes (`references/vus-authoring-notes.md`).
2. **Validate**:
   ```bash
   node scripts/check-script.mjs <script.md> --series-root <series-dir>
   ```
3. **Plan, Estimate & Consult Providers (Pre-Generation Gate)**:
   ```bash
   node scripts/asset-cost-estimator.mjs <script.md> --out assets/{video-slug}/asset_plan.md [--image-model <id>] [--tts-model <id>] [--avatar-model <id>]
   ```
   *Present provider options (WaveSpeed AI, Replicate, ElevenLabs, OpenAI, Local/Free), quality tiers, and itemized per-scene cost estimates to the user for explicit approval before proceeding. The plan is stamped with a `plan_hash`. Approval is a HUMAN act that the engine enforces: the user runs `node scripts/approve-plan.mjs assets/{video-slug}/asset_plan.md` in an interactive terminal (typed confirmation, no `--yes`), which writes `asset_plan.approved.json`. Never run `approve-plan.mjs` yourself and never hand-write the approval file. Talking avatars (InfiniteTalk lip-sync, the costliest call) MUST be produced with `scripts/synthesize-avatar.mjs`, never with ad-hoc API or MCP calls: only that script puts them under the budget, daily cap, approval and ledger. Preview uncached billable work with `compile --dry-run`. Budget, the 24h cap, model allow/block lists and the ledger live in `video-guard.json` - see `references/cost-guardrails.md`.*
4. **Ensure the Render Engine (consent-gated, idempotent)**:
   ```bash
   node scripts/ensure-engine.mjs
   ```
   *Remotion is the only renderer. The parser is vendored (no npm needed), but the renderer runtime is installed on demand. Before installing, state the approximate total size AND that a headless browser downloads on the first render. Re-running is a no-op once installed. Also verifies provider credentials (WaveSpeed/Replicate) with consent.*
5. **Compile Composition & Synthesize Assets**:
   ```bash
   node scripts/video-engine-cli.mjs compile <script.md> --output renders/{ref}/manifest.json [--dry-run] [--approval <approved.json>] [--allow-model <name>]... [--image-model <id>] [--tts-model <id>] [--avatar-model <id>] [--cache-dir <dir>]
   ```
   *Compile plans first and refuses the whole run before the first charge unless `asset_plan.approved.json` matches the current script (cache hits stay free), every model is allowed and covered by the approval, and the total fits `min(budgetPerRunUsd, 1.25 x approved total)` and the rolling `dailyCapUsd`. Pass the same `--image-model/--tts-model/--avatar-model` as the estimator. `--allow-model` only works for models a human recorded in the approval. Avatar jobs are serialized across processes and every billable call is appended to `.cognnitive/video-ledger.jsonl`. A `replicate/<vendor>/<model>` name in a script is normalized to the WaveSpeed id for the guard, pricing, URL, ledger and plan_hash. Voices are cloned once with `node scripts/voice-clone.mjs <name> <sample>`; `scene_voice` resolves by registered name or `voice_id`, or is a provider system voice listed in `systemVoices`; anything else fails before spend.*
5b. **Synthesize Talking Avatars (guarded, after the first compile)**:
   ```bash
   node scripts/synthesize-avatar.mjs <script.md> [--scene <id>]... [--dry-run] [--resume <task-id>] [--force-resubmit] [--poll-window <min>] [--allow-model <name>] [--approval <file>] [--cache-dir <dir>]
   node scripts/video-engine-cli.mjs compile <script.md> --output renders/{ref}/manifest.json   # picks the clips up, zero extra spend
   ```
   *Needs the narration audio that the first `compile` staged (`audio/<sceneId>_voiceover.mp3`), `WAVESPEED_API_KEY` and the human-approved plan. The price is per second of that audio (measured first; unmeasurable audio is refused), the default and only allowed model is `wavespeed-ai/infinitetalk-fast`, and the whole batch is refused before the first charge. A job takes minutes: the task id is journaled in `.cognnitive/pending-predictions.jsonl` before polling, and a re-run is REFUSED while the journal shows an outstanding job for the same scene (use the printed `--resume` command; `--force-resubmit` costs money). On a timeout or recoverable failure the script exits 3 with one complete resume command per task (resume never re-submits). Avatar images must be real files (prompt-only avatar layers need the image generated first by compile); stale staged audio is refused (re-run compile). Billing is ceil(seconds), capped by `maxAvatarSeconds` Outputs get `-movflags +faststart` when ffmpeg is on PATH. The second `compile` rewrites each cached avatar layer to a muted `video` layer.*

6. **Render Master Video (dual-master: horizontal + vertical)**:
   ```bash
   node scripts/video-engine-cli.mjs render renders/{ref}/manifest.json --output renders/{ref}/master.mp4
   node scripts/video-engine-cli.mjs compile <script.md> --output renders/{ref}-vertical/manifest.json --format 9:16
   node scripts/video-engine-cli.mjs render renders/{ref}-vertical/manifest.json --output renders/{ref}-vertical/master_vertical.mp4
   # cheap fallback only (burned-in captions may crop): node scripts/render-vertical.mjs --source renders/{ref}/master.mp4 --out renders/{ref}/master_vertical.mp4
   ```
   *A Remotion failure is a loud, non-zero error — there is no FFmpeg fallback. Pass `--allow-mock` only for CI placeholders. `--format 16:9|9:16|1:1` sets width/height (explicit flags win); `render` from a manifest refuses size flags — re-compile. Overlays scale with `width/1920` via `useVideoConfig`, so the vertical master keeps captions in frame. The second compile reuses cached TTS/images: zero extra provider cost.*
7. **Compose Video Thumbnail**:
   ```bash
   node scripts/render-thumbnail.mjs --base <path> --title <title> --out <out>
   ```
8. **Finalize**:
   ```bash
   node scripts/finalize-video.mjs --video-dir <video-dir> [--ref <r>] [--force-thumbnail]
   ```
   *Promotes `master.mp4` + `master_vertical.mp4` (when present) + thumbnail/voiceover. Set `master::` and `master_vertical::` on the Element.*
9. **Closing Retrospective & Improvement Analysis**:
   After completing the script elaboration or rendering session, proactively prompt the user asking if they want to analyze the session's conversation to suggest concrete refinements for future episodes.

## 3. Tooling Reference

| Script | Purpose |
|---|---|
| `scripts/remotion-scene-compiler.mjs` | Compiles video scripts into Remotion composition manifests with calculated frame timings and overlay configs. |
| `scripts/lib/innfo-video-parser.generated.mjs` | Committed, self-contained ESM VUS parser mirror (generated; drift-guarded). |
| `scripts/ensure-engine.mjs` | Idempotent, consent-gated Remotion runtime install with a size + first-render browser notice. |
| `scripts/cache-manager.mjs` | Deterministic SHA-256 asset cache manager under `.cognnitive/cache/video/`. |
| `scripts/asset-synthesizer.mjs` | Multi-provider TTS and media synthesis with `@remotion/media-parser` duration measurement and cache support. |
| `scripts/lib/video-guard.mjs` | Spend guard: validated `video-guard.json`, model allow/block lists, per-run and rolling 24h caps, append-only ledger, avatar limiter. |
| `scripts/lib/plan-approval.mjs` | `plan_hash`, plan stamp parsing and approval-file checks. |
| `scripts/lib/file-lock.mjs` | Cross-process lock files (ledger, voice registry, avatar slots). |
| `scripts/lib/cli-args.mjs` | Strict argv parser shared by the CLIs (`--flag=value`, missing-value errors). |
| `scripts/approve-plan.mjs` | HUMAN approval of a cost plan (interactive TTY + typed confirmation, no `--yes`): writes `asset_plan.approved.json` that `compile` requires for billable work. |
| `scripts/synthesize-avatar.mjs` | Guarded talking-avatar synthesis (budget, daily cap, approval, ledger, cross-process slot, pending-task journal, `--resume`, faststart). The ONLY allowed way to produce avatars. |
| `scripts/lib/avatar-jobs.mjs` | Avatar job definition shared by synthesize-avatar and compile: layer predicate, audio source, content-addressed cache key, cached-clip pickup. |
| `scripts/voice-clone.mjs` | Clone a voice once (pending reservation under a lock, atomic registry write, ledgered); refuses re-cloning without `--force`. |
| `scripts/asset-cost-estimator.mjs` | Pre-generation provider options catalog, per-scene character/layer calculator, and production cost estimator. |
| `scripts/video-engine-cli.mjs` | Headless CLI for video compilation (`compile`), headless rendering (`render`), and local web preview (`preview`). `compile` enforces the approval gate; `--dry-run` previews spend. `--format 16:9\|9:16\|1:1` presets width/height. |
| `scripts/render-vertical.mjs` | Cheap ffmpeg 16:9 → 9:16 reframe fallback (blur bg + header + title). Prefer native `--format 9:16`. |
| `scripts/check-script.mjs` | Zero-Unresolved-Placeholder Gate + No-Upward-Escape Rule. |
| `scripts/render-thumbnail.mjs` | Programmatic thumbnail compositor (SVG + Sharp) rendering high-contrast typography over clean 16:9 base images. |
| `scripts/finalize-video.mjs` | Promotes rendered `master`/`thumbnail`/`voiceover` out of `renders/<ref>/` into the video's own folder. |

Run any script with no arguments (or a bad one) to see its usage banner.
See `references/thumbnail-and-asset-pipeline.md` for visual preproduction guidelines.
See `references/cost-guardrails.md` for the spend gate (approval, budget, allowlist, ledger, dry run).
