---
name: nn-video-script
description: |
  iNNfo-native skill for authoring, compiling, and rendering cogNNitive Video scripts inside a workspace's Series/Video hierarchy. Lowers the structured model into a deterministic Composition Manifest, emits a HyperFrames project from it, measures duration with ffprobe, and renders headlessly via the pinned HyperFrames CLI; also supports thumbnail composition. Triggers: video script, cognnitive video, hyperframes, series script, nn-video-script, video-script blueprint, finalize video, render video script.
version: "V_0-15-6"
last_updated: 2026-10-27
license: MIT
depends_on:
  cli:
    - name: hyperframes
      agent_skills: true
  env:
    - name: WAVESPEED_API_KEY
      purpose: TTS and image/video media synthesis
      required: true
    - name: REPLICATE_API_TOKEN
      purpose: Fallback media synthesis
      required: false
  binaries:
    - ffmpeg
  node: ">=22"
  optional_mcp:
    - wavespeed
metadata:
  engine: "cogNNitive Video Engine"
  renderer: "HyperFrames Headless CLI"
---

# cogNNitive Video Script Engine Skill

Provides end-to-end video script authoring, deterministic TTS/media asset synthesis, HyperFrames scene compilation, and headless rendering for cogNNitive.

## 0. Activation Gate

Execute the canonical activation gate defined in `nn-preflight` (session greeting + deterministic preflight integrity check), same as every other cogNNitive skill.

## 1. Engine Architecture & HyperFrames Pipeline

The video engine operates headlessly through programmatic modules:
- **Scene Compiler (`scripts/scene-compiler.mjs`)**: lowers the structured iNNfo video-script model (a Level-3 kNNowledge document adopting the `video-script` blueprint) into a deterministic, tool-agnostic Composition Manifest with sequence tracks, transitions, lower-thirds (`lowerThird`), and kinetic titles (`kineticTitle`). It reads the model structurally and never re-parses markdown.
- **Project Emitter (`scripts/scene-project.mjs`)**: lowers the manifest into a deterministic HyperFrames project (root `index.html` + one Sub-composition per Scene + `hyperframes.json`), with all audio and every overlay host at the root. Each overlay mounts, with global times, the slot component named by the `components` cascade (`components/<name>.html`, staged into the project by the render driver); the slot's fallback in `components/` defines the variable contract (see `references/overlay-slots.md`).
- **Scene Transitions (`scripts/scene-transition.mjs`)**: resolves `transition::` into a GSAP tween on the scene wrapper (`#root`).
- **Frame Tokens (`scripts/lib/frame-tokens.mjs`)**: reads the frame document named by the `frame::` cascade parameter (`frames/<name>.md`, found episode > series > domain > skill fallback) into the manifest's `metadata.frame`, so overlays take the brand typeface and accent instead of hardcoded values. The frame is truth for color and type, never for layout. The skill ships `frames/neutral.md` as the blueprint default.
- **Media Duration (`scripts/lib/media-duration.mjs`)**: ffprobe duration with a provider-reported fallback.
- **Deterministic Asset Cache (`scripts/cache-manager.mjs`)**: Content-addressed SHA-256 cache under `.cognnitive/cache/video/` with isolated subdirectories (`tts/`, `images/`, `temp/`).
- **Asset Synthesizer (`scripts/asset-synthesizer.mjs` / `scripts/tts-generator.mjs`)**: Synthesizes TTS voiceover tracks and image/motion assets.
- **Runtime Provisioner (`scripts/ensure-hyperframes.mjs`)**: Idempotent, consent-gated verification of the pinned HyperFrames CLI (`0.8.192`) and its agent skills.
- **Render Driver (`scripts/hyperframes-render.mjs`)**: emits the project and renders it via the pinned CLI; HyperFrames is the only renderer.
- **Video Engine CLI (`scripts/video-engine-cli.mjs`)**: Headless CLI providing `compile` and `render` commands.

## 1b. Domain Setup (adopt the blueprint)

When a domain adopts the `video-script` bluepriNNt, its root carries a Video Defaults document
(the `domain` cascade level). If `<domain root>/video-defaults_NN.md` is absent, copy the
package's `defaults/video-defaults_NN.md` there unchanged:

