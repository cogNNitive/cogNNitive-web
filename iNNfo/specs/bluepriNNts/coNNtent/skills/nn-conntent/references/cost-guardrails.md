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
  "allowDelegatedApproval": true,
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
- `allowDelegatedApproval`: retired in V_0-15-0 along with the approval artifact. A
  leftover value in a workspace `video-guard.json` is ignored; remove it.

## 2. The spending decision (Episode status + plan hash)

There is no approval file. The decision lives in the Episode document and in one
command-line value, so nothing on disk can be hand-edited into consent.

1. `node scripts/asset-cost-estimator.mjs <script.md> --out <episode>/asset_plan.md`
   stamps the first line of the plan with `plan_hash` (sha256 of the normalized
   script text, NFC and newline-insensitive, plus the cascade-resolved model ids
   and their unit prices), `total_usd` and the model set.
   Only that first-line stamp is ever read back. The estimate prices what the run
   will charge: it opens the video cache read-only, with the same keys `compile`
   writes (TTS, image, avatar clip), and quotes a cached item at $0 (marked
   `cached` in the plan); an image is quoted only for a layer with a prompt. The
   plan states the hash to pass and lists the stamped resolved model ids.
2. `produce` gates in this order: the review gate (each scene approved, no
   outstanding `needs-change`), then `status:: approved`, then the estimate, then the
   budget. When the estimate exceeds the Episode's `budget::`, `produce` stops with
   exit 11 and asks; the human decides, and the run proceeds only with
   `--approve <plan_hash>` matching the current hash. Editing the script, a document
   that resolves a model id, or a catalog price changes the hash, so a stale
   approval cannot be replayed.
3. `compile` and `synthesize-avatar` never look for an approval artifact. They
   enforce the model allow/block lists, the per-run `budgetPerRunUsd` and the rolling
   `dailyCapUsd`.

**Residual risk.** The gate is a command, not a signature. An agent with shell access
can pass `--approve` itself. Keep the Episode's `budget::` low, keep
`budgetPerRunUsd`/`dailyCapUsd` in `video-guard.json` tight, and deny agent writes to
`video-guard.json`. The agent MUST NOT invent a plan hash: it prints the hash and
waits for the human.

## 2b. Stale prices

The catalog carries a `price_date` per model. Past `DEFAULT_STALE_AFTER_DAYS` the price is
stale: the estimate still uses it (it is the best number available) but the plan carries a
`Stale price` warning naming each model and the date it was priced. A stale price never
changes `plan_hash` or the total, and it never blocks a run. Refresh the catalog instead of
editing the estimate.

## 2c. The daily ceiling

`daily_budget::` is declared at the domaiNN or bluepriNNt level (never per episode) and is a
rolling 24h ceiling, not a per-run one. `produce` sums what the facts ledger charged in the
last 24h and stops with exit 11 when this run's estimate would pass `daily_budget`.
`--approve` never bypasses it: that flag is about the Episode's `budget::` only. The
per-call safety caps (`budgetPerRunUsd`, `dailyCapUsd` in `video-guard.json`) still apply
during the run; `daily_budget` is the author's intent, those are the machine's guard rails.

## 3. Dry run

`node scripts/lib/compile.mjs compile <script.md> --dry-run` lists every
uncached billable call (TTS and image layers), the estimated total against the
per-run and 24h caps and the blocked models. It spends nothing,
writes nothing (not even cache directories) and exits 0. `produce --dry-run` does the
same across the whole pipeline. `--dry-run` is rejected on `render`.

## 4. Enforcement order (per billable call)

model allow/block list, per-run cap, rolling
24h cap, ledger append, then the request. Every refusal happens before the
request. A provider failure after submit (HTTP error, failed task, timeout, empty
output) throws with the task id; nothing is cached, no other provider is tried and
nothing retries on its own. Concurrent identical TTS lines or images share one
call. A bare synthesizer with no guard fails closed: it refuses billable calls.

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

A Scene's voice — the `voice::` value of its referenced Template instance — is resolved in this order: a `pending` registry entry always fails; a registry key (the name) or any entry's `voice_id` value (exact, case-sensitive) sends that entry's `voice_id`; a name in `systemVoices` is sent to the provider as-is; anything else fails before any spend. Omit it, or use `default`, for the provider's default voice. System voices keep their original cache key.

