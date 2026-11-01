---
name: nn-video-script
description: |
  iNNfo-native skill for authoring, compiling, and rendering cogNNitive Video scripts inside a workspace's Series/Video hierarchy. Lowers the structured model into a deterministic Composition Manifest, emits a HyperFrames project from it, measures duration with ffprobe, and renders headlessly via the pinned HyperFrames CLI; also supports thumbnail composition. Triggers: video script, cognnitive video, hyperframes, series script, nn-video-script, video-script blueprint, finalize video, render video script.
version: "V_0-15-7"
last_updated: 2026-10-31
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

Domain tuning is an EDIT of that copy (voice, models, `background_audio_volume`, `transition`, `fit`,
`frame`, `components`, `sounds`). No script creates it; when it is absent the `domain` level is
simply skipped and the package defaults apply.

## 2. Scope of This Skill in the Authoring Workflow

This skill owns **authoring, validating, compiling, rendering, and finalizing** one video's script inside a Series folder:

1. **Author** the video's Level-3 kNNowledge document (adopting the `video-script` blueprint, following the Series' `includes` blueprint and its scope document plus its `Preset` elements; see `references/series-template-convention.md`). Allowed Field names and `type::` values are read from the `video-script` blueprint at run time — never restated as prose.
1b. **Interactive Review Console & Human Review Gate** (`review_console.html`):
   Before executing billable synthesis or committing the final L3 script, generate the interactive self-contained Review Console:
   ```bash
   node scripts/build-draft-html.mjs <draft.json>
   ```
   The script refuses to build the console (exit 1, no HTML written) while any media or thumbnail file referenced by the draft is missing under `assets/<slug>/media/`; produce the screenshots and HyperFrames clips first.
   The draft, the review and the console use fixed names (`draft.json`, `reviewed.json`, `review_console.html`) in the episode folder. A draft or reviewed JSON carrying a retired key (`template`, `speed`, `emotion`, `tts_model`, `music`, `music_volume`, `presenter_asset`, `intro_asset`) is rejected with `legacy-draft-keys`, which names the key and its replacement (list: `scripts/lib/legacy-draft-keys.mjs`); re-draft it, it is never converted.
   This emits `review_console.html`. The console provides:
   - Parameter cascade inspection and overrides (`#video-params-sheet`): voice speed, fps, background audio volume, transition, and one Preset selector (video and scene level) that lists the Presets visible from the Series chain and the domain Video Defaults, and exports the choice as an ordered `presets` list.
   - Global video overlay templates (`#video-overlays-sheet`).
   - Editorial hook variant selection and narration editing.
   - Visual option selection with 3-tier motion styling (ALTA, MEDIA, RÁPIDA) and storyboard lightbox inspection (`#modal-lightbox`).
     The builder (`normalizeAnimationTiers`) guarantees every animated scene exactly 3 HyperFrames options, ALTA (violet/magenta), MEDIA (blue/cyan) and RÁPIDA (emerald), each with a structured `storyboard` (`camera[]`, `choreography[]`, `timeline{duration_s, ease, fps}`) shown in the lightbox. Authored options are kept; missing tiers are derived. Procedural options never carry a raster thumbnail.
   - **Quine Self-Saving Pattern**: Clicking *Save & Package HTML* (`#btn-save-html`) packages all editorial decisions into `<script id="raw-reviewed-data">` directly inside the standalone HTML file, making it self-contained and portable.
   - Exporting `reviewed.json` (`#btn-save-json`) or copying compiled Level-3 markdown prompt for the agent (`#btn-copy-prompt`).
   The human reviewer opens the console in any browser, completes the review, and either exports `reviewed.json` or uses the Quine file to build the script with `scripts/build-script-from-draft.mjs`.
