# Cost Guardrails

Billable provider calls (TTS, image, avatar, voice clone) are gated by code, not
by prose. One day of unguarded runs once spent about $21: six non-fast
`infinitetalk` avatar jobs fired in seven seconds, a voice cloned three times,
and identical TTS lines regenerated.

A call is **billable** only when it would actually reach a provider (a
`WAVESPEED_API_KEY` / `REPLICATE_API_TOKEN` is configured and the call is a cache
miss). Cache hits and keyless local/offline synthesis are free and never gated.

## 1. `video-guard.json` (workspace root)

Found by walking up from the script directory. Root resolution is the same for
the config, the ledger, the locks and the cache: a `video-guard.json` anywhere
above wins, otherwise the nearest `.git`, otherwise the script directory. A stray
`.cognnitive` folder is not a marker. With no file the defaults below apply.

```json
{
  "version": 1,
  "budgetPerRunUsd": 2.0,
  "dailyCapUsd": 5.0,
  "maxAvatarConcurrency": 1,
  "maxAvatarSeconds": 300,
  "allowedModels": [
    "minimax/speech-2.8-hd",
    "wavespeed-ai/infinitetalk-fast",
    "wavespeed-ai/z-image/turbo",
    "black-forest-labs/flux-schnell",
    "luma/uni-v1/text-to-image",
    "black-forest-labs/flux-3/text-to-image",
    "wavespeed-ai/minimax-h3/image-edit"
  ],
  "blockedModels": ["wavespeed-ai/infinitetalk"],
  "allowDelegatedApproval": false,
  "systemVoices": ["Friendly_Person", "Wise_Woman", "Deep_Voice_Man", "English_*", "..."],
  "voices": { "<Name>": { "voice_id": "<id>", "series": "<slug>" } }
}
```

The file is validated on load and an invalid one throws (never a silent
fallback): budgets and `dailyCapUsd` must be finite numbers >= 0,
`maxAvatarConcurrency` a positive integer, the model lists arrays of strings, and
`allowedModels` must be non-empty (an empty or null list never means "allow all").

- `blockedModels` always wins. A blocked model needs `--allow-model <name>`, and
  that override must also be recorded in the human approval (section 2).
- `allowedModels`: any model not listed is rejected.
- `budgetPerRunUsd`: per-process running total of estimated spend, further
  tightened to 1.25x the approved plan total.
- `dailyCapUsd`: rolling 24h cap summed from the ledger, so re-running compile or
  running several processes in parallel cannot reset or multiply it.
- `systemVoices`: provider-native voice names that need no registration or cloning (array of strings; a trailing `*` is a prefix glob). The default list holds the MiniMax system voices (Friendly_Person, Wise_Woman, Deep_Voice_Man, Elegant_Man, Casual_Guy, ... and `English_*`).
- `maxAvatarSeconds`: longest avatar audio that may be billed (finite number > 0, default 300).
- `maxAvatarConcurrency`: simultaneous avatar jobs, enforced in-process and across
  processes with lock files under `.cognnitive/locks/` (stale locks are broken).
- `allowDelegatedApproval`: when `true`, compile/synthesize-avatar honor
  agent-relayed (`--delegated`) plan approvals (section 2b). Default `false`.

## 2. Plan approval is an artifact (a human act)

1. `node scripts/asset-cost-estimator.mjs <script.md> --out assets/<slug>/asset_plan.md`
   stamps the first line of the plan with `plan_hash` (sha256 of the normalized
   script text, NFC and newline-insensitive, plus the explicitly chosen
   `--image-model/--tts-model/--avatar-model`), `total_usd` and the model set.
   Only that first-line stamp is ever read back.
2. A **human** runs `node scripts/approve-plan.mjs assets/<slug>/asset_plan.md
   [--allow-model <name>]...`. It needs an interactive terminal and a typed
   confirmation, and has no `--yes` flag. It writes `asset_plan.approved.json`
   (`plan_hash`, `totalUsd`, `approvedAt`, `allowedModels`, `allowModels`).
3. `compile` plans first and refuses the whole run before the first charge unless
   the approval exists next to `script.md` (or via `--approval`), matches the
   script and models, covers every model used, and the plan fits
   `min(budgetPerRunUsd, approvedTotal x 1.25)` and the 24h cap. Editing the script
   or the model flags invalidates the approval.

Pass the same `--image-model/--tts-model/--avatar-model` to `compile` as to the
estimator: those flags select the models actually called, and are part of the hash.

**Residual risk.** The approval is a file, not a signature. Interactivity and a
typed confirmation stop `approve-plan.mjs` from being run casually by an agent, but
anything with file-write access to the workspace can still hand-write
`asset_plan.approved.json`. Add a workspace permission rule that denies agent
writes to `**/asset_plan.approved.json` and `video-guard.json`.

### 2b. Delegated approval (opt-in, default off)

Workspaces that prefer chat-based approval can set
`"allowDelegatedApproval": true` in `video-guard.json`. The flow is then:

