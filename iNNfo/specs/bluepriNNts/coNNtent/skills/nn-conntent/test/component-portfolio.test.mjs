/**
 * nn-conntent/test/component-portfolio.test.mjs
 *
 * A component is a folder `library/components/<name>/` holding `COMPONENT.md`,
 * `index.html` and `preview.mp4`; the frontmatter declares `name`, `slot`,
 * `variables` (objects), `duration` (>0 or scene), `aspect`, `source`
 * (`local` or pinned `registry:<item>@<ver>` with `license`) and `tokens`. The slot
 * contract (`assertSlotContract`) is kept: a component must declare a superset of
 * its slot's variables. (capability conntent-component-portfolio; task 2e.1 —
 * RED: no folder form.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateComponent, COMPONENT_DIR, isVendored } from '../scripts/lib/component-portfolio.mjs';
import { assertSlotContract } from '../scripts/overlay-blocks.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS_ROOT = path.resolve(here, '../../../library/components');

const BASE = {
  name: 'title-card',
  slot: 'title',
  duration: 3.2,
  aspect: '[16:9, 1:1]',
  source: 'local',
  tokens: '[colors.text]',
};

const DEFAULT_VARIABLES = [
  '  - { name: text, type: string, required: true }',
  '  - { name: subtitle, type: string, default: "" }',
];

const FRONT = (over = {}) => {
  const front = { ...BASE, ...(over || {}) };
  const variablesLines = front.variablesLines || DEFAULT_VARIABLES;
  const lines = ['---', `name: ${front.name}`, `slot: ${front.slot}`, 'variables:', ...variablesLines];
  for (const k of ['duration', 'aspect', 'source', 'tokens', 'license']) {
    if (front[k] !== undefined) lines.push(`${k}: ${front[k]}`);
  }
  lines.push('---', '', '# Title Card', '', '## When to use', '', 'Full-frame title overlays.', '', '## Variant prompt', '', 'A tighter, bottom-anchored title variant.');
  return lines.join('\n');
};

function tmpComponent({ over = {}, license = true } = {}) {
  const root = fs.mkdtempSync(path.join(process.env.TEMP || '/tmp', 'cmp-'));
  const dir = path.join(root, COMPONENT_DIR, 'title-card');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'COMPONENT.md'), FRONT(over), 'utf8');
  fs.writeFileSync(path.join(dir, 'index.html'), '<section data-slot="title"><h1 data-bind="text"></h1></section>', 'utf8');
  fs.writeFileSync(path.join(dir, 'preview.mp4'), 'mp4', 'utf8');
  if (license) fs.writeFileSync(path.join(dir, 'LICENSE'), 'MIT\n', 'utf8');
  return { root, dir };
}

test('validateComponent accepts the folder form with a local source', () => {
  const { root, dir } = tmpComponent();
  const c = validateComponent(dir);
  assert.equal(c.name, 'title-card');
  assert.equal(c.slot, 'title');
  assert.ok(Array.isArray(c.variables) && c.variables.some((v) => v.name === 'text' && v.required));
  assert.equal(c.source, 'local');
  assert.deepEqual(c.aspect.sort(), ['16:9', '1:1'].sort());
  assert.ok(fs.existsSync(path.join(dir, 'index.html')) && fs.existsSync(path.join(dir, 'preview.mp4')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('a vendored component requires a pinned version, a license key and a LICENSE file', () => {
  const { root, dir } = tmpComponent({ over: { source: 'registry:swiper@9.4.1', license: 'MIT' } });
  const c = validateComponent(dir);
  assert.equal(c.source, 'registry:swiper@9.4.1');
  assert.ok(isVendored(c.source));
  assert.ok(fs.existsSync(path.join(dir, 'LICENSE')), 'vendored items ship a LICENSE');
  fs.rmSync(root, { recursive: true, force: true });
});

test('an unpinned registry source fails', () => {
  const { root, dir } = tmpComponent({ over: { source: 'registry:swiper@latest', license: 'MIT' } });
  assert.throws(() => validateComponent(dir), /version/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a registry source without license fails', () => {
  const { root, dir } = tmpComponent({ over: { source: 'registry:swiper@9.4.1' } });
  assert.throws(() => validateComponent(dir), /license/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a package component without preview.mp4 fails', () => {
  const { root, dir } = tmpComponent();
  fs.rmSync(path.join(dir, 'preview.mp4'));
  assert.throws(() => validateComponent(dir), /preview\.mp4/);
  // Outside the package it only warns.
  const warned = [];
  const c = validateComponent(dir, { packageItem: false, warn: (m) => warned.push(m) });
  assert.ok(c.name === 'title-card');
  assert.ok(warned.some((m) => /preview/.test(m)));
  fs.rmSync(root, { recursive: true, force: true });
});

test('a required variable with a default fails', () => {
  const { root, dir } = tmpComponent({
    over: { variablesLines: ['  - { name: text, type: string, required: true, default: "x" }'] },
  });
  assert.throws(() => validateComponent(dir), /required variable/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('invalid aspect fails listing the accepted values', () => {
  const { root, dir } = tmpComponent({ over: { aspect: '[4:3]' } });
  assert.throws(() => validateComponent(dir), /16:9/i);
  fs.rmSync(root, { recursive: true, force: true });
});

test('the slot contract still rejects a component missing a slot variable', () => {
  assert.throws(
    () =>
      assertSlotContract('title', {
        path: 'x',
        html: '<section data-slot="title" data-composition-variables=\'[{"id":"title"}]\'></section>',
        contractHtml: '<section data-composition-variables=\'[{"id":"title"},{"id":"subtitle"}]\'></section>',
      }),
    (err) => {
      assert.equal(err.name, 'SlotContractError');
      return true;
    },
  );
});

// All packaged components validate (their COMPONENT.md is the definition of record).
test('every packaged component validates', () => {
  if (!fs.existsSync(COMPONENTS_ROOT)) {
    assert.ok(true, 'no packaged components yet (2e.2 not landed)');
    return;
  }
  for (const entry of fs.readdirSync(COMPONENTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(COMPONENTS_ROOT, entry.name);
    const c = validateComponent(dir);
    assert.ok(c.slot, `${entry.name} declares a slot`);
  }
});

// The package base set (capability conntent-component-portfolio "The Package Vendors
// A Pinned Base Set"; V5 fallback ships only the engine-authored items).
test('every packaged index.html is free of network URLs (hermetic render)', () => {
  if (!fs.existsSync(COMPONENTS_ROOT)) {
    assert.ok(true, 'no packaged components yet (2e.2 not landed)');
    return;
  }
  const urlRe = /(?:https?:)?\/\/|src="https?:/;
  for (const entry of fs.readdirSync(COMPONENTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const html = fs.readFileSync(path.join(COMPONENTS_ROOT, entry.name, 'index.html'), 'utf8');
    assert.doesNotMatch(html, urlRe, `${entry.name}/index.html must not reference the network`);
  }
});

test('engine-authored package items are local and need no LICENSE (V5 fallback)', () => {
  if (!fs.existsSync(COMPONENTS_ROOT)) return;
  const vendored = [];
  const locals = [];
  for (const entry of fs.readdirSync(COMPONENTS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const c = validateComponent(path.join(COMPONENTS_ROOT, entry.name));
    if (isVendored(c.source)) vendored.push(c);
    else locals.push(c);
    assert.equal(fs.existsSync(path.join(COMPONENTS_ROOT, entry.name, 'preview.mp4')), true, `${entry.name} ships preview.mp4`);
  }
  // The V.5 fallback decision ships only engine-authored items: everything is local.
  assert.deepEqual(vendored, [], 'no vendored registry item in the fallback set');
  assert.equal(locals.length, 6, 'the six engine-authored components ship');
});