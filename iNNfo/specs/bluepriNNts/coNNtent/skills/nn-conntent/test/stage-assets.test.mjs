#!/usr/bin/env node

/**
 * nn-conntent/test/stage-assets.test.mjs
 *
 * Slice 5: the engine links provider cache entries into the HyperFrames project instead of
 * copying them (capability cognnitive-video-engine "Assets Are Linked, Not Copied"). A link
 * failure (`EXDEV`/`EPERM`/`ENOTSUP`) falls back to a copy, records `link_mode: copy` and
 * warns once. The emitted project lives in `<episode>/hyperframes/`, loads GSAP from
 * `vendor/`, and a missing GSAP fails loudly.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  LINK_FALLBACK_CODES,
  assetName,
  linkOrCopy,
  resetCopyModeWarning,
  resolveGsapPath,
  sameFile,
} from '../scripts/lib/stage-assets.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nn-stage-'));
const done = (dir) => fs.rmSync(dir, { recursive: true, force: true });

function source(dir, bytes = 'asset-bytes') {
  const src = path.join(dir, 'cache', 'tts', 'key.mp3');
  fs.mkdirSync(path.dirname(src), { recursive: true });
  fs.writeFileSync(src, bytes);
  return src;
}

test('an asset is linked: the project file and the cache entry are the same file on disk', () => {
  const dir = tmp();
  try {
    const src = source(dir);
    const dest = path.join(dir, 'hyperframes', 'assets', 'narration_abc.mp3');
    const res = linkOrCopy(src, dest);
    assert.deepEqual(res, { mode: 'link', staged: true });
    assert.ok(fs.existsSync(dest));
    assert.ok(sameFile(src, dest), 'the staged asset IS the cache entry');
    assert.ok(fs.statSync(dest).nlink >= 2, 'a hardlink leaves more than one name on the inode');
    assert.equal(fs.readFileSync(dest, 'utf8'), 'asset-bytes');
  } finally {
    done(dir);
  }
});

test('linking twice is idempotent and reports no new work', () => {
  const dir = tmp();
  try {
    const src = source(dir);
    const dest = path.join(dir, 'hyperframes', 'assets', 'narration_abc.mp3');
    linkOrCopy(src, dest);
    assert.deepEqual(linkOrCopy(src, dest), { mode: 'link', staged: false });
  } finally {
    done(dir);
  }
});

for (const code of ['EXDEV', 'EPERM', 'ENOTSUP']) {
  test(`a ${code} link failure falls back to a copy and warns exactly once`, () => {
    const dir = tmp();
    const warnings = [];
    try {
      resetCopyModeWarning();
      const src = source(dir);
      const failingLink = () => {
        const err = new Error('link refused');
        err.code = code;
        throw err;
      };
      const first = linkOrCopy(src, path.join(dir, 'a', 'asset.mp3'), {
        link: failingLink,
        warn: (m) => warnings.push(m),
      });
      const second = linkOrCopy(src, path.join(dir, 'a', 'asset2.mp3'), {
        link: failingLink,
        warn: (m) => warnings.push(m),
      });
      assert.deepEqual(first, { mode: 'copy', staged: true });
      assert.deepEqual(second, { mode: 'copy', staged: true });
      assert.ok(fs.existsSync(path.join(dir, 'a', 'asset.mp3')));
      assert.equal(sameFile(src, path.join(dir, 'a', 'asset.mp3')), false, 'a copy is a new file');
      assert.equal(warnings.length, 1, 'one warning per run, not one per asset');
      assert.match(warnings[0], new RegExp(code));
      assert.match(warnings[0], /link_mode: copy/);
    } finally {
      resetCopyModeWarning();
      done(dir);
    }
  });
}

test('an error that is not a link-refusal is rethrown, never silently copied', () => {
  const dir = tmp();
  try {
    const src = source(dir);
    const err = new Error('disk on fire');
    err.code = 'EIO';
    assert.throws(
      () => linkOrCopy(src, path.join(dir, 'x', 'asset.mp3'), { link: () => { throw err; } }),
      /disk on fire/,
    );
    assert.equal(LINK_FALLBACK_CODES.has('EIO'), false);
    assert.equal(fs.existsSync(path.join(dir, 'x', 'asset.mp3')), false);
  } finally {
    done(dir);
  }
});

test('the asset name carries a content hash and keeps the extension', () => {
  const dir = tmp();
  try {
    const src = source(dir);
    const name = assetName(src);
    assert.match(name, /^key_[0-9a-f]{12}\.mp3$/);
    fs.writeFileSync(src, 'other bytes');
    assert.notEqual(assetName(src), name, 'different bytes never reuse a staged name');
  } finally {
    done(dir);
  }
});

test('GSAP resolves from the installed dependency, or reports nothing so the caller fails loudly', () => {
  assert.equal(resolveGsapPath({ resolve: () => { throw new Error('MODULE_NOT_FOUND'); } }), null);
  const dir = tmp();
  try {
    const fake = path.join(dir, 'gsap.min.js');
    fs.writeFileSync(fake, '/* gsap */');
    assert.equal(resolveGsapPath({ resolve: () => fake }), fake);
  } finally {
    done(dir);
  }
});
