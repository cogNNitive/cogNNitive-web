#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/asset-synthesizer.mjs
 *
 * Deterministic TTS and media asset synthesis with content-addressed caching.
 * Adapts ElevenLabs, Edge-TTS, and Replicate media providers with graceful local fallbacks.
 * Measures audio duration without FFmpeg (via @remotion/media-parser).
 *
 * Zero external mandatory runtime dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CacheManager } from './cache-manager.mjs';
import { SpendGuard, loadGuard, isSystemVoice } from './lib/video-guard.mjs';
import { resolveRegisteredVoice } from './lib/tts-options.mjs';
import { buildAvatarRequest } from './lib/avatar-request.mjs';
import { markNeedsFaststart } from './lib/faststart.mjs';
import { estimateCallUsd, resolveModelId, DEFAULT_MODELS } from './asset-cost-estimator.mjs';

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

/** @type {{ parseMedia: Function, nodeReader: unknown } | null | undefined} */
let cachedMediaParser;

/**
 * Lazily resolves @remotion/media-parser AND its node reader (installed with the Remotion
 * engine). A LOCAL path needs `reader: nodeReader`; the default web reader only accepts URLs.
 * Returns null only when the module is truly unavailable.
 * @returns {Promise<{ parseMedia: Function, nodeReader: unknown } | null>}
 */
async function loadMediaParser() {
  if (cachedMediaParser !== undefined) return cachedMediaParser;
  try {
    const mod = await import('@remotion/media-parser');
    const node = await import('@remotion/media-parser/node');
    cachedMediaParser = { parseMedia: mod.parseMedia, nodeReader: node.nodeReader };
  } catch {
    cachedMediaParser = null;
  }
  return cachedMediaParser;
}

/**
 * @typedef {Object} AssetSynthesisResult
 * @property {string} assetPath Full filesystem path to the asset
 * @property {string} sha256 Content-derived hash
 * @property {boolean} fromCache Whether the asset was served from cache
 * @property {number} [durationSeconds] Measured duration for audio/video assets
 * @property {number} fileSizeBytes Size in bytes
 */

/**
 * Measures audio duration in seconds without FFmpeg-from-PATH, using the
 * `@remotion/media-parser` bundled with the Remotion engine and its NODE reader. Never throws:
 * `seconds` is 0 when the duration is unknown, and `error` says why (missing file, parser not
 * installed, parser failure, no duration reported).
 * @param {string} filePath
 * @param {{ parseMedia?: Function, nodeReader?: unknown, loadModules?: () => Promise<any> }} [deps] Injectable seams for tests.
 * @returns {Promise<{ seconds: number, error?: string }>}
 */
export async function probeAudioDurationDetailed(filePath, deps = {}) {
  if (!fs.existsSync(filePath)) {
    return { seconds: 0, error: 'audio file not found: ' + filePath };
  }
  let parseMedia = deps.parseMedia;
  let nodeReader = deps.nodeReader;
  if (!parseMedia) {
    const mods = await (deps.loadModules || loadMediaParser)();
    if (!mods) {
      return { seconds: 0, error: '@remotion/media-parser is not installed (run scripts/ensure-engine.mjs), so audio durations cannot be measured' };
    }
    parseMedia = mods.parseMedia;
    nodeReader = nodeReader || mods.nodeReader;
  }
  try {
    const result = await parseMedia({
      src: filePath,
      reader: nodeReader,
      fields: { durationInSeconds: true },
      acknowledgeRemotionLicense: true,
    });
    const duration = result?.durationInSeconds;
    if (typeof duration === 'number' && duration > 0) {
      return { seconds: Math.round(duration * 1000) / 1000 };
    }
    return { seconds: 0, error: 'media-parser reported no duration for ' + filePath };
  } catch (err) {
    return { seconds: 0, error: 'media-parser failed: ' + (err?.message || String(err)) };
  }
}

/**
 * Seconds only (0 when unknown). The reason for a 0 is passed to `deps.onError` when given.
 * @param {string} filePath
 * @param {Parameters<typeof probeAudioDurationDetailed>[1] & { onError?: (message: string) => void }} [deps]
 * @returns {Promise<number>}
 */
export async function probeAudioDuration(filePath, deps = {}) {
  const { seconds, error } = await probeAudioDurationDetailed(filePath, deps);
  if (error && deps.onError) deps.onError(error);
  return seconds;
}

const WAVESPEED_BASE = 'https://api.wavespeed.ai/api/v3/';

/**
 * Raised when a provider call fails AFTER it may have been billed (HTTP error, failed task,
 * poll timeout, empty output). The task id is kept so the user can look the job up instead of
 * paying for a blind retry. Nothing is cached and no other provider is tried.
 */
