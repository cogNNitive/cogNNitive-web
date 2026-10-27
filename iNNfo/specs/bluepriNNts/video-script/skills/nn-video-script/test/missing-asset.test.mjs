/**
 * nn-video-script/test/missing-asset.test.mjs
 *
 * RED→GREEN tests for scripts/lib/missing-asset.mjs: the shared D21 check that
 * turns a name→file miss into a loud `MissingAssetError` for a user-level name
 * and a single warning for a blueprint-only default. S6 and S7 reuse it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MissingAssetError,
  checkMissingAsset,
  resetMissingAssetWarnings,
} from '../scripts/lib/missing-asset.mjs';

test('a user-level name with no file throws naming the name, the level and every path', () => {
  assert.throws(
    () =>
      checkMissingAsset({
        kind: 'frame',
        name: 'night',
        source: 'scene',
        searched: ['/a/frames/night.md', '/b/frames/night.md'],
      }),
    (err) => {
      assert.ok(err instanceof MissingAssetError);
      assert.match(err.message, /frame/);
      assert.match(err.message, /night/);
      assert.match(err.message, /scene/);
      assert.match(err.message, /\/a\/frames\/night\.md/);
      assert.match(err.message, /\/b\/frames\/night\.md/);
      return true;
    },
  );
});

test('every user level fails: cli, layer, scene, video, series, domain', () => {
  for (const source of ['cli', 'layer', 'scene', 'video', 'series', 'domain']) {
    assert.throws(
      () => checkMissingAsset({ kind: 'sound', name: 'click', source, searched: ['/x/sounds/click.*'] }),
      MissingAssetError,
    );
  }
});

test('a blueprint-only name warns once and is skipped', () => {
  const warnings = [];
  const orig = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  try {
    resetMissingAssetWarnings();
    const first = checkMissingAsset(
      { kind: 'sound', name: 'whoosh', source: 'blueprint', searched: ['/x/sounds/whoosh.*'] },
      { warn: console.warn },
    );
    assert.deepEqual(first, { skipped: true, warning: true });
    const second = checkMissingAsset(
      { kind: 'sound', name: 'whoosh', source: 'blueprint', searched: ['/x/sounds/whoosh.*'] },
      { warn: console.warn },
    );
    assert.deepEqual(second, { skipped: true, warning: false });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /whoosh/);
  } finally {
    console.warn = orig;
  }
});

test('an unresolved name (source null) is silent', () => {
  assert.deepEqual(checkMissingAsset({ kind: 'sound', name: null, source: null, searched: [] }), {
    skipped: false,
    warning: false,
  });
});
