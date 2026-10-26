import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScript, loadSeriesConfig, applySeriesTokens, DEFAULT_SERIES_CONFIG } from '../scripts/build-script-from-draft.mjs';

const reviewed = {
  slug: 'demo',
  title: 'Demo',
  sources: ['src_a'],
  config: { effective: {} },
  overlays: [{ id: 'watermark', type: 'watermark', text: 'generado con IA', position: 'bottom', default: true }],
  scenes: [
    { slug: '00-gancho', name: '00 Gancho', narration: 'Hook words here', choice: { type: 'avatar', model: 'pruna-ai/p-video-2-pro/avatar', quality: 'ALTA' } },
    { slug: '01-intro', name: '01 Intro', kind: 'fixed' },
    { slug: '02-noticia', name: '02 Noticia', narration: 'Body words here', choice: { type: 'animation' } },
  ],
};
const draft = { scenes: reviewed.scenes };
const cfg = { ...DEFAULT_SERIES_CONFIG, series: 'acme', templateFull: '[[acme :: Full]]', templateSection: '[[acme :: Section]]' };

test('the series config drives templates and the parent spec', () => {
  const md = buildScript(reviewed, draft, cfg);
  assert.match(md, /template:: \[\[acme :: Full\]\]/);
  assert.match(md, /template:: \[\[acme :: Section\]\]/);
  assert.match(md, /name: "acme_V_0-1-0"/);
  assert.match(md, /url: "series\/acme\/spec_NN\.md"/);
});

test('the script filename is series-parameterized', () => {
  assert.equal(applySeriesTokens(cfg, 'demo').scriptFilename, 'demo_video-script_acme_NN.md');
});

test('a fixed scene has no narration and no default overlays', () => {
  const md = buildScript(reviewed, draft, cfg);
  const intro = md.split('## NN Scene: 01 Intro')[1].split('## NN Scene: 02 Noticia')[0];
  assert.doesNotMatch(intro, /Hook words|Body words/);
  assert.doesNotMatch(intro, /type:: watermark/);
});

test('an avatar scene carries a presenter layer and its model', () => {
  const md = buildScript(reviewed, draft, cfg);
  assert.match(md, /type:: presenter/);
  assert.match(md, /model:: pruna-ai\/p-video-2-pro\/avatar/);
});

test('an animation scene references its media clip', () => {
  const md = buildScript(reviewed, draft, cfg);
  assert.match(md, /asset:: media\/02-noticia_animacion_1080x1080\.mp4/);
});

test('the default watermark overlay applies to non-fixed scenes', () => {
  const md = buildScript(reviewed, draft, cfg);
  const body = md.split('## NN Scene: 02 Noticia')[1];
  assert.match(body, /type:: watermark/);
  assert.match(body, /text:: generado con IA/);
});

test('loadSeriesConfig falls back to neutral defaults', () => {
  const c = loadSeriesConfig(['x.json']);
  assert.equal(c.series, DEFAULT_SERIES_CONFIG.series);
  assert.equal(c.templateFull, DEFAULT_SERIES_CONFIG.templateFull);
});