export class BillingFailureError extends Error {
  /**
   * @param {string} message
   * @param {{ taskId?: string, timedOut?: boolean, retryable?: boolean, mayHaveBeenBilled?: boolean, preTask?: boolean }} [info]
   *   `retryable`: resumable with the task id; `preTask`: rejected before any task existed (nothing billed);
   *   `mayHaveBeenBilled`: the request may have reached the provider.
   */
  constructor(message, { taskId, timedOut = false, retryable = false, mayHaveBeenBilled = false, preTask = false } = {}) {
    super(message);
    this.name = 'BillingFailureError';
    this.taskId = taskId;
    this.timedOut = timedOut;
    this.retryable = retryable;
    this.mayHaveBeenBilled = mayHaveBeenBilled;
    this.preTask = preTask;
  }
}

/** Journal status for a failed avatar job (see lib/pending-predictions.mjs). */
function journalStatus(err) {
  if (err.timedOut) return 'timeout';
  if (err.preTask || err.notSubmitted) return 'submit-rejected';
  if (!err.taskId) return err.mayHaveBeenBilled ? 'submit-uncertain' : 'failed';
  return err.retryable ? 'failed-after-submit' : 'failed';
}

export class AssetSynthesizer {
  /**
   * @param {Object} [options]
   * @param {CacheManager} [options.cacheManager]
   * @param {string} [options.ttsProvider="local"] "elevenlabs" | "edge-tts" | "local" | "mock"
   * @param {string} [options.mediaProvider="local"] "replicate" | "local" | "mock"
   * @param {string} [options.elevenLabsApiKey]
   * @param {SpendGuard} [options.guard] Spend guard. Without one the synthesizer FAILS CLOSED: billable calls are refused.
   * @param {{ image?: string, tts?: string, avatar?: string }} [options.defaultModels] Models used when a call names no provider model.
   * @param {Record<string, string | undefined>} [options.env] Environment seam (defaults to process.env).
   * @param {typeof fetch} [options.fetch] HTTP seam for tests.
   * @param {(ms: number) => Promise<void>} [options.sleep] Poll-delay seam for tests.
   * @param {() => number} [options.now] Clock seam for tests (bounded polling windows).
   */
  constructor(options = {}) {
    this.env = options.env || process.env;
    this._fetch = options.fetch || ((...args) => globalThis.fetch(...args));
    this._sleep = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    this._now = options.now || (() => Date.now());
    /** Duration-probe seams (parseMedia, nodeReader, loadModules); tests only. */
    this.probeDeps = options.probeDeps || {};
    this.cacheManager = options.cacheManager || new CacheManager();
    this.ttsProvider = options.ttsProvider || this.env.TTS_PROVIDER || 'local';
    this.mediaProvider = options.mediaProvider || this.env.MEDIA_PROVIDER || 'local';
    this.elevenLabsApiKey = options.elevenLabsApiKey || this.env.ELEVENLABS_API_KEY;
    const chosen = Object.fromEntries(Object.entries(options.defaultModels || {}).filter(([, v]) => v));
    this.defaultModels = { ...DEFAULT_MODELS, ...chosen };
    if (options.guard) {
      this.guard = options.guard;
    } else {
      const loaded = loadGuard(process.cwd());
      this.guard = new SpendGuard({ config: loaded.config, root: loaded.root });
    }
    /** @type {Map<string, Promise<AssetSynthesisResult>>} */
    this._inflight = new Map();
    /** @type {Set<string>} Calls already planned in dry-run (a repeat would be a cache hit). */
    this._planned = new Set();
  }

  /** Concurrent identical requests share one provider call. @private */
  _singleFlight(key, fn) {
    const existing = this._inflight.get(key);
    if (existing) return existing;
    const p = Promise.resolve()
      .then(fn)
      .finally(() => this._inflight.delete(key));
    this._inflight.set(key, p);
    return p;
  }

  /** Dry-run only: true when this call was already planned (it would be a cache hit). @private */
  _alreadyPlanned(key) {
    if (!this.guard.dryRun) return false;
    if (this._planned.has(key)) return true;
    this._planned.add(key);
    return false;
  }

  /** Result for a call that was planned, not performed (dry-run). @private */
  _skipped(sha256) {
    return { assetPath: null, sha256, fromCache: false, dryRun: true, fileSizeBytes: 0 };
  }

  /** True when TTS would go to the MiniMax provider path (otherwise: local synthetic audio). @private */
  _useMiniMax() {
    return (
      this.ttsProvider.includes('minimax') ||
      (!this.elevenLabsApiKey && Boolean(this.env.WAVESPEED_API_KEY || this.env.REPLICATE_API_TOKEN))
    );
  }

