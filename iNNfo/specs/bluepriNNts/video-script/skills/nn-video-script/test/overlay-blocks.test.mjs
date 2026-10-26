import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveOverlayBlock, overlayHostMarkup, DEFAULT_OVERLAY_BLOCKS } from '../scripts/overlay-blocks.mjs';

test('defaults map each overlay type to a registry block', () => {
  for (const [type, block] of Object.entries(DEFAULT_OVERLAY_BLOCKS)) {
    assert.deepEqual(resolveOverlayBlock(type), { blockId: block, source: 'registry' });
  }
});

test('a series frame overrides the default', () => {
  assert.deepEqual(
    resolveOverlayBlock('lowerThird', { seriesFrame: { blocks: { lowerThird: 'my-lower' } } }),
    { blockId: 'my-lower', source: 'series' },
  );
});

test('a scene block wins over the series frame', () => {
  assert.deepEqual(
    resolveOverlayBlock('lowerThird', {
      seriesFrame: { blocks: { lowerThird: 's' } },
      sceneBlock: { lowerThird: 'sc' },
    }),
    { blockId: 'sc', source: 'scene' },
  );
});

test('an unknown overlay type resolves to null', () => {
  assert.equal(resolveOverlayBlock('nope'), null);
});

test('overlayHostMarkup is scene-relative and carries variables', () => {
  const o = { id: 'overlay_x_1', type: 'lowerThird', fromFrame: 90, durationInFrames: 30, config: { text: 'Dr. A', position: 'bottom-left' } };
  const html = overlayHostMarkup(o, 60, 30, {});
  assert.match(html, /class="clip nn-overlay"/);
  assert.match(html, /data-block="lower-third"/);
  assert.match(html, /data-start="1"/);
  assert.match(html, /data-duration="1"/);
  assert.match(html, /data-var-text="Dr\. A"/);
});

test('b-roll carries the staged asset variable', () => {
  const o = { id: 'o', type: 'broll', fromFrame: 0, durationInFrames: 30, config: { assetPath: 'clip_abc.mp4' } };
  assert.match(overlayHostMarkup(o, 0, 30, {}), /data-var-src="assets\/clip_abc\.mp4"/);
});

test('the anchor overlayHostMarkup emits no audio', () => {
  const o = { id: 'o', type: 'watermark', fromFrame: 0, durationInFrames: 30, config: { text: 'AI' } };
  assert.doesNotMatch(overlayHostMarkup(o, 0, 30, {}), /<audio/);
});
