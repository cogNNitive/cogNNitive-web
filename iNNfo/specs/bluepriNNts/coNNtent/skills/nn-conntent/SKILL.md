---
name: nn-conntent
description: |
  iNNfo-native skill for authoring, compiling, and rendering cogNNitive Video scripts inside a workspace's Series/Video hierarchy. Lowers the structured model into a deterministic Composition Manifest, emits a HyperFrames project from it, measures duration with ffprobe, and renders headlessly via the pinned HyperFrames CLI; also supports thumbnail composition. This is the one skill that triggers for a coNNtent domaiNN: an episode, a series, a frame, a character or the production pipeline. Triggers: coNNtent domaiNN, coNNtent episode, series script, frame, character, produce episode, video script, cognnitive video, hyperframes, nn-conntent, coNNtent blueprint, finalize video, render video script.
version: "V_0-15-11"
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

## 0b. Entry point: detect the state, then propose one procedure

In a coNNtent domaiNN, before anything else, run `detectState(root)` from
`scripts/lib/detect-state.mjs`. It reads the domaiNN's files (never conversation memory)
and returns the one procedure that comes next — or the layout rejection when the folder
predates this contract, in which case do not migrate: propose Set up the Domain in a new
folder.

Propose that procedure and ask for confirmation; the person may choose another one. The
six procedures, their steps and the tool of each step live in
`procedures/usage_procedures_NN.md`: point to it, do not restate it. Detection is
stateless, so after a procedure completes run `detectState` again and propose the next.
Series, cascade and character authoring follow `procedures/create_series_procedures_NN.md`,
`procedures/configure_cascade_procedures_NN.md` and `procedures/create_character_procedures_NN.md`.

## 0c. Authoring rules (always)

- **Load the HyperFrames skills before any visual.** Before authoring or changing any
  visual (an `animation` project, a component, an overlay, a frame), load `hyperframes`,
  `hyperframes-cli`, `hyperframes-registry` and `media-use`. Search the registry
  (`hyperframes-registry`) for a ready-made block before hand-authoring one: an arrow, a
  lower third, a chart or a transition almost always exists. Get music, sound effects and
  images through `media-use`; an episode with no music bed is a decision, not a default.
- **Verify with snapshots; render once.** After each visual change run `hyperframes check`
  on the project, then `hyperframes snapshot` and inspect the frames it writes. Fix and
  repeat on snapshots. Render the master once, at the end, through `produce`: a full render
  takes minutes and is never the way to check a fix.
- **Scene Kinds come only from the series.** Every `kind::` names a `Scene Kind` the Series
  document declares. Never invent a kind, or write a field where the blueprint does not
  define it (for example a `demo` kind, or `role::` on a Scene: `role` belongs to the Scene
  Kind); propose adding the kind to the
  Series instead. `Libre` is the only escape hatch, and it takes no chrome (no watermark).
- **Narration is continuous prose.** The scene body is TTS input: never break a line inside
  a sentence, because the voice reads it as a pause.
- **Never patch the installed copy silently.** The installed bluepriNNt and this skill under
  `~/.agents/` are overwritten by the next `install --blueprint coNNtent`, so a local patch is
  lost. When a workaround needs one, tell the person, and record it as an upstream report
  (what failed, the patch, the file) so it can be fixed in the bluepriNNt itself.

## 1. Engine Architecture & HyperFrames Pipeline

The video engine operates headlessly through programmatic modules:
- **Scene Compiler (`scripts/scene-compiler.mjs`)**: lowers the structured iNNfo coNNtent model (a Level-3 kNNowledge document adopting the `coNNtent` blueprint) into a deterministic, tool-agnostic Composition Manifest with sequence tracks, transitions, lower-thirds (`lowerThird`), and kinetic titles (`kineticTitle`). It reads the model structurally and never re-parses markdown.
- **Project Emitter (`scripts/scene-project.mjs`)**: lowers the manifest into a deterministic HyperFrames project (root `index.html` + one Sub-composition per Scene + `hyperframes.json`), with all audio and every overlay host at the root. Each overlay mounts, with global times, the slot component named by the `components` cascade (`components/<name>.html`, staged into the project by the render driver); the slot's fallback in `components/` defines the variable contract (see `references/overlay-slots.md`).
- **Scene Transitions (`scripts/scene-transition.mjs`)**: resolves `transition::` into a GSAP tween on the scene wrapper (`#root`).
- **Frame Tokens (`scripts/lib/frame-tokens.mjs`)**: reads the frame document named by the `frame::` cascade parameter (`frames/<name>.md`, found episode > series > domain > skill fallback) into the manifest's `metadata.frame`, so overlays take the brand typeface and accent instead of hardcoded values. The frame is truth for color and type, never for layout. The skill ships `frames/neutral.md` as the blueprint default.
- **Media Duration (`scripts/lib/media-duration.mjs`)**: ffprobe duration with a provider-reported fallback.
- **Deterministic Asset Cache (`scripts/cache-manager.mjs`)**: Content-addressed SHA-256 cache under `.cognnitive/cache/video/` with isolated subdirectories (`tts/`, `images/`, `temp/`).
- **Asset Synthesizer (`scripts/asset-synthesizer.mjs` / `scripts/tts-generator.mjs`)**: Synthesizes TTS voiceover tracks and image/motion assets.
- **Runtime Provisioner (`scripts/ensure-hyperframes.mjs`)**: Idempotent, consent-gated verification of the pinned HyperFrames CLI (`0.8.192`) and the pinned GSAP build it vendors into `vendor/gsap.min.js`.
- **Render Driver (`scripts/hyperframes-render.mjs`)**: emits the project and renders it via the pinned CLI; HyperFrames is the only renderer.
- **Engine CLI (`scripts/produce.mjs`, `scripts/lib/compile.mjs`, `scripts/lib/render.mjs`, `scripts/synthesize-avatar.mjs`)**: `produce` is the single pipeline command. `compile` and `render` are the primitives it drives, and `synthesize-avatar` is the guarded avatar stage.

