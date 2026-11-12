/**
 * nn-conntent/test/emitter-postmortem.test.mjs
 *
 * Regression tests for the coNNtent production post-mortem (#608, #609, #612.2, #615):
 * - an authored animation project that splits its scene into sub-composition files
 *   renders when mounted (its `data-composition-src` paths reach the staged copy);
 * - one project can be mounted by several scenes (per-mount host ids, staged once);
 * - a narrated scene lasts its narration: an animation is trimmed or looped to it,
 *   and only a scene without narration takes the animation's length;
 * - every slot component honours `nn-pos-*` on the host that mounts it;
 * - a slot fix reaches a project that was already staged;
 * - a Preset `avatar::` satisfies an avatar Layer's `asset` requirement.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SceneCompiler, computeSceneDurations } from '../scripts/scene-compiler.mjs';
import { buildProject } from '../scripts/scene-project.mjs';
import { buildHyperframesProject, stageAuthoredProjects } from '../scripts/hyperframes-render.mjs';
import { assertAnimationIds, AnimationIdCollisionError } from '../scripts/lib/animations.mjs';
import { loadPresetIndex } from '../scripts/lib/presets.mjs';
import { SLOT_OF } from '../scripts/overlay-blocks.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

// --- #608: authored sub-compositions and reuse ----------------------------------

/** A project laid out the way `hyperframes check` asks: the scene lives in a sub-composition file. */
function writeSplitProject(dir) {
  fs.mkdirSync(path.join(dir, 'compositions'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    '<!doctype html><html><body><div id="root" data-composition-id="rig" data-duration="4" data-width="1080" data-height="1080">' +
      '<div id="scene-host" data-composition-id="rig-scene" data-composition-src="compositions/scene.html" data-start="0" data-duration="4"></div>' +
      '<div id="ext" data-composition-src="https://example.invalid/x.html"></div>' +
      '</div></body></html>',
    'utf8',
  );
  fs.writeFileSync(
    path.join(dir, 'compositions', 'scene.html'),
    '<template><div id="scene" data-composition-id="rig-scene"><div data-composition-src="compositions/part.html"></div></div></template>',
    'utf8',
  );
  fs.writeFileSync(path.join(dir, 'compositions', 'part.html'), '<template><div id="part"></div></template>', 'utf8');
}

test('a sub-composition of an authored project resolves from the emitted root once staged', () => {
  const src = tmp('nn-pm-rig-');
  const projectDir = tmp('nn-pm-proj-');
  try {
    writeSplitProject(src);
    stageAuthoredProjects({ tracks: { scenes: [{ animations: [{ id: 'rig', sourceDir: src }] }] } }, projectDir);
    const index = fs.readFileSync(path.join(projectDir, 'authored', 'rig', 'index.html'), 'utf8');
    const sub = fs.readFileSync(path.join(projectDir, 'authored', 'rig', 'compositions', 'scene.html'), 'utf8');
    // HyperFrames resolves data-composition-src against the ENTRY root, so every
    // relative path is re-rooted under authored/<id>/ and points at a staged file.
    assert.match(index, /data-composition-src="authored\/rig\/compositions\/scene\.html"/);
    assert.match(sub, /data-composition-src="authored\/rig\/compositions\/part\.html"/);
    for (const rel of ['authored/rig/compositions/scene.html', 'authored/rig/compositions/part.html']) {
      assert.ok(fs.existsSync(path.join(projectDir, rel)), `${rel} is staged`);
    }
    // Absolute URLs are left as authored.
    assert.match(index, /data-composition-src="https:\/\/example\.invalid\/x\.html"/);
    // The source project is never touched.
    assert.match(fs.readFileSync(path.join(src, 'index.html'), 'utf8'), /data-composition-src="compositions\/scene\.html"/);
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('one project mounted by two scenes is allowed; two different projects with one id collide', () => {
  assert.doesNotThrow(() =>
    assertAnimationIds({
      animations: { scene_a: [{ id: 'rig', sourceDir: '/p/rig' }], scene_b: [{ id: 'rig', sourceDir: '/p/rig' }] },
      sceneSlugs: ['a', 'b'],
      rootId: 'demo',
    }),
  );
  assert.throws(
    () =>
      assertAnimationIds({
        animations: { scene_a: [{ id: 'rig', sourceDir: '/p/rig' }], scene_b: [{ id: 'rig', sourceDir: '/p/other' }] },
        sceneSlugs: ['a', 'b'],
        rootId: 'demo',
      }),
    (err) => err instanceof AnimationIdCollisionError && /scene_a/.test(err.message),
  );
});

function twoSceneManifest(sourceDir) {
  return {
    compositionId: 'demo',
    fps: 30,
    width: 1080,
    height: 1080,
    totalDurationInFrames: 240,
    totalDurationInSeconds: 8,
    tracks: {
      scenes: [
        { id: 'scene_a', slug: 'a', fromFrame: 0, durationInFrames: 120, animations: [{ id: 'rig', durationInFrames: 120, sourceDir }], props: { layers: [] } },
        { id: 'scene_b', slug: 'b', fromFrame: 120, durationInFrames: 120, animations: [{ id: 'rig', durationInFrames: 120, sourceDir }], props: { layers: [] } },
      ],
      audio: [],
      overlays: [],
    },
    metadata: {},
  };
}

test('each mount of a shared project gets its own host id and the project is staged once', () => {
  const src = tmp('nn-pm-shared-');
  const projectDir = tmp('nn-pm-shared-proj-');
  try {
    writeSplitProject(src);
    const manifest = twoSceneManifest(src);
    const { indexHtml } = buildProject(manifest);
    const hosts = [...indexHtml.matchAll(/<div id="(animation-[^"]+)"[^>]*data-composition-src="authored\/rig\/index\.html"[^>]*>/g)];
    assert.deepEqual(hosts.map((m) => m[1]), ['animation-a-rig', 'animation-b-rig']);
    assert.match(hosts[1][0], /data-start="4"/);
    stageAuthoredProjects(manifest, projectDir);
    assert.deepEqual(fs.readdirSync(path.join(projectDir, 'authored')), ['rig']);
  } finally {
    fs.rmSync(src, { recursive: true, force: true });
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

// --- #615: narration sets the scene length --------------------------------------

const animModel = (narration) => ({
  version: 'innfo-read-knowledge@1',
  frontmatter: { title: 'Anim' },
  elements: {
    Video: [{ type: 'Video', name: 'Anim', slug: 'anim', fields: { title: 'Anim' } }],
    Scene: [{ type: 'Scene', name: 'S', slug: 's', description: narration, fields: {} }],
    Layer: [],
  },
});

test('a narrated scene lasts its narration: a longer animation never stretches it', () => {
  const compiler = new SceneCompiler({ fps: 30, wordsPerSecond: 5, width: 1920, height: 1920 });
  // Measured narration 18.4 s, presenter rig declaring 45 s (the #615 evidence).
  const manifest = compiler.compile(animModel('one two three'), {
    audioAssets: { scene_s: { assetPath: 'vo.mp3', durationSeconds: 18.4 } },
    animations: { scene_s: [{ id: 'rig', durationSeconds: 45, sourceDir: '/x' }] },
  });
  assert.equal(manifest.tracks.scenes[0].durationInFrames, 552, '18.4 s, not 45 s');
  assert.equal(manifest.totalDurationInFrames, 552);
  const { indexHtml } = buildProject({ ...manifest, width: 1080, height: 1080 });
  const hosts = [...indexHtml.matchAll(/<div id="animation-s-rig[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.equal(hosts.length, 1, 'trimmed: one host');
  assert.match(hosts[0], /data-start="0"[^>]*data-duration="18\.4"/);
});

test('a shorter animation is looped to the narration length', () => {
  const manifest = {
    compositionId: 'demo',
    fps: 30,
    width: 1080,
    height: 1080,
    totalDurationInFrames: 300,
    totalDurationInSeconds: 10,
    tracks: {
      scenes: [{ id: 'scene_s', slug: 's', fromFrame: 30, durationInFrames: 300, animations: [{ id: 'rig', durationInFrames: 120, sourceDir: '/x' }], props: { layers: [] } }],
      audio: [],
      overlays: [],
    },
    metadata: {},
  };
  const { indexHtml } = buildProject(manifest);
  const hosts = [...indexHtml.matchAll(/<div id="(animation-s-rig-\d)"[^>]*data-start="([\d.]+)" data-duration="([\d.]+)"/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(hosts, [
    ['animation-s-rig-1', '1', '4'],
    ['animation-s-rig-2', '5', '4'],
    ['animation-s-rig-3', '9', '2'],
  ]);
});

test('only a scene without narration takes its length from the animation', () => {
  const durations = computeSceneDurations(
    [
      { id: 'scene_silent', slug: 'silent', narration: '' },
      { id: 'scene_spoken', slug: 'spoken', narration: 'w '.repeat(30).trim() },
    ],
    {
      wordsPerSecond: 5,
      animations: { scene_silent: [{ durationSeconds: 7 }], scene_spoken: [{ durationSeconds: 9 }] },
    },
  );
  assert.equal(durations[0].seconds, 7, 'narration off: the animation sets it');
  assert.equal(durations[1].seconds, 6, 'narration on: 30 words / 5 wps, the 9 s animation does not stretch it');
  // A silent scene with no animation keeps the default length.
  assert.equal(computeSceneDurations([{ id: 'scene_x', narration: '' }])[0].seconds, 5);
});

// --- #609: slot position classes, re-staging ------------------------------------

test('every slot styles nn-pos-* on the host that carries its composition id', () => {
  // HyperFrames scopes a component's CSS under the HOST that mounts it, and the host
  // carries both `data-composition-id="<slot>"` and the nn-pos-* class. A plain
  // `.nn-pos-x .inner` becomes `[host] .nn-pos-x .inner` and never matches; the
  // compound `[data-composition-id="<slot>"].nn-pos-x .inner` targets the host itself.
  for (const slot of new Set(Object.values(SLOT_OF))) {
    const css = fs.readFileSync(path.join(SKILL_DIR, 'slots', `${slot}.html`), 'utf8');
    const rules = css.match(/^[^{\n]*\.nn-pos-[a-z-]+[^{\n]*\{/gm) || [];
    assert.ok(rules.length >= 7, `${slot}.html styles every position`);
    for (const rule of rules) {
      assert.ok(rule.trim().startsWith(`[data-composition-id="${slot}"].nn-pos-`), `${slot}.html: ${rule.trim()}`);
    }
  }
  const watermark = fs.readFileSync(path.join(SKILL_DIR, 'slots', 'watermark.html'), 'utf8');
  assert.match(watermark, /\[data-composition-id="watermark"\]\.nn-pos-bottom-right \.nn-watermark \{[^}]*right: 3%/);
});

test('a changed slot component reaches a project that was already staged', () => {
  const dir = tmp('nn-pm-restage-');
  const gsap = path.join(dir, 'gsap.min.js');
  const comp = path.join(dir, 'watermark.html');
  fs.writeFileSync(gsap, '/* gsap */', 'utf8');
  try {
    const manifest = {
      compositionId: 'demo',
      fps: 30,
      width: 1080,
      height: 1080,
      totalDurationInFrames: 30,
      totalDurationInSeconds: 1,
      tracks: { scenes: [{ id: 'scene_a', slug: 'a', fromFrame: 0, durationInFrames: 30, props: { layers: [] } }], audio: [], overlays: [{ id: 'wm', type: 'watermark', fromFrame: 0, durationInFrames: 30, config: { text: 'x', position: 'bottom-right' } }] },
      metadata: { components: { watermark: { name: 'watermark', path: comp } } },
    };
    const projectDir = path.join(dir, 'hyperframes');
    fs.writeFileSync(comp, '<template>old</template>', 'utf8');
    buildHyperframesProject(manifest, projectDir, { gsapPath: gsap });
    fs.writeFileSync(comp, '<template>fixed</template>', 'utf8');
    buildHyperframesProject(manifest, projectDir, { gsapPath: gsap });
    assert.equal(fs.readFileSync(path.join(projectDir, 'components', 'watermark.html'), 'utf8'), '<template>fixed</template>');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// --- #612.2: a Preset satisfies an avatar Layer's asset -------------------------

function avatarModel({ sceneFields = {}, layerFields = {} } = {}) {
  return {
    version: 'innfo-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V' } }],
      Scene: [{ type: 'Scene', name: 'Problema', slug: 'problema', description: 'hola', fields: sceneFields }],
      Layer: [{ type: 'Layer', name: 'Presenter', slug: 'problema-presenter', fields: { type: 'avatar', ...layerFields } }],
    },
  };
}

const presetIndex = () =>
  loadPresetIndex([
    { doc: 'series', elements: { Preset: [{ type: 'Preset', name: 'Host', slug: 'host', fields: { avatar: 'media/host.png' } }] } },
  ]);

test('a Preset avatar:: satisfies the avatar Layer asset, at scene, kind and series level', () => {
  const compiler = new SceneCompiler({ width: 1920, height: 1920 });
  const cases = [
    { name: 'scene presets', model: avatarModel({ sceneFields: { presets: ['Host'] } }), options: { bags: { presetIndex: presetIndex() } } },
    { name: 'scene avatar field', model: avatarModel({ sceneFields: { avatar: 'media/own.png' } }), options: { bags: { presetIndex: presetIndex() } } },
    { name: 'series presets', model: avatarModel(), options: { bags: { presetIndex: presetIndex(), series: { presets: ['Host'] } } } },
    {
      name: 'kind presets',
      model: avatarModel({ sceneFields: { kind: 'Talk' } }),
      options: { bags: { presetIndex: presetIndex() }, grammar: { kinds: { Talk: { name: 'Talk', fields: { presets: ['Host'] } } }, chrome: {} } },
    },
  ];
  for (const c of cases) {
    const guard = compiler.checkScript(c.model, c.options);
    assert.ok(!guard.errors.some((e) => e.code === 'missing-conditional-field'), `${c.name}: ${JSON.stringify(guard.errors)}`);
  }
});

test('an avatar Layer with no asset, prompt or cascaded avatar is still rejected', () => {
  const compiler = new SceneCompiler({ width: 1920, height: 1920 });
  const guard = compiler.checkScript(avatarModel(), { bags: { presetIndex: presetIndex() } });
  const err = guard.errors.find((e) => e.code === 'missing-conditional-field');
  assert.ok(err, JSON.stringify(guard.errors));
  assert.match(err.message, /Layer "Presenter" \(type:: avatar\) requires one of: asset, prompt/);
});

test('a media Layer is not satisfied by a cascaded avatar', () => {
  const compiler = new SceneCompiler({ width: 1920, height: 1920 });
  const model = avatarModel({ sceneFields: { presets: ['Host'] } });
  model.elements.Layer[0].fields.type = 'media';
  const guard = compiler.checkScript(model, { bags: { presetIndex: presetIndex() } });
  assert.ok(guard.errors.some((e) => e.code === 'missing-conditional-field'), JSON.stringify(guard.errors));
});
