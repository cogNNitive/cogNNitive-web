#!/usr/bin/env node

/**
 * nn-video-script/test/render-formats.test.mjs
 *
 * Unit tests for render-formats.mjs — the post-process that derives
 * vertical/horizontal variants from a square master, showing the square WHOLE
 * over a Gaussian-blurred fill, named by their dimensions (`<slug>_<W>x<H>.mp4`).
 * Zero external test framework dependencies (runs with plain node). The real
 * ffmpeg smoke test is skipped when ffmpeg/ffprobe are not on PATH.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  FORMAT_PRESETS,
  slugFromMaster,
  variantName,
  buildBlurFillFilter,
  renderFormats,
} from '../scripts/render-formats.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, '..', 'scripts', 'render-formats.mjs');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'render-formats-test-'));
}

function makeFile(dir, name) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, 'x');
  return p;
}

function hasBinary(name) {
  const res = spawnSync(name, ['-version'], { stdio: 'ignore' });
  return !res.error && res.status === 0;
}

function probeDims(file) {
  const res = spawnSync(
    'ffprobe',
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file],
    { encoding: 'utf8' },
  );
  if (res.error || res.status !== 0) return null;
  const s = JSON.parse(res.stdout).streams?.[0];
  return s ? { width: s.width, height: s.height } : null;
}

async function runTests() {
  console.log('Running render-formats unit tests...');

  // Test 1: presets carry the canonical dimensions
  {
    assert.deepStrictEqual(FORMAT_PRESETS.square, { width: 1080, height: 1080, copy: true });
    assert.strictEqual(FORMAT_PRESETS.vertical.width, 1080);
    assert.strictEqual(FORMAT_PRESETS.vertical.height, 1920);
    assert.strictEqual(FORMAT_PRESETS.horizontal.width, 1920);
    assert.strictEqual(FORMAT_PRESETS.horizontal.height, 1080);
    console.log('✔ FORMAT_PRESETS define square/vertical/horizontal dimensions');
  }

  // Test 2: slug strips a trailing dimension suffix
  {
    assert.strictEqual(slugFromMaster('/r/master_1080x1080.mp4'), 'master');
    assert.strictEqual(slugFromMaster('/r/creadores_intro_1080x1080.mp4'), 'creadores_intro');
    assert.strictEqual(slugFromMaster('/r/plain.mp4'), 'plain');
    console.log('✔ slugFromMaster strips the dimension suffix');
  }

  // Test 3: variant name encodes the target dimensions
  {
    assert.strictEqual(variantName('master', { width: 1080, height: 1920 }), 'master_1080x1920.mp4');
    assert.strictEqual(variantName('master', { width: 1920, height: 1080 }), 'master_1920x1080.mp4');
    console.log('✔ variantName encodes <slug>_<W>x<H>.mp4');
  }

  // Test 4: blur-fill filter shows the square whole over a blurred fill
  {
    const filter = buildBlurFillFilter(1080, 1920);
    assert.ok(filter.includes('split=2[bg][fg]'), 'splits the source into background and foreground');
    assert.ok(filter.includes('force_original_aspect_ratio=increase'), 'fills the background');
    assert.ok(filter.includes('crop=1080:1920'), 'crops the background to the target');
    assert.ok(/gblur=sigma=\d+/.test(filter), 'blurs the background');
    assert.ok(filter.includes('eq=brightness=-0.18'), 'dims the blurred fill');
    assert.ok(filter.includes('force_original_aspect_ratio=decrease'), 'scales the square whole');
    assert.ok(filter.includes('overlay=(W-w)/2:(H-h)/2'), 'centers the square');
    assert.ok(filter.endsWith('[v]'), 'names the output label [v]');
    console.log('✔ buildBlurFillFilter composes the blur-fill filter graph');
  }

  // Test 5: happy path emits the three variant names in the output dir
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'master_1080x1080.mp4');
    const outDir = path.join(dir, 'out');
    const calls = [];
    const run = (args) => {
      calls.push(args);
      fs.writeFileSync(args[args.length - 1], 'MP4');
      return { status: 0 };
    };
    const res = await renderFormats({ master, outDir, run });
    assert.strictEqual(res.slug, 'master');
    assert.deepStrictEqual(
      res.variants.map((v) => path.basename(v.outputPath)),
      ['master_1080x1080.mp4', 'master_1080x1920.mp4', 'master_1920x1080.mp4'],
    );
    for (const name of ['master_1080x1080.mp4', 'master_1080x1920.mp4', 'master_1920x1080.mp4']) {
      assert.ok(fs.existsSync(path.join(outDir, name)), `${name} written`);
    }
    console.log('✔ Happy path emits the square, vertical and horizontal variants');
  }

  // Test 6: square is a stream copy; the others blur-fill and keep audio
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'master_1080x1080.mp4');
    const commands = {};
    const run = (args) => {
      commands[path.basename(args[args.length - 1])] = args;
      fs.writeFileSync(args[args.length - 1], 'MP4');
      return { status: 0 };
    };
    await renderFormats({ master, outDir: path.join(dir, 'out'), run });
    const square = commands['master_1080x1080.mp4'];
    assert.ok(square.includes('-c') && square.includes('copy'), 'square is stream-copied');
    assert.ok(!square.includes('-filter_complex'), 'square is not a reprocess');
    for (const name of ['master_1080x1920.mp4', 'master_1920x1080.mp4']) {
      const args = commands[name];
      assert.ok(args.includes('-filter_complex'), `${name} uses a filter graph`);
      assert.ok(args.includes('-map') && args.includes('0:a?'), `${name} maps the optional audio stream`);
      assert.ok(args.includes('-c:a') && args.includes('copy'), `${name} copies audio untouched`);
      assert.ok(args.includes('+faststart'), `${name} remuxes with +faststart`);
    }
    console.log('✔ Square copies; vertical/horizontal blur-fill with audio copy + faststart');
  }

  // Test 6b: a square master named for its dimensions is not overwritten by itself
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'master_1080x1080.mp4');
    const calls = [];
    const run = (args) => { const out = args[args.length - 1]; calls.push(path.basename(out)); fs.writeFileSync(out, 'MP4'); return { status: 0 }; };
    const res = await renderFormats({ master, outDir: dir, run });
    const square = res.variants.find((v) => v.format === 'square');
    assert.strictEqual(square.skipped, true, 'square is skipped when it IS the master');
    assert.ok(!calls.includes('master_1080x1080.mp4'), 'ffmpeg must not run for the skipped square');
    assert.ok(calls.includes('master_1080x1920.mp4') && calls.includes('master_1920x1080.mp4'), 'the non-square variants still run');
    console.log('✔ A dimension-named master is not overwritten by the square copy');
  }

  // Test 7: a missing master fails before ffmpeg runs
  {
    const dir = tmpDir();
    let invoked = false;
    await assert.rejects(
      () => renderFormats({ master: path.join(dir, 'nope.mp4'), run: () => { invoked = true; return { status: 0 }; } }),
      /not found/,
    );
    assert.strictEqual(invoked, false, 'ffmpeg must not run without a master');
    console.log('✔ Missing master fails before ffmpeg runs');
  }

  // Test 8: an unknown format name is refused
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'master_1080x1080.mp4');
    await assert.rejects(
      () => renderFormats({ master, formats: ['wide'], run: () => ({ status: 0 }) }),
      /Unknown format/,
    );
    console.log('✔ Unknown format is refused');
  }

  // Test 9: a missing ffmpeg binary is a named error
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'master_1080x1080.mp4');
    const run = () => ({ error: Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' }), status: null });
    await assert.rejects(
      () => renderFormats({ master, run }),
      /ffmpeg was not found/,
    );
    console.log('✔ Missing ffmpeg is a named error');
  }

  // Test 10: --dry-run prints commands and writes nothing
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'master_1080x1080.mp4');
    const outDir = path.join(dir, 'out');
    const res = spawnSync('node', [scriptPath, '--master', master, '--out-dir', outDir, '--dry-run'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `dry-run should exit 0, got stderr: ${res.stderr}`);
    assert.ok(/-filter_complex/.test(res.stdout), 'prints the filter graph');
    assert.ok(!fs.existsSync(path.join(outDir, 'master_1080x1920.mp4')), 'dry-run must not write outputs');
    console.log('✔ CLI --dry-run prints commands and writes nothing');
  }

  // Test 11: CLI without --master exits non-zero with a usage banner
  {
    const res = spawnSync('node', [scriptPath], { encoding: 'utf8' });
    assert.notStrictEqual(res.status, 0);
    assert.ok(/Usage: node render-formats\.mjs/.test(res.stderr));
    console.log('✔ CLI without --master prints usage and exits non-zero');
  }

  // Test 12: real-ffmpeg smoke — variant dimensions match their names (skipped without ffmpeg)
  if (!hasBinary('ffmpeg') || !hasBinary('ffprobe')) {
    console.log('ℹ ffmpeg/ffprobe not on PATH; skipping the real render smoke test');
  } else {
    const dir = tmpDir();
    const master = path.join(dir, 'master_1080x1080.mp4');
    const build = spawnSync(
      'ffmpeg',
      ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=1080x1080:d=0.2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.2', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', master],
      { encoding: 'utf8' },
    );
    assert.strictEqual(build.status, 0, `fixture master build failed: ${build.stderr}`);
    const res = await renderFormats({ master, outDir: dir });
    for (const v of res.variants) {
      if (v.width === v.height) continue; // the square is a copy of the source
      const dims = probeDims(v.outputPath);
      assert.deepStrictEqual(dims, { width: v.width, height: v.height }, `${path.basename(v.outputPath)} dimensions`);
    }
    console.log('✔ Real ffmpeg smoke: variant dimensions match their names');
  }

  console.log('\nAll render-formats unit tests passed! 🎬');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
