import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
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

test('a missing thumbnail is skipped by the pure builder, not fatal', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'draft-html-'));
  const draft = { slug: 'demo', title: 'Demo', media: [{ id: 'm1', thumb: 'missing.jpg' }], scenes: [] };
  const html = buildDraftHtml(draft, { baseDir: dir, templatePath: TEMPLATE, seriesTitle: 'S' });
  assert.ok(html.length > 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- Media gate (issue #429): the CLI never builds the console over missing evidence ----

const SCRIPT = path.join(__dirname, '..', 'scripts', 'build-draft-html.mjs');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'draft-html-gate-'));
}

function touch(dir, rel) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, Buffer.from('fake-bytes'));
}

function runCli(media, files = []) {
  const dir = tmpDir();
  for (const f of files) touch(dir, f);
  const json = path.join(dir, 'draft.json');
  fs.writeFileSync(json, JSON.stringify({ slug: 'demo', title: 'Demo', media, scenes: [] }));
  const r = spawnSync(process.execPath, [SCRIPT, json], { encoding: 'utf8' });
  const wroteHtml = fs.readdirSync(dir).some((f) => f.endsWith('.html'));
  fs.rmSync(dir, { recursive: true, force: true });
  return { ...r, wroteHtml };
}

test('gate: a missing media file or thumbnail exits 1, names every file and writes no HTML', () => {
  const r = runCli([
    { id: 'a', path: 'media/gone.png', thumb: 'thumbs/gone.jpg' },
    { id: 'b', path: 'media/ok.png' },
  ], ['media/ok.png']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /gone\.png/);
  assert.match(r.stderr, /thumbs[\\/]gone\.jpg/);
  assert.doesNotMatch(r.stderr, /ok\.png/);
  assert.equal(r.wroteHtml, false);
});

test('gate: with every file present, or no media declared, the console is written', () => {
  assert.equal(runCli([{ id: 'm1', path: 'media/a.png' }], ['media/a.png']).wroteHtml, true);
  assert.equal(runCli([]).wroteHtml, true);
});

test('gate: a missing thumbnail is tolerated when its inline copy is embedded', () => {
  const r = runCli([{ id: 'm1', path: 'media/a.png', thumb: 'missing.jpg', thumbB64: 'AAAA' }], ['media/a.png']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.wroteHtml, true);
});

// ---- Fixed file names: no slug, no version tag, no legacy alias ----

test('the CLI reads draft.json and reviewed.json and writes only review_console.html', () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, 'draft.json'), JSON.stringify({ slug: 'demo', version: 'v3', title: 'Demo', media: [], scenes: [] }));
  fs.writeFileSync(path.join(dir, 'reviewed.json'), JSON.stringify({ slug: 'demo', title: 'Demo', scenes: [] }));
  const r = spawnSync(process.execPath, [SCRIPT, path.join(dir, 'draft.json')], { encoding: 'utf8' });
  const files = fs.readdirSync(dir).sort();
  const html = fs.existsSync(path.join(dir, 'review_console.html')) ? fs.readFileSync(path.join(dir, 'review_console.html'), 'utf8') : '';
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(files, ['draft.json', 'review_console.html', 'reviewed.json']);
  assert.match(html, /video-script\.draft\.reviewed\.v1/);
  assert.doesNotMatch(r.stdout, /alias/i);
});

