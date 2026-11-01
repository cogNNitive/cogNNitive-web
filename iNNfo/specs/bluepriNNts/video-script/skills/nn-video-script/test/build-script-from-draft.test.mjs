/**
 * nn-video-script/test/build-script-from-draft.test.mjs
 *
 * The draft tools read every series value from the parameter cascade (series →
 * domain Video Defaults → package Video Defaults) and never from a side config
 * (design D10/D11, slice S5). No `video.series.json`, no `--config`, no built-in
 * series defaults, no `00-gancho` branch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildScript,
  scriptFilename,
  extractFrontmatter,
  loadSeriesDocument,
} from '../scripts/build-script-from-draft.mjs';

const SERIES_CONTENT = `---
level: 3
parent_spec:
  name: "video-script_V_0-9-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Other Series"
---

# NN Series

## NN Series: Other Series
slug:: other-series
title:: Other Series
avatar:: media/presenter.png
intro:: media/intro.mp4
`;

// The cascade bags: the series document supplies the values the tool reads.
const bags = {
  series: {
    slug: 'other-series',
    title: 'Other Series',
    avatar: 'media/presenter.png',
    intro: 'media/intro.mp4',
    transition: 'fade',
    background_audio: 'series-music.mp3',
    background_audio_volume: '0.4',
  },
  blueprint: { background_audio_volume: '0.2', transition: 'none' },
};

const reviewed = {
  slug: 'demo',
  title: 'Demo',
  sources: ['src_a'],
  overlays: [{ id: 'watermark', type: 'watermark', text: 'generated with AI', position: 'bottom', default: true }],
  scenes: [
    { slug: '00-gancho', name: '00 Gancho', narration: 'Hook words here', choice: { type: 'avatar', model: 'pruna-ai/p-video-2-pro/avatar', quality: 'ALTA', resolution: '768p' } },
    { slug: '01-intro', name: '01 Intro', kind: 'fixed' },
    { slug: '02-noticia', name: '02 Noticia', narration: 'Body words here', choice: { type: 'animation', asset: 'media/anim-demo' } },
  ],
};
const draft = {
  scenes: [
    { slug: '00-gancho', name: '00 Gancho', presets: ['Lucas', 'Full'] },
    { slug: '01-intro', name: '01 Intro', kind: 'fixed' },
    { slug: '02-noticia', name: '02 Noticia' },
  ],
};

function build(rev = reviewed, dr = draft) {
  return buildScript(rev, dr, { bags, frontmatter: extractFrontmatter(SERIES_CONTENT) });
}

test('the intro asset comes from the cascade and the presenter carries no literal asset', () => {
  const md = build();
  assert.match(md, /asset:: media\/intro\.mp4/);
  // A presenter Layer takes its image from the cascaded `avatar` (design D7),
  // so the tool never writes a literal presenter asset.
  const hook = md.split('## NN Scene: 00 Gancho')[1].split('## NN Scene: 01 Intro')[0];
  assert.doesNotMatch(hook, /asset:: media\/presenter\.png/);
});

test('the script filename uses the Series slug', () => {
  assert.equal(scriptFilename('other-series', 'demo'), 'demo_video-script_other-series_NN.md');
});

test('the frontmatter is copied from the series document', () => {
  const md = build();
  const fm = extractFrontmatter(SERIES_CONTENT);
  assert.ok(md.startsWith('---\n' + fm + '\n---'), 'frontmatter must be the series document frontmatter verbatim');
  assert.match(md, /name: "video-script_V_0-9-0"/);
});

test('no cascaded scene line is written', () => {
  const md = build();
  assert.doesNotMatch(md, /^background_audio:: /m);
  assert.doesNotMatch(md, /^background_audio_volume:: /m);
  assert.doesNotMatch(md, /^transition:: /m);
  assert.doesNotMatch(md, /^fit:: /m);
  // The series/blueprint values must never leak into the script.
  assert.doesNotMatch(md, /series-music\.mp3/);
  assert.doesNotMatch(md, /\[\[Blueprint :: Section\]\]/);
});

test('a presets list that exists only on the draft scene is not written: the console selector is the only source', () => {
  const md = build();
  assert.doesNotMatch(md, /presets::/);
});

test('the reviewed scene presets list is written in the author order', () => {
  const rev = structuredClone(reviewed);
  rev.scenes[0].sceneOverrides = { presets: ['Studio Warm', 'Lucas'] };
  const md = build(rev);
  const hook = md.split('## NN Scene: 00 Gancho')[1].split('## NN Scene: 01 Intro')[0];
  assert.match(hook, /presets:: \[Studio Warm, Lucas\]/);
  const body = md.split('## NN Scene: 02 Noticia')[1];
  assert.doesNotMatch(body, /presets::/);
});

test('the reviewed video-level presets list is written on the video, absent means no line', () => {
  const rev = structuredClone(reviewed);
  rev.videoOverrides = { presets: ['Lucas', 'Studio Warm'] };
  const md = build(rev);
  const video = md.split('# NN Scene')[0];
  assert.match(video, /^presets:: \[Lucas, Studio Warm\]$/m);
  assert.doesNotMatch(build().split('# NN Scene')[0], /presets::/);
  rev.videoOverrides = { presets: [] };
  assert.doesNotMatch(build(rev).split('# NN Scene')[0], /presets::/);
});

test('a presets value that is not a list fails loudly, at video and scene level', () => {
  const sceneBad = structuredClone(reviewed);
  sceneBad.scenes[0].sceneOverrides = { presets: 'Lucas' };
  assert.throws(() => build(sceneBad), /presets/);
  const videoBad = structuredClone(reviewed);
  videoBad.videoOverrides = { presets: '[[Doc :: Lucas]]' };
  assert.throws(() => build(videoBad), /presets/);
});

test('the avatar layer uses the renamed avatar_model field', () => {
  const md = build();
  assert.match(md, /avatar_model:: pruna-ai\/p-video-2-pro\/avatar/);
  // The chosen resolution is written whatever the draft's quality label was: it
  // used to be dropped for anything but ALTA, silently changing what was billed.
  assert.match(md, /avatar_resolution:: 768p/);
  assert.doesNotMatch(md, /(?:^|\n)model:: /);
});

test('a fixed scene has no narration and no default overlays', () => {
  const md = build();
  const intro = md.split('## NN Scene: 01 Intro')[1].split('## NN Scene: 02 Noticia')[0];
  assert.doesNotMatch(intro, /Hook words|Body words/);
  assert.doesNotMatch(intro, /type:: watermark/);
});

test('the default watermark overlay applies to non-fixed scenes', () => {
  const md = build();
  const body = md.split('## NN Scene: 02 Noticia')[1];
  assert.match(body, /type:: watermark/);
  assert.match(body, /text:: generated with AI/);
});

test('an animation choice emits a type:: animation Layer with the authored project asset', () => {
  const md = build();
  const body = md.split('## NN Scene: 02 Noticia')[1];
  assert.match(body, /type:: animation/);
  assert.match(body, /asset:: media\/anim-demo/);
  assert.doesNotMatch(md, /_animacion_/);
});

test('an animation choice without an asset falls back to a media/<slug> project directory', () => {
  const rev = {
    ...reviewed,
    scenes: [{ slug: '03-outro', name: '03 Outro', narration: 'Bye', choice: { type: 'animation' } }],
  };
  const md = build(rev, null);
  const body = md.split('## NN Scene: 03 Outro')[1];
  assert.match(body, /type:: animation/);
  assert.match(body, /asset:: media\/03-outro/);
});

test('without --draft the reviewed scenes stand alone and no template is invented', () => {
  const md = build(reviewed, null);
  assert.match(md, /## NN Scene: 00 Gancho/);
  assert.doesNotMatch(md, /template::/);
});

// A draft scene carries its own proposed overlays; the reviewed scene is the decision.
const withOverlays = (scenes) => ({ ...reviewed, overlays: [], scenes });
const reviewedOvl = withOverlays([
  { slug: '00-gancho', name: '00 Gancho', narration: 'Hook words here', choice: { type: 'avatar', model: 'm', quality: 'ALTA' }, overlays: [{ id: 'kept', type: 'caption', text: 'reviewed text', position: 'top' }] },
  { slug: '01-intro', name: '01 Intro', kind: 'fixed' },
  { slug: '02-noticia', name: '02 Noticia', kind: 'scene', narration: 'Body words here', choice: { type: 'animation' }, overlays: [] },
]);
const draftOvl = {
  scenes: [
    { slug: '00-gancho', name: '00 Gancho', overlays: [{ id: 'proposed', type: 'caption', text: 'draft text', position: 'bottom' }] },
    { slug: '01-intro', name: '01 Intro', kind: 'fixed' },
    { slug: '02-noticia', name: '02 Noticia', overlays: [{ id: 'proposed2', type: 'caption', text: 'draft only', position: 'bottom' }] },
  ],
};

test('with --draft, per-scene overlays come from the reviewed scene, not the draft', () => {
  const md = build(reviewedOvl, draftOvl);
  assert.match(md, /text:: reviewed text/);
  assert.doesNotMatch(md, /draft text|draft only/);
});

test('overlay output is identical with and without --draft', () => {
  assert.equal(build(reviewedOvl, draftOvl), build(reviewedOvl, null));
});

test('a reviewed scene without an overlays key yields no overlays, with or without --draft', () => {
  const rev = withOverlays([{ slug: '02-noticia', name: '02 Noticia', narration: 'Body', choice: { type: 'animation' } }]);
  const dr = { scenes: [{ slug: '02-noticia', name: '02 Noticia', overlays: [{ id: 'p', type: 'caption', text: 'draft proposal', position: 'bottom' }] }] };
  const md = build(rev, dr);
  assert.doesNotMatch(md, /draft proposal/);
  assert.equal(md, build(rev, null));
});

test('loadSeriesDocument reads the slug, title and frontmatter from the scope document', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-series-'));
  fs.writeFileSync(path.join(dir, 'other-series_scope_NN.md'), SERIES_CONTENT, 'utf8');
  const series = loadSeriesDocument(dir);
  assert.equal(series.slug, 'other-series');
  assert.equal(series.title, 'Other Series');
  assert.equal(series.frontmatter, extractFrontmatter(SERIES_CONTENT));
  assert.equal(series.fields.avatar, 'media/presenter.png');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('no side config or hardcoded series leaks into the engine scripts', () => {
  const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts');
  const forbidden = /video\.series\.json|DEFAULT_SERIES_CONFIG|loadSeriesConfig|applySeriesTokens|00-gancho|--config|_animacion_/;
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(mjs|js|cjs)$/i.test(entry.name) && forbidden.test(fs.readFileSync(full, 'utf8'))) {
        offenders.push(path.relative(scriptsDir, full).split(path.sep).join('/'));
      }
    }
  };
  walk(scriptsDir);
  assert.deepEqual(offenders, [], `draft tools must read the cascade, not a config: ${offenders.join(', ')}`);
});

test('a fixed scene falls back to visual.asset or asset when cascade has no intro_asset', () => {
  const rev = {
    slug: 'demo-fixed',
    scenes: [
      { slug: '01-intro', name: '01 Intro', kind: 'fixed', asset: 'media/direct-fallback.mp4' },
    ],
  };
  const md = buildScript(rev, null, { bags: {}, frontmatter: '' });
  assert.match(md, /asset:: media\/direct-fallback\.mp4/);

  const revDraftVisual = {
    slug: 'demo-fixed-2',
    scenes: [
      { slug: '01-intro', name: '01 Intro', kind: 'fixed', visual: { asset: 'media/visual-fallback.mp4' } },
    ],
  };
  const md2 = buildScript(revDraftVisual, null, { bags: {}, frontmatter: '' });
  assert.match(md2, /asset:: media\/visual-fallback\.mp4/);
});


test('an episode with reviewed.json and no draft.json builds its script', async () => {
  const { spawnSync } = await import('node:child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewed-only-'));
  fs.writeFileSync(path.join(dir, 'reviewed.json'), JSON.stringify(reviewed));
  const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'build-script-from-draft.mjs');
  const r = spawnSync(process.execPath, [cli, path.join(dir, 'reviewed.json')], { encoding: 'utf8' });
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(files.length, 1);
  assert.match(files[0], /^demo_video-script_.+_NN\.md$/);
});
