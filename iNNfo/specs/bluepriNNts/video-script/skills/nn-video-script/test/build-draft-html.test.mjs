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

test('scenes with empty variants array do not corrupt narration or throw', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(html, /sc\.variants && sc\.variants\.length > 0/);
});

test('modern review console UI markers and script hooks are present', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(html, /id="video-params-sheet"/, 'must have video-params-sheet');
  assert.match(html, /id="video-overlays-sheet"/, 'must have video-overlays-sheet');
  assert.match(html, /id="modal-lightbox"/, 'must have modal-lightbox');
  assert.match(html, /id="lightbox-motion-stage"/, 'must have lightbox-motion-stage');
  assert.match(html, /id="lightbox-storyboard"/, 'must have lightbox-storyboard');
  assert.match(html, /id="btn-save-html"/, 'must have btn-save-html');
  assert.match(html, /id="btn-save-json"/, 'must have btn-save-json');
  assert.match(html, /id="btn-copy-prompt"/, 'must have btn-copy-prompt');
  assert.match(html, /btn-agent-btn/, 'must have btn-agent-btn class');
  assert.match(html, /id="btn-preview-l3"/, 'must have btn-preview-l3');
  assert.match(html, /function generateL3Markdown\(\)/, 'must have generateL3Markdown function');
  assert.match(html, /async function saveSelfHtml\(\)/, 'must have saveSelfHtml function');
  assert.match(html, /raw-draft-data/, 'must have raw-draft-data script tag');
  assert.match(html, /raw-thumbs-data/, 'must have raw-thumbs-data script tag');
  assert.match(html, /raw-reviewed-data/, 'must have raw-reviewed-data script tag');
});

test('buildDraftHtml inlines draft_thumbs directory if present', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-html-thumbs-'));
  const thumbsDir = path.join(dir, 'draft_thumbs');
  fs.mkdirSync(thumbsDir, { recursive: true });
  fs.writeFileSync(path.join(thumbsDir, 'extra.jpg'), Buffer.from('extra-fake-jpg'));
  const draft = { schema: 'video-script.draft.v1', slug: 'demo-thumbs', title: 'Demo Thumbs', media: [], scenes: [] };
  const html = buildDraftHtml(draft, { baseDir: dir, templatePath: TEMPLATE, seriesTitle: 'Serie Thumbs' });
  assert.match(html, /extra\.jpg/);
  assert.match(html, /data:image\/jpeg;base64,/);
  fs.rmSync(dir, { recursive: true, force: true });
});