```bash
cp <bluepriNNt package>/defaults/video-defaults_NN.md <domain root>/video-defaults_NN.md
```

Domain tuning is an EDIT of that copy (voice, models, `music_volume`, `transition`, `fit`,
`frame`, `components`, `sounds`). No script creates it; when it is absent the `domain` level is
simply skipped and the package defaults apply.

## 2. Scope of This Skill in the Authoring Workflow

This skill owns **authoring, validating, compiling, rendering, and finalizing** one video's script inside a Series folder:

1. **Author** the video's Level-3 kNNowledge document (adopting the `video-script` blueprint, following the Series' `includes` blueprint and its L3 Template-data document; see `references/series-template-convention.md`). Allowed Field names and `type::` values are read from the `video-script` blueprint at run time — never restated as prose.
2. **Validate**: the document is validated against the `video-script` blueprint (innfo-core `validate_knowledge` / the engine pre-compile guard); the engine refuses an invalid document with a named, non-zero error before any manifest.
3. **Plan, Estimate & Consult Providers (Pre-Generation Gate)**:
   ```bash
   node scripts/asset-cost-estimator.mjs <script_NN.md> --out assets/{video-slug}/asset_plan.md [--image-model <id>] [--tts-model <id>] [--avatar-model <id>]
   ```
   *Present provider options (WaveSpeed AI, Replicate, OpenAI, Local/Free), quality tiers, and itemized per-scene cost estimates to the user for explicit approval before proceeding. The plan is stamped with a `plan_hash`. Approval is a HUMAN act, confirmed by the plan hash, done IN CHAT: ask the user to reply with the exact phrase `approve the plan <plan-hash-8>`; when they send it, relay it with `node scripts/approve-plan.mjs assets/{video-slug}/asset_plan.md --delegated "<their exact phrase>"`, which writes `asset_plan.approved.json`. The phrase is recorded verbatim for audit. A workspace may instead require an interactive TTY (`video-guard.json: allowDelegatedApproval: false`). NEVER self-approve: never invent the phrase, never run `approve-plan.mjs` without the human's actual reply, and never hand-write the approval file. Talking avatars (InfiniteTalk lip-sync, the costliest call) MUST be produced with `scripts/synthesize-avatar.mjs`, never with ad-hoc API or MCP calls: only that script puts them under the budget, daily cap, approval and ledger. Preview uncached billable work with `compile --dry-run`. Budget, the 24h cap, model allow/block lists and the ledger live in `video-guard.json` - see `references/cost-guardrails.md`.*
4. **Ensure the Render Runtime (consent-gated, idempotent)**:
   ```bash
   node scripts/ensure-hyperframes.mjs
   ```
   *HyperFrames is the only renderer. The scene compiler reads the iNNfo model directly and the project emitter writes a HyperFrames project; the pinned CLI (`npx hyperframes@0.8.192`) installs on demand when a render runs. Re-running is a no-op once installed. Also verifies provider credentials (WaveSpeed/Replicate) with consent.*
5. **Compile Composition & Synthesize Assets**:
   ```bash
   node scripts/video-engine-cli.mjs compile <script_NN.md> --output renders/{ref}/manifest.json [--dry-run] [--approval <approved.json>] [--allow-model <name>]... [--image-model <id>] [--tts-model <id>] [--avatar-model <id>] [--cache-dir <dir>]
   ```
   *Compile plans first and refuses the whole run before the first charge unless `asset_plan.approved.json` matches the current script (cache hits stay free), every model is allowed and covered by the approval, and the total fits `min(budgetPerRunUsd, 1.25 x approved total)` and the rolling `dailyCapUsd`. Pass the same `--image-model/--tts-model/--avatar-model` as the estimator. `--allow-model` only works for models a human recorded in the approval. Avatar jobs are serialized across processes and every billable call is appended to `.cognnitive/video-ledger.jsonl`. A `replicate/<vendor>/<model>` name in a script is normalized to the WaveSpeed id for the guard, pricing, URL, ledger and plan_hash. Voices are cloned once with `node scripts/voice-clone.mjs <name> <sample>`; `scene_voice` resolves by registered name or `voice_id`, or is a provider system voice listed in `systemVoices`; anything else fails before spend.*