2. **Validate**: the document is validated against the `video-script` blueprint (innfo-core `validate_knowledge` / the engine pre-compile guard); the engine refuses an invalid document with a named, non-zero error before any manifest.
3. **Plan, Estimate & Consult Providers (Pre-Generation Gate)**:
   ```bash
   node scripts/asset-cost-estimator.mjs <script_NN.md> --out assets/{video-slug}/asset_plan.md [--image-model <id>] [--tts-model <id>] [--avatar-model <id>]
   ```
   *Present provider options (WaveSpeed AI, Replicate, OpenAI, Local/Free), quality tiers, and itemized per-scene cost estimates to the user for explicit approval before proceeding. Items already in the cache are priced $0 (marked `cached`), so the total is what the run will charge. The plan is stamped with a `plan_hash`. Approval is a HUMAN act, confirmed by the plan hash, done IN CHAT: ask the user to reply with the exact phrase `approve the plan <plan-hash-8>`; when they send it, relay it with `node scripts/approve-plan.mjs assets/{video-slug}/asset_plan.md --delegated "<their exact phrase>"`, which writes `asset_plan.approved.json`. The phrase is recorded verbatim for audit. A workspace may instead require an interactive TTY (`video-guard.json: allowDelegatedApproval: false`). NEVER self-approve: never invent the phrase, never run `approve-plan.mjs` without the human's actual reply, and never hand-write the approval file. Talking avatars (InfiniteTalk lip-sync, the costliest call) MUST be produced with `scripts/synthesize-avatar.mjs`, never with ad-hoc API or MCP calls: only that script puts them under the budget, daily cap, approval and ledger. Preview uncached billable work with `compile --dry-run`. Budget, the 24h cap, model allow/block lists and the ledger live in `video-guard.json` - see `references/cost-guardrails.md`.*
4. **Ensure the Render Runtime (consent-gated, idempotent)**:
   ```bash
   node scripts/ensure-hyperframes.mjs
   ```
   *HyperFrames is the only renderer. The scene compiler reads the iNNfo model directly and the project emitter writes a HyperFrames project; the pinned CLI (`npx hyperframes@0.8.192`) installs on demand when a render runs. Re-running is a no-op once installed. Also verifies provider credentials (WaveSpeed/Replicate) with consent.*
5. **Compile Composition & Synthesize Assets**:
   ```bash
   node scripts/video-engine-cli.mjs compile <script_NN.md> [--dry-run] [--approval <approved.json>] [--allow-model <name>]... [--image-model <id>] [--tts-model <id>] [--avatar-model <id>] [--cache-dir <dir>]
   ```
   *Compile plans first and refuses the whole run before the first charge unless `asset_plan.approved.json` matches the current script (cache hits stay free), every model is allowed and covered by the approval, and the total fits `min(budgetPerRunUsd, 1.25 x approved total)` and the rolling `dailyCapUsd`. Pass the same `--image-model/--tts-model/--avatar-model` as the estimator. `--allow-model` only works for models a human recorded in the approval. Avatar jobs are serialized across processes and every billable call is appended to `.cognnitive/video-ledger.jsonl`. A `replicate/<vendor>/<model>` name in a script is normalized to the WaveSpeed id for the guard, pricing, URL, ledger and plan_hash. Voices are cloned once with `node scripts/voice-clone.mjs <name> <sample>`; `scene_voice` resolves by registered name or `voice_id`, or is a provider system voice listed in `systemVoices`; anything else fails before spend.*
5b. **Synthesize Talking Avatars (guarded, after the first compile)**:
   ```bash
   node scripts/synthesize-avatar.mjs <script_NN.md> [--scene <id>]... [--dry-run] [--resume <task-id>] [--force-resubmit] [--poll-window <min>] [--allow-model <name>] [--approval <file>] [--cache-dir <dir>]
   node scripts/video-engine-cli.mjs compile <script_NN.md>   # picks the clips up, zero extra spend
   ```
   *Needs the narration audio the first `compile` cached (it reads `<domain>/.cognnitive/cache/video/tts` directly: there is no `audio/` copy), `WAVESPEED_API_KEY` and the human-approved plan. The price is per second of that audio (measured first; unmeasurable audio is refused), the default and only allowed model is `wavespeed-ai/infinitetalk-fast`, and the whole batch is refused before the first charge. A job takes minutes: the task id is journaled in `.cognnitive/pending-predictions.jsonl` before polling, and a re-run is REFUSED while the journal shows an outstanding job for the same scene (use the printed `--resume` command; `--force-resubmit` costs money). On a timeout or recoverable failure the script exits 3 with one complete resume command per task (resume never re-submits). Avatar images must be real files (prompt-only avatar layers need the image generated first by compile); a scene whose narration, voice or model changed has no cache entry and is refused (re-run compile first). Billing is ceil(seconds), capped by `maxAvatarSeconds`. The second `compile` rewrites each cached avatar layer to a muted `video` layer.*

