import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CacheManager } from '../scripts/cache-manager.mjs';
import { collectAvatarJobs, ttsCachePathFor } from '../scripts/lib/avatar-jobs.mjs';
import { buildTtsVoiceOptions, resolveRegisteredVoice } from '../scripts/lib/tts-options.mjs';

const PRUNA = 'pruna-ai/p-video-2-pro/avatar';
const config = { voices: {} };

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-tts-'));
  const img = path.join(dir, 'a.png');
  fs.writeFileSync(img, Buffer.from('img'));
  const cacheManager = new CacheManager({ baseDir: path.join(dir, 'cache') });
  return { dir, img, cacheManager };
}

const scene = (img, extra = {}) => ({
  id: 'scene_a',
  narration: 'hello there',
  properties: { scene_voice: 'alloy', scene_voice_model: 'm1', ...(extra.properties || {}) },
  layers: [{ name: 'p', type: 'presenter', properties: { layer_type: 'talking_avatar', layer_asset_source: img, layer_avatar_model: PRUNA } }],
  ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== 'properties')),
});

const keyFor = (cacheManager, sc, models = {}, bags = {}) =>
  cacheManager.computeHash(String(sc.narration).trim(), resolveRegisteredVoice(buildTtsVoiceOptions(sc, models, bags), config));

const run = (cacheManager, dir, sc) =>
  collectAvatarJobs({ parsed: { scenes: [sc] }, scriptDir: dir, cacheManager, config, models: {}, bags: {} });

test('ttsCachePathFor is exported and finds the entry compile writes', () => {
  const { dir, img, cacheManager } = setup();
  try {
    const sc = scene(img);
    cacheManager.putSync(keyFor(cacheManager, sc), 'mp3', Buffer.from('tts-bytes'), 'tts');
    const p = ttsCachePathFor(sc, { cacheManager, config, models: {}, bags: {} });
    assert.equal(fs.readFileSync(p, 'utf8'), 'tts-bytes');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('narrated scene reads the TTS cache entry and needs no audio/ folder', () => {
  const { dir, img, cacheManager } = setup();
  try {
    const sc = scene(img);
    cacheManager.putSync(keyFor(cacheManager, sc), 'mp3', Buffer.from('tts-bytes'), 'tts');
    assert.equal(fs.existsSync(path.join(dir, 'audio')), false);
    const { jobs, problems } = run(cacheManager, dir, sc);
    assert.deepEqual(problems, []);
    assert.equal(jobs.length, 1);
    assert.equal(fs.readFileSync(jobs[0].audioPath, 'utf8'), 'tts-bytes');
    assert.equal(fs.existsSync(path.join(dir, 'audio')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('narrated scene without a cache entry reports "run compile first"', () => {
  const { dir, img, cacheManager } = setup();
  try {
    const { jobs, problems } = run(cacheManager, dir, scene(img));
    assert.equal(jobs.length, 0);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /run compile first/i);
    assert.match(problems[0], /scene_a/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('scene without narration keeps the explicit audio_asset_source branch', () => {
  const { dir, img, cacheManager } = setup();
  try {
    const aud = path.join(dir, 'own.mp3');
    fs.writeFileSync(aud, Buffer.from('own'));
    const sc = scene(img, { narration: '', properties: { audio_asset_source: 'own.mp3' } });
    const { jobs, problems } = run(cacheManager, dir, sc);
    assert.deepEqual(problems, []);
    assert.equal(jobs[0].audioPath, aud);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('changing narration, voice or voice model never serves the old entry', () => {
  const { dir, img, cacheManager } = setup();
  try {
    const sc = scene(img);
    cacheManager.putSync(keyFor(cacheManager, sc), 'mp3', Buffer.from('old'), 'tts');
    const ctx = { cacheManager, config, models: {}, bags: {} };
    assert.ok(ttsCachePathFor(sc, ctx));
    assert.equal(ttsCachePathFor({ ...sc, narration: 'changed' }, ctx), undefined);
    assert.equal(ttsCachePathFor({ ...sc, properties: { ...sc.properties, scene_voice: 'echo' } }, ctx), undefined);
    assert.equal(ttsCachePathFor({ ...sc, properties: { ...sc.properties, scene_voice_model: 'm2' } }, ctx), undefined);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