## Avatars (InfiniteTalk lip-sync)

`compile` never synthesizes avatars. Avatars are the most expensive call (about $0.015 per billed
second with `wavespeed-ai/infinitetalk-fast`; the non-fast model, about $0.06/s, is blocked), so they
have their own entry point on the same guard: `node scripts/synthesize-avatar.mjs <script.md>
[--scene <id>]... [--dry-run] [--resume <task-id>] [--force-resubmit] [--poll-window <min>]
[--allow-model <name>] [--cache-dir <dir>]`.
Never call WaveSpeed for avatars directly or through an MCP tool: those calls bypass the budget, the
daily cap, the ledger and the double-submit protection.

**Order:** plan, human decision (`status:: approved`, plus `--approve` when the estimate exceeds
`budget::`), `synthesize-avatar`, `compile`, render — or just `produce`, which walks that order
and runs the avatar stage itself whenever the episode declares an avatar Layer.

- **Job and inputs**: one avatar layer (`layer_type: talking_avatar`; a layer named "Avatar Intro" or one
  with an explicit `image`/`video` type is never an avatar) = one scene audio + a still image. The image
  must be a real `.jpg/.jpeg/.png/.webp` file referenced with `![media](path)`. A layer that only has a
  `layer_prompt` is refused with an explanation: generate the image first (compile generates prompt layers
  into the cache) and reference the file. The audio is the scene's TTS cache entry, populated by
  `compile`, when the scene has narration (otherwise an explicit `audio_asset_source`/`voiceover`). No
  staged `audio/` file exists. If the narration, voice or model changed, the entry for the CURRENT text is
  missing and the run is refused: re-run `compile` first.
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
  clip is written to the cache first (tmp + rename); the ledger says `ok` only after that. The clip is
  cached exactly as delivered and served to HyperFrames unchanged (a raw `moov`-at-end clip renders fine;
  verified against the pinned CLI).
- **Render pickup contract**: the clip is cached at `temp/<key>.mp4`; the key hashes the image bytes, the
  audio bytes, the model and the resolution. At render time a `talking_avatar` layer is drawn as a still
  image by AvatarFrame; a following `compile` finds the clip by the same key (cache reads only) and rewrites
  that layer to `layer_type: video`, `layer_asset_source: <clip>` and `layer_muted: true` (the narration is a
  separate Audio track; `Scene.tsx` mutes the clip only for `true` or `"true"`). Other video layers keep
  `layer_muted` undefined. If clips seem missing after synthesis, check that the episode and its Series
  resolve the same `avatar_model` and `voice_model` for compile and synthesize-avatar.
- **Framing (design question)**: a picked-up clip is drawn by the generic full-bleed video primitive
  (`object-fit: cover`), NOT inside the framed-portrait `AvatarFrame` used for the still. The existing
  Mendel avatar scenes were already full-bleed `video` layers, so this keeps them identical. Whether
  avatar clips should instead get a framed treatment is open.
- **Unverified**: the exact infinitetalk-fast request/response schema (image and audio sent as base64 data
  URIs with a size limit, `resolution`, task id and output fields) comes from the earlier asset-synthesizer
  code, not from the live API. It lives in ONE function, `buildAvatarRequest` (lib/avatar-request.mjs).

## Model aliases

A Template instance names its model with a route prefix (`replicate/minimax/speech-2.8-hd`), but calls go
to WaveSpeed, whose id is the remainder (`minimax/speech-2.8-hd`). A leading `replicate/` is
stripped only when the remainder is a `<vendor>/<model>` id (`replicate/flux-schnell` stays as
is). The normalized id is used by the allow/block lists (a blocked model stays blocked through
its alias, e.g. `replicate/wavespeed-ai/infinitetalk`), approval coverage, pricing, the request
URL, the ledger, the estimator and `plan_hash`.

## 7. Cache location

`<workspaceRoot>/.cognnitive/cache/video`, independent of the current directory.
An explicit `--cache-dir` still wins.

## 8. Library use

`new AssetSynthesizer()` and `TTSGenerator` without an explicit guard fail closed:
billable calls are refused. Only `compileVideo` (or a caller supplying a
`SpendGuard` with an approval check) can spend.
