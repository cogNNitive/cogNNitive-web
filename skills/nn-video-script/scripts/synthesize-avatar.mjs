#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/synthesize-avatar.mjs
 *
 * Talking-avatar (lip-sync) video synthesis through the SAME spend guard as compile.
 * Avatars must be produced with this script, never with ad-hoc API/MCP calls.
 *
 * One avatar job = one scene's narration audio + the avatar still image. The audio is the
 * `audio/<sceneId>_voiceover.mp3` that `compile` stages (run compile first; stale audio is
 * refused). Cost is ceil(seconds) of that audio, measured before any spend. The finished clip
 * is cached under the content-addressed key `compile` looks up, so a following compile + render
 * uses it for free.
 *
 * Billing safety: the journal (.cognnitive/pending-predictions.jsonl) records a `submitting`
 * intent BEFORE the POST and the task id right after it. A re-run never submits a second job
 * while the journal shows the first one outstanding (only --force-resubmit, which costs money,
 * overrides). A per-job lock stops two processes submitting the same job. A timeout exits 3
 * with the exact `--resume <task-id>` command; resume never re-submits or re-charges.
 *
 * Unverified: the WaveSpeed infinitetalk-fast request/response schema (see lib/avatar-request.mjs).
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AssetSynthesizer, BillingFailureError, probeAudioDurationDetailed } from './asset-synthesizer.mjs';
import { CacheManager } from './cache-manager.mjs';
import { DEFAULT_MODELS, estimateCallUsd, resolveModelId } from './asset-cost-estimator.mjs';
import { RemotionSceneCompiler } from './remotion-scene-compiler.mjs';
import { APPROVAL_FILENAME, checkApproval } from './lib/plan-approval.mjs';
import { LOCKS_RELATIVE_DIR, SpendGuard, loadGuard, resolveDefaultCacheDir } from './lib/video-guard.mjs';
import { assertAudioFresh, collectAvatarJobs } from './lib/avatar-jobs.mjs';
import { appendPending, findOutstanding, latestPending } from './lib/pending-predictions.mjs';
import { applyFaststart } from './lib/faststart.mjs';
import { acquireLock } from './lib/file-lock.mjs';
import { parseArgs, CliUsageError } from './lib/cli-args.mjs';

export const DEFAULT_POLL_WINDOW_MS = 20 * 60 * 1000;
const SCRIPT_FILE = fileURLToPath(import.meta.url);

/** One or more jobs failed. `failures` lists every one; `exitCode` is 3 when any is resumable, else 1. */
export class AvatarBatchError extends Error {
  /** @param {{ sceneIds: string[], error: Error, resumeCommand?: string }[]} failures */
  constructor(failures) {
    super(failures.map((f) => '[' + f.sceneIds.join(', ') + '] ' + f.error.message).join('\n'));
    this.name = 'AvatarBatchError';
    this.failures = failures;
    this.exitCode = failures.some((f) => f.resumeCommand) ? 3 : 1;
  }
}

/** A previous submit for the same job is still outstanding: a new submit would double-bill. */
export class OutstandingJobError extends Error {
  constructor(message, outstanding) {
    super(message);
    this.name = 'OutstandingJobError';
    this.outstanding = outstanding;
  }
}

