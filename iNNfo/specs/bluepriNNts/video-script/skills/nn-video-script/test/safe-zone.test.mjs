/**
 * nn-video-script/test/safe-zone.test.mjs
 *
 * Open Gate guard: only the central 1080x1080 of the 1920x1920 master survives every
 * derived crop, so each overlay component lays out inside `#root { inset: 21.875% }`
 * and keeps its own percentages relative to that square. A component that drops the
 * inset, or places something outside it, fails here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMPONENTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'components');
const NAMES = ['lower-third', 'caption', 'title', 'quote', 'watermark', 'b-roll'];
const MASTER = 1920;
const INSET = 21.875;
const SAFE = MASTER * (1 - 2 * INSET / 100);

const css = (name) => /<style>([\s\S]*?)<\/style>/.exec(fs.readFileSync(path.join(COMPONENTS, name + '.html'), 'utf8'))?.[1] ?? '';
const rule = (sheet, selector) => new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}').exec(sheet)?.[1] ?? '';
const pct = (decls, prop) => {
  const m = new RegExp('(?:^|[;\\s])' + prop + ':\\s*(-?[\\d.]+)%').exec(decls);
  return m ? Number(m[1]) : null;
};

test('the six overlay components ship', () => {
  const shipped = fs.readdirSync(COMPONENTS).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort();
  assert.deepEqual(shipped, [...NAMES].sort());
});

for (const name of NAMES) {
  test(`${name} declares #root inset ${INSET}% with overflow visible`, () => {
    const root = rule(css(name), '#root');
    assert.match(root, /inset:\s*21\.875%/);
    assert.match(root, /overflow:\s*visible/);
  });

  test(`${name} places nothing with a percentage offset outside its inset square`, () => {
    for (const m of css(name).matchAll(/(?:^|[;{\s])(top|left|right|bottom):\s*(-?[\d.]+)%/g)) {
      const v = Number(m[2]);
      assert.ok(v >= 0 && v <= 50, `${name}: ${m[1]}: ${v}% leaves the safe square`);
    }
    assert.doesNotMatch(css(name), /position:\s*fixed|\b\d+v[wh]\b/);
  });
}

test('lower-third sits where the safe-square arithmetic says on the master', () => {
  const base = rule(css('lower-third'), '.nn-lower-third');
  const px = (p) => (p / 100) * SAFE;
  assert.equal(pct(base, 'bottom'), 12);
  assert.equal(pct(base, 'left'), 5);
  assert.equal(pct(base, 'max-width'), 70);
  assert.ok(Math.abs(MASTER * INSET / 100 + px(12) - 549.6) < 1e-9);
  assert.ok(Math.abs(MASTER * INSET / 100 + px(5) - 474) < 1e-9);
  assert.ok(Math.abs(px(70) - 756) < 1e-9);
});

test('caption sits where the safe-square arithmetic says on the master', () => {
  const base = rule(css('caption'), '.nn-caption');
  const px = (p) => (p / 100) * SAFE;
  assert.equal(pct(base, 'bottom'), 10);
  assert.equal(pct(base, 'right'), 5);
  assert.equal(pct(base, 'max-width'), 60);
  assert.ok(Math.abs(MASTER * INSET / 100 + px(10) - 528) < 1e-9);
  assert.ok(Math.abs(MASTER * INSET / 100 + px(5) - 474) < 1e-9);
  assert.ok(Math.abs(px(60) - 648) < 1e-9);
});
