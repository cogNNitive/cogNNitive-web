/**
 * nn-conntent/test/prune-duplicates.test.mjs
 *
 * Change 2026-11-02-video-script-v1, Slice 10: `prune-duplicates.mjs` finds episode
 * files whose exact bytes already live in the provider cache. It is the only cleanup
 * that may delete an authored file, so the rule is strict: same sha256, same extension,
 * a real cache entry. Anything else is reported and left alone.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { pruneDuplicates, findDuplicates } from '../scripts/prune-duplicates.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-prune-'));
  const cache = path.join(root, '.cognnitive', 'cache', 'video');
  fs.mkdirSync(path.join(cache, 'images'), { recursive: true });
  fs.mkdirSync(path.join(cache, 'tts'), { recursive: true });
  const episode = path.join(root, 'series', 's', 'assets', 'e');
  fs.mkdirSync(path.join(episode, 'media'), { recursive: true });

  const cached = Buffer.from('identical-bytes');
  // The cache is content-addressed: the entry name IS the sha256 of the bytes.
  const cachedHash = crypto.createHash('sha256').update(cached).digest('hex');
  fs.writeFileSync(path.join(cache, 'images', `${cachedHash}.png`), cached);

  // The same bytes in the episode, under a friendly name.
  fs.writeFileSync(path.join(episode, 'media', 'shot.png'), cached);
  // Different bytes, same extension: must survive.
  fs.writeFileSync(path.join(episode, 'media', 'other.png'), Buffer.from('different-bytes'));
  // Same bytes but an extension that is not in the cache entry: must survive.
  fs.writeFileSync(path.join(episode, 'media', 'shot.bin'), cached);

  return { root, cache, episode, cachedHash, file: path.join(episode, 'media', 'shot.png') };
}

test('findDuplicates reports a file whose exact bytes are cached', () => {
  const f = fixture();
  try {
    const found = findDuplicates({ target: f.episode, cacheDir: f.cache });
    const hit = found.find((d) => d.file === path.join(f.episode, 'media', 'shot.png'));
    assert.ok(hit, 'the duplicated file is reported');
    assert.equal(hit.bytes, Buffer.from('identical-bytes').length);
    assert.equal(hit.cacheEntry, path.join(f.cache, 'images', `${f.cachedHash}.png`));
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('findDuplicates ignores a different extension and different bytes', () => {
  const f = fixture();
  try {
    const names = findDuplicates({ target: f.episode, cacheDir: f.cache }).map((d) => path.basename(d.file));
    assert.ok(!names.includes('other.png'), 'different bytes are never a duplicate');
    assert.ok(!names.includes('shot.bin'), 'only the cached extension counts');
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('a dry run deletes nothing and reports the reclaimable bytes', () => {
  const f = fixture();
  try {
    const before = fs.readFileSync(f.file);
    const result = pruneDuplicates({ target: f.episode, cacheDir: f.cache, apply: false });
    assert.equal(result.removed.length, 0, 'nothing is removed');
    assert.equal(result.duplicates.length, 1);
    assert.ok(result.reclaimableBytes > 0, 'it reports the bytes it would reclaim');
    assert.deepEqual(fs.readFileSync(f.file), before, 'the file is untouched');
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('applying removes only the byte-identical file', () => {
  const f = fixture();
  try {
    const result = pruneDuplicates({ target: f.episode, cacheDir: f.cache, apply: true });
    assert.equal(result.removed.length, 1);
    assert.equal(fs.existsSync(f.file), false, 'the duplicate is gone');
    assert.equal(fs.existsSync(path.join(f.episode, 'media', 'other.png')), true, 'the different file stays');
    assert.equal(fs.existsSync(path.join(f.episode, 'media', 'shot.bin')), true, 'the other extension stays');
    assert.equal(
      fs.existsSync(path.join(f.cache, 'images', `${f.cachedHash}.png`)),
      true,
      'the cache entry is never deleted',
    );
  } finally {
    fs.rmSync(f.root, { recursive: true, force: true });
  }
});

test('an empty target is a clean no-op', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-prune-empty-'));
  try {
    const result = pruneDuplicates({ target: root, cacheDir: path.join(root, 'nope'), apply: true });
    assert.deepEqual(result.duplicates, []);
    assert.deepEqual(result.removed, []);
    assert.equal(result.reclaimableBytes, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
