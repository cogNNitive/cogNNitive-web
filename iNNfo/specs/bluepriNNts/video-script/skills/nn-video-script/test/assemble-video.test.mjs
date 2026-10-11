#!/usr/bin/env node

/**
 * nn-video-script/test/assemble-video.test.mjs
 *
 * Unit tests for assemble-video.mjs — the final-assembly layer that joins
 * ordered clips with the FFmpeg concat demuxer in stream-copy mode. Zero
 * external test framework dependencies (runs with plain node).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { assembleVideo, buildConcatList, escapeConcatPath } from '../scripts/assemble-video.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, '..', 'scripts', 'assemble-video.mjs');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'assemble-video-test-'));
}

function makeClips(dir, names) {
  return names.map((n) => {
    const p = path.join(dir, n);
    fs.writeFileSync(p, 'x');
    return p;
  });
}

const consistentProbe = () => ({ codec: 'h264', width: 1920, height: 1080, fps: '30/1' });

async function runTests() {
  console.log('Running assemble-video unit tests...');

  // Test 1: concat list keeps order and escapes single quotes
  {
    const list = buildConcatList(["/a/one's.mp4", '/a/two.mp4']);
    assert.strictEqual(escapeConcatPath("/a/one's.mp4"), "file '/a/one'\\''s.mp4'");
    assert.strictEqual(list, "file '/a/one'\\''s.mp4'\nfile '/a/two.mp4'\n");
    console.log('✔ Concat list preserves order and escapes single quotes');
  }

  // Test 2: happy path — stream-copy args, output written, no re-encode
  {
    const dir = tmpDir();
    const clips = makeClips(dir, ['a.mp4', 'b.mp4']);
    const out = path.join(dir, 'master.mp4');
    let captured;
    const run = (args) => {
      captured = args;
      fs.writeFileSync(args[args.length - 1], 'MP4');
      return { status: 0 };
    };
    const res = await assembleVideo({ clips, outputPath: out, run, probe: consistentProbe });
    assert.strictEqual(res.clips, 2);
    assert.strictEqual(fs.readFileSync(out, 'utf8'), 'MP4');
    assert.ok(captured.includes('-f') && captured.includes('concat'), 'uses the concat demuxer');
    assert.ok(captured.includes('-c') && captured.includes('copy'), 'stream-copies (no re-encode)');
    assert.ok(captured.includes('+faststart'), 'remuxes with +faststart');
    console.log('✔ Happy path streams-copies clips and writes the master');
  }

  // Test 3: no clips fails
  {
    await assert.rejects(
      () => assembleVideo({ clips: [], outputPath: path.join(tmpDir(), 'm.mp4'), run: () => ({ status: 0 }) }),
      /No clips provided/,
    );
    console.log('✔ Empty clip list fails');
  }

  // Test 4: missing clip fails before invoking ffmpeg
  {
    const dir = tmpDir();
    let invoked = false;
    await assert.rejects(
      () => assembleVideo({ clips: [path.join(dir, 'nope.mp4')], outputPath: path.join(dir, 'm.mp4'), run: () => { invoked = true; return { status: 0 }; } }),
      /not found/,
    );
    assert.strictEqual(invoked, false, 'ffmpeg must not run when a clip is missing');
    console.log('✔ Missing clip fails before ffmpeg runs');
  }

  // Test 5: mismatched clips are refused before ffmpeg (no silent glitch)
  {
    const dir = tmpDir();
    const clips = makeClips(dir, ['a.mp4', 'b.mp4']);
    let invoked = false;
    const probe = (f) => (f.endsWith('a.mp4')
      ? { codec: 'h264', width: 1920, height: 1080, fps: '30/1' }
      : { codec: 'h264', width: 1280, height: 720, fps: '25/1' });
    await assert.rejects(
      () => assembleVideo({ clips, outputPath: path.join(dir, 'm.mp4'), run: () => { invoked = true; return { status: 0 }; }, probe }),
      /differ in codec\/resolution\/fps/,
    );
    assert.strictEqual(invoked, false, 'ffmpeg must not run on a mismatched set');
    console.log('✔ Mismatched clips are refused before ffmpeg runs');
  }

  // Test 6: unreadable probes warn and skip the precheck (ffmpeg decides)
  {
    const dir = tmpDir();
    const clips = makeClips(dir, ['a.mp4', 'b.mp4']);
    const out = path.join(dir, 'master.mp4');
    let warned = '';
    const run = (args) => { fs.writeFileSync(args[args.length - 1], 'MP4'); return { status: 0 }; };
    const res = await assembleVideo({ clips, outputPath: out, run, probe: () => null, warn: (m) => { warned = m; } });
    assert.strictEqual(res.clips, 2);
    assert.ok(/skipping the consistency precheck/.test(warned));
    console.log('✔ Unreadable probes warn and skip the precheck');
  }

  // Test 7: CLI --dry-run prints the ffmpeg command and exits 0
  {
    const dir = tmpDir();
    const clips = makeClips(dir, ['a.mp4', 'b.mp4']);
    const res = spawnSync('node', [scriptPath, ...clips, '--out', path.join(dir, 'm.mp4'), '--dry-run'], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `dry-run should exit 0, got stderr: ${res.stderr}`);
    assert.ok(/-f concat/.test(res.stdout), 'prints the concat command');
    assert.ok(/-c copy/.test(res.stdout), 'prints the stream-copy command');
    assert.ok(!fs.existsSync(path.join(dir, 'm.mp4')), 'dry-run must not write output');
    console.log('✔ CLI --dry-run prints the command and writes nothing');
  }

  // Test 8: CLI without --out exits non-zero with a usage banner
  {
    const res = spawnSync('node', [scriptPath, 'a.mp4', 'b.mp4'], { encoding: 'utf8' });
    assert.notStrictEqual(res.status, 0);
    assert.ok(/Usage: node assemble-video\.mjs/.test(res.stderr));
    console.log('✔ CLI without --out prints usage and exits non-zero');
  }

  console.log('\nAll assemble-video unit tests passed! 🎉');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