const quote = (a) => (/^[A-Za-z0-9_@%+=:,./\\-]+$/.test(a) ? a : '"' + a.replace(/"/g, '\\"') + '"');

/**
 * The complete command to resume one task: absolute node, absolute script, absolute script
 * path and every flag the user gave.
 */
function buildResumeCommand(o, sceneIds, taskId) {
  const args = [process.execPath, SCRIPT_FILE, path.resolve(o.scriptPath)];
  for (const id of sceneIds) args.push('--scene', id);
  args.push('--resume', String(taskId));
  if (o.cacheDir) args.push('--cache-dir', path.resolve(o.cacheDir));
  if (o.approvalPath) args.push('--approval', path.resolve(o.approvalPath));
  const m = o.models || {};
  if (m.avatar) args.push('--avatar-model', m.avatar);
  if (m.tts) args.push('--tts-model', m.tts);
  if (m.image) args.push('--image-model', m.image);
  for (const a of o.allowModels || []) args.push('--allow-model', a);
  if (o.pollWindowMs) args.push('--poll-window', String(o.pollWindowMs / 60000));
  return args.map(quote).join(' ');
}

/**
 * @param {Object} o
 * @param {string} o.scriptPath
 * @param {string[]} [o.scenes] Restrict to these scene ids (duplicates are ignored).
 * @param {boolean} [o.dryRun] Plan only: spends and writes nothing.
 * @param {string} [o.resume] Poll this existing task id; never re-submits or re-charges.
 * @param {boolean} [o.forceResubmit] Submit again even though the journal shows an outstanding job (COSTS MONEY).
 * @param {string[]} [o.allowModels] Unlocks a blocked model (must be recorded in the approval).
 * @param {string} [o.approvalPath]
 * @param {string} [o.cacheDir]
 * @param {{ image?: string, tts?: string, avatar?: string }} [o.models] Same flags as the estimator (part of plan_hash).
 * @param {number} [o.pollWindowMs] Bounded polling window (default 20 min).
 * @param {object} [o.probeDeps] Test seams for the real duration probe (parseMedia, nodeReader, loadModules).
 * @param {Function} [o.onPreflightPassed] Test seam: awaited after pre-flight, before the first submit.
 * @param {Record<string, string | undefined>} [o.env] Test seams: env, fetch, sleep, now, measureDuration, ffmpegRun, warn.
 */
export async function synthesizeAvatars(o) {
  if (o.dryRun && o.resume) throw new Error('--dry-run cannot be combined with --resume (resume performs a real poll).');
  const scriptPath = path.resolve(o.scriptPath);
  if (!fs.existsSync(scriptPath)) throw new Error('Script file not found: ' + scriptPath);
  const env = o.env || process.env;
  const warn = o.warn || ((m) => console.warn(m));
  const measure = o.measureDuration
    ? async (f) => ({ seconds: Number(await o.measureDuration(f)) })
    : (f) => probeAudioDurationDetailed(f, o.probeDeps || {});
  const models = o.models || {};
  const allowModels = o.allowModels || [];
  const windowMs = o.pollWindowMs ?? DEFAULT_POLL_WINDOW_MS;
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  const scriptDir = path.dirname(scriptPath);
  const loaded = loadGuard(scriptDir);
  const cacheDir = o.cacheDir || resolveDefaultCacheDir(scriptDir);
  const approvalPath = o.approvalPath ? path.resolve(o.approvalPath) : path.join(scriptDir, APPROVAL_FILENAME);
  const checkNow = () => checkApproval({ scriptContent, models, approvalPath, allowModels, allowDelegated: loaded.config.allowDelegatedApproval === true });
  const avatarStaleMs = windowMs + 10 * 60 * 1000;
  const makeGuard = (dryRun) =>
    new SpendGuard({ config: loaded.config, root: loaded.root, allowModels, dryRun, approval: checkNow, avatarStaleMs });

  const parsed = new RemotionSceneCompiler({}).parseScript(scriptContent);
  const sceneFilter = o.scenes?.length ? [...new Set(o.scenes)] : undefined;
  if (sceneFilter) {
    const unknown = sceneFilter.filter((id) => !parsed.scenes.some((s) => s.id === id));
    if (unknown.length) throw new Error('Unknown scene id(s): ' + unknown.join(', ') + '. Known: ' + parsed.scenes.map((s) => s.id).join(', '));
  }

  // 1. Collect and validate every job BEFORE any spend: image, audio (fresh), measurable, not too long.
  const readCache = new CacheManager({ baseDir: cacheDir, readOnly: true });
  const { jobs: raw, problems } = collectAvatarJobs({
    parsed,
    scriptDir,
    cacheManager: readCache,
    sceneIds: sceneFilter,
    resolveModel: (prop) => resolveModelId(prop, models.avatar || DEFAULT_MODELS.avatar),
  });
  if (problems.length) throw new Error(problems.join('\n'));
  if (raw.length === 0) throw new Error('No talking-avatar layers (layer_type: talking_avatar) found in ' + scriptPath + (sceneFilter ? ' for the selected scenes.' : '.'));
  for (const j of raw) {
    const sc = parsed.scenes.find((s) => s.id === j.sceneId);
    assertAudioFresh({ sc, audioPath: j.audioPath, cacheManager: readCache, config: loaded.config, models });
  }

  const byKey = new Map();
  for (const j of raw) {
    const existing = byKey.get(j.cacheKey);
    if (existing) {
      if (!existing.sceneIds.includes(j.sceneId)) existing.sceneIds.push(j.sceneId);
      continue;
    }
    const { seconds, error: probeError } = await measure(j.audioPath);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new Error(
        'Cannot measure the audio duration of ' + j.audioPath + (probeError ? ' (' + probeError + ')' : '') +
          ': refusing to price (or bill) an avatar on a guess.',
      );
    }
    if (seconds > loaded.config.maxAvatarSeconds) {
      throw new Error('Scene ' + j.sceneId + ': the audio is ' + seconds + 's, over maxAvatarSeconds (' + loaded.config.maxAvatarSeconds + 's) in video-guard.json: refusing to bill it.');
    }
    byKey.set(j.cacheKey, {
      ...j,
      sceneIds: [j.sceneId],
      seconds,
      estUsd: estimateCallUsd('avatar', j.model, { seconds }),
      cachedPath: readCache.getSync(j.cacheKey, 'mp4', 'temp'),
    });
  }
  const jobs = [...byKey.values()];
  const view = (j, extra = {}) => ({
    sceneIds: j.sceneIds,
    layerName: j.layerName,
    model: j.model,
    seconds: j.seconds,
    estUsd: j.cachedPath ? 0 : j.estUsd,
    cacheKey: j.cacheKey,
    status: j.cachedPath ? 'cached' : 'planned',
    assetPath: j.cachedPath || null,
    ...extra,
  });
  const refOf = (j) => j.sceneIds[0] + '/' + (j.layerName || 'avatar');
  const outstandingOf = (j) => (j.cachedPath ? null : findOutstanding(loaded.root, j.cacheKey));

  // 2. Plan through a dry-run guard (same authorize path as a real run).
  const planGuard = makeGuard(true);
  if (!o.resume) {
    for (const j of jobs.filter((x) => !x.cachedPath)) {
      await planGuard.authorize({ kind: 'avatar', model: j.model, estUsd: j.estUsd, ref: refOf(j) });
    }
  }
  const plan = () => ({
    items: planGuard.planned,
    totalUsd: planGuard.plannedTotalUsd,
    budgetUsd: loaded.config.budgetPerRunUsd,
    dailyCapUsd: loaded.config.dailyCapUsd,
    dailySpentUsd: planGuard.dailySpentUsd,
    withinBudget: planGuard.plannedTotalUsd <= loaded.config.budgetPerRunUsd,
    approval: checkNow(),
  });
  if (o.dryRun) {
    return {
      dryRun: true,
      jobs: jobs.map((j) => view(j, { outstanding: outstandingOf(j)?.status || null })),
      plan: plan(),
    };
  }

  // 3. Real run. Resume polls an existing task (no submit, no charge). A normal run refuses to
  //    submit while the journal shows an outstanding job for the same key.
  let todo = jobs.filter((j) => !j.cachedPath);
  if (o.resume) {
    const record = latestPending(loaded.root, String(o.resume));
    if (!record) throw new Error('Unknown task id ' + o.resume + ': it is not in .cognnitive/pending-predictions.jsonl.');
    todo = jobs.filter((j) => j.cacheKey === record.cacheKey && !j.cachedPath);
    if (todo.length === 0 && !jobs.some((j) => j.cacheKey === record.cacheKey)) {
      throw new Error('Task ' + o.resume + ' belongs to a different scene or script (cache key mismatch).');
    }
  } else if (!o.forceResubmit) {
    const blocked = todo.map((j) => ({ job: j, rec: outstandingOf(j) })).filter((x) => x.rec);
    if (blocked.length > 0) throw new OutstandingJobError(outstandingMessage(blocked), blocked);
  }
  if (todo.length > 0 && !env.WAVESPEED_API_KEY) {
    throw new Error('WAVESPEED_API_KEY is not set: avatar synthesis needs a provider key (no placeholder clip is ever produced).');
  }
  if (!o.resume) planGuard.assertPlanAffordable(); // refuses the WHOLE batch before the first charge
  await o.onPreflightPassed?.();

  const guard = makeGuard(false);
  for (const j of jobs.filter((x) => x.cachedPath)) guard.recordCacheHit({ kind: 'avatar', ref: refOf(j) });
  const synth = new AssetSynthesizer({
    cacheManager: new CacheManager({ baseDir: cacheDir }),
    guard,
    env,
    fetch: o.fetch,
    sleep: o.sleep,
    now: o.now,
    defaultModels: models,
  });
  const postProcess = (buf) => applyFaststart(buf, { run: o.ffmpegRun, warn });

  function outstandingMessage(blocked) {
    return blocked
      .map(({ job, rec }) => {
        const cmd = rec.taskId ? buildResumeCommand(o, job.sceneIds, rec.taskId) : null;
        return (
          'Scene(s) ' + job.sceneIds.join(', ') + ': a previous submit for this exact job is still outstanding (journal status "' + rec.status + '"' +
          (rec.taskId ? ', task ' + rec.taskId : ', no task id recorded') + '); it may still be running or may already have been billed. ' +
          (cmd ? 'Resume it instead (no new charge):\n  ' + cmd : 'Check the WaveSpeed dashboard.') +
          '\nOnly --force-resubmit submits again, and that COSTS MONEY.'
        );
      })
      .join('\n');
  }

  const runJob = async (j) => {
    const lockPath = path.join(loaded.root, LOCKS_RELATIVE_DIR, 'avatar-key-' + j.cacheKey + '.lock');
    const release = await acquireLock(lockPath, { staleMs: avatarStaleMs, timeoutMs: avatarStaleMs });
    try {
      // Re-check under the per-job lock: another process may have finished or started this job meanwhile.
      const nowCached = readCache.getSync(j.cacheKey, 'mp4', 'temp');
      if (nowCached) {
        guard.recordCacheHit({ kind: 'avatar', ref: refOf(j) });
        return view(j, { status: 'cached', assetPath: nowCached });
      }
      if (!o.resume && !o.forceResubmit) {
        const rec = findOutstanding(loaded.root, j.cacheKey);
        if (rec) throw new OutstandingJobError(outstandingMessage([{ job: j, rec }]), [{ job: j, rec }]);
      }
      const intentId = crypto.randomBytes(6).toString('hex');
      let taskId = o.resume ? String(o.resume) : undefined;
      const base = { kind: 'avatar', model: j.model, ref: refOf(j), cacheKey: j.cacheKey, sceneIds: j.sceneIds, script: scriptPath, intentId };
      const pending = {
        onSubmitting: ({ estUsd }) => appendPending(loaded.root, { ...base, status: 'submitting', estUsd, seconds: j.seconds }),
        onSubmitted: (id) => {
          taskId = String(id);
          appendPending(loaded.root, { ...base, taskId, status: 'submitted', command: buildResumeCommand(o, j.sceneIds, taskId) });
        },
        onResult: (status, detail) => appendPending(loaded.root, { ...base, ...(taskId ? { taskId } : {}), status, ...(detail ? { detail } : {}) }),
      };
      const res = await synth.resolveTalkingAvatar(
        j.imagePath,
        j.audioPath,
        { model: j.model, resolution: j.resolution },
        {
          ref: refOf(j),
          cacheKey: j.cacheKey,
          durationSeconds: j.seconds,
          resumeTaskId: o.resume ? String(o.resume) : undefined,
          windowMs,
          intervalMs: 5000,
          backoff: { factor: 1.5, maxMs: 30000 },
          postProcess,
          warn,
          pending,
        },
      );
      return view(j, { status: res.fromCache ? 'cached' : o.resume ? 'resumed' : 'synthesized', assetPath: res.assetPath });
    } finally {
      release();
    }
  };

  // Collect EVERY failure. A failed billed job does not stop the others (each was approved);
  // a guard refusal or any non-billing error stops further launches.
  const results = jobs.map((j) => view(j));
  const queue = todo.slice();
  const failures = [];
  let stop = false;
  const worker = async () => {
    while (!stop && queue.length > 0) {
      const j = queue.shift();
      try {
        results[jobs.indexOf(j)] = await runJob(j);
      } catch (err) {
        const resumable = err instanceof BillingFailureError && err.taskId && (err.timedOut || err.retryable);
        failures.push({ sceneIds: j.sceneIds, error: err, ...(resumable ? { resumeCommand: buildResumeCommand(o, j.sceneIds, err.taskId) } : {}) });
        if (!(err instanceof BillingFailureError)) stop = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(loaded.config.maxAvatarConcurrency, todo.length) }, worker));
  if (failures.length > 0) throw new AvatarBatchError(failures);
  return { dryRun: false, jobs: results, plan: plan() };
}

export const USAGE = [
  'Usage: node synthesize-avatar.mjs <script.md> [options]',
  '  --scene <id>             only this scene (repeatable); default: every avatar scene',
  '  --dry-run                list scenes, audio seconds, estimated $ and the caps; spends and writes nothing',
  '  --resume <task-id>       poll an existing task (from pending-predictions.jsonl); NEVER re-submits or re-charges',
  '  --force-resubmit         submit again although the journal shows an outstanding job for the same scene.',
  '                           THIS COSTS MONEY (a second billed job while the first may still run). Normally use --resume.',
  '  --poll-window <minutes>  bounded polling window per job (default 20)',
  '  --allow-model <name>     unlock a blocked model; must be recorded in the human approval (repeatable)',
  '  --approval <file>        approved plan (default <script dir>/asset_plan.approved.json)',
  '  --cache-dir <dir>        cache dir (default <workspace>/.cognnitive/cache/video)',
  '  --avatar-model <id> / --tts-model <id> / --image-model <id>   same values as given to the estimator (part of plan_hash)',
  'Run compile first (it stages audio/<sceneId>_voiceover.mp3; stale audio is refused). Needs WAVESPEED_API_KEY and a',
  'human-approved plan. Billed seconds = ceil(measured audio seconds); audio over maxAvatarSeconds is refused.',
  'Exit codes: 0 ok, 1 refused or failed, 3 resumable (timeout or recoverable failure; the exact command is printed).',
].join('\n');

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      boolean: ['dry-run', 'force-resubmit'],
      value: ['resume', 'poll-window', 'approval', 'cache-dir', 'avatar-model', 'tts-model', 'image-model'],
      repeatable: ['scene', 'allow-model'],
    });
    if (parsed.flags['dry-run'] && parsed.flags.resume) throw new CliUsageError('--dry-run cannot be combined with --resume');
  } catch (err) {
    if (!(err instanceof CliUsageError)) throw err;
    console.error('Error: ' + err.message + '\n' + USAGE);
    process.exit(1);
  }
  const f = parsed.flags;
  const scriptPath = parsed._[0];
  if (!scriptPath) {
    console.error(USAGE);
    process.exit(1);
  }
  const windowMin = f['poll-window'] === undefined ? 20 : Number(f['poll-window']);
  if (!Number.isFinite(windowMin) || windowMin <= 0) {
    console.error('Error: --poll-window must be a positive number of minutes.\n' + USAGE);
    process.exit(1);
  }
  try {
    const res = await synthesizeAvatars({
      scriptPath,
      scenes: f.scene,
      dryRun: Boolean(f['dry-run']),
      resume: f.resume,
      forceResubmit: Boolean(f['force-resubmit']),
      allowModels: f['allow-model'],
      approvalPath: f.approval,
      cacheDir: f['cache-dir'],
      models: { avatar: f['avatar-model'], tts: f['tts-model'], image: f['image-model'] },
      pollWindowMs: Math.round(windowMin * 60000),
    });
    if (res.dryRun) {
      console.log('Dry run: nothing was synthesized, spent or written. Billed seconds are ceil(measured audio seconds).');
      for (const j of res.jobs) {
        const ref = j.sceneIds[0] + '/' + (j.layerName || 'avatar');
        const blocked = res.plan.items.find((i) => i.ref === ref)?.blocked;
        console.log('   - ' + j.sceneIds.join(', ') + ': ' + j.seconds + 's audio, ' + j.model + ' ~$' + j.estUsd.toFixed(4) + ' [' + j.status + ']' +
          (j.outstanding ? ' [OUTSTANDING previous submit: ' + j.outstanding + '; use --resume]' : '') + (blocked ? ' [BLOCKED: ' + blocked + ']' : ''));
      }
      const p = res.plan;
      console.log('   Estimated total: $' + p.totalUsd.toFixed(4) + ' (budget per run: $' + p.budgetUsd.toFixed(2) + (p.withinBudget ? '' : ' - OVER BUDGET') + ')');
      console.log('   Spent in the last 24h: $' + p.dailySpentUsd.toFixed(4) + ' (daily cap: $' + p.dailyCapUsd.toFixed(2) + ')');
      console.log('   Plan approval: ' + (p.approval.ok ? 'approved' : 'NOT approved (' + p.approval.reason + ')'));
      return;
    }
    for (const j of res.jobs) console.log(j.status + ': ' + j.sceneIds.join(', ') + ' -> ' + j.assetPath);
    console.log('Run compile again to pick the clips up (zero extra spend).');
  } catch (err) {
    if (err instanceof AvatarBatchError) {
      for (const fl of err.failures) {
        console.error('Error [' + fl.sceneIds.join(', ') + ']: ' + fl.error.message);
        if (fl.resumeCommand) console.error('  The task may still finish (and is billed). Resume without re-submitting:\n  ' + fl.resumeCommand);
      }
      process.exit(err.exitCode);
    }
    console.error('Error: ' + err.message);
    process.exit(1);
  }
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(SCRIPT_FILE);
if (isMain) await main();
