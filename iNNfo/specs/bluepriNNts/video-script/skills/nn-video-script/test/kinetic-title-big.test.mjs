import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveKineticTitleLayout,
  DEFAULT_HEADING_SIZE,
  DEFAULT_SUBHEADING_SIZE,
} from '../scripts/scene/kinetic-title-layout.mjs';

describe('resolveKineticTitleLayout', () => {
  it('keeps the historical look when no size or anchor is configured', () => {
    const l = resolveKineticTitleLayout({ heading: 'A', subheading: 'B', theme: 'dark' });
    assert.equal(l.headingSize, 88);
    assert.equal(l.subheadingSize, 40);
    assert.equal(DEFAULT_HEADING_SIZE, 88);
    assert.equal(DEFAULT_SUBHEADING_SIZE, 40);
    assert.equal(l.justifyContent, 'center');
    assert.equal(l.textShadow, undefined);
    assert.equal(l.maxWidth, undefined);
    assert.equal(l.textWrap, undefined);
    assert.equal(l.big, false);
  });

  it('uses configured sizes, adds a legible shadow and a wrapping width cap', () => {
    const l = resolveKineticTitleLayout({ headingSize: 120, subheadingSize: '60' });
    assert.equal(l.headingSize, 120);
    assert.equal(l.subheadingSize, 60);
    assert.equal(l.big, true);
    assert.match(l.textShadow, /rgba\(0,\s*0,\s*0/);
    assert.equal(l.maxWidth, '92%');
    assert.equal(l.textWrap, 'balance');
  });

  it('ignores invalid sizes and clamps absurd ones', () => {
    assert.equal(resolveKineticTitleLayout({ headingSize: 'big' }).headingSize, 88);
    assert.equal(resolveKineticTitleLayout({ headingSize: -5 }).headingSize, 88);
    assert.equal(resolveKineticTitleLayout({ headingSize: 0 }).headingSize, 88);
    assert.equal(resolveKineticTitleLayout({ headingSize: 99999 }).headingSize, 400);
    assert.equal(resolveKineticTitleLayout({ headingSize: 99999 }).big, true);
  });

  it('maps the anchor to a vertical position and ignores unknown values', () => {
    assert.equal(resolveKineticTitleLayout({ anchor: 'top' }).justifyContent, 'flex-start');
    assert.equal(resolveKineticTitleLayout({ anchor: 'bottom' }).justifyContent, 'flex-end');
    assert.equal(resolveKineticTitleLayout({ anchor: 'center' }).justifyContent, 'center');
    assert.equal(resolveKineticTitleLayout({ anchor: 'sideways' }).justifyContent, 'center');
  });
});