  /** @private */
  _resolveTtsModel(voiceOptions = {}, meta = {}) {
    return resolveModelId(meta.model, resolveModelId(voiceOptions.model, this.defaultModels.tts));
  }

  /** @private */
  _resolveMediaModel(options = {}, meta = {}) {
    return resolveModelId(meta.model, resolveModelId(options.model, this.defaultModels.image));
  }

  /**
   * Finds the registry entry for a script voice: by registry key (the name) or by any entry's
   * `voice_id` value (exact, case-sensitive). Returns null when there is none.
   * @private
   */
  _findVoiceEntry(name) {
    const voices = this.guard.config.voices || {};
    if (Object.hasOwn(voices, name)) return voices[name];
    return Object.values(voices).find((e) => e && e.voice_id && e.voice_id === name) || null;
  }

  /** @private */
  _isSystemVoice(name) {
    return isSystemVoice(name, this.guard.config.systemVoices || []);
  }

  /** Adds the registered voice id so it is part of the cache key (see lib/tts-options.mjs). @private */
  _withResolvedVoice(voiceOptions) {
    return resolveRegisteredVoice(voiceOptions, this.guard.config);
  }

  /**
   * Billable path: the voice id to send. A named voice must be registered (by name or voice_id),
   * or be a provider-native system voice; a pending clone always fails.
   * @private
   */
  _voiceIdToSend(voiceOptions) {
    if (voiceOptions.voiceId || voiceOptions.voice_id) return voiceOptions.voiceId || voiceOptions.voice_id;
    const name = voiceOptions.voice;
    if (typeof name !== 'string' || name === '' || name === 'default') return 'Friendly_Person';
    const entry = this._findVoiceEntry(name);
    if (entry && entry.pending) {
      throw new Error('Voice "' + name + '" is pending (an unfinished clone). Re-run voice-clone with --force or remove the entry.');
    }
    if (this._isSystemVoice(name)) return name;
    throw new Error(
      'Voice "' + name + '" is not registered in video-guard.json voices (by name or voice_id) and is not a system voice. ' +
        'Run voice-clone.mjs, add it to systemVoices, or use "default".',
    );
  }

