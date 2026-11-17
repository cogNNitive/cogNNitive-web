/**
 * nn-conntent/test/safe-zone.test.mjs
 *
 * Per-canvas safe zone guard (spec S6): each overlay component lays out inside
 * `#root`, which reads the safe area of the canvas it is rendered on
 * (`--safe-top/right/bottom/left`, `lib/safe-area.mjs`), and keeps its own percentages
 * relative to that rectangle. A component that drops the safe-area root, or places
 * something outside it, fails here. The arithmetic is checked on every default canvas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { safeArea } from '../scripts/lib/safe-area.mjs';

const COMPONENTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'library', 'components');
const NAMES = ['lower-third', 'caption', 'title', 'quote', 'watermark', 'b-roll'];
const CANVASES = [
  { width: 1920, height: 1080 },
  { width: 1080, height: 1920 },
  { width: 1080, height: 1080 },
];

const css = (name) => /<style>([\s\S]*?)<\/style>/.exec(fs.readFileSync(path.join(COMPONENTS, name, 'index.html'), 'utf8'))?.[1] ?? '';
const rule = (sheet, selector) => new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}').exec(sheet)?.[1] ?? '';
const pct = (decls, prop) => {
  const m = new RegExp('(?:^|[;\\s])' + prop + ':\\s*(-?[\\d.]+)%').exec(decls);
  return m ? Number(m[1]) : null;
};

test('the six overlay components ship', () => {
  const shipped = fs
    .readdirSync(COMPONENTS)
    .filter((f) => fs.statSync(path.join(COMPONENTS, f)).isDirectory() && fs.existsSync(path.join(COMPONENTS, f, 'index.html')))
    .sort();
  assert.deepEqual(shipped, [...NAMES].sort());
});

for (const name of NAMES) {
  test(`${name} lays #root out on the canvas safe area with overflow visible`, () => {
    const root = rule(css(name), '#root');
    for (const side of ['top', 'right', 'bottom', 'left']) assert.match(root, new RegExp(`${side}:\\s*var\\(--safe-${side},`));
    assert.match(root, /overflow:\s*visible/);
    assert.doesNotMatch(root, /inset:\s*[\d.]+%/, 'no fixed square inset');
  });

  test(`${name} places nothing with a percentage offset outside its safe area`, () => {
    for (const m of css(name).matchAll(/(?:^|[;{\s])(top|left|right|bottom):\s*(-?[\d.]+)%/g)) {
      const v = Number(m[2]);
      assert.ok(v >= 0 && v <= 50, `${name}: ${m[1]}: ${v}% leaves the safe area`);
    }
    assert.doesNotMatch(css(name), /position:\s*fixed|\b\d+v[wh]\b/);
  });
}

test('lower-third sits where the safe-area arithmetic says on every canvas', () => {
  const base = rule(css('lower-third'), '.nn-lower-third');
  assert.equal(pct(base, 'bottom'), 12);
  assert.equal(pct(base, 'left'), 5);
  assert.equal(pct(base, 'max-width'), 70);
  for (const canvas of CANVASES) {
    const safe = safeArea(canvas);
    const left = safe.x + 0.05 * safe.width;
    const bottomEdge = safe.y + safe.height - 0.12 * safe.height;
    assert.ok(left >= safe.x && left + 0.7 * safe.width <= safe.x + safe.width, `${canvas.width}x${canvas.height}: inside horizontally`);
    assert.ok(bottomEdge <= safe.y + safe.height && bottomEdge >= safe.y, `${canvas.width}x${canvas.height}: inside vertically`);
  }
  // Vertical canvas: the lower third ends above the platform interface band (65% of the height).
  const v = safeArea({ width: 1080, height: 1920 });
  assert.ok(v.y + v.height - 0.12 * v.height < 0.65 * 1920);
});

test('caption sits where the safe-area arithmetic says on every canvas', () => {
  const base = rule(css('caption'), '.nn-caption');
  assert.equal(pct(base, 'bottom'), 10);
  assert.equal(pct(base, 'right'), 5);
  assert.equal(pct(base, 'max-width'), 60);
  for (const canvas of CANVASES) {
    const safe = safeArea(canvas);
    const right = safe.x + safe.width - 0.05 * safe.width;
    assert.ok(right - 0.6 * safe.width >= safe.x && right <= canvas.width - safe.right, `${canvas.width}x${canvas.height}: inside horizontally`);
  }
});