test('the console downloads use the fixed names', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(html, /suggestedName = 'review_console\.html'/);
  assert.match(html, /const name = "reviewed\.json"/);
  assert.doesNotMatch(html, /DRAFT\.slug \+ ['"]_(review_console|reviewed)/);
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


// ---- Review console: HyperFrames animation tiers (issues #426, #427) ----

const TIER_ORDER = ['ALTA', 'MEDIA', 'RÁPIDA'];

function loadFn(name, nextMarker, ...params) {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const start = html.indexOf(`function ${name}(`);
  const end = html.indexOf(nextMarker, start);
  assert.ok(start > 0 && end > start, `${name} must be present in the template`);
  return new Function(...params, html.slice(start, end) + `\nreturn ${name};`);
}

function cssRule(html, selector) {
  const i = html.indexOf(selector + ' {');
  assert.ok(i >= 0, `CSS rule ${selector} must exist`);
  return html.slice(i, html.indexOf('}', i));
}

test('procedural animation options never fall back to a raster thumbnail', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const start = html.indexOf('(rawSc.animations || []).forEach');
  const block = html.slice(start, html.indexOf('});', start));
  assert.match(block, /thumb:\s*null/);
  assert.doesNotMatch(block, /thumbs\[/);
  assert.doesNotMatch(html, /captura_\d+/);
});

test('tier colours: ALTA violet/magenta, MEDIA blue/cyan, RÁPIDA emerald, on card badge, thumbnail and lightbox badge', () => {
  const html = fs.readFileSync(TEMPLATE, 'utf8');
  const violet = /#7c3aed|#a855f7|#ec4899/i;
  const blue = /#2563eb|#38bdf8|#0891b2|#06b6d4/i;
  const emerald = /#059669|#10b981/i;
  for (const prefix of ['.badge-tier', '.visual-thumb-motion.tier', '.stage-badge-tag.tier']) {
    assert.match(cssRule(html, `${prefix}-alta`), violet, `${prefix}-alta`);
    assert.match(cssRule(html, `${prefix}-media`), blue, `${prefix}-media`);
    assert.match(cssRule(html, `${prefix}-rapida`), emerald, `${prefix}-rapida`);
  }
});

function fakeLightboxDom() {
  const mk = () => ({ style: {}, textContent: '', src: 'stale.png', className: '', classList: { add() {}, remove() {} } });
  const els = {};
  for (const id of ['modal-lightbox', 'lightbox-img', 'lightbox-title', 'lightbox-motion-stage', 'stage-tier-badge', 'stage-title', 'lightbox-storyboard', 'storyboard-desc', 'storyboard-specs', 'storyboard-structured']) els[id] = mk();
  return { els, document: { getElementById: (id) => els[id] || null } };
}

test('lightbox isolates raster images from HyperFrames options', () => {
  const { els, document } = fakeLightboxDom();
  const openLightbox = loadFn('openLightbox', 'function closeLightbox', 'document')(document);
  openLightbox('data:image/png;base64,AAA', 'shot', '', '', false, 'MEDIA');
  assert.equal(els['lightbox-img'].style.display, 'block');
  assert.equal(els['lightbox-img'].src, 'data:image/png;base64,AAA');
  assert.equal(els['lightbox-motion-stage'].style.display, 'none');
  assert.equal(els['lightbox-storyboard'].style.display, 'none');

  const sb = encodeURIComponent(JSON.stringify({ camera: ['slow push-in'], choreography: ['title lands'], timeline: { duration_s: 4, ease: 'power3.inOut', fps: 30 } }));
  openLightbox('data:image/png;base64,AAA', 'motion', 'desc', 'specs', true, 'RÁPIDA', sb);
  assert.equal(els['lightbox-img'].style.display, 'none');
  assert.equal(els['lightbox-img'].src, '');
  assert.equal(els['lightbox-motion-stage'].style.display, 'flex');
  assert.equal(els['lightbox-storyboard'].style.display, 'block');
  assert.match(els['stage-tier-badge'].className, /tier-rapida/);
  const text = els['storyboard-structured'].textContent;
  assert.match(text, /slow push-in/);
  assert.match(text, /title lands/);
  assert.match(text, /power3\.inOut/);
});

test('every animated scene is normalised to exactly the 3 tiers with structured storyboards', async () => {
  const { normalizeAnimationTiers } = await import('../scripts/build-draft-html.mjs');
  const draft = {
    scenes: [
      { slug: 'a', name: 'A', animations: [{ id: 'a-motion', label: 'Cookie box', prompt: 'A cookie box opens' }] },
      { slug: 'b', name: 'B', animations: [
        { id: 'b-hi', label: 'Hi', tier: 'ALTA', prompt: 'authored', storyboard: { camera: ['orbit'], choreography: ['x'], timeline: { duration_s: 6 } } },
        { id: 'b-fast', label: 'Fast', tier: 'RAPIDA', prompt: 'quick' },
      ] },
      { slug: 'c', name: 'C', animations: [] },
      { slug: 'd', name: 'D', kind: 'fixed' },
    ],
  };
  const out = normalizeAnimationTiers(draft);
  for (const slug of ['a', 'b']) {
    const sc = out.scenes.find((s) => s.slug === slug);
    assert.deepEqual(sc.animations.map((x) => x.tier), TIER_ORDER, slug);
    assert.equal(new Set(sc.animations.map((x) => x.id)).size, 3, 'ids unique');
    for (const an of sc.animations) {
      assert.ok(an.storyboard.camera.length > 0, 'camera movements');
      assert.ok(an.storyboard.choreography.length > 0, 'choreography');
      assert.ok(an.storyboard.timeline.duration_s > 0 && an.storyboard.timeline.ease && an.storyboard.timeline.fps, 'timeline params');
      assert.equal(an.thumb, undefined, 'no raster thumb');
    }
  }
  // authored data is preserved, not overwritten
  const b = out.scenes.find((s) => s.slug === 'b').animations;
  assert.equal(b[0].id, 'b-hi');
  assert.deepEqual(b[0].storyboard.camera, ['orbit']);
  assert.equal(b[2].tier, 'RÁPIDA');
  assert.equal(b[2].id, 'b-fast');
  // a lone untiered authored option is kept (as MEDIA) and its siblings derive from it
  const a = out.scenes.find((s) => s.slug === 'a').animations;
  assert.equal(a[1].id, 'a-motion');
  assert.match(a[0].label, /Cookie box/);
  // scenes without animations are untouched; input is not mutated
  assert.deepEqual(out.scenes.find((s) => s.slug === 'c').animations, []);
  assert.equal(out.scenes.find((s) => s.slug === 'd').animations, undefined);
  assert.equal(draft.scenes[0].animations.length, 1);
  assert.equal(normalizeAnimationTiers(out).scenes[0].animations.length, 3, 'idempotent');
});

test('buildDraftHtml embeds the 3 tiers for an animated scene', () => {
  const draft = { slug: 'demo', title: 'Demo', media: [], scenes: [{ slug: 's', name: 'S', animations: [{ id: 'm', label: 'One' }] }] };
  const html = buildDraftHtml(draft, { baseDir: os.tmpdir(), templatePath: TEMPLATE, seriesTitle: 'S' });
  const m = /<script id="raw-draft-data" type="application\/json">([\s\S]*?)<\/script>/.exec(html);
  const embedded = JSON.parse(m[1]);
  assert.deepEqual(embedded.scenes[0].animations.map((a) => a.tier), TIER_ORDER);
});

test('tier recognition tolerates whitespace, casing and a descriptive suffix', async () => {
  const { normalizeAnimationTiers } = await import('../scripts/build-draft-html.mjs');
  const run = (animations) =>
    normalizeAnimationTiers({ scenes: [{ slug: 's', animations }] }).scenes[0].animations;

  const padded = run([{ id: 'a', tier: 'alta ' }]);
  assert.equal(padded.find((x) => x.tier === 'ALTA').id, 'a', 'padded "alta " stays the ALTA option');

  const mixed = run([{ id: 'a', tier: 'ALTA (3D)' }, { id: 'b', tier: 'media' }]);
  assert.equal(mixed.find((x) => x.tier === 'ALTA').id, 'a', 'authored ALTA with a suffix is kept');
  assert.equal(mixed.find((x) => x.tier === 'MEDIA').id, 'b');
});

test('discarding an authored option is reported, not silent', async () => {
  const { normalizeAnimationTiers } = await import('../scripts/build-draft-html.mjs');
  const warnings = [];
  const orig = console.warn;
  console.warn = (m) => warnings.push(String(m));
  try {
    normalizeAnimationTiers({ scenes: [{ slug: 's', animations: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] }] });
  } finally {
    console.warn = orig;
  }
  assert.ok(warnings.some((w) => /b/.test(w) && /discard/i.test(w)), 'names a discarded option');
});

test('malformed input degrades instead of throwing', async () => {
  const { normalizeAnimationTiers } = await import('../scripts/build-draft-html.mjs');
  assert.deepEqual(normalizeAnimationTiers(null).scenes, []);
  const out = normalizeAnimationTiers({ scenes: [{ animations: [null, { label: 'x' }] }] }).scenes[0].animations;
  assert.equal(out.length, 3);
  assert.ok(out.every((x) => !/undefined/.test(x.id)), 'no "undefined" in generated ids');
});

test('authored storyboard fields are coerced to arrays and defaults are not shared', async () => {
  const { normalizeAnimationTiers } = await import('../scripts/build-draft-html.mjs');
  const a = normalizeAnimationTiers({ scenes: [{ slug: 's', animations: [{ id: 'a', tier: 'MEDIA', storyboard: { camera: 'pan', choreography: 7 } }] }] }).scenes[0].animations;
  const sb = a.find((x) => x.tier === 'MEDIA').storyboard;
  assert.ok(Array.isArray(sb.camera) && Array.isArray(sb.choreography));
  assert.deepEqual(sb.camera, ['pan']);

  const x = normalizeAnimationTiers({ scenes: [{ slug: 's', animations: [{ id: 'a' }] }] }).scenes[0].animations[0];
  x.storyboard.camera.push('mutated');
  const y = normalizeAnimationTiers({ scenes: [{ slug: 's', animations: [{ id: 'a' }] }] }).scenes[0].animations[0];
  assert.ok(!y.storyboard.camera.includes('mutated'), 'defaults are copied per call');
});