1. The human writes an explicit approval phrase in the chat (naming episode and
   total, e.g. `apruebo el plan de huelga-general, $1.60`).
2. The agent runs `node scripts/approve-plan.mjs <asset_plan.md> --delegated "<exact phrase>"`.
   No TTY is needed; the phrase is recorded verbatim (`delegated: true`,
   `delegatedPhrase`) in `asset_plan.approved.json` for audit.
3. `compile` / `synthesize-avatar` honor that approval only when the workspace
   opted in; otherwise they refuse it (`delegated-not-allowed`) and require the
   interactive approval from section 2.

Trade-off: a chat phrase is weaker than a TTY — a malicious document in the
workspace could in principle contain an approval-looking phrase (prompt
injection) that an incautious agent relays. Only opt in if the human reviews
every plan total before uttering the phrase, and never enable it together with
fully autonomous agent loops. The plan-hash match, model coverage, 1.25x cap,
per-run budget and 24h cap all still apply to delegated approvals.

## 3. Dry run

`node scripts/video-engine-cli.mjs compile <script.md> --dry-run` lists every
uncached billable call (TTS and image layers), the estimated total against the
per-run and 24h caps, blocked models and approval status. It spends nothing,
writes nothing (not even cache directories) and exits 0. `--dry-run` is rejected
on `render` and `preview`.

## 4. Enforcement order (per billable call)

model allow/block list, plan approval and approved model set, per-run cap, rolling
24h cap, ledger append, then the request. Every refusal happens before the
request. A provider failure after submit (HTTP error, failed task, timeout, empty
output) throws with the task id; nothing is cached, no other provider is tried and
nothing retries on its own. Concurrent identical TTS lines or images share one
call.

## 5. Ledger

Append-only `<workspaceRoot>/.cognnitive/video-ledger.jsonl`, one JSON line per
event: `ts`, `kind`, `model`, `ref`, `estUsd`, `cacheHit` and `outcome`
(`started` carries the estimate; `ok` / `failed` settle it; `cache-hit` is free).
Readers skip corrupt or partial lines. Amounts are catalog estimates, not
invoices; the TTS rate for `minimax/speech-2.8-hd` is explicitly unverified.

## 6. Voices

`voice-clone.mjs <name> <sample-audio> [--series <slug>] [--force]` refuses an
existing name (case-insensitive), a sample already cloned under another name, and
reserved or unsafe names, all before any provider call, unless `--force`. It
reserves a `pending` entry under an exclusive lock first, replaces it on success
(restores the previous entry on failure) and writes `video-guard.json` through a
temp file + rename. The attempt is ledgered with its outcome. The default client
targets the WaveSpeed `minimax/voice-clone` endpoint; its request and response
schema is unverified against the live API.

A scene's `scene_voice` is resolved in this order: a `pending` registry entry always fails; a registry key (the name) or any entry's `voice_id` value (exact, case-sensitive) sends that entry's `voice_id`; a name in `systemVoices` is sent to the provider as-is; anything else fails before any spend. Omit it, or use `default`, for the provider's default voice. System voices keep their original cache key.

## Avatars (InfiniteTalk lip-sync)

`compile` never synthesizes avatars. Avatars are the most expensive call (about $0.015 per billed
second with `wavespeed-ai/infinitetalk-fast`; the non-fast model, about $0.06/s, is blocked), so they
have their own entry point on the same guard: `node scripts/synthesize-avatar.mjs <script.md>
[--scene <id>]... [--dry-run] [--resume <task-id>] [--force-resubmit] [--poll-window <min>]
[--allow-model <name>] [--approval <file>] [--cache-dir <dir>] [--avatar-model/--tts-model/--image-model <id>]`.
Never call WaveSpeed for avatars directly or through an MCP tool: those calls bypass the budget, the
daily cap, the approval, the ledger and the double-submit protection.

**Order:** plan, human approval, `compile` (stages the narration audio), `synthesize-avatar`, `compile`
again (picks the clips up), render.

- **Job and inputs**: one avatar layer (`layer_type: talking_avatar`; a layer named "Avatar Intro" or one
  with an explicit `image`/`video` type is never an avatar) = one scene audio + a still image. The image
  must be a real `.jpg/.jpeg/.png/.webp` file referenced with `![media](path)`. A layer that only has a
  `layer_prompt` is refused with an explanation: generate the image first (compile generates prompt layers
  into the cache) and reference the file. The audio is `audio/<sceneId>_voiceover.mp3`, staged by
  `compile`, when the scene has narration (otherwise an explicit `audio_asset_source`/`voiceover`). Staged
  audio that no longer matches the CURRENT TTS cache entry (narration, voice or model changed) is refused:
  re-run `compile` first.
- **Price**: ceil(measured audio seconds) x the catalog rate, the same function the estimator uses
  (a fractional second bills as a whole second). Missing or unmeasurable audio is refused, and so is audio
  over `maxAvatarSeconds` (default 300). The avatar line of the estimator is an ESTIMATE (scene_duration
  or words/2.5) until the audio exists.
