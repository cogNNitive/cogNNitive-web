/**
 * nn-conntent/test/catalog-video.test.mjs
 *
 * A catalog or overlay Model with `capability:: video` is rejected when the merged
 * catalog is built (`unsupported-capability`), the estimate has no video-clip line, and
 * the `video`/`ai_video` Layer types are gone. (capability conntent-model-catalog "Video
 * Capability Is Not Supported Yet"; D-K7; task 2b.4 — RED: capability video accepted.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMergedCatalog,
  UNSUPPORTED_CAPABILITY,
} from '../scripts/lib/catalog.mjs';

test('a catalog Model with capability video is rejected naming the model', () => {
  assert.throws(
    () => buildMergedCatalog({
      reference: [{ slug: 'm1', capability: 'tts' }],
      overlay: [{ slug: 'm2', capability: 'video' }],
    }),
    (err) => {
      assert.ok(err instanceof Error);
      assert.equal(err.code, UNSUPPORTED_CAPABILITY);
      assert.match(err.message, /m2/);
      assert.match(err.message, /generated video clips are not supported/i);
      return true;
    },
  );
});