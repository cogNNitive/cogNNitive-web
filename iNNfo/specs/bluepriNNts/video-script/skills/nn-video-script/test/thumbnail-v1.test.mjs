import test from 'node:test';
import assert from 'node:assert/strict';
import { buildThumbnailSvg } from '../scripts/thumbnail-v1.mjs';

test('the thumbnail SVG carries the title, subtitle and badge', () => {
  const svg = buildThumbnailSvg({ title: 'ATASCO FALSO', subtitle: 'Mi Serie', badge: 'Mi Serie', width: 2560, height: 1440 });
  assert.match(svg, /ATASCO FALSO/);
  assert.match(svg, /Mi Serie/);
  assert.match(svg, /<svg width="2560" height="1440"/);
});

test('no series is hardcoded in the SVG defaults', () => {
  const svg = buildThumbnailSvg({ title: 'X' });
  assert.match(svg, /Series/);
  assert.doesNotMatch(svg, /iNNteresante/);
});

test('typography scales with the width', () => {
  const wide = buildThumbnailSvg({ title: 'A', width: 2560, height: 1440 });
  const tall = buildThumbnailSvg({ title: 'A', width: 1080, height: 1920 });
  assert.match(wide, /font-size="192px"/);
  assert.match(tall, new RegExp('font-size="' + Math.round(192 * (1080 / 2560)) + 'px"'));
});