- **Guard**: allow/block lists (through the `replicate/` alias), approval coverage and 1.25x cap, per-run
  budget, rolling daily cap, a cross-process avatar slot (`maxAvatarConcurrency`, default 1; lock files with
  a heartbeat, owner PID and token, so a long job is never robbed and a dead owner never blocks) and the
  ledger (`started`/`ok`/`failed`/`cache-hit`). The whole batch is checked before the first charge, and each
  check is repeated at the moment of the charge.
- **Double-submit protection**: before any submit the journal is consulted by job key. A job whose latest
  status is `submitting`, `submitted`, `timeout`, `failed-after-submit` or `submit-uncertain` is refused
  with the exact resume command (a re-run after a timeout, Ctrl-C or crash can never start a second billed
  job). Only `--force-resubmit` overrides it, and that COSTS MONEY. A per-job lock stops two processes from
  submitting the same job.
- **Journal** (`.cognnitive/pending-predictions.jsonl`): a `submitting` intent is written BEFORE the POST,
  `submitted` (task id and the full resume command) right after it, then `completed`, `timeout`,
  `failed-after-submit` (download or post-process failed; resumable), `failed` (the provider reported
  failed/canceled; nothing to resume), `submit-rejected` (a 4xx before any task existed; ledgered as failed
  and refunded from the run budget and the daily cap) or `submit-uncertain` (the request may have reached
  the provider: it may have been billed).
- **Long jobs**: polling is bounded (default 20 min, delay growing from 5s to 30s, transient fetch errors
  tolerated). Exit codes: 0 ok, 1 refused/failed, 3 resumable (timeout or a recoverable failure; one
  complete command per task is printed, using `process.execPath`, the absolute script path and every flag
  you gave). `--resume` polls the existing task, never re-submits and never charges again. Every failure of
  a batch is collected; `--dry-run` cannot be combined with `--resume`.
- **Clip handling**: the download must start with an MP4 `ftyp` box (an HTML 200 is never cached). The raw
  clip is written to the cache first (tmp + rename); the ledger says `ok` only after that. Then, with ffmpeg
  on PATH, a copy is remuxed with `-c copy -movflags +faststart` (async, 120s timeout; WaveSpeed puts the
  moov atom at the end, which breaks the Remotion proxy). If ffmpeg is missing or fails, the raw clip is
  kept, a warning is printed and `<clip>.needs-faststart` is left so `compile` retries once ffmpeg exists.
- **Render pickup contract**: the clip is cached at `temp/<key>.mp4`; the key hashes the image bytes, the
  audio bytes, the model and the resolution. At render time a `talking_avatar` layer is drawn as a still
  image by AvatarFrame; a following `compile` finds the clip by the same key (cache reads only) and rewrites
  that layer to `layer_type: video`, `layer_asset_source: <clip>` and `layer_muted: true` (the narration is a
  separate Audio track; `Scene.tsx` mutes the clip only for `true` or `"true"`). Other video layers keep
  `layer_muted` undefined. If clips seem missing after synthesis, check that `--avatar-model/--tts-model`
  match between compile and synthesize-avatar.
- **Framing (design question)**: a picked-up clip is drawn by the generic full-bleed video primitive
  (`object-fit: cover`), NOT inside the framed-portrait `AvatarFrame` used for the still. The existing
  Mendel avatar scenes were already full-bleed `video` layers, so this keeps them identical. Whether
  avatar clips should instead get a framed treatment is open.
- **Unverified**: the exact infinitetalk-fast request/response schema (image and audio sent as base64 data
  URIs with a size limit, `resolution`, task id and output fields) comes from the earlier asset-synthesizer
  code, not from the live API. It lives in ONE function, `buildAvatarRequest` (lib/avatar-request.mjs).

## Model aliases

VUS scripts name models with a route prefix (`replicate/minimax/speech-2.8-hd`), but calls go
to WaveSpeed, whose id is the remainder (`minimax/speech-2.8-hd`). A leading `replicate/` is
stripped only when the remainder is a `<vendor>/<model>` id (`replicate/flux-schnell` stays as
is). The normalized id is used by the allow/block lists (a blocked model stays blocked through
its alias, e.g. `replicate/wavespeed-ai/infinitetalk`), approval coverage, pricing, the request
URL, the ledger, the estimator and `plan_hash`. Script property keys such as
`replicate/minimax/speech-2.8-hd/voice_id` are still looked up with the ORIGINAL string.

## 7. Cache location

`<workspaceRoot>/.cognnitive/cache/video`, independent of the current directory.
An explicit `--cache-dir` still wins.

## 8. Library use

`new AssetSynthesizer()` and `TTSGenerator` without an explicit guard fail closed:
billable calls are refused. Only `compileVideo` (or a caller supplying a
`SpendGuard` with an approval check) can spend.
