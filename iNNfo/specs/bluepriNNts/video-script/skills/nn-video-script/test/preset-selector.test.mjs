/**
 * nn-video-script/test/preset-selector.test.mjs
 *
 * The review console offers ONE preset selector listing the Presets visible from
 * the script's lookup order, and exports the author's choice as an ordered
 * `presets` list (video-presets: "Console Draft Tool Offers One Preset Selector").
 * The names are computed in Node; the control is exercised in jsdom, which is
 * only a test-time dependency (the tests skip when it does not resolve).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildDraftHtml, visiblePresetNames } from '../scripts/build-draft-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '..', 'scripts', 'draft-template.html');
const CLI = path.join(__dirname, '..', 'scripts', 'build-draft-html.mjs');

const preset = (name, extra = '') => `## NN Preset: ${name}\nslug:: ${name.toLowerCase().replace(/\s+/g, '-')}\nvoice:: v\n${extra}\n`;
const scopeDoc = (title, presets) => `---\nlevel: 3\ntitle: "${title}"\nscope: true\n---\n\n# NN Series\n\n## NN Series: ${title}\n\n# NN Preset\n\n${presets.join('\n')}`;
const defaultsDoc = (presets) => `---\nlevel: 3\ntitle: "Video Defaults"\n---\n\n# NN Video Defaults\n\n## NN Video Defaults: Defaults\nslug:: defaults\n\n${presets.length ? '# NN Preset\n\n' + presets.join('\n') : ''}`;

/** A domaiNN with one Series scope document and a domain `video-defaults_NN.md`; returns the episode folder. */
function makeDomain({ series = [], domain = [] }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-preset-selector-'));
  const seriesDir = path.join(root, 'series', 'demo');
  const episode = path.join(seriesDir, 'ep-one');
  fs.mkdirSync(episode, { recursive: true });
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '---\ntitle: demo\n---\n\n# NN DomaiNN\n');
  fs.writeFileSync(path.join(root, 'video-defaults_NN.md'), defaultsDoc(domain));
  fs.writeFileSync(path.join(seriesDir, 'demo_scope_NN.md'), scopeDoc('Demo', series));
  return { root, episode };
}

function withDomain(options, fn) {
  const made = makeDomain(options);
  try {
    return fn(made);
  } finally {
    fs.rmSync(made.root, { recursive: true, force: true });
  }
}

