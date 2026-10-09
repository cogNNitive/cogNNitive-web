#!/usr/bin/env node

/**
 * nn-video-script/scripts/voice-clone.mjs
 *
 * Usage: node voice-clone.mjs <name> <sample-audio> [--series <slug>] [--force]
 *
 * Clones a voice ONCE and records it in the workspace `video-guard.json`
 * (`voices.<name> = { voice_id, series, sample_sha256 }`) so it is never cloned (and
 * paid for, ~$1.60 each) again. Refused before any provider call when the name exists
 * (case-insensitive), when the same sample was already cloned, or when the name is
 * unsafe, unless `--force`. A `pending` entry is reserved under an exclusive lock
 * BEFORE the provider call and replaced on success (restored on failure); the
 * registry is written via temp file + rename. Every attempt is ledgered with its outcome.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { withFileLock } from './lib/file-lock.mjs';
import { parseArgs, CliUsageError } from './lib/cli-args.mjs';
import { DEFAULT_GUARD, GUARD_FILENAME, LOCKS_RELATIVE_DIR, SpendGuard, loadGuard } from './lib/video-guard.mjs';

export const VOICE_CLONE_MODEL = 'minimax/voice-clone';
export const VOICE_CLONE_EST_USD = 1.6;

const RESERVED_NAMES = new Set([...Object.getOwnPropertyNames(Object.prototype), 'prototype']);

/**
 * Default provider client (WaveSpeed MiniMax voice clone). The request/response schema
 * follows the other WaveSpeed v3 calls in this skill but has NOT been verified against
 * the live API: the voice id is read from the response when present (`voice_id`), and
 * otherwise falls back to the id this client requested. Inject a client to use another
 * provider or to test.
 * @param {{ env?: Record<string, string | undefined>, fetch?: typeof fetch }} [deps]
 * @returns {{ cloneVoice: (args: { name: string, samplePath: string }) => Promise<{ voiceId: string }> }}
 */
export function createWaveSpeedVoiceClient(deps = {}) {
  const env = deps.env || process.env;
  const doFetch = deps.fetch || ((...a) => globalThis.fetch(...a));
  return {
    async cloneVoice({ name, samplePath }) {
      const key = env.WAVESPEED_API_KEY;
      if (!key) throw new Error('WAVESPEED_API_KEY is not set; cannot clone a voice.');
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'voice';
      const requestedId = 'voice_' + slug + '_' + crypto.randomBytes(3).toString('hex');
      const audio = 'data:audio/mpeg;base64,' + fs.readFileSync(samplePath).toString('base64');
      const res = await doFetch('https://api.wavespeed.ai/api/v3/' + VOICE_CLONE_MODEL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ audio, voice_id: requestedId }),
      });
      if (!res.ok) throw new Error('Voice clone request failed with HTTP ' + res.status);
      const data = await res.json();
      const returned = data?.data?.voice_id ?? data?.voice_id ?? data?.data?.outputs?.[0]?.voice_id;
      return { voiceId: typeof returned === 'string' && returned ? returned : requestedId };
    },
  };
}

/** @param {string} name */
function assertSafeName(name) {
  const ok =
    typeof name === 'string' && name === name.trim() && name.length >= 1 && name.length <= 64 &&
    /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u.test(name) && !RESERVED_NAMES.has(name);
  if (!ok) {
    throw new Error(
      'Invalid voice name ' + JSON.stringify(name) + ': use 1-64 letters, digits, spaces, "_", "-" or ".", ' +
        'starting with a letter or digit, and not a reserved object-property name.',
    );
  }
}