## 1b. Domain Setup (adopt the blueprint)

When a domain adopts the `coNNtent` bluepriNNt, its root carries a Video Defaults document
(the `domain` cascade level). If `<domain root>/video-defaults_NN.md` is absent, copy the
package's `defaults/video-defaults_NN.md` there unchanged:

```bash
cp <bluepriNNt package>/defaults/video-defaults_NN.md <domain root>/video-defaults_NN.md
```

Domain tuning is an EDIT of that copy (voice, models, `background_audio_volume`, `transition`, `fit`,
`frame`, `components`, `sounds`). No script creates it; when it is absent the `domain` level is
simply skipped and the package defaults apply.

## 2. Scope of This Skill in the Authoring Workflow

This skill owns **authoring, validating, compiling, rendering, and producing** one episode inside a Series folder. The single entry point is:

```bash
node scripts/produce.mjs <episode-dir> [--dry-run] [--no-open]
```

`produce` runs the whole pipeline in order — intake, review gate, `status:: approved`, estimate,
budget gate, compile + render, delivery formats, `status:: produced` — and returns a predictable
exit code: `0` produced, `10` stopped for review, `11` stopped for budget, `1` error. Every stage
below is what `produce` does; the primitive commands are for debugging a single stage. Every exit
regenerates the domaiNN console, and opens it only when the exit needs a human (`10`, `11`, `12`);
`--no-open` (or `INNFO_CONSOLE_NO_OPEN=1`) keeps the browser closed.

1. **Author** the episode's Level-3 kNNowledge document (adopting the `coNNtent` blueprint, following the Series' `includes` blueprint and its scope document plus its `Preset` elements; see `references/series-template-convention.md`). Allowed Field names and `type::` values are read from the `coNNtent` blueprint at run time — never restated as prose.
1b. **Review Gate** (the Episode document is the record; the console view is the UI):
   The episode declares `review::` (skip or required) and each scene carries its own approval.
   `produce` refuses to spend while a scene is unapproved and, when a reviewer left a
   `needs-change` comment, prints that comment verbatim. Two console views ship with the
   blueprint:
   - **Episode review** (`assets/console-view-episode-review.js`): the episode's Scenes in
     order with kind, narration, a verdict control and a comment box, one ordered Preset
     selector, and the estimate against the budget. Every edit is a changeset operation.
   - **Series** (`assets/console-view-series.js`): the Series' episodes grouped by state,
     their real cost from the ledger and their stage timings across machines.
   Both read the exporter's facts through `ctx.viewData`; neither keeps a private copy of a
   decision. There is no `draft.json`, `reviewed.json`, `review_console.html` or
   `draft_thumbs/`: those artifacts are retired.
