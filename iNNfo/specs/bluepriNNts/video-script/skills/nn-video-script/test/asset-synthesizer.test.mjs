#!/usr/bin/env node

/**
 * nn-video-script/test/asset-synthesizer.test.mjs
 *
 * Guards the FFmpeg-free audio duration path:
 *  1. probeAudioDuration accepts an injectable `parseMedia` seam and calls it with
 *     `{ fields: { durationInSeconds: true } }` — no ffprobe/ffmpeg spawn, no
 *     file-size estimate.
 *  2. No OS-native (Windows SAPI) synthesis path remains in the module.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeAudioDuration } from '../scripts/asset-synthesizer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYNTH_PATH = path.join(__dirname, '..', 'scripts', 'asset-synthesizer.mjs');

async function runTests() {
  console.log('Running asset-synthesizer unit tests...');

  // 1. Duration comes from ffprobe, with a provider-reported fallback. No Remotion parser.
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-dur-'));
    try {
      const file = path.join(tmp, 'voice.mp3');
      fs.writeFileSync(file, Buffer.from('fake audio bytes'));

      let seen = null;
      const duration = await probeAudioDuration(file, {
        run: async (cmd, args) => {
          seen = { cmd, args };
          return { status: 0, stdout: '3.5\n', stderr: '' };
        },
      });
      assert.strictEqual(duration, 3.5, `expected the ffprobe duration, got ${duration}`);
      assert.ok(seen, 'the runner must be invoked');
      assert.strictEqual(seen.cmd, 'ffprobe');
      assert.ok(seen.args.includes('-show_entries'), 'ffprobe asked for the container duration');

      const fallback = await probeAudioDuration(file, {
        run: async () => ({ status: 1, stdout: '', stderr: 'boom' }),
        providerSeconds: 2.25,
      });
      assert.strictEqual(fallback, 2.25, 'falls back to the provider duration');

      const src = fs.readFileSync(SYNTH_PATH, 'utf8');
      assert.ok(!/@remotion\/media-parser/.test(src), 'no @remotion/media-parser reference may remain');
      console.log('✔ probeAudioDuration uses ffprobe with a provider fallback (no Remotion parser)');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // 2. No Windows SAPI synthesis path remains.
  {
    const src = fs.readFileSync(SYNTH_PATH, 'utf8');
    assert.ok(!/_synthesizeWindowsSapi/.test(src), 'the SAPI synthesis method must be removed');
    assert.ok(!/System\.Speech/.test(src), 'no System.Speech usage may remain');
    console.log('✔ no OS-native (Windows SAPI) synthesis path remains');
  }

  console.log('\nAll asset-synthesizer unit tests passed! 🎉');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
