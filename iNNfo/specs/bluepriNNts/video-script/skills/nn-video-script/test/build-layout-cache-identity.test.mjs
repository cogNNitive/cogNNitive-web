/**
 * nn-video-script/test/build-layout-cache-identity.test.mjs
 *
 * The build/ layout (design D2) moved where the engine writes; it must not move
 * any cache key. A key is a pure function of content and options, so no path,
 * folder name or master dimension of the layout may enter it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CacheManager } from '../scripts/cache-manager.mjs';

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
const TTS_OPTIONS = { model: 'minimax/speech-2.8-hd', voice: 'Ana', speed: 1.1, emotion: 'calm' };

test('keys are pinned: a layout change cannot silently move them', () => {
  const cache = new CacheManager({ baseDir: 'C:/tmp/nn-layout-a' });
  assert.equal(cache.computeHash('Same narration words here.', TTS_OPTIONS), '0b701e9cdbad1b21d5c58aa1bcaae889055c3cde03b32d287761fd480fefc1fc');
  assert.equal(cache.computeHash('a bright studio', { model: 'm' }), '8bc56032ecf6d4fa05a117b185c039317392df545ba4f5b9789dbae1cf7791d0');
});

test('the key does not depend on where the cache or the episode build lives', () => {
  const domainCache = new CacheManager({ baseDir: 'C:/tmp/domain/.cognnitive/cache/video' });
  const buildCache = new CacheManager({ baseDir: 'C:/tmp/domain/series/s/assets/e/build/hyperframes/assets' });
  assert.equal(
    domainCache.computeHash('Same narration words here.', TTS_OPTIONS),
    buildCache.computeHash('Same narration words here.', TTS_OPTIONS),
  );
});

test('the cache key code names no build-layout path, folder or dimension', () => {
  const source = fs.readFileSync(path.join(SCRIPTS, 'cache-manager.mjs'), 'utf8');
  const hashFn = /computeHash\(content[\s\S]*?\n  \}\n/.exec(source)?.[0] ?? '';
  assert.ok(hashFn.length > 0, 'computeHash is present');
  assert.doesNotMatch(hashFn, /baseDir|buildDir|\bbuild\b|hyperframes|\.nn-build|render\.tmp|manifest|1920|1080|publicDir/);
});