2. **Validate**: the document is validated against the `coNNtent` blueprint (innfo-core `validate_knowledge` / the engine pre-compile guard); the engine refuses an invalid document with a named, non-zero error before any manifest.
3. **Plan, Estimate & Consult Providers (Pre-Generation Gate)**:
   ```bash
   node scripts/asset-cost-estimator.mjs <script_NN.md> --out <episode-dir>/asset_plan.md
   ```
   *Model ids come from the documents (layer, scene, video, Scene Kind presets, Series, domain, blueprint): no flag supplies one, so the estimator and `compile` cannot disagree. Present provider options (WaveSpeed AI, Replicate, OpenAI, Local/Free), quality tiers, and itemized per-scene cost estimates to the user before proceeding. Items already in the cache are priced $0 (marked `cached`), so the total is what the run will charge. The plan is stamped with a `plan_hash`, and it warns when a model price is older than the staleness threshold. Spend is authorized only by applied human console verdicts: the `script` and `preview` gates per scene, and an inserted episode-level `budget` gate when the plan exceeds `budget::` without a preview verdict. There is no `--approve` flag and no approval file: a price or model change produces a different hash, so a stale verdict cannot be replayed. A domain-level `daily_budget::` is a rolling 24h ceiling that no verdict bypasses. NEVER self-approve: the human decides in the console, and the agent never invents a hash. Talking avatars (InfiniteTalk lip-sync, the costliest call) MUST be produced with `scripts/synthesize-avatar.mjs`, never with ad-hoc API or MCP calls: only that script puts them under the budget, daily cap and ledger. Preview uncached billable work with `produce --dry-run`. Budget, the 24h cap, model allow/block lists and prices live in the catalog and cascade fields — see `references/cost-guardrails.md`.*
4. **Ensure the Render Runtime (consent-gated, idempotent)**:
   ```bash
   node scripts/ensure-hyperframes.mjs
   ```
   *HyperFrames is the only renderer. The scene compiler reads the iNNfo model directly and the project emitter writes a HyperFrames project; the pinned CLI (`npx hyperframes@0.8.192`) installs on demand when a render runs. Re-running is a no-op once installed. Also verifies provider credentials (WaveSpeed/Replicate) with consent.*
5. **Compile Composition & Synthesize Assets**:
   ```bash
   node scripts/lib/compile.mjs compile <script_NN.md> [--dry-run] [--allow-model <name>]... [--cache-dir <dir>]
   ```
   *Compile plans first and refuses the whole run before the first charge unless every model is allowed and the total fits the per-run `budgetPerRunUsd` and the rolling `dailyCapUsd` (cache hits stay free). The spending decision belongs to `produce`; `compile` never looks for an approval file. There is no model flag: the estimator and `compile` resolve the same ids from the same documents. Avatar jobs are serialized across processes and every billable call is appended to `.cognnitive/video-ledger.jsonl`. A `replicate/<vendor>/<model>` name in a script is normalized to the WaveSpeed id for the guard, pricing, URL, ledger and plan_hash. Voices are cloned once with `node scripts/voice-clone.mjs <name> <sample>`; `scene_voice` resolves by registered name or `voice_id`, or is a provider system voice listed in `systemVoices`; anything else fails before spend.*
5b. **Synthesize Talking Avatars (guarded, and `produce` does it for you)**:
   *`produce` runs this stage by itself whenever the episode has a Layer with `type:: avatar`, before the render: a render refuses an avatar Layer with no cached clip. The standalone command exists for a single scene, a resume, or a dry run:*
   ```bash
   node scripts/synthesize-avatar.mjs <script_NN.md> [--scene <id>]... [--dry-run] [--resume <task-id>] [--force-resubmit] [--poll-window <min>] [--allow-model <name>] [--cache-dir <dir>]
   node scripts/lib/compile.mjs compile <script_NN.md>   # picks the clips up, zero extra spend
   ```
   *Needs the narration audio the first `compile` cached (it reads `<domain>/.cognnitive/cache/video/tts` directly: there is no `audio/` copy) and `WAVESPEED_API_KEY`. The price is per second of that audio (measured first; unmeasurable audio is refused), the default and only allowed model is `wavespeed-ai/infinitetalk-fast`, and the whole batch is refused before the first charge. A job takes minutes: the task id is journaled in `.cognnitive/pending-predictions.jsonl` before polling, and a re-run is REFUSED while the journal shows an outstanding job for the same scene (use the printed `--resume` command; `--force-resubmit` costs money). On a timeout or recoverable failure the script exits 3 with one complete resume command per task (resume never re-submits). Avatar images must be real files (prompt-only avatar layers need the image generated first by compile); a scene whose narration, voice or model changed has no cache entry and is refused (re-run compile first). Billing is ceil(seconds), capped by `maxAvatarSeconds`. The second `compile` rewrites each cached avatar layer to a muted `video` layer.*

6. **Render the Master (one file at the master resolution)**:
   ```bash
   node scripts/lib/render.mjs render <script_NN.md>
   ```
   *`render` takes the SCRIPT (a manifest argument is a usage error) and compiles first, so a stale manifest can never be rendered. It has no output option: the master is always `<episode-dir>/<slug>_<W>x<H>.mp4`, and `compile` has no `--output`/`--out` either (the manifest is always `hyperframes/manifest.json`). The master size comes from the first entry of `output_formats`; there is no `--format`, `--width` or `--height` and no 9:16 recompile. The master is written in place through a temp file in `hyperframes/`, so the path holds either the previous complete master or the new one. The project loads `vendor/gsap.min.js` (never a network URL): a missing pinned GSAP is a loud failure. A HyperFrames failure is a loud, non-zero error that includes the tail of the CLI's stderr - there is no FFmpeg fallback. Everything after a literal `--` is forwarded verbatim to `hyperframes render`; `--allow-mock` is only for CI placeholders. An avatar Layer with no cached lip-sync clip stops the render before it starts.*