5b. **Synthesize Talking Avatars (guarded, after the first compile)**:
   ```bash
   node scripts/synthesize-avatar.mjs <script_NN.md> [--scene <id>]... [--dry-run] [--resume <task-id>] [--force-resubmit] [--poll-window <min>] [--allow-model <name>] [--approval <file>] [--cache-dir <dir>]
   node scripts/video-engine-cli.mjs compile <script_NN.md> --output renders/{ref}/manifest.json   # picks the clips up, zero extra spend
   ```
   *Needs the narration audio that the first `compile` staged (`audio/<sceneId>_voiceover.mp3`), `WAVESPEED_API_KEY` and the human-approved plan. The price is per second of that audio (measured first; unmeasurable audio is refused), the default and only allowed model is `wavespeed-ai/infinitetalk-fast`, and the whole batch is refused before the first charge. A job takes minutes: the task id is journaled in `.cognnitive/pending-predictions.jsonl` before polling, and a re-run is REFUSED while the journal shows an outstanding job for the same scene (use the printed `--resume` command; `--force-resubmit` costs money). On a timeout or recoverable failure the script exits 3 with one complete resume command per task (resume never re-submits). Avatar images must be real files (prompt-only avatar layers need the image generated first by compile); stale staged audio is refused (re-run compile). Billing is ceil(seconds), capped by `maxAvatarSeconds`. The second `compile` rewrites each cached avatar layer to a muted `video` layer.*

6. **Render Master Video (dual-master: horizontal + vertical)**:
   ```bash
   node scripts/video-engine-cli.mjs render renders/{ref}/manifest.json --output renders/{ref}/master.mp4
   node scripts/video-engine-cli.mjs compile <script_NN.md> --output renders/{ref}-vertical/manifest.json --format 9:16
   node scripts/video-engine-cli.mjs render renders/{ref}-vertical/manifest.json --output renders/{ref}-vertical/master_vertical.mp4
   ```
   *A HyperFrames failure is a loud, non-zero error that includes the tail of the CLI's stderr (stdout if empty) — there is no FFmpeg fallback. Everything after a literal `--` is forwarded verbatim to `hyperframes render` (e.g. `render <manifest> --output <mp4> -- --workers 2 --low-memory-mode`); environment variables are inherited by the CLI. Pass `--allow-mock` only for CI placeholders. `--format 16:9|9:16|1:1` sets width/height (explicit flags win); `render` from a manifest refuses size flags — re-compile. Presenter avatar layers automatically anchor at `object-position: center 12%` in horizontal widescreen (16:9) to preserve cinematic headroom, while vertical (9:16) preserves full-body framing. The second compile reuses cached TTS/images/avatars: zero extra provider cost.*
6c. **Derive Format Variants (optional, from a square master)** — when the deliverable set is square/vertical/horizontal and crop-fill would lose the square composition:
   ```bash
   node scripts/render-formats.mjs --master renders/{ref}/master_1080x1080.mp4 [--out-dir renders/{ref}] [--formats square,vertical,horizontal]
   ```
   *Post-process over the square master (NOT a re-render): emits `<slug>_1080x1080.mp4` (stream copy), `<slug>_1080x1920.mp4` and `<slug>_1920x1080.mp4`, each showing the square WHOLE, centered, over a Gaussian-blurred fill, audio copied and `+faststart` applied. `--dry-run` prints the ffmpeg filter graphs. If the master is already named `<slug>_1080x1080.mp4`, the square copy is skipped (never overwrites its own input).*
