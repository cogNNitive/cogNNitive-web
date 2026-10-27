/**
 * nn-video-script/test/cascade.test.mjs
 *
 * RED→GREEN tests for scripts/lib/cascade.mjs: the one universal parameter
 * resolver (design D10/D13/D15/D16) plus its compiler integration. Migrated
 * from model-cascade.test.mjs (which only resolved model ids).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SCOPE_ORDER,
  resolve,
  resolveKeyed,
  loadCascadeBags,
  findBlueprintPackage,
  BlueprintPackageNotFoundError,
} from '../scripts/lib/cascade.mjs';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nn-cascade-'));
}

test('the scope order is the documented chain, ending at blueprint', () => {
  assert.deepEqual(SCOPE_ORDER, ['cli', 'layer', 'scene', 'video', 'series', 'domain', 'blueprint']);
});

test('the most specific level wins and the source is reported', () => {
  const bags = {
    cli: { fit: 'cli' },
    scene: { transition: 'fade', fit: 'scene' },
    video: { transition: 'slide-left' },
    series: { transition: 'wipe' },
    domain: { transition: 'none' },
    blueprint: { transition: 'fade' },
  };
  assert.deepEqual(resolve('fit', bags), { value: 'cli', source: 'cli' });
  assert.deepEqual(resolve('transition', bags), { value: 'fade', source: 'scene' });
});

test('empty or absent values are skipped', () => {
  const bags = { scene: { music: '   ' }, series: { music: 's.m4a' } };
  assert.deepEqual(resolve('music', bags), { value: 's.m4a', source: 'series' });
  assert.deepEqual(resolve('music', {}), { value: null, source: null });
});

test('resolveKeyed resolves a keyed list per key across levels', () => {
  const bags = {
    series: { sounds: '[overlay-enter.title=click]' },
    blueprint: { sounds: '[scene-boundary=whoosh, video-start=pop]' },
  };
  assert.deepEqual(resolveKeyed('sounds', 'overlay-enter.title', bags), { value: 'click', source: 'series' });
  assert.deepEqual(resolveKeyed('sounds', 'scene-boundary', bags), { value: 'whoosh', source: 'blueprint' });
  assert.deepEqual(resolveKeyed('sounds', 'missing', bags), { value: null, source: null });
});

test('resolveKeyed accepts object and array bags', () => {
  assert.deepEqual(resolveKeyed('components', 'title', { video: { components: { title: 'pill' } } }), {
    value: 'pill',
    source: 'video',
  });
  assert.deepEqual(resolveKeyed('components', 'b-roll', { series: { components: ['b-roll=card', 'title=pill'] } }), {
    value: 'card',
    source: 'series',
  });
});

test('findBlueprintPackage finds the repo, global and workspace layouts', () => {
  const root = tmp();
  const writeSpec = (dir) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'spec_NN.md'), '---\nblueprint_name: "video-script"\n---\n');
  };

  // Repo / in-package layout: <pkg>/skills/<skill> with <pkg>/spec_NN.md.
  const pkg = path.join(root, 'repo', 'video-script');
  writeSpec(pkg);
  const repSkill = path.join(pkg, 'skills', 'nn-video-script');
  assert.equal(findBlueprintPackage(repSkill), pkg);

  // Global install layout: <agents>/bluepriNNts/video-script, skill at <agents>/skills/<skill>.
  const agents = path.join(root, 'agents');
  const globalPkg = path.join(agents, 'bluepriNNts', 'video-script');
  writeSpec(globalPkg);
  const globalSkill = path.join(agents, 'skills', 'nn-video-script');
  assert.equal(findBlueprintPackage(globalSkill), globalPkg);

  // Workspace install layout: <ws>/specs/bluepriNNts/video-script, skill at <ws>/.agents/skills/<skill>.
  const ws = path.join(root, 'ws');
  const wsPkg = path.join(ws, 'specs', 'bluepriNNts', 'video-script');
  writeSpec(wsPkg);
  const wsSkill = path.join(ws, '.agents', 'skills', 'nn-video-script');
  assert.equal(findBlueprintPackage(wsSkill), wsPkg);

  fs.rmSync(root, { recursive: true, force: true });
});

test('findBlueprintPackage throws listing every path tried when none is found', () => {
  const root = tmp();
  const skill = path.join(root, 'lonely', 'skills', 'nn-video-script');
  fs.mkdirSync(skill, { recursive: true });
  assert.throws(
    () => findBlueprintPackage(skill),
    (err) => {
      assert.ok(err instanceof BlueprintPackageNotFoundError);
      assert.ok(err.message.includes(path.join('lonely', 'bluepriNNts', 'video-script')));
      return true;
    },
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadCascadeBags reads the series, domain and blueprint documents', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.git'), { recursive: true }); // workspace root marker
  fs.writeFileSync(path.join(root, 'video-defaults_NN.md'), defaultsDoc({ music_volume: '0.3' }));
  const series = path.join(root, 'series-a');
  const episode = path.join(series, 'ep-01');
  fs.mkdirSync(episode, { recursive: true });
  fs.writeFileSync(path.join(series, 'series_NN.md'), seriesDoc({ transition: 'fade' }));

  const bags = loadCascadeBags(episode);
  assert.equal(bags.series.transition, 'fade');
  assert.equal(bags.domain.music_volume, '0.3');
  // The blueprint level comes from the real package via findBlueprintPackage.
  assert.equal(bags.blueprint.music_volume, '0.2');
  assert.equal(bags.blueprint.transition, 'none');
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadCascadeBags skips the domain level when there is no domain document', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  const episode = path.join(root, 'ep-01');
  fs.mkdirSync(episode, { recursive: true });

  const bags = loadCascadeBags(episode);
  assert.equal(bags.domain, undefined);
  assert.equal(bags.series, undefined);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a script outside a series yields the domain level, never series', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  fs.writeFileSync(path.join(root, 'video-defaults_NN.md'), defaultsDoc({ transition: 'fade' }));
  const loose = path.join(root, 'loose-episode');
  fs.mkdirSync(loose, { recursive: true });

  const bags = loadCascadeBags(loose);
  assert.equal(bags.series, undefined);
  assert.equal(bags.domain.transition, 'fade');
  fs.rmSync(root, { recursive: true, force: true });
});

test('lowerKnowledgeModel resolves template, music, music_volume, transition and fit through the cascade', () => {
  const model = {
    version: 'innfo-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V' } }],
      Scene: [{ type: 'Scene', name: 's1', slug: 's1', description: 'words here', fields: {} }],
      Layer: [{ type: 'Layer', name: 'br', slug: 's1-br', parentSlug: 's1', fields: { type: 'b-roll', asset: 'a.png' } }],
    },
  };
  const templates = { Full: { voice: 'Lucas', model: 'minimax/x' } };
  const bags = {
    series: { template: '[[Series :: Full]]', transition: 'fade', music: 'loop.m4a', music_volume: '0.4', fit: 'contain' },
  };
  const lowered = new SceneCompiler().lowerKnowledgeModel(model, { templates, bags });
  const sc = lowered.scenes[0];
  assert.equal(sc.resolvedTemplate.name, 'Full');
  assert.equal(sc.transition, 'fade');
  assert.equal(sc.music, 'loop.m4a');
  assert.equal(sc.properties.scene_music_volume, 0.4);
  assert.equal(sc.layers[0].properties.layer_fit, 'contain');
});

test('a domain-level value overrides the blueprint and loses to a scene value', () => {
  const model = (sceneFields) => ({
    version: 'innfo-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V' } }],
      Scene: [{ type: 'Scene', name: 's1', slug: 's1', description: 'words', fields: sceneFields }],
      Layer: [],
    },
  });
  const bags = { domain: { transition: 'wipe' }, blueprint: { transition: 'none' } };
  const compiler = new SceneCompiler();
  assert.equal(compiler.lowerKnowledgeModel(model({}), { bags }).scenes[0].transition, 'wipe');
  assert.equal(compiler.lowerKnowledgeModel(model({ transition: 'slide-left' }), { bags }).scenes[0].transition, 'slide-left');
});

/** A minimal L3 Video Defaults document. */
function defaultsDoc(fields = {}) {
  const lines = Object.entries(fields).map(([k, v]) => `${k}:: ${v}`);
  return [
    '---',
    'level: 3',
    'parent_spec:',
    '  name: "video-script_V_0-6-0"',
    'title: "Video Defaults"',
    '---',
    '',
    '# NN Video Defaults',
    '',
    '## NN Video Defaults: Defaults',
    'slug:: defaults',
    ...lines,
    '',
  ].join('\n');
}

/** A minimal L3 Series document. */
function seriesDoc(fields = {}) {
  const lines = Object.entries(fields).map(([k, v]) => `${k}:: ${v}`);
  return [
    '---',
    'level: 3',
    'parent_spec:',
    '  name: "video-script_V_0-6-0"',
    'title: "Series A"',
    '---',
    '',
    '# NN Series',
    '',
    '## NN Series: Series A',
    'slug:: series-a',
    ...lines,
    '',
  ].join('\n');
}
