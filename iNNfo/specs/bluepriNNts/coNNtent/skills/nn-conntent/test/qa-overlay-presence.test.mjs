/**
 * nn-conntent/test/qa-overlay-presence.test.mjs
 *
 * QA overlay presence after the coNNtent post-mortem (#610, #616):
 * - an overlay with no text keeps its structural check and skips the visual one;
 * - the threshold separates present (0.0029 on a textured background) from absent (~0);
 * - captions are checked structurally and by manifest timing, never by frame diff;
 * - the edge density reads the decoded frame from a file, never from ffmpeg stdout.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { QA_TEXT_EDGE_MIN, qaMaster, defaultMeasureFrameEdgeDensity } from '../scripts/lib/qa.mjs';

const FPS = 30;

function manifestWith(overlays, { frames = 90, scenes } = {}) {
  return {
    fps: FPS,
    totalDurationInFrames: frames,
    totalDurationInSeconds: frames / FPS,
    tracks: {
      scenes: scenes || [{ id: 'scene_one', slug: 'one', fromFrame: 0, durationInFrames: frames, narration: 'Hi', props: { layers: [] } }],
      overlays,
      audio: [{ id: 'audio_narration', fromFrame: 0, durationInFrames: frames }],
    },
    metadata: {},
  };
}

/** Runs qaMaster with a host div per overlay and a stubbed density; returns { res, sampled }. */
async function runQa(overlays, density, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-presence-'));
  try {
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    const hosts = overlays
      .map((o) => `<div id="${o.id}" class="clip nn-overlay" data-start="${o.fromFrame / FPS}" data-duration="${o.durationInFrames / FPS}"></div>`)
      .join('');
    fs.writeFileSync(path.join(dir, 'hyperframes', 'index.html'), `<div id="root">${hosts}</div>`);
    const masterPath = path.join(dir, 'master.mp4');
    fs.writeFileSync(masterPath, 'video');
    const sampled = [];
    const frames = opts.frames || 90;
    const res = await qaMaster({
      episodeDir: dir,
      manifest: manifestWith(overlays, opts),
      masterPath,
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({ width: 1920, height: 1920, duration: frames / FPS, hasAudio: true }),
        sampleEdgeDensity: (args) => (sampled.push(args), density),
      },
    });
    return { res, sampled };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('an overlay with empty text skips the visual check and keeps the structural one', async () => {
  const overlay = { id: 'ov_title', type: 'kineticTitle', sceneId: 'scene_one', fromFrame: 0, durationInFrames: 90, config: { heading: '' } };
  const { res, sampled } = await runQa([overlay], 0);
  assert.equal(res.ok, true, JSON.stringify(res.checks));
  assert.equal(sampled.length, 0, 'no frame is sampled for an overlay with no text');
  const check = res.checks.find((c) => c.overlayKind === 'kineticTitle');
  assert.equal(check.id, 'overlay-structural');
  assert.equal(check.status, 'pass');
});

test('an overlay with empty text still fails when its host is missing (structural check kept)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-presence-'));
  try {
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'hyperframes', 'index.html'), '<div id="root"></div>');
    const res = await qaMaster({
      episodeDir: dir,
      manifest: manifestWith([{ id: 'ov_title', type: 'kineticTitle', sceneId: 'scene_one', fromFrame: 0, durationInFrames: 90, config: { heading: '' } }]),
      masterPath: path.join(dir, 'master.mp4'),
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({ width: 1920, height: 1920, duration: 3, hasAudio: true }),
        sampleEdgeDensity: () => 1,
      },
    });
    assert.equal(res.ok, false);
    assert.ok(res.checks.some((c) => c.id === 'overlay-missing' && c.found === 'host missing'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a kineticTitle with a heading keeps the visual check (heading counts as text)', async () => {
  const overlay = { id: 'ov_title', type: 'kineticTitle', sceneId: 'scene_one', fromFrame: 0, durationInFrames: 90, config: { heading: 'Hola' } };
  const { res, sampled } = await runQa([overlay], 0);
  assert.equal(sampled.length, 1);
  assert.equal(res.ok, false);
  const check = res.checks.find((c) => c.overlayKind === 'kineticTitle');
  assert.equal(check.id, 'overlay-missing');
  assert.equal(check.text, 'Hola');
});

test('a b-roll with no text keeps the visual check', async () => {
  const overlay = { id: 'ov_broll', type: 'broll', sceneId: 'scene_one', fromFrame: 0, durationInFrames: 90, config: { assetPath: 'a.png' } };
  const { sampled } = await runQa([overlay], 1);
  assert.equal(sampled.length, 1);
});