7. **Compose Video Thumbnail**:
   ```bash
   node scripts/render-thumbnail.mjs --base <path> --title <title> --out <out> [--series <series-dir>]
   ```
   *`render-thumbnail.mjs` is the only Phase B thumbnail tool. When `--series <dir>` is passed (or a series is found by walking from `--out`), the subtitle and badge default to the Series `title`; explicit `--subtitle`/`--badge` win.*
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
| `scripts/scene-compiler.mjs` | Lowers video scripts into tool-agnostic composition manifests with calculated frame timings and overlay configs. |
| `scripts/scene-project.mjs` | Emits a deterministic HyperFrames project from the manifest (root + Sub-compositions + `hyperframes.json`). |
| `scripts/scene-transition.mjs` | Resolves `transition::` into a GSAP tween on the scene wrapper. |
| `scripts/hyperframes-render.mjs` | Emits the project and renders it via the pinned HyperFrames CLI. |
| `scripts/lib/media-duration.mjs` | ffprobe duration probe with a provider-reported fallback. |
| `scripts/ensure-hyperframes.mjs` | Idempotent, consent-gated verification of the pinned HyperFrames CLI and its skills. |
| `scripts/cache-manager.mjs` | Deterministic SHA-256 asset cache manager under `.cognnitive/cache/video/`. |
| `scripts/asset-synthesizer.mjs` | Multi-provider TTS and media synthesis with ffprobe duration measurement and cache support. |
| `scripts/lib/video-guard.mjs` | Spend guard: validated `video-guard.json`, model allow/block lists, per-run and rolling 24h caps, append-only ledger, avatar limiter. |
| `scripts/lib/plan-approval.mjs` | `plan_hash`, plan stamp parsing and approval-file checks. |
| `scripts/lib/file-lock.mjs` | Cross-process lock files (ledger, voice registry, avatar slots). |
| `scripts/lib/cli-args.mjs` | Strict argv parser shared by the CLIs (`--flag=value`, missing-value errors). |
| `scripts/approve-plan.mjs` | HUMAN approval of a cost plan. Default flow is in-chat: the user replies with `approve the plan <hash>`; the agent relays it via `--delegated "<phrase>"`. Also supports an interactive TTY (`--yes`-free). Writes `asset_plan.approved.json` that `compile` requires for billable work. |
| `scripts/synthesize-avatar.mjs` | Guarded talking-avatar synthesis (budget, daily cap, approval, ledger, cross-process slot, pending-task journal, `--resume`). The ONLY allowed way to produce avatars. |
| `scripts/lib/avatar-jobs.mjs` | Avatar job definition shared by synthesize-avatar and compile: layer predicate, audio source, content-addressed cache key, cached-clip pickup. |
| `scripts/voice-clone.mjs` | Clone a voice once (pending reservation under a lock, atomic registry write, ledgered); refuses re-cloning without `--force`. |
| `scripts/asset-cost-estimator.mjs` | Pre-generation provider options catalog, per-scene character/layer calculator, and production cost estimator. |
| `scripts/video-engine-cli.mjs` | Headless CLI for video compilation (`compile`) and headless rendering (`render`). `compile` enforces the approval gate; `--dry-run` previews spend. `--format 16:9\|9:16\|1:1` presets width/height. |
| `scripts/render-formats.mjs` | Format-variant post-process: square master → `_1080x1080` (copy) / `_1080x1920` / `_1920x1080` with the square whole over a Gaussian-blurred fill (`+faststart`). |
| `scripts/render-thumbnail.mjs` | Programmatic thumbnail compositor: renders a one-frame HyperFrames composition (base image + typography + brand pill) through the pinned CLI. `--series <dir>` (or the cascade from `--out`) fills subtitle/badge from the Series `title`; font/accent come from the resolved `frame` tokens. |
| `scripts/finalize-video.mjs` | Promotes rendered `master`/`thumbnail`/`voiceover` out of `renders/<ref>/` into the video's own folder. |
| `scripts/build-script-from-draft.mjs` | Generates the L3 `video-script` document from a reviewed draft JSON, reading series values through the parameter cascade (`series_NN.md` → domain Video Defaults → package Video Defaults). The reviewed JSON (all scenes, fixed ones included, each with its `kind`) is the single source of truth for per-scene decisions (narration, choice, overlays) and works on its own; `--draft` only supplies scene structure. The script frontmatter is copied from the series document and the filename uses the Series slug. |
| `scripts/build-draft-html.mjs` | Generates the self-contained review HTML from a draft JSON (base64 thumbnails; series title from the `series_NN.md` document). |

Run any script with no arguments (or a bad one) to see its usage banner.
See `references/thumbnail-and-asset-pipeline.md` for visual preproduction guidelines.
See `references/overlay-slots.md` for the overlay slot contract (variables, components, sound keys).
See `references/cost-guardrails.md` for the spend gate (approval, budget, allowlist, ledger, dry run).
