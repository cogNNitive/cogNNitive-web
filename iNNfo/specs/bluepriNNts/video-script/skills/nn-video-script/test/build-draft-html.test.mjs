import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDraftHtml } from '../scripts/build-draft-html.mjs';
import { buildScript } from '../scripts/build-script-from-draft.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE = path.join(__dirname, '..', 'scripts', 'draft-template.html');

test('the draft HTML is self-contained and substitutes the series title', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-html-'));
  const thumb = path.join(dir, 'thumb.jpg');
  fs.writeFileSync(thumb, Buffer.from('fake-jpg-bytes'));
  const draft = { schema: 'video-script.draft.v1', slug: 'demo', title: 'Demo', media: [{ id: 'm1', thumb: 'thumb.jpg' }], scenes: [] };
  const html = buildDraftHtml(draft, { baseDir: dir, templatePath: TEMPLATE, seriesTitle: 'Mi Serie' });
  assert.match(html, /data:image\/jpeg;base64,/);
  assert.match(html, /Mi Serie/);
  assert.doesNotMatch(html, /\{\{SERIES\}\}/);
  assert.doesNotMatch(html, /\/\*__DRAFT_JSON__\*\/|\/\*__THUMBS_JSON__\*\//);
  assert.match(html, /video-script\.draft\.reviewed\.v1/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a missing thumbnail is skipped, not fatal', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-html-'));
  const draft = { slug: 'demo', title: 'Demo', media: [{ id: 'm1', thumb: 'missing.jpg' }], scenes: [] };
  const html = buildDraftHtml(draft, { baseDir: dir, templatePath: TEMPLATE, seriesTitle: 'S' });
  assert.ok(html.length > 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

// Coupling: the export logic is inline in the template, so we slice buildReviewed out by text markers; keep them in sync.
// The export logic lives inline in the template; evaluate just `buildReviewed` against stub state.
function loadBuildReviewed() {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const start = html.indexOf('function buildReviewed()');
  const end = html.indexOf('function download(', start);
  assert.ok(start > 0 && end > start, 'buildReviewed must be present in the template');
  return new Function('DRAFT', 'state', 'sceneNarration', html.slice(start, end) + '\nreturn buildReviewed();');
}

test('the reviewed export keeps fixed scenes in order and builds without --draft', () => {
  const DRAFT = {
    slug: 'demo', version: 'v1', title: 'Demo', sources: [], config: [], avatars: [], media: [],
    scenes: [
      { slug: '00-gancho', name: '00 Gancho', narration: 'Hook', overlays: [{ id: 'o1', type: 'caption', text: 'proposed' }] },
      { slug: '01-intro', name: '01 Intro', kind: 'fixed' },
      { slug: '02-cuerpo', name: '02 Cuerpo', narration: 'Body', overlays: [] },
    ],
  };
  const state = {
    config: {}, overlays: {}, choices: {},
    sceneOverlays: { '00-gancho': { o1: { text: 'edited' } }, '02-cuerpo': {} },
  };
  const reviewed = loadBuildReviewed()(DRAFT, state, (sc) => sc.narration);

  assert.deepEqual(reviewed.scenes.map((s) => s.slug), ['00-gancho', '01-intro', '02-cuerpo']);
  assert.equal(reviewed.scenes[1].kind, 'fixed');
  assert.equal(reviewed.scenes[1].narration, undefined);

  const md = buildScript(reviewed, null, { bags: {}, frontmatter: '' });
  assert.match(md, /## NN Scene: 01 Intro/);
  assert.match(md, /slug:: 01-intro-background/);
  assert.match(md, /text:: edited/);
  assert.doesNotMatch(md, /text:: proposed/);
});