  /**
   * Submits a WaveSpeed job (or, with `resumeTaskId`, only polls an existing one) and polls it
   * to completion. EVERYTHING after the submit rethrows as a BillingFailureError that carries the
   * task id, so a billed task is never lost:
   *   - `timedOut`: the window ended (resumable);
   *   - `retryable`: transient/recoverable (download, journal, post-process) and resumable;
   *   - neither: the provider reported a terminal failure (failed/canceled): nothing to resume.
   * A submit that throws after the request may have reached the server is "may have been billed";
   * a 4xx before any task id is a `preTask` rejection (nothing was billed).
   * Polling is bounded either by `maxPolls` or, for long jobs, by `windowMs` with a growing delay
   * (`backoff`); transient poll exceptions are tolerated until the window ends.
   * @private
   */
  async _runWaveSpeedJob({ model, body, maxPolls, intervalMs, what, windowMs, backoff, resumeTaskId, onSubmitting, onSubmitted, track = {} }) {
    const key = this.env.WAVESPEED_API_KEY;
    const snippet = async (res) => {
      try {
        return typeof res.text === 'function' ? ' Response: ' + String(await res.text()).slice(0, 300) : '';
      } catch {
        return '';
      }
    };
    let taskId = resumeTaskId ? String(resumeTaskId) : undefined;
    if (taskId) track.taskId = taskId;
    if (!taskId) {
      if (onSubmitting) {
        try {
          await onSubmitting();
        } catch (e) {
          const err = new Error('Could not journal the submit intent (' + e.message + '); nothing was sent.');
          err.notSubmitted = true;
          throw err;
        }
      }
      let res;
      try {
        res = await this._fetch(WAVESPEED_BASE + model, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify(body),
        });
      } catch (e) {
        throw new BillingFailureError(
          what + ' request to ' + model + ' failed before a response (' + e.message + '); the request may have reached the provider and MAY HAVE BEEN BILLED.',
          { retryable: true, mayHaveBeenBilled: true },
        );
      }
      if (!res.ok) {
        const preTask = res.status >= 400 && res.status < 500;
        throw new BillingFailureError(
          what + ' request to ' + model + ' failed (HTTP ' + res.status + ').' + (await snippet(res)) + (preTask ? '' : ' It MAY HAVE BEEN BILLED.'),
          { preTask, mayHaveBeenBilled: !preTask, retryable: !preTask },
        );
      }
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new BillingFailureError(what + ' response could not be read (' + e.message + '); the job MAY HAVE BEEN BILLED.', { mayHaveBeenBilled: true, retryable: true });
      }
      const rawId = data.data?.id || data.id || data.task_id;
      if (!rawId) {
        throw new BillingFailureError(what + ' request to ' + model + ' returned no task id; it MAY HAVE BEEN BILLED. Check the provider dashboard.', { mayHaveBeenBilled: true, retryable: true });
      }
      taskId = String(rawId);
      track.taskId = taskId;
      try {
        // Persist the id BEFORE polling so a timeout or crash can never lose a billed task.
        if (onSubmitted) await onSubmitted(taskId);
      } catch (e) {
        throw new BillingFailureError(what + ' task ' + taskId + ' was submitted (billed) but could not be journaled: ' + e.message, { taskId, retryable: true });
      }
    }
    const startedAt = this._now();
    let delay = intervalMs;
    for (let i = 0; windowMs !== undefined ? this._now() - startedAt < windowMs : i < maxPolls; i++) {
      await this._sleep(delay);
      if (backoff) delay = Math.min(Math.round(delay * backoff.factor), backoff.maxMs);
      let pollData;
      try {
        const pollRes = await this._fetch(WAVESPEED_BASE + 'predictions/' + taskId + '/result', {
          headers: { Authorization: 'Bearer ' + key },
        });
        if (!pollRes.ok) continue;
        pollData = await pollRes.json();
      } catch {
        continue; // transient network/parse error: keep polling until the window ends
      }
      const status = pollData.data?.status || pollData.status;
      if (status === 'completed' || status === 'succeeded') {
        const url = pollData.data?.outputs?.[0] || pollData.outputs?.[0];
        if (!url) throw new BillingFailureError(what + ' task ' + taskId + ' completed without an output.', { taskId, retryable: true });
        try {
          const dl = await this._fetch(url);
          if (!dl.ok) throw new Error('HTTP ' + dl.status);
          const buf = Buffer.from(await dl.arrayBuffer());
          if (buf.length === 0) throw new Error('empty file');
          return buf;
        } catch (e) {
          throw new BillingFailureError(what + ' task ' + taskId + ' output download failed (' + e.message + '); resume to download it again.', { taskId, retryable: true });
        }
      }
      if (status === 'failed' || status === 'canceled' || status === 'cancelled' || status === 'error') {
        const why = pollData.data?.error || pollData.error;
        throw new BillingFailureError(what + ' task ' + taskId + ' ended with status "' + status + '".' + (why ? ' ' + String(why).slice(0, 300) : ''), { taskId });
      }
    }
    throw new BillingFailureError(
      'Timed out waiting for ' + what + ' task ' + taskId + ' (' + model + '); it may still be running or billed. Check the provider dashboard before retrying.',
      { taskId, timedOut: true, retryable: true },
    );
  }

  /** Replicate image prediction with the same fail-loud contract. @private */
  async _runReplicateImageJob(prompt) {
    const token = this.env.REPLICATE_API_TOKEN;
    const res = await this._fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Token ' + token },
      body: JSON.stringify({ version: 'black-forest-labs/flux-schnell', input: { prompt, aspect_ratio: '16:9' } }),
    });
    if (!res.ok) throw new BillingFailureError('Replicate image request failed (HTTP ' + res.status + ').');
    const prediction = await res.json();
    const pollUrl = prediction.urls?.get;
    if (!pollUrl) throw new BillingFailureError('Replicate returned no poll URL; the prediction may still have been billed.');
    for (let i = 0; i < 15; i++) {
      await this._sleep(2000);
      const pollRes = await this._fetch(pollUrl, { headers: { Authorization: 'Token ' + token } });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json();
      if (pollData.status === 'succeeded' && pollData.output) {
        const url = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
        const dl = await this._fetch(url);
        if (!dl.ok) throw new BillingFailureError('Replicate output download failed (HTTP ' + dl.status + ').');
        const buf = Buffer.from(await dl.arrayBuffer());
        if (buf.length === 0) throw new BillingFailureError('Replicate returned an empty file.');
        return buf;
      }
      if (pollData.status === 'failed' || pollData.status === 'canceled') {
        throw new BillingFailureError('Replicate prediction ended with status "' + pollData.status + '".');
      }
    }
    throw new BillingFailureError('Timed out waiting for the Replicate prediction; it may still be billed. Check the dashboard before retrying.');
  }

  /**
   * Runs one authorized provider call, settling the ledger as ok or failed.
   * @private
   */
  async _billed(ticket, run) {
    try {
      const out = await run();
      ticket.settle('ok');
      return out;
    } catch (err) {
      ticket.settle('failed', err.message);
      throw err;
    }
  }

  /**
   * Synthesizes text-to-speech audio with deterministic caching.
   * @param {string} text
   * @param {Record<string, unknown>} [voiceOptions={}]
   * @param {{ ref?: string, model?: string }} [meta={}] Ledger label and request-model override (not part of the cache key).
   * @returns {Promise<AssetSynthesisResult>}
   */
  async synthesizeTTS(text, voiceOptions = {}, meta = {}) {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      throw new Error('TTS synthesis requires non-empty text');
    }
    const options = this._withResolvedVoice(voiceOptions);
    const sha256 = this.cacheManager.computeHash(cleanText, options);
    const cachedPath = await this.cacheManager.get(sha256, 'mp3', 'tts');

    if (cachedPath) {
      this.guard.recordCacheHit({ kind: 'tts', ref: meta.ref });
      const stats = fs.statSync(cachedPath);
      const durationSeconds = await probeAudioDuration(cachedPath, this.probeDeps);
      return { assetPath: cachedPath, sha256, fromCache: true, durationSeconds, fileSizeBytes: stats.size };
    }

    const billable = this._useMiniMax() && Boolean(this.env.WAVESPEED_API_KEY);
    if (!billable) {
      if (this.guard.dryRun) return this._skipped(sha256);
      return this._storeTts(sha256, this._generateSyntheticAudio(cleanText, options));
    }

    return this._singleFlight('tts:' + sha256, async () => {
      if (this._alreadyPlanned('tts:' + sha256)) return this._skipped(sha256);
      const voiceId = this._voiceIdToSend(options);
      const model = this._resolveTtsModel(options, meta);
      const ticket = await this.guard.authorize({
        kind: 'tts',
        model,
        estUsd: estimateCallUsd('tts', model, { chars: cleanText.length }),
        ref: meta.ref,
      });
      if (!ticket) return this._skipped(sha256);
      const audioBuffer = await this._billed(ticket, () =>
        this._runWaveSpeedJob({
          model,
          what: 'TTS',
          maxPolls: 20,
          intervalMs: 1500,
          body: {
            text: cleanText,
            voice_id: voiceId,
            speed: options.speed || 1.0,
            language: options.language || 'Spanish',
            emotion: options.emotion || 'neutral',
          },
        }),
      );
      return this._storeTts(sha256, audioBuffer);
    });
  }

  /** @private */
  async _storeTts(sha256, audioBuffer) {
    const assetPath = await this.cacheManager.put(sha256, 'mp3', audioBuffer, 'tts');
    const stats = fs.statSync(assetPath);
    const durationSeconds = await probeAudioDuration(assetPath, this.probeDeps);
    return { assetPath, sha256, fromCache: false, durationSeconds, fileSizeBytes: stats.size };
  }

  /**
   * Resolves or synthesizes talking avatar video with lip-sync animation.
   * @param {string} imagePath Base character portrait
   * @param {string} audioPath Voice narration track
   * @param {Record<string, unknown>} [avatarOptions={}]
   * @param {{ ref?: string }} [meta={}] Ledger label (not part of the cache key).
   * @returns {Promise<AssetSynthesisResult>}
   */
  resolveTalkingAvatar(imagePath, audioPath, avatarOptions = {}, meta = {}) {
    // Avatar jobs are the expensive ones: bounded in-process AND across processes (slot lock files),
    // and the cache is re-checked INSIDE the slot so duplicate requests never double-bill.
    return this.guard.avatarLimit(() => this._resolveTalkingAvatar(imagePath, audioPath, avatarOptions, meta));
  }

  /**
   * @param {{ ref?: string, cacheKey?: string, durationSeconds?: number, resumeTaskId?: string, windowMs?: number,
   *   intervalMs?: number, backoff?: { factor: number, maxMs: number }, warn?: (m: string) => void,
   *   postProcess?: (b: Buffer) => Promise<{ buffer: Buffer, applied: boolean }>,
   *   pending?: { onSubmitting?: Function, onSubmitted?: Function, onResult?: Function } }} meta
   *   A `cacheKey` marks a managed job (synthesize-avatar): it is never replaced by an offline placeholder.
   * @private
   */
  async _resolveTalkingAvatar(imagePath, audioPath, avatarOptions = {}, meta = {}) {
    const sha256 = meta.cacheKey || this.cacheManager.computeHash(`${imagePath}:${audioPath}`, avatarOptions);
    const cachedPath = await this.cacheManager.get(sha256, 'mp4', 'temp');
    if (cachedPath) {
      this.guard.recordCacheHit({ kind: 'avatar', ref: meta.ref });
      return { assetPath: cachedPath, sha256, fromCache: true, fileSizeBytes: fs.statSync(cachedPath).size };
    }

    if (!this.env.WAVESPEED_API_KEY) {
      if (meta.cacheKey) throw new Error('WAVESPEED_API_KEY is not set: refusing to produce a placeholder avatar.');
      if (this.guard.dryRun) return this._skipped(sha256);
      // Offline placeholder: stored under its own key so it can never be served once a real key exists.
      const stub = Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);
      const assetPath = await this.cacheManager.put(sha256 + '-offline', 'mp4', stub, 'temp');
      return { assetPath, sha256, fromCache: false, fileSizeBytes: stub.length };
    }

    if (this._alreadyPlanned('avatar:' + sha256)) return this._skipped(sha256);
    const model = resolveModelId(avatarOptions.model, this.defaultModels.avatar);
    const resumeId = meta.resumeTaskId;
    const resolution = avatarOptions.resolution || '720p';
    let ticket = null;
    let estUsd = 0;
    let request = null;
    if (!resumeId) {
      // Everything that can be checked is checked BEFORE any spend: inputs (fail closed), duration, cap.
      request = buildAvatarRequest({ imagePath, audioPath, resolution });
      const seconds =
        Number(meta.durationSeconds) || Number(avatarOptions.durationSeconds) || (await probeAudioDuration(audioPath, this.probeDeps)) || 0;
      if (!(seconds > 0)) {
        throw new Error('Cannot price the avatar job: the audio duration is unknown (refusing to bill on a guess).');
      }
      const maxSeconds = this.guard.config.maxAvatarSeconds;
      if (seconds > maxSeconds) {
        throw new Error('The avatar audio is ' + seconds + 's, over maxAvatarSeconds (' + maxSeconds + 's) in video-guard.json: refusing to bill it.');
      }
      estUsd = estimateCallUsd('avatar', model, { seconds });
      ticket = await this.guard.authorize({ kind: 'avatar', model, estUsd, ref: meta.ref });
      if (!ticket) return this._skipped(sha256);
    }
    const settle = (outcome, detail, extra) =>
      ticket ? ticket.settle(outcome, detail, extra) : this.guard.noteOutcome({ kind: 'avatar', model, ref: meta.ref }, outcome, detail);
    const fail = (err) => {
      settle('failed', err.message, err.preTask || err.notSubmitted ? { refundUsd: estUsd } : undefined);
      meta.pending?.onResult?.(journalStatus(err), err.message);
    };

    const track = {};
    let assetPath;
    let raw;
    try {
      raw = await this._runWaveSpeedJob({
        model,
        what: 'Avatar',
        maxPolls: 30,
        intervalMs: meta.intervalMs ?? 2000,
        windowMs: meta.windowMs,
        backoff: meta.backoff,
        resumeTaskId: resumeId,
        onSubmitting: meta.pending?.onSubmitting ? () => meta.pending.onSubmitting({ model, estUsd }) : undefined,
        onSubmitted: meta.pending?.onSubmitted,
        track,
        body: request,
      });
      if (!(raw.length >= 12 && raw.subarray(4, 8).toString('latin1') === 'ftyp')) {
        const peek = raw.subarray(0, 120).toString('utf8').replace(/[^\x20-\x7e]+/g, ' ').trim();
        throw new BillingFailureError('Avatar task ' + track.taskId + ' returned something that is not an MP4 (no ftyp box; starts with: ' + peek + '). Nothing was cached; resume to download it again.', { taskId: track.taskId, retryable: true });
      }
      // The raw clip is cached FIRST (tmp+rename); faststart then improves a copy of it.
      assetPath = await this.cacheManager.put(sha256, 'mp4', raw, 'temp');
    } catch (err) {
      const wrapped =
        err instanceof BillingFailureError || err.notSubmitted
          ? err
          : new BillingFailureError('Avatar job failed after submit: ' + err.message, { taskId: track.taskId, retryable: Boolean(track.taskId), mayHaveBeenBilled: !track.taskId });
      fail(wrapped);
      throw wrapped;
    }
    settle('ok'); // only after the clip is safely in the cache
    meta.pending?.onResult?.('completed');
    if (meta.postProcess) {
      try {
        const out = await meta.postProcess(raw);
        if (out?.applied) await this.cacheManager.put(sha256, 'mp4', out.buffer, 'temp');
        else markNeedsFaststart(assetPath);
      } catch (e) {
        markNeedsFaststart(assetPath);
        (meta.warn || ((m) => console.warn(m)))('faststart failed (' + e.message + '); the raw clip is cached and marked .needs-faststart.');
      }
    }
    return { assetPath, sha256, fromCache: false, fileSizeBytes: fs.statSync(assetPath).size };
  }

  /**
   * Resolves or synthesizes a visual image media asset from a prompt.
   * @param {string} prompt
   * @param {Record<string, unknown>} [options={}]
   * @param {{ ref?: string, model?: string }} [meta={}] Ledger label and request-model override (not part of the cache key).
   * @returns {Promise<AssetSynthesisResult>}
   */
  async resolveMedia(prompt, options = {}, meta = {}) {
    const cleanPrompt = (prompt || '').trim();
    const sha256 = this.cacheManager.computeHash(cleanPrompt, options);
    const cachedPath = await this.cacheManager.get(sha256, 'png', 'images');
    if (cachedPath) {
      this.guard.recordCacheHit({ kind: 'image', ref: meta.ref });
      return { assetPath: cachedPath, sha256, fromCache: true, fileSizeBytes: fs.statSync(cachedPath).size };
    }

    const billable = Boolean(this.env.WAVESPEED_API_KEY || this.env.REPLICATE_API_TOKEN);
    if (!billable && this.guard.dryRun) return this._skipped(sha256);

    return this._singleFlight('img:' + sha256, async () => {
      if (billable && this._alreadyPlanned('img:' + sha256)) return this._skipped(sha256);
      const imageBuffer = await this._generateMediaFromPrompt(cleanPrompt, options, meta);
      if (imageBuffer === null) return this._skipped(sha256);
      const assetPath = await this.cacheManager.put(sha256, 'png', imageBuffer, 'images');
      return { assetPath, sha256, fromCache: false, fileSizeBytes: fs.statSync(assetPath).size };
    });
  }

  /**
   * Generates a standard synthetic MP3 buffer with ID3 header for offline test environments.
   * @private
   */
  _generateSyntheticAudio(text, voiceOptions) {
    // Estimate word count to produce corresponding sized buffer (1 sec ~ 16KB at 128kbps)
    const words = text.trim().split(/\s+/).length;
    const duration = Math.max(1, Math.round((words / 2.5) * 10) / 10);
    const byteLength = Math.max(1024, Math.round(duration * 16000));
    const buf = Buffer.alloc(byteLength);

    // Write minimal MP3 frame header pattern (0xFFFB = MPEG-1 Layer 3 128kbps 44.1kHz)
    for (let i = 0; i < byteLength - 4; i += 418) {
      buf[i] = 0xff;
      buf[i + 1] = 0xfb;
      buf[i + 2] = 0x90;
      buf[i + 3] = 0x64;
    }
    return buf;
  }


  /**
   * Generates a 1920x1080 visual asset: a billable provider image when a key is configured
   * (WaveSpeed first, otherwise Replicate; one provider only, never both), or a free local
   * scenic composition when no key exists. Returns null in dry-run.
   * @private
   */
  async _generateMediaFromPrompt(prompt, options = {}, meta = {}) {
    if (this.env.WAVESPEED_API_KEY) {
      const model = this._resolveMediaModel(options, meta);
      const ticket = await this.guard.authorize({
        kind: 'image',
        model,
        estUsd: estimateCallUsd('image', model),
        ref: meta.ref,
      });
      if (!ticket) return null;
      return this._billed(ticket, () =>
        this._runWaveSpeedJob({
          model,
          what: 'Image',
          maxPolls: 30,
          intervalMs: 2000,
          body: { prompt, size: options.size || '1024*1024' },
        }),
      );
    }

    if (this.env.REPLICATE_API_TOKEN) {
      const model = 'black-forest-labs/flux-schnell';
      const ticket = await this.guard.authorize({
        kind: 'image',
        model,
        estUsd: estimateCallUsd('image', model),
        ref: meta.ref,
      });
      if (!ticket) return null;
      return this._billed(ticket, () => this._runReplicateImageJob(prompt));
    }

    // 3. High-quality artistic visual scene composition
    const escapeXml = (str) =>
      String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const provider = escapeXml(options.provider || options.layer_provider || 'WaveSpeed');
    const model = escapeXml(options.model || options.layer_generation_model || 'wavespeed-v1-flux');
    const title = escapeXml(options.title || options.layer_name || 'SCENE LAYER');
    const cleanPrompt = escapeXml(prompt);
    const accent = options.accentColor || '#e11d48';

    // Thematic background palette based on prompt
    const is60s = /196[0-9]|beatles|rebel/i.test(prompt);
    const is70s = /197[0-9]|sticky|exile/i.test(prompt);
    const is80s = /198[0-9]|199[0-9]|estadios|stadium|abbey/i.test(prompt);

    const gradStart = is60s ? '#0f172a' : is70s ? '#2e1065' : is80s ? '#1e1b4b' : '#18181b';
    const gradMid = is60s ? '#1e293b' : is70s ? '#4c1d95' : is80s ? '#312e81' : '#09090b';
    const gradEnd = is60s ? '#090d16' : is70s ? '#1e1b4b' : is80s ? '#0f172a' : '#18181b';
    const themeHighlight = is60s ? '#38bdf8' : is70s ? '#ec4899' : is80s ? '#f59e0b' : accent;

    const svg = `
    <svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${gradStart}"/>
          <stop offset="50%" stop-color="${gradMid}"/>
          <stop offset="100%" stop-color="${gradEnd}"/>
        </linearGradient>
        <radialGradient id="stageGlow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="${themeHighlight}" stop-opacity="0.35"/>
          <stop offset="60%" stop-color="${gradMid}" stop-opacity="0.1"/>
          <stop offset="100%" stop-color="${gradEnd}" stop-opacity="0"/>
        </radialGradient>
        <filter id="cardShadow">
          <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000" flood-opacity="0.8"/>
        </filter>
        <pattern id="filmGrain" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="2" height="2" fill="#ffffff" fill-opacity="0.04"/>
          <rect x="2" y="2" width="2" height="2" fill="#000000" fill-opacity="0.05"/>
        </pattern>
      </defs>
      <rect width="1920" height="1080" fill="url(#bg)"/>
      <rect width="1920" height="1080" fill="url(#stageGlow)"/>
      <rect width="1920" height="1080" fill="url(#filmGrain)"/>

      <!-- Ambient Stage Lights -->
      <circle cx="300" cy="180" r="400" fill="${themeHighlight}" fill-opacity="0.12"/>
      <circle cx="1620" cy="220" r="450" fill="${themeHighlight}" fill-opacity="0.10"/>
      <circle cx="960" cy="540" r="520" fill="none" stroke="${themeHighlight}" stroke-width="2" stroke-opacity="0.25"/>
      <circle cx="960" cy="540" r="420" fill="none" stroke="${themeHighlight}" stroke-width="1.5" stroke-dasharray="16,16" stroke-opacity="0.35"/>

      <!-- Top Badge -->
      <rect x="80" y="70" width="380" height="54" rx="27" fill="${themeHighlight}" fill-opacity="0.2" stroke="${themeHighlight}" stroke-width="2"/>
      <text x="270" y="105" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="bold" fill="${themeHighlight}" text-anchor="middle" letter-spacing="2">${provider.toUpperCase()} AI ENGINE</text>
      <text x="1840" y="108" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="bold" fill="#94a3b8" text-anchor="end">${model}</text>

      <!-- Main Visual Subject Card -->
      <g filter="url(#cardShadow)">
        <rect x="180" y="260" width="1560" height="520" rx="28" fill="#030712" fill-opacity="0.88" stroke="${themeHighlight}" stroke-width="2" stroke-opacity="0.6"/>
        
        <!-- Era & Title Header -->
        <text x="960" y="370" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">${title.toUpperCase()}</text>
        
        <rect x="820" y="405" width="280" height="6" rx="3" fill="${themeHighlight}"/>

        <!-- Prompt Text -->
        <text x="960" y="475" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" fill="#cbd5e1" text-anchor="middle">
          VISUAL BIT PROMPT:
        </text>
        <text x="960" y="525" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="600" fill="#f8fafc" text-anchor="middle">
          &quot;${cleanPrompt.slice(0, 110)}${cleanPrompt.length > 110 ? '...' : ''}&quot;
        </text>

        <!-- Generation Details -->
        <rect x="360" y="590" width="1200" height="130" rx="16" fill="#0f172a" fill-opacity="0.75" stroke="#334155" stroke-width="1.5"/>
        <text x="960" y="635" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="${themeHighlight}" text-anchor="middle" letter-spacing="1">
          ✦ SYNTHESIZED SCENE LAYER • 1920x1080 HD BITMAP • CONTENT-DERIVED CACHE ✦
        </text>
        <text x="960" y="680" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="400" fill="#94a3b8" text-anchor="middle">
          Layer Asset Source: layers/ • Optimized for Remotion Compositing &amp; FFmpeg H.264
        </text>
      </g>

      <!-- Bottom Watermark -->
      <text x="960" y="1000" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="500" fill="#64748b" text-anchor="middle">
        cogNNitive Video • WaveSpeed &amp; Remotion Unified Pipeline
      </text>
    </svg>`;

    if (sharp) {
      try {
        return await sharp(Buffer.from(svg.trim())).png().toBuffer();
      } catch (e) {
        console.error('SVG Sharp Error:', e);
      }
    }
    return this._generatePlaceholderImage(prompt, options);
  }

  /**
   * Generates a 1x1/placeholder PNG buffer for media synthesis fallback.
   * @private
   */
  _generatePlaceholderImage(prompt, options) {
    const minimalPng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
      0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
      0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
      0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
      0x42, 0x60, 0x82,
    ]);
    return minimalPng;
  }
}
