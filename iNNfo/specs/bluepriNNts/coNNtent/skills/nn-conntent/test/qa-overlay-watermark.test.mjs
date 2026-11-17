/**
 * nn-conntent/test/qa-overlay-watermark.test.mjs
 *
 * #692: a VISIBLE watermark measured an edge-density delta of 0.0004 against a
 * threshold of 0.0015, so `produce` exited 12 with nothing delivered.
 *
 * The instrument was the problem, not the overlay. The check averaged edge density
 * over the whole overlay band (1080x302 on a 1920 square master), which is 6-20x the
 * area a watermark actually covers: the same 130 edge pixels that are 0.0032 of a
 * tile are 0.0004 of the band. Measuring the band as one average dilutes a small mark
 * below any usable threshold.
 *
 * `measureFn` here is deterministic: it returns the share of the measured crop that
 * the mark's 130 edge pixels cover. The band reproduces the reported 0.0004 exactly;
 * a tile that contains the mark is 8x more sensitive.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { QA_TEXT_EDGE_MIN, defaultSampleEdgeDensity, tileRegions } from '../scripts/lib/qa.mjs';

/** The watermark band the current check derives for a 1920x1920 master. */
const BAND = { width: 1080, height: 302, x: 420, y: 1198 };
/** Where the watermark really is: a 200x80 mark whose outline is 130 edge pixels. */
const MARK = { x: 1150, y: 1330, width: 200, height: 80 };
const EDGE_PIXELS = 130;

const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Edge density of a crop: the mark's edge pixels divided by the crop area. */
function markDensity({ crop }) {
  if (!overlaps(crop, MARK)) return 0;
  return EDGE_PIXELS / (crop.width * crop.height);
}

/** The control crop is the same x/width, shifted above the band: no mark there. */
const controlOf = (band) => ({ width: band.width, height: band.height, x: band.x, y: Math.max(0, band.y - band.height) });

test('the reported number comes from averaging: 0.0004 of the band, 0.0032 of a tile', () => {
  // The arithmetic behind #692, independent of the instrument: the same 130 edge
  // pixels are diluted 8x by the 1080x302 band and clear the threshold in a tile.
  const bandShare = EDGE_PIXELS / (BAND.width * BAND.height);
  const tileShare = EDGE_PIXELS / (270 * 151);
  assert.equal(Number(bandShare.toFixed(4)), 0.0004, 'the reported delta');
  assert.ok(bandShare < QA_TEXT_EDGE_MIN, 'below the threshold: the false negative');
  assert.ok(tileShare >= QA_TEXT_EDGE_MIN, 'the same mark in a tile is measurable');
});

test('tiling the band finds a visible watermark', () => {
  const delta = defaultSampleEdgeDensity({
    outputPath: 'unused.mp4',
    time: 1,
    crop: BAND,
    controlCrop: controlOf(BAND),
    measureFn: markDensity,
  });
  assert.ok(delta >= QA_TEXT_EDGE_MIN, 'a visible mark must clear the threshold');
});

test('an absent overlay stays at zero under tiling', () => {
  const delta = defaultSampleEdgeDensity({
    outputPath: 'unused.mp4',
    time: 1,
    crop: BAND,
    controlCrop: controlOf(BAND),
    measureFn: () => 0,
  });
  assert.equal(delta, 0);
});

test('tiles are inside the band and cover it', () => {
  const tiles = tileRegions(BAND);
  assert.ok(tiles.length >= 4);
  for (const t of tiles) {
    assert.ok(t.x >= BAND.x && t.y >= BAND.y, 'tile starts inside the band');
    assert.ok(t.x + t.width <= BAND.x + BAND.width, 'tile ends inside the band');
    assert.ok(t.y + t.height <= BAND.y + BAND.height, 'tile ends inside the band');
    assert.ok(t.width >= 16 && t.height >= 16, 'tile is measurable');
    assert.equal(t.width % 2, 0, 'even width for the ffmpeg crop filter');
  }
});

test('a tile rect is never larger than the crop it comes from', () => {
  const tiny = { width: 20, height: 18, x: 4, y: 6 };
  for (const t of tileRegions(tiny)) {
    assert.ok(t.width <= tiny.width && t.height <= tiny.height);
    assert.ok(t.x >= tiny.x && t.y >= tiny.y);
  }
});

test('a tight layout rect still measures the mark directly', () => {
  const tight = { width: 200, height: 80, x: MARK.x, y: MARK.y };
  const delta = defaultSampleEdgeDensity({
    outputPath: 'unused.mp4',
    time: 1,
    crop: tight,
    controlCrop: { width: 200, height: 80, x: MARK.x, y: 0 },
    measureFn: markDensity,
  });
  assert.ok(delta >= QA_TEXT_EDGE_MIN, 'the layout rect is the most sensitive crop of all');
});