7. **Compose Video Thumbnail**:
   ```bash
   node scripts/render-thumbnail.mjs --base <path> --title <title> --out <out> [--series <series-dir>]
   ```
   *`render-thumbnail.mjs` is the only Phase B thumbnail tool. When `--series <dir>` is passed (or a series is found by walking from `--out`), the subtitle and badge default to the Series `title`; explicit `--subtitle`/`--badge` win.*
8. **Produce (formats + status)**:
   ```bash
   node scripts/produce.mjs <episode-dir> [--dry-run] [--no-open]
   ```
   *`produce` derives the delivery files from the master — `<slug>_1080x1920.mp4`, `<slug>_1920x1080.mp4` and `<slug>_1080x1080.mp4` according to `output_formats` — writes the chapters into `description.md`, sets `master::` and `thumbnail::` on the Video element, and moves the Episode to `status:: produced`. A format with no preset is `unsupported-format`, never a guess. It never writes a manifest by hand: `compile` owns `hyperframes/manifest.json`.*
9. **Housekeeping (optional)**:
   ```bash
   node scripts/prune-duplicates.mjs <episode-or-series-dir> [--apply] [--json]
   ```
   *Reports files whose exact bytes and extension already exist in the provider cache, then
   deletes them only with `--apply` — this is the one cleanup that removes authored files, so
   the default is a dry run. A same-name-different-bytes file, another extension and anything
   the cache does not hold byte-for-byte are left alone, and the cache entry is never deleted.
   Run it before archiving a Series.*
10. **Closing Retrospective & Improvement Analysis**:
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
| `scripts/lib/plan.mjs` | `plan_hash` computation and the plan stamp on the first line of the estimate. |
| `scripts/lib/file-lock.mjs` | Cross-process lock files (ledger, voice registry, avatar slots). |
| `scripts/lib/cli-args.mjs` | Strict argv parser shared by the CLIs (`--flag=value`, missing-value errors). |
| `scripts/produce.mjs` | The single pipeline command: intake, review gate, budget gate, compile + render, formats, status. Exit codes 0/10/11/1. |
| `scripts/synthesize-avatar.mjs` | Guarded talking-avatar synthesis (budget, daily cap, ledger, cross-process slot, pending-task journal, `--resume`). The ONLY allowed way to produce avatars. |
| `scripts/lib/avatar-jobs.mjs` | Avatar job definition shared by synthesize-avatar and compile: layer predicate, audio source, content-addressed cache key, cached-clip pickup. |
| `scripts/voice-clone.mjs` | Clone a voice once (pending reservation under a lock, atomic registry write, ledgered); refuses re-cloning without `--force`. |
| `scripts/asset-cost-estimator.mjs` | Pre-generation provider options catalog, per-scene character/layer calculator, and production cost estimator. |
| `scripts/lib/compile.mjs` | The compile primitive: validates, resolves the cascade, synthesizes missing assets, stages them and writes `hyperframes/manifest.json`. `--dry-run` previews spend. |
| `scripts/lib/render.mjs` | The render primitive: takes the script, compiles, and writes the master in place. The size comes from `output_formats`. |
| `scripts/lib/series-doc.mjs` | Reads a Series' `<series>_coNNtent_NN.md` document (title, slug, fields). |
| `scripts/prune-duplicates.mjs` | Reports (or, with `--apply`, deletes) episode files whose exact bytes and extension already exist in the provider cache. The cache entry is never touched. |
| `scripts/render-formats.mjs` | The one derivation from the master: `_1080x1920` and `_1920x1080` are the central 1080 crops, `_1080x1080` is a lanczos scale, and `--fill blur` is an opt-in with a `_blur` suffix. |
| `scripts/render-thumbnail.mjs` | Programmatic thumbnail compositor: renders a one-frame HyperFrames composition (base image + typography + brand pill) through the pinned CLI. `--series <dir>` (or the cascade from `--out`) fills subtitle/badge from the Series `title`; font/accent come from the resolved `frame` tokens. |

Run any script with no arguments (or a bad one) to see its usage banner.
See `references/thumbnail-and-asset-pipeline.md` for visual preproduction guidelines.
See `references/overlay-slots.md` for the overlay slot contract (variables, components, sound keys).
See `references/cost-guardrails.md` for the spend gate (budget, allowlist, ledger, dry run).
See `references/parameters.md` for every Field by scope (Defaults, Series, Preset, Video, Scene, Layer) with its type and values. It is generated from the blueprint; never edit it by hand.