const embeddedNames = (html) => JSON.parse(/<script id="raw-presets-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html)[1]);

test('the visible names follow the lookup order: Series first, then the domain, deeper wins, no duplicates', () => {
  withDomain({ series: [preset('Lucas'), preset('Shared')], domain: [preset('Studio Warm'), preset('shared')] }, ({ episode }) => {
    assert.deepEqual(visiblePresetNames(episode), ['Lucas', 'Shared', 'Studio Warm']);
  });
});

test('a folder with no visible Preset yields an empty list', () => {
  withDomain({}, ({ episode }) => {
    assert.deepEqual(visiblePresetNames(episode), []);
  });
});

test('the CLI embeds exactly the visible names in the console', () => {
  withDomain({ series: [preset('Lucas')], domain: [preset('Studio Warm')] }, ({ episode }) => {
    fs.writeFileSync(path.join(episode, 'draft.json'), JSON.stringify({ slug: 'demo', title: 'Demo', media: [], scenes: [] }));
    const r = spawnSync(process.execPath, [CLI, path.join(episode, 'draft.json')], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const html = fs.readFileSync(path.join(episode, 'review_console.html'), 'utf8');
    assert.deepEqual(embeddedNames(html), ['Lucas', 'Studio Warm']);
    assert.doesNotMatch(html, /__PRESET_NAMES_JSON__/);
  });
  withDomain({}, ({ episode }) => {
    fs.writeFileSync(path.join(episode, 'draft.json'), JSON.stringify({ slug: 'demo', title: 'Demo', media: [], scenes: [] }));
    assert.equal(spawnSync(process.execPath, [CLI, path.join(episode, 'draft.json')], { encoding: 'utf8' }).status, 0);
    assert.deepEqual(embeddedNames(fs.readFileSync(path.join(episode, 'review_console.html'), 'utf8')), []);
  });
});

test('the console has no per-kind selector', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.doesNotMatch(html, /character|environment|look-select/i);
  assert.doesNotMatch(html, /function presetName\(/);
});

// ---- The control and the export, driven in jsdom ----

let JSDOM = null;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  console.log('ℹ jsdom not resolvable; skipping the preset selector control tests');
}

const DRAFT = {
  slug: 'demo', title: 'Demo', config: [], avatars: [], media: [],
  scenes: [
    { slug: '00-a', name: '00 A', narration: 'Hook' },
    { slug: '01-b', name: '01 B', narration: 'Body' },
  ],
};

function openConsole({ names = ['Lucas', 'Studio Warm', 'Third'], draft = DRAFT, reviewed } = {}) {
  const html = buildDraftHtml(draft, { baseDir: os.tmpdir(), templatePath: TEMPLATE, seriesTitle: 'S', presetNames: names, reviewed });
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/' });
  const { window } = dom;
  const { document } = window;
  const pick = (scope, name) => document.querySelector(`[data-preset-scope="${scope}"] [data-preset-add="${encodeURIComponent(name)}"]`).click();
  const drop = (scope, name) => document.querySelector(`[data-preset-scope="${scope}"] [data-preset-remove="${encodeURIComponent(name)}"]`).click();
  const chips = (scope) => [...document.querySelectorAll(`[data-preset-scope="${scope}"] [data-preset-remove]`)].map((b) => decodeURIComponent(b.dataset.presetRemove));
  return { window, document, pick, drop, chips, /* plain objects: jsdom arrays live in another realm */ reviewed: () => JSON.parse(JSON.stringify(window.buildReviewed())), l3: () => window.generateL3Markdown() };
}

const jsdomTest = (name, fn) => test(name, { skip: JSDOM ? false : 'jsdom not resolvable' }, fn);

jsdomTest('one selector at video level offers the visible names and no other control', () => {
  const c = openConsole();
  const offered = [...c.document.querySelectorAll('[data-preset-scope="video"] [data-preset-add]')].map((b) => decodeURIComponent(b.dataset.presetAdd));
  assert.deepEqual(offered, ['Lucas', 'Studio Warm', 'Third']);
  assert.equal(c.document.querySelectorAll('[data-preset-scope="video"]').length, 1);
});

jsdomTest('selecting Lucas then Studio Warm exports presets in that order, and L3 writes the list', () => {
  const c = openConsole();
  c.pick('video', 'Lucas');
  c.pick('video', 'Studio Warm');
  assert.deepEqual(c.chips('video'), ['Lucas', 'Studio Warm']);
  assert.deepEqual(c.reviewed().videoOverrides.presets, ['Lucas', 'Studio Warm']);
  assert.match(c.l3(), /^presets:: \[Lucas, Studio Warm\]$/m);
});

jsdomTest('selection order is the click order, not the offered order', () => {
  const c = openConsole();
  c.pick('video', 'Studio Warm');
  c.pick('video', 'Lucas');
  assert.deepEqual(c.reviewed().videoOverrides.presets, ['Studio Warm', 'Lucas']);
});

jsdomTest('a chosen name is not offered again, so it cannot be added twice or reordered', () => {
  const c = openConsole();
  c.pick('video', 'Lucas');
  c.pick('video', 'Studio Warm');
  assert.equal(c.document.querySelector('[data-preset-scope="video"] [data-preset-add="Lucas"]'), null);
  assert.deepEqual(c.reviewed().videoOverrides.presets, ['Lucas', 'Studio Warm']);
});

jsdomTest('removing one name keeps the rest; clearing the control removes the key', () => {
  const c = openConsole();
  c.pick('video', 'Lucas');
  c.pick('video', 'Studio Warm');
  c.drop('video', 'Lucas');
  assert.deepEqual(c.reviewed().videoOverrides.presets, ['Studio Warm']);
  c.drop('video', 'Studio Warm');
  assert.equal('presets' in c.reviewed().videoOverrides, false);
  assert.doesNotMatch(c.l3(), /^presets::/m);
});

jsdomTest('the scene control is independent of the video control', () => {
  const c = openConsole();
  c.pick('video', 'Lucas');
  c.pick('00-a', 'Studio Warm');
  c.pick('00-a', 'Third');
  const rev = c.reviewed();
  assert.deepEqual(rev.videoOverrides.presets, ['Lucas']);
  assert.deepEqual(rev.scenes[0].sceneOverrides.presets, ['Studio Warm', 'Third']);
  assert.equal('presets' in rev.scenes[1].sceneOverrides, false);
  const l3 = c.l3();
  assert.match(l3, /slug:: 00-a\npresets:: \[Studio Warm, Third\]/);
  assert.match(l3, /^presets:: \[Lucas\]$/m);
});

jsdomTest('with no visible Preset the selector offers nothing and exports nothing', () => {
  const c = openConsole({ names: [] });
  assert.equal(c.document.querySelectorAll('[data-preset-add]').length, 0);
  assert.equal('presets' in c.reviewed().videoOverrides, false);
});

jsdomTest('a saved list is restored; a saved string is an inline error and is dropped, not coerced', () => {
  const ok = openConsole({ reviewed: { slug: 'demo', title: 'Demo', videoOverrides: { presets: ['Lucas'] }, scenes: [] } });
  assert.deepEqual(ok.chips('video'), ['Lucas']);

  const bad = openConsole({
    reviewed: { slug: 'demo', title: 'Demo', videoOverrides: { presets: '[[Doc :: Lucas]]' }, scenes: [{ slug: '00-a', sceneOverrides: { presets: 'Lucas' } }] },
  });
  assert.deepEqual(bad.chips('video'), []);
  assert.deepEqual(bad.chips('00-a'), []);
  assert.match(bad.document.querySelector('[data-preset-scope="video"] .preset-error').textContent, /presets/);
  assert.match(bad.document.querySelector('[data-preset-scope="00-a"] .preset-error').textContent, /presets/);
  const rev = bad.reviewed();
  assert.equal('presets' in rev.videoOverrides, false);
  assert.equal('presets' in rev.scenes[0].sceneOverrides, false);
});