/** Writes JSON through a temp file + rename so readers never see a partial registry. */
function writeJsonAtomic(file, obj) {
  const tmp = file + '.' + process.pid + '.' + Date.now() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * @param {Object} opts
 * @param {string} opts.name Voice name (key in video-guard.json `voices`).
 * @param {string} opts.samplePath Reference audio sample.
 * @param {string} [opts.series] Series slug the voice belongs to.
 * @param {boolean} [opts.force] Allow re-cloning an already recorded voice or sample.
 * @param {string} [opts.startDir] Where to look for the workspace (defaults to cwd).
 * @param {{ cloneVoice: Function }} [opts.client] Provider client (injectable).
 * @returns {Promise<{ voiceId: string, estUsd: number, guardFile: string }>}
 */
export async function cloneVoice({ name, samplePath, series, force = false, startDir = process.cwd(), client }) {
  assertSafeName(name);
  const resolvedSample = path.resolve(samplePath || '');
  if (!samplePath || !fs.existsSync(resolvedSample)) {
    throw new Error('Voice sample not found: ' + resolvedSample);
  }
  const sampleSha = crypto.createHash('sha256').update(fs.readFileSync(resolvedSample)).digest('hex');

  const loaded = loadGuard(startDir);
  const guardFile = loaded.source || path.join(loaded.root, GUARD_FILENAME);
  const lockPath = path.join(loaded.root, LOCKS_RELATIVE_DIR, 'voices.lock');
  // Voice cloning is an explicit user action: no plan approval or model allowlist, but the
  // per-run budget and the rolling 24h cap still apply, and the attempt is ledgered.
  const guard = new SpendGuard({ config: loaded.config, root: loaded.root });
  const readRaw = () => (fs.existsSync(guardFile) ? JSON.parse(fs.readFileSync(guardFile, 'utf8')) : structuredClone(DEFAULT_GUARD));

  let previous = null;
  let ticket = null;
  let effectiveSeries = series;

  // 1. Reserve a pending entry under an exclusive lock, before the provider call.
  await withFileLock(lockPath, async () => {
    const raw = readRaw();
    const voices = Object.hasOwn(raw, 'voices') && raw.voices && typeof raw.voices === 'object' ? raw.voices : {};
    const dupKey = Object.keys(voices).find((k) => k.toLowerCase() === name.toLowerCase());
    if (dupKey && !force) {
      const state = voices[dupKey].pending ? 'is pending (a clone is in progress or was interrupted)' : 'already exists';
      throw new Error(
        'Voice "' + dupKey + '" ' + state + ' in ' + GUARD_FILENAME + ' (voice_id ' + voices[dupKey].voice_id + '). ' +
          'Re-cloning costs ~$' + VOICE_CLONE_EST_USD.toFixed(2) + ' each time; pass --force to do it anyway.',
      );
    }
    const shaKey = Object.keys(voices).find((k) => k !== dupKey && voices[k] && voices[k].sample_sha256 === sampleSha);
    if (shaKey && !force) {
      throw new Error(
        'This sample was already cloned as "' + shaKey + '" (voice_id ' + voices[shaKey].voice_id + '). Reuse that voice, or pass --force.',
      );
    }
    previous = dupKey ? { key: dupKey, entry: voices[dupKey] } : null;
    effectiveSeries = series ?? previous?.entry?.series ?? '';

    ticket = await guard.authorize(
      { kind: 'voice-clone', model: VOICE_CLONE_MODEL, estUsd: VOICE_CLONE_EST_USD, ref: name },
      { requireApproval: false, checkModel: false },
    );
    try {
      if (dupKey) delete voices[dupKey];
      voices[name] = { voice_id: '', series: effectiveSeries, pending: true, sample_sha256: sampleSha, reservedAt: new Date().toISOString() };
      raw.voices = voices;
      writeJsonAtomic(guardFile, raw);
    } catch (err) {
      ticket.settle('failed', err.message);
      throw err;
    }
  });

  // 2. Call the provider outside the lock (it can take a while).
  const provider = client || createWaveSpeedVoiceClient();
  let voiceId;
  try {
    const result = await provider.cloneVoice({ name, samplePath: resolvedSample });
    voiceId = result?.voiceId;
    if (typeof voiceId !== 'string' || !voiceId) throw new Error('The provider returned no voice id.');
  } catch (err) {
    await withFileLock(lockPath, () => {
      const raw = readRaw();
      const voices = raw.voices || {};
      if (voices[name] && voices[name].pending) delete voices[name];
      if (previous) voices[previous.key] = previous.entry;
      raw.voices = voices;
      writeJsonAtomic(guardFile, raw);
    });
    ticket.settle('failed', err.message);
    throw err;
  }

  // 3. Replace the reservation with the real entry.
  await withFileLock(lockPath, () => {
    const raw = readRaw();
    raw.voices = { ...(raw.voices || {}) };
    raw.voices[name] = { voice_id: voiceId, series: effectiveSeries, sample_sha256: sampleSha, clonedAt: new Date().toISOString() };
    writeJsonAtomic(guardFile, raw);
  });
  ticket.settle('ok');
  return { voiceId, estUsd: VOICE_CLONE_EST_USD, guardFile };
}

const USAGE = 'Usage: node voice-clone.mjs <name> <sample-audio> [--series <slug>] [--force]';

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { boolean: ['force'], value: ['series'] });
  } catch (err) {
    if (!(err instanceof CliUsageError)) throw err;
    console.error('Error: ' + err.message + '\n' + USAGE);
    process.exit(1);
  }
  const [name, sample] = parsed._;
  if (!name || !sample) {
    console.error(USAGE);
    process.exit(1);
  }
  try {
    const res = await cloneVoice({ name, samplePath: sample, series: parsed.flags.series, force: parsed.flags.force });
    console.log('Cloned voice "' + name + '" (' + res.voiceId + '), est. $' + res.estUsd.toFixed(2) + ' -> ' + res.guardFile);
  } catch (err) {
    console.error('Error: ' + err.message);
    process.exit(1);
  }
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) await main();