test('the threshold passes a visible overlay on a textured background (0.0029) and fails an absent one (0.0000)', async () => {
  const overlay = { id: 'ov_lt', type: 'lowerThird', sceneId: 'scene_one', fromFrame: 0, durationInFrames: 90, config: { title: 'Ana' } };
  const present = await runQa([overlay], 0.0029);
  assert.equal(present.res.ok, true, JSON.stringify(present.res.checks));
  assert.ok(present.res.checks.some((c) => c.id === 'overlay-present'));
  const absent = await runQa([overlay], 0.0);
  assert.equal(absent.res.ok, false);
  assert.ok(absent.res.checks.some((c) => c.id === 'overlay-missing'));
  assert.ok(QA_TEXT_EDGE_MIN > 0.001 && QA_TEXT_EDGE_MIN < 0.0029, `threshold ${QA_TEXT_EDGE_MIN} separates both populations`);
});

test('consecutive generated captions pass by structure and manifest timing with no frame diff', async () => {
  // 41 captions, each sampled against the previous one would differ by ~0.0001.
  const captions = Array.from({ length: 3 }, (_, i) => ({
    id: `cap_${i}`, type: 'caption', sceneId: 'scene_one', fromFrame: i * 30, durationInFrames: 30, config: { text: `linea ${i}` },
  }));
  const { res, sampled } = await runQa(captions, 0.0001);
  assert.equal(sampled.length, 0, 'captions are never frame-diffed');
  assert.equal(res.ok, true, JSON.stringify(res.checks));
  assert.equal(res.checks.filter((c) => c.id === 'caption-present' && c.status === 'pass').length, 3);
});

test('a caption outside its scene fails with caption-timing', async () => {
  const scenes = [
    { id: 'scene_one', slug: 'one', fromFrame: 0, durationInFrames: 45, narration: 'a', props: { layers: [] } },
    { id: 'scene_two', slug: 'two', fromFrame: 45, durationInFrames: 45, narration: 'b', props: { layers: [] } },
  ];
  const cap = { id: 'cap_x', type: 'caption', sceneId: 'scene_one', fromFrame: 30, durationInFrames: 30, config: { text: 'tarde' } };
  const { res, sampled } = await runQa([cap], 1, { scenes });
  assert.equal(sampled.length, 0);
  assert.equal(res.ok, false);
  const check = res.checks.find((c) => c.id === 'caption-timing');
  assert.ok(check, JSON.stringify(res.checks));
  assert.deepEqual(check.interval, [1, 2]);
});

test('a caption host missing from index.html still fails structurally', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-presence-'));
  try {
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'hyperframes', 'index.html'), '<div id="root"></div>');
    const res = await qaMaster({
      episodeDir: dir,
      manifest: manifestWith([{ id: 'cap_0', type: 'caption', sceneId: 'scene_one', fromFrame: 0, durationInFrames: 30, config: { text: 'x' } }]),
      masterPath: path.join(dir, 'master.mp4'),
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({ width: 1920, height: 1920, duration: 3, hasAudio: true }),
        sampleEdgeDensity: () => 1,
      },
    });
    assert.equal(res.ok, false);
    assert.ok(res.checks.some((c) => c.id === 'overlay-missing' && c.overlayKind === 'caption'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('edge density reads the decoded frame from a file, never from ffmpeg stdout', () => {
  const calls = [];
  // Windows behaviour from #616: nothing ever arrives on stdout.
  const run = (cmd, args) => {
    calls.push({ cmd, args });
    const out = args[args.length - 1];
    if (out !== '-' && out !== 'pipe:' && out !== 'pipe:1') fs.writeFileSync(out, Buffer.from([0, 255, 0, 255]));
    return { status: 0, stdout: Buffer.alloc(0), stderr: '' };
  };
  const density = defaultMeasureFrameEdgeDensity({ masterPath: 'm.mp4', timeSeconds: 1, crop: { width: 2, height: 2, x: 0, y: 0 }, run });
  assert.equal(calls[0]?.cmd, 'ffmpeg');
  assert.ok(!['-', 'pipe:', 'pipe:1'].includes(calls[0].args.at(-1)), 'ffmpeg writes to a file');
  assert.equal(density, 0.5);
  assert.equal(fs.existsSync(path.dirname(calls[0].args.at(-1))), false, 'the temp frame is removed');
});

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

test('edge density on a real master: textured frame > 0, flat frame = 0 (needs ffmpeg)', { skip: !hasFfmpeg }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-real-'));
  try {
    const textured = path.join(dir, 'textured.mp4');
    const flat = path.join(dir, 'flat.mp4');
    assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x320:rate=10', '-t', '1', '-pix_fmt', 'yuv420p', textured]).status, 0);
    assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=gray:size=320x320:rate=10', '-t', '1', '-pix_fmt', 'yuv420p', flat]).status, 0);
    const crop = { width: 160, height: 160, x: 0, y: 0 };
    assert.ok(defaultMeasureFrameEdgeDensity({ masterPath: textured, timeSeconds: 0.5, crop }) > 0.001);
    assert.equal(defaultMeasureFrameEdgeDensity({ masterPath: flat, timeSeconds: 0.5, crop }), 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
