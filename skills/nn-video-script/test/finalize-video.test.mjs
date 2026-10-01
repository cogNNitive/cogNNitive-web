#!/usr/bin/env node

/**
 * skills/nn-video-script/test/finalize-video.test.mjs
 *
 * Unit tests for finalize-video.mjs — the finalize/register step that
 * promotes `master`/`thumbnail`/`voiceover` out of `renders/<ref>/` into the
 * Video Element's own folder (video-folder-contract). Zero external test
 * framework dependencies (runs with plain node).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveRenderRef, finalizeVideo, listRenderRefs } from '../scripts/finalize-video.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const finalizeVideoPath = path.join(__dirname, '..', 'scripts', 'finalize-video.mjs');

function makeVideoDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'finalize-video-test-'));
}

function makeRender(videoDir, ref, files) {
  const renderDir = path.join(videoDir, 'renders', ref);
  fs.mkdirSync(renderDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(renderDir, name), content, 'utf8');
  }
  return renderDir;
}

function noLeftoverTempFiles(dir) {
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (walk(full)) return true;
      } else if (/\.tmp-/.test(entry.name)) {
        return true;
      }
    }
    return false;
  };
  return !walk(dir);
}

async function runTests() {
  console.log('Running finalize-video unit tests...');

  // Test 1: single ref succeeds — master, thumbnail, voiceover all promoted
  {
    const videoDir = makeVideoDir();
    makeRender(videoDir, 'ref1', {
      'ref1.mp4': 'MASTER',
      'ref1_thumbnail.png': 'THUMB',
      'ref1_voiceover.mp3': 'VOICE',
    });

    const result = finalizeVideo({ videoDir });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.ref, 'ref1');
    assert.strictEqual(result.fields.master, 'master.mp4');
    assert.strictEqual(result.fields.thumbnail, 'thumbnail.png');
    assert.strictEqual(result.fields.voiceover, 'voiceover.mp3');
    assert.strictEqual(fs.readFileSync(path.join(videoDir, 'master.mp4'), 'utf8'), 'MASTER');
    assert.strictEqual(fs.readFileSync(path.join(videoDir, 'thumbnail.png'), 'utf8'), 'THUMB');
    assert.strictEqual(fs.readFileSync(path.join(videoDir, 'voiceover.mp3'), 'utf8'), 'VOICE');
    assert.ok(noLeftoverTempFiles(videoDir), 'No .tmp- files should remain after copy-then-rename');
    console.log('✔ Single ref succeeds: master/thumbnail/voiceover promoted via temp-then-rename');
  }

  // Test 2: ambiguous ref with no --ref fails
  {
    const videoDir = makeVideoDir();
    makeRender(videoDir, 'ref1', { 'ref1.mp4': 'A' });
    makeRender(videoDir, 'ref2', { 'ref2.mp4': 'B' });

    assert.strictEqual(listRenderRefs(videoDir).length, 2);
    assert.throws(() => resolveRenderRef(videoDir, undefined), /Multiple render refs found/);
    console.log('✔ Ambiguous ref with no --ref fails');
  }

  // Test 3: existing thumbnail is preserved unless --force-thumbnail
  {
    const videoDir = makeVideoDir();
    makeRender(videoDir, 'ref1', { 'ref1.mp4': 'MASTER', 'ref1_thumbnail.png': 'NEW' });
    fs.writeFileSync(path.join(videoDir, 'thumbnail.png'), 'OLD', 'utf8');

    const result = finalizeVideo({ videoDir });
    assert.strictEqual(result.fields.thumbnail, undefined, 'Thumbnail must not be overwritten by default');
    assert.strictEqual(fs.readFileSync(path.join(videoDir, 'thumbnail.png'), 'utf8'), 'OLD');

    const forced = finalizeVideo({ videoDir, forceThumbnail: true });
    assert.strictEqual(forced.fields.thumbnail, 'thumbnail.png');
    assert.strictEqual(fs.readFileSync(path.join(videoDir, 'thumbnail.png'), 'utf8'), 'NEW');
    console.log('✔ Existing thumbnail preserved unless --force-thumbnail');
  }

  // Test 4: missing voiceover file is skipped without error
  {
    const videoDir = makeVideoDir();
    makeRender(videoDir, 'ref1', { 'ref1.mp4': 'MASTER' });

    const result = finalizeVideo({ videoDir });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.fields.voiceover, undefined);
    assert.ok(!fs.existsSync(path.join(videoDir, 'voiceover.mp3')));
    console.log('✔ Missing voiceover file is skipped without error');
  }

  // Test 5: CLI succeeds with a single unambiguous ref and prints field values
  {
    const videoDir = makeVideoDir();
    makeRender(videoDir, 'ref1', { 'ref1.mp4': 'MASTER' });
    const res = spawnSync('node', [finalizeVideoPath, '--video-dir', videoDir], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `CLI should exit 0, got stderr: ${res.stderr}`);
    assert.ok(/master:: master\.mp4/.test(res.stdout), 'CLI should print the master:: field value');
    console.log('✔ CLI exits 0 and prints field values on success');
  }

  // Test 6: CLI fails on an ambiguous ref set without --ref
  {
    const videoDir = makeVideoDir();
    makeRender(videoDir, 'ref1', { 'ref1.mp4': 'A' });
    makeRender(videoDir, 'ref2', { 'ref2.mp4': 'B' });
    const res = spawnSync('node', [finalizeVideoPath, '--video-dir', videoDir], { encoding: 'utf8' });
    assert.strictEqual(res.status, 1, 'CLI should exit 1 on ambiguous ref');
    assert.ok(/Multiple render refs found/.test(res.stderr));
    console.log('✔ CLI exits 1 on ambiguous ref without --ref');
  }

  console.log('\nAll finalize-video unit tests passed! 🎉');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
