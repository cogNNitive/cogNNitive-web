/**
 * nn-conntent/test/video-estimate.test.mjs
 *
 * The cost estimator prices TTS, image and avatar calls only: the engine module must
 * contain no per-clip `0.030` constant and no `video` fallback rate, and an estimate
 * summary carries no video-clip line or totals. (capability conntent-model-catalog
 * "Video Capability Is Not Supported Yet"; task 2b.5 — RED: video branches alive.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const estimatorPath = path.resolve(here, '../scripts/asset-cost-estimator.mjs');
const source = fs.readFileSync(estimatorPath, 'utf8');

test('the estimator module prices no video clip', () => {
  assert.doesNotMatch(source, /\bvideoCount\b/, 'no videoCount variable');
  assert.doesNotMatch(source, /\bsceneVideoCost\b/, 'no per-scene video clip cost');
  assert.doesNotMatch(source, /\btotalVideos\b/, 'no video totals in the summary');
  assert.doesNotMatch(source, /\btotalVideoCost\b/, 'no video totals in the summary');
  assert.doesNotMatch(source, /0\.030/, 'no per-clip 0.030 constant');
  assert.doesNotMatch(source, /videoLayers/, 'no video layer filter');
  assert.doesNotMatch(source, /ai_video/, 'no ai_video layer type');
  assert.doesNotMatch(source, /'video'/, 'no "video" pricing kind');
  assert.doesNotMatch(source, /\bvideo:\s*0\.\d+/, 'no video fallback rate');
});
