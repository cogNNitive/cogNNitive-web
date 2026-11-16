/**
 * nn-conntent/test/avatar-resolution-readback.test.mjs
 *
 * `avatar_resolution` is sent to the provider and is NOT enforced by it (#691). Measured
 * A/B on `wavespeed-ai/infinitetalk-fast`, both declaring 720p: 1920x1920 in came back
 * 480x480, 2848x1600 in came back 640x352. The engine therefore reads the clip's real
 * dimensions back and warns when they fall below the declared label, instead of implying
 * the label was honoured. A non-1:1 avatar still also warns, because a square master
 * composes a full-frame avatar layer with `cover`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  declaredHeightOf,
  checkAvatarClip,
  checkAvatarAssetAspect,
  validResolutionsFor,
  normalizeAvatarResolution,
} from '../scripts/lib/avatar-jobs.mjs';
import { probeVideoSize, FFPROBE_SIZE_ARGS } from '../scripts/lib/media-duration.mjs';
import { buildAvatarRequest } from '../scripts/lib/avatar-request.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const INF = 'wavespeed-ai/infinitetalk-fast';

test('the declared label maps to a nominal short side', () => {
  assert.equal(declaredHeightOf('480p'), 480);
  assert.equal(declaredHeightOf('720p'), 720);
  assert.equal(declaredHeightOf('768p'), 768);
  assert.equal(declaredHeightOf(''), 0);
});

test('resolution stays in the request body (it is still sent, just not enforced)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-req-'));
  try {
    const img = path.join(dir, 'a.png');
    const aud = path.join(dir, 'a.mp3');
    fs.writeFileSync(img, Buffer.from('img'));
    fs.writeFileSync(aud, Buffer.from('aud'));
    const body = buildAvatarRequest({ imagePath: img, audioPath: aud, resolution: '720p' });
    assert.equal(body.resolution, '720p');
    assert.ok(body.image.startsWith('data:image/png;base64,'));
    assert.ok(body.audio.startsWith('data:audio/mpeg;base64,'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a 480x480 clip for a declared 720p warns: the measured provider behaviour', () => {
  const res = checkAvatarClip({ resolution: '720p', width: 480, height: 480 });
  assert.equal(res.ok, false);
  assert.equal(res.width, 480);
  assert.equal(res.height, 480);
  assert.match(res.warning, /480x480/);
  assert.match(res.warning, /720p/);
  assert.match(res.warning, /advisory/);
});

test('a 640x352 clip for a declared 720p warns on the short side', () => {
  const res = checkAvatarClip({ resolution: '720p', width: 640, height: 352 });
  assert.equal(res.ok, false);
  assert.equal(res.height, 352);
  assert.match(res.warning, /352/);
});

test('a clip that reaches the declared short side passes', () => {
  assert.equal(checkAvatarClip({ resolution: '720p', width: 720, height: 720 }).ok, true);
  assert.equal(checkAvatarClip({ resolution: '480p', width: 1280, height: 720 }).ok, true);
  assert.equal(checkAvatarClip({ resolution: '768p', width: 768, height: 768 }).ok, true);
});

test('an unreadable clip size warns instead of silently trusting the label', () => {
  const res = checkAvatarClip({ resolution: '720p', width: undefined, height: undefined });
  assert.equal(res.ok, false);
  assert.match(res.warning, /dimensions/);
  assert.match(res.warning, /advisory/);
});

test('a square avatar asset passes the aspect check', () => {
  assert.equal(checkAvatarAssetAspect({ width: 1024, height: 1024 }), null);
  assert.equal(checkAvatarAssetAspect({ width: 1000, height: 1010 }), null, 'inside the 2% tolerance');
});

test('a 16:9 avatar asset warns about the frame the square master crops', () => {
  const warning = checkAvatarAssetAspect({ width: 1920, height: 1080, label: 'Scene s1: avatar image a.png' });
  assert.ok(warning, 'a non-square avatar still warns');
  assert.match(warning, /1920x1080/);
  assert.match(warning, /not square/);
  assert.match(warning, /56%/, '1080/1920 of the frame survives the square crop');
  assert.doesNotMatch(warning, /throw|refus/i);
});

test('an asset whose size cannot be read is not accused of being non-square', () => {
  assert.equal(checkAvatarAssetAspect({ width: undefined, height: undefined }), null);
});

test('probeVideoSize reads the first video stream size through ffprobe', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-size-'));
  try {
    const file = path.join(dir, 'clip.mp4');
    fs.writeFileSync(file, 'x');
    const calls = [];
    const size = await probeVideoSize(file, {
      run: (cmd, args) => {
        calls.push({ cmd, args });
        return { status: 0, stdout: '640,352\n', stderr: '' };
      },
    });
    assert.equal(calls[0].cmd, 'ffprobe');
    assert.deepEqual(calls[0].args, FFPROBE_SIZE_ARGS(file));
    assert.deepEqual(size, { width: 640, height: 352 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('probeVideoSize returns null when ffprobe fails or prints nothing usable', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-size-'));
  try {
    const file = path.join(dir, 'clip.mp4');
    fs.writeFileSync(file, 'x');
    assert.equal(await probeVideoSize(file, { run: () => ({ status: 1, stdout: '', stderr: 'boom' }) }), null);
    assert.equal(await probeVideoSize(file, { run: () => ({ status: 0, stdout: 'garbage' }) }), null);
    assert.equal(await probeVideoSize(path.join(dir, 'missing.mp4'), { run: () => ({ status: 0, stdout: '1,1' }) }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the model still validates its own allowed resolution set', () => {
  assert.deepEqual(validResolutionsFor(INF), ['480p', '720p', '768p']);
  assert.throws(() => normalizeAvatarResolution('1080p', INF), /not supported/);
});
