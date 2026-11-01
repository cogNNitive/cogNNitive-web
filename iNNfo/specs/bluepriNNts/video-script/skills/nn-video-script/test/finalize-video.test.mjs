#!/usr/bin/env node

/**
 * nn-video-script/test/finalize-video.test.mjs
 *
 * Finalize derives the delivery formats from the master, prints the chapters and
 * the two Field values, and writes nothing else (capability video-script-skill
 * "Finalize Derives Formats In Place" and capability video-publication-description).
 * The derivation is injected as a seam, so no ffmpeg is needed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  episodeScriptPath,
  finalizeVideo,
  masterPath,
  parseFormats,
  thumbnailPath,
} from '../scripts/finalize-video.mjs';
import { formatTimecode, buildChapters, chapterLines } from '../scripts/lib/description.mjs';

const SCRIPT = '---\nlevel: 3\n---\n\n# NN Video\n\n## NN Video: X\nslug:: x\n';

function episode({ master = 'x_1920x1920.mp4', thumbnail = 'x_thumbnail_2560x1440.png' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-finalize-'));
  fs.mkdirSync(path.join(dir, 'build'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'x_video-script_s_NN.md'), SCRIPT, 'utf8');
  if (master) fs.writeFileSync(path.join(dir, master), 'master-bytes', 'utf8');
  if (thumbnail) fs.writeFileSync(path.join(dir, thumbnail), 'png', 'utf8');
  const manifest = {
    fps: 30,
    metadata: { scriptSource: path.join(dir, 'x_video-script_s_NN.md') },
    tracks: {
      scenes: [
        { id: 'scene_a', fromFrame: 0, props: { title: 'A' } },
        { id: 'scene_b', fromFrame: 786, props: { title: 'B' } },
      ],
    },
  };
  fs.writeFileSync(path.join(dir, 'build', 'manifest.json'), JSON.stringify(manifest), 'utf8');
  return dir;
}

const run = (args) => {
  const out = args[args.length - 1];
  fs.writeFileSync(out, 'derived', 'utf8');
  return { status: 0 };
};
const probe = () => ({ width: 1920, height: 1920 });

test('timecodes are measured, floored to seconds, with hours when needed', () => {
  assert.equal(formatTimecode(0), '00:00');
  assert.equal(formatTimecode(26.2), '00:26');
  assert.equal(formatTimecode(3700), '1:01:40');
});

test('chapters come from the manifest scene starts and titles', () => {
  const manifest = { fps: 30, tracks: { scenes: [{ fromFrame: 0, props: { title: 'Hook' } }, { fromFrame: 786, props: { title: 'Body' } }] } };
  const chapters = buildChapters(manifest);
  assert.deepEqual(chapters.map((c) => c.timecode), ['00:00', '00:26']);
  assert.deepEqual(chapters.map((c) => c.title), ['Hook', 'Body']);
  assert.deepEqual(chapterLines(manifest), ['00:00 Hook', '00:26 Body']);
});

test('the first chapter is always 00:00 even when the manifest starts later', () => {
  const manifest = { fps: 30, tracks: { scenes: [{ fromFrame: 90, props: { title: 'Late' } }] } };
  assert.equal(buildChapters(manifest)[0].timecode, '00:00');
});

test('finalize derives the formats from the master and prints the fields', async () => {
  const dir = episode();
  const res = await finalizeVideo({ episodeDir: dir, run, probe });
  assert.equal(res.master, path.join(dir, 'x_1920x1920.mp4'));
  assert.deepEqual(res.fields, { master: 'x_1920x1920.mp4', thumbnail: 'x_thumbnail_2560x1440.png' });
  assert.deepEqual(res.chapters, ['00:00 A', '00:26 B']);
  assert.ok(res.messages.some((m) => m.startsWith('derive x_1080x1920.mp4')));
  assert.ok(res.messages.includes('master:: x_1920x1920.mp4'));
  // It never writes the model or a description file.
  assert.equal(fs.existsSync(path.join(dir, 'description.md')), false);
  assert.equal(fs.readFileSync(path.join(dir, 'x_video-script_s_NN.md'), 'utf8'), SCRIPT);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a manifest compiled from another script is refused', async () => {
  const dir = episode();
  const manifestPath = path.join(dir, 'build', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.metadata.scriptSource = path.join(dir, 'other_video-script_s_NN.md');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest), 'utf8');
  await assert.rejects(() => finalizeVideo({ episodeDir: dir, run, probe }), /compiled from/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a manifest older than the script is refused as stale', async () => {
  const dir = episode();
  const scriptPath = path.join(dir, 'x_video-script_s_NN.md');
  const later = new Date(Date.now() + 60_000);
  fs.utimesSync(scriptPath, later, later);
  await assert.rejects(() => finalizeVideo({ episodeDir: dir, run, probe }), /older than the script/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a missing master is refused before any derivation', async () => {
  const dir = episode({ master: null });
  let ran = 0;
  await assert.rejects(
    () => finalizeVideo({ episodeDir: dir, run: (a) => { ran++; return { status: 0 }; }, probe }),
    /No <slug>_1920x1920\.mp4/,
  );
  assert.equal(ran, 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the retired --ref and renders/ path are gone', async () => {
  const dir = episode();
  fs.mkdirSync(path.join(dir, 'renders', 'r1'), { recursive: true });
  const res = await finalizeVideo({ episodeDir: dir, run, probe });
  assert.equal(res.fields.master, 'x_1920x1920.mp4', 'the master comes from the episode folder');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('dry run derives nothing', async () => {
  const dir = episode();
  let ran = 0;
  const res = await finalizeVideo({ episodeDir: dir, dryRun: true, run: () => { ran++; return { status: 0 }; }, probe });
  assert.equal(ran, 0);
  assert.equal(res.dryRun, true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the helpers find one script, one master and the delivered thumbnail', () => {
  const dir = episode();
  assert.equal(path.basename(episodeScriptPath(dir)), 'x_video-script_s_NN.md');
  assert.equal(path.basename(masterPath(dir)), 'x_1920x1920.mp4');
  assert.equal(path.basename(thumbnailPath(dir)), 'x_thumbnail_2560x1440.png');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an unknown --formats value is refused', () => {
  assert.deepEqual(parseFormats('vertical,square'), ['vertical', 'square']);
  assert.throws(() => parseFormats('vertical,vertical-wide'), /Unknown format/);
});
