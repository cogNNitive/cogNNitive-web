import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { probeDuration, FFPROBE_CMD, FFPROBE_DURATION_ARGS } from '../scripts/lib/media-duration.mjs';

function tmpFile(bytes = 'fake') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-dur-'));
  const f = path.join(dir, 'voice.mp3');
  fs.writeFileSync(f, Buffer.from(bytes));
  return { f, dir };
}

test('uses ffprobe and reports its source', async () => {
  const { f, dir } = tmpFile();
  const calls = [];
  const r = await probeDuration(f, {
    run: async (cmd, args) => {
      calls.push({ cmd, args });
      return { status: 0, stdout: '3.5\n', stderr: '' };
    },
  });
  assert.deepEqual(r, { seconds: 3.5, source: 'ffprobe' });
  assert.equal(calls[0].cmd, FFPROBE_CMD);
  assert.deepEqual(calls[0].args, FFPROBE_DURATION_ARGS(f));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('falls back to the provider duration when ffprobe fails', async () => {
  const { f, dir } = tmpFile();
  const r = await probeDuration(f, {
    run: async () => ({ status: 1, stdout: '', stderr: 'boom' }),
    providerSeconds: 2.25,
  });
  assert.deepEqual(r, { seconds: 2.25, source: 'provider' });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('never throws and reports unknown when nothing measures', async () => {
  const { f, dir } = tmpFile();
  const r = await probeDuration(f, { run: async () => { throw new Error('nope'); } });
  assert.equal(r.seconds, 0);
  assert.equal(r.source, 'unknown');
  assert.match(r.error, /could not measure/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('missing file is a clean unknown', async () => {
  const r = await probeDuration(path.join(os.tmpdir(), 'does-not-exist-xyz.mp3'));
  assert.equal(r.seconds, 0);
  assert.equal(r.source, 'unknown');
  assert.match(r.error, /file not found/);
});