6. **Render the Master (one 1920x1920 file)**:
   ```bash
   node scripts/video-engine-cli.mjs render <script_NN.md>
   ```
   *`render` takes the SCRIPT (a manifest argument is a usage error) and compiles first, so a stale manifest can never be rendered. It has no output option: the master is always `<episode-dir>/<slug>_1920x1920.mp4`, and `compile` has no `--output`/`--out` either (the manifest is always `build/manifest.json`). The master size comes from the declared `master_resolution` in the domain Video Defaults; there is no `--format`, `--width` or `--height` and no 9:16 recompile. The master is written in place through a temp file in `build/`, so the path holds either the previous complete master or the new one. A HyperFrames failure is a loud, non-zero error that includes the tail of the CLI's stderr — there is no FFmpeg fallback. Everything after a literal `--` is forwarded verbatim to `hyperframes render`; `--allow-mock` is only for CI placeholders. A presenter Layer with no cached avatar clip stops the render before it starts.*
7. **Compose Video Thumbnail**:
   ```bash
   node scripts/render-thumbnail.mjs --base <path> --title <title> --out <out> [--series <series-dir>]
   ```
   *`render-thumbnail.mjs` is the only Phase B thumbnail tool. When `--series <dir>` is passed (or a series is found by walking from `--out`), the subtitle and badge default to the Series `title`; explicit `--subtitle`/`--badge` win.*
8. **Finalize**:
   ```bash
   node scripts/finalize-video.mjs <episode-dir> [--formats vertical,horizontal,square] [--fill crop|blur] [--force] [--dry-run]
   ```
   *Derives the delivery files from `<slug>_1920x1920.mp4` — `<slug>_1080x1920.mp4`, `<slug>_1920x1080.mp4` and `<slug>_1080x1080.mp4` — then prints the chapters of `description.md` and the two Field values `master::` and `thumbnail::`. It never writes the model and copies nothing: render already wrote the master in place. Write `description.md` yourself from the printed chapters, and set `master::` on the Video element.*
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
| `scripts/video-engine-cli.mjs` | Headless CLI for `compile` and `render`. `compile` enforces the approval gate, writes `build/manifest.json` and `--dry-run` previews spend; `render` takes the script and writes the master in place. The size comes from the declared `master_resolution`. |
| `scripts/render-formats.mjs` | The one derivation from the 1920x1920 master: `_1080x1920` and `_1920x1080` are the central 1080 crops, `_1080x1080` is a lanczos scale, and `--fill blur` is an opt-in with a `_blur` suffix. |
| `scripts/render-thumbnail.mjs` | Programmatic thumbnail compositor: renders a one-frame HyperFrames composition (base image + typography + brand pill) through the pinned CLI. `--series <dir>` (or the cascade from `--out`) fills subtitle/badge from the Series `title`; font/accent come from the resolved `frame` tokens. |
| `scripts/finalize-video.mjs` | Derives the delivery formats from the master in place, prints the `description.md` chapters and the `master::`/`thumbnail::` values. Never writes the model. |
| `scripts/build-script-from-draft.mjs` | Generates the L3 `video-script` document from a reviewed draft JSON, reading series values through the parameter cascade (series scope document → domain Video Defaults → package Video Defaults). The reviewed JSON (all scenes, fixed ones included, each with its `kind`) is the single source of truth for per-scene decisions (narration, choice, overlays) and works on its own; `--draft` only supplies scene structure. The script frontmatter is copied from the series document and the filename uses the Series slug. |
| `scripts/build-draft-html.mjs` | Generates the self-contained interactive Review Console (`review_console.html`) from a draft JSON with inlined base64 thumbnails, parameter cascade overrides, hook variant selector, live L3 preview, and Quine self-saving pattern. |

Run any script with no arguments (or a bad one) to see its usage banner.
See `references/thumbnail-and-asset-pipeline.md` for visual preproduction guidelines.
See `references/overlay-slots.md` for the overlay slot contract (variables, components, sound keys).
See `references/cost-guardrails.md` for the spend gate (approval, budget, allowlist, ledger, dry run).
See `references/parameters.md` for every Field by scope (Defaults, Series, Preset, Video, Scene, Layer) with its type and values. It is generated from the blueprint; never edit it by hand.
