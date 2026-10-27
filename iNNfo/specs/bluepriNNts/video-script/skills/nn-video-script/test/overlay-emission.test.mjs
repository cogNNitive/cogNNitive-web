/**
 * nn-video-script/test/overlay-emission.test.mjs
 *
 * RED→GREEN tests for the slot-component overlay emitter (design D1/D4/D5/D21):
 * every overlay mounts, as a ROOT host with global times, the component named by
 * the `components` cascade; the enter/exit animations and the frame font/accent
 * reach it as variable values; a component missing a slot variable fails with
 * `SlotContractError`; a user-level component name with no file fails pre-compile.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProject } from '../scripts/scene-project.mjs';
import { overlayMount, readVariableIds, assertSlotContract, SlotContractError, SLOT_OF } from '../scripts/overlay-blocks.mjs';
import { resolveComponents, compileVideo } from '../scripts/video-engine-cli.mjs';
import { MissingAssetError } from '../scripts/lib/missing-asset.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FRAME = {
  path: 'frames/brand.md',
  tokens: { colors: { primary: '#1e2bfa' }, typography: { body: { fontFamily: 'Inter' } } },
};

function fixture() {
  return {
    compositionId: 'demo',
    fps: 30,
    width: 1080,
    height: 1080,
    totalDurationInFrames: 180,
    totalDurationInSeconds: 6,
    tracks: {
      scenes: [
        { id: 'scene_a', slug: 'a', fromFrame: 0, durationInFrames: 90, transition: { type: 'none' }, props: { layers: [{ layer_type: 'image', layer_asset_source: 'bg.jpg', layer_level: 0 }] } },
        { id: 'scene_b', slug: 'b', fromFrame: 90, durationInFrames: 90, transition: { type: 'none' }, props: { layers: [] } },
      ],
      audio: [],
      overlays: [
        {
          id: 'overlay_scene_b_1',
          type: 'lowerThird',
          fromFrame: 90,
          durationInFrames: 90,
          enterAnimation: 'fade',
          exitAnimation: 'slide',
          config: { title: 'Lucas Cervera', position: 'bottom-left' },
        },
      ],
    },
    metadata: {
      frame: FRAME,
      components: { 'lower-third': { name: 'lower-third', path: '/skill/components/lower-third.html' } },
    },
  };
}

test('an overlay mounts its slot component as a root host with global times', () => {
  const { indexHtml, compositions } = buildProject(fixture());
  assert.match(indexHtml, /data-composition-src="components\/lower-third\.html"/);
  assert.match(indexHtml, /data-start="3"/, 'global time, not scene-relative');
  assert.match(indexHtml, /id="overlay_scene_b_1"/);
  for (const c of compositions) assert.doesNotMatch(c.html, /overlay_scene_b_1/, 'overlays do not live in a scene sub-composition');
});

test('the enter/exit animations and the frame tokens reach the host as variable values', () => {
  const { indexHtml } = buildProject(fixture());
  assert.match(indexHtml, /"text":"Lucas Cervera"/);
  assert.match(indexHtml, /"position":"bottom-left"/);
  assert.match(indexHtml, /"enter":"fade"/);
  assert.match(indexHtml, /"exit":"slide"/);
  assert.match(indexHtml, /"font":"Inter"/);
  assert.match(indexHtml, /"accent":"#1e2bfa"/);
});

test('a series components:: [lower-third=pill] mounts pill.html', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-comp-series-'));
  const series = path.join(root, 'series-a');
  const episode = path.join(series, 'ep-01');
  fs.mkdirSync(path.join(series, 'components'), { recursive: true });
  fs.mkdirSync(episode, { recursive: true });
  fs.writeFileSync(
    path.join(series, 'components', 'pill.html'),
    '<div data-composition-variables=\'[{"id":"text"},{"id":"src"},{"id":"position"},{"id":"enter"},{"id":"exit"},{"id":"font"},{"id":"accent"}]\'></div>',
    'utf8',
  );

  const bags = { series: { components: '[lower-third=pill]' }, blueprint: { components: '[lower-third=lower-third]' } };
  const resolved = resolveComponents({ slots: ['lower-third'], bags, scriptDir: episode, workspaceRoot: root, skillDir: SKILL_DIR });
  assert.equal(resolved['lower-third'].name, 'pill');
  assert.equal(resolved['lower-third'].path, path.join(series, 'components', 'pill.html'));

  const manifest = fixture();
  manifest.metadata.components = resolved;
  assert.match(buildProject(manifest).indexHtml, /data-composition-src="components\/pill\.html"/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a static component marks its overlay host data-no-timeline', () => {
  // A component whose root declares data-no-timeline never registers a
  // sub-composition timeline; without the host flag HyperFrames waits its 45s
  // readiness timeout on every render (S0 spike finding).
  const manifest = fixture();
  manifest.metadata.components = { 'lower-third': { name: 'lower-third', noTimeline: true } };
  assert.match(buildProject(manifest).indexHtml, /nn-overlay[^>]*data-no-timeline/);

  // A component that does not declare it keeps the wait (it may register a timeline).
  const manifest2 = fixture();
  manifest2.metadata.components = { 'lower-third': { name: 'lower-third', noTimeline: false } };
  assert.doesNotMatch(buildProject(manifest2).indexHtml, /nn-overlay[^>]*data-no-timeline/);
});

test('resolveComponents records whether each resolved component is static', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-comp-static-'));
  const episode = path.join(root, 'ep-01');
  fs.mkdirSync(path.join(root, 'components'), { recursive: true });
  fs.mkdirSync(episode, { recursive: true });
  const vars = '[{"id":"text"},{"id":"src"},{"id":"position"},{"id":"enter"},{"id":"exit"},{"id":"font"},{"id":"accent"}]';
  fs.writeFileSync(path.join(root, 'components', 'static.html'), `<div data-composition-variables='${vars}' data-no-timeline></div>`, 'utf8');
  fs.writeFileSync(path.join(root, 'components', 'animated.html'), `<div data-composition-variables='${vars}'></div>`, 'utf8');

  const bags = (name) => ({ series: { components: `[lower-third=${name}]` }, blueprint: { components: '[lower-third=lower-third]' } });
  const staticRes = resolveComponents({ slots: ['lower-third'], bags: bags('static'), scriptDir: episode, workspaceRoot: root, skillDir: SKILL_DIR });
  assert.equal(staticRes['lower-third'].noTimeline, true);
  const animatedRes = resolveComponents({ slots: ['lower-third'], bags: bags('animated'), scriptDir: episode, workspaceRoot: root, skillDir: SKILL_DIR });
  assert.equal(animatedRes['lower-third'].noTimeline, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a user-level component name with no file fails pre-compile via the D21 check', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-comp-missing-'));
  const episode = path.join(root, 'ep-01');
  fs.mkdirSync(episode, { recursive: true });

  assert.throws(
    () =>
      resolveComponents({
        slots: ['lower-third'],
        bags: { series: { components: '[lower-third=ghost]' }, blueprint: { components: '[lower-third=lower-third]' } },
        scriptDir: episode,
        workspaceRoot: root,
        skillDir: SKILL_DIR,
      }),
    (err) => {
      assert.ok(err instanceof MissingAssetError);
      assert.match(err.message, /component/);
      assert.match(err.message, /ghost/);
      assert.match(err.message, /series/);
      assert.match(err.message, /searched/i);
      return true;
    },
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('a resolved component missing a slot variable raises SlotContractError naming both', () => {
  const contractHtml = '<div data-composition-variables=\'[{"id":"text"},{"id":"accent"},{"id":"exit"}]\'></div>';
  const componentHtml = '<div data-composition-variables=\'[{"id":"text"}]\'></div>';
  assert.throws(
    () => assertSlotContract('lower-third', { path: '/series/components/pill.html', html: componentHtml, contractHtml }),
    (err) => {
      assert.ok(err instanceof SlotContractError);
      assert.match(err.message, /slot "lower-third"/);
      assert.match(err.message, /pill\.html/);
      assert.match(err.message, /missing variables: accent, exit/);
      return true;
    },
  );
});

test('readVariableIds reads the declared variable ids from a component', () => {
  assert.deepEqual(readVariableIds('<div data-composition-variables=\'[{"id":"text"},{"id":"fit"}]\'></div>'), ['text', 'fit']);
  assert.deepEqual(readVariableIds('<div></div>'), []);
});

test('the six manifest overlay types map to their slot names', () => {
  assert.deepEqual(SLOT_OF, {
    kineticTitle: 'title',
    lowerThird: 'lower-third',
    captions: 'caption',
    quote: 'quote',
    watermark: 'watermark',
    broll: 'b-roll',
  });
});

test('the skill ships exactly one neutral fallback per slot', () => {
  for (const slot of ['title', 'lower-third', 'caption', 'quote', 'watermark', 'b-roll']) {
    const file = path.join(SKILL_DIR, 'components', `${slot}.html`);
    assert.ok(fs.existsSync(file), `missing fallback ${slot}.html`);
    assert.ok(readVariableIds(fs.readFileSync(file, 'utf8')).length > 0, `${slot}.html declares no variables`);
  }
});

test('the emitted tree has no `..` in any src and is byte-identical on re-emission', () => {
  const built = buildProject(fixture());
  const serialized = JSON.stringify(built.files);
  for (const html of Object.values(built.files)) {
    for (const m of html.matchAll(/src="([^"]*)"/g)) {
      assert.ok(!m[1].includes('..'), `src must not climb: ${m[1]}`);
    }
  }
  assert.equal(JSON.stringify(buildProject(fixture()).files), serialized, 'deterministic');
});

test('overlayMount returns null for an unknown overlay type', () => {
  assert.equal(overlayMount({ id: 'x', type: 'nope', fromFrame: 0, durationInFrames: 30, config: {} }, {}), null);
});

test('a b-roll host carries the staged src and the cascaded fit', () => {
  const overlay = { id: 'br', type: 'broll', fromFrame: 0, durationInFrames: 60, config: { assetPath: 'clip_abc.mp4', fit: 'contain' } };
  const html = overlayMount(overlay, { componentName: 'b-roll', fps: 30 });
  assert.match(html, /data-composition-src="components\/b-roll\.html"/);
  assert.match(html, /"src":"assets\/clip_abc\.mp4"/);
  assert.match(html, /"fit":"contain"/);
});

test('compileVideo fails before any synthesis when a user-level component name has no file', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-comp-compile-'));
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  const ep = path.join(root, 'ep');
  fs.mkdirSync(ep, { recursive: true });
  const scriptPath = path.join(ep, 'script.md');
  fs.writeFileSync(scriptPath, '---\ntitle: C\n---\n', 'utf8');

  const model = {
    version: 'innfo-read-knowledge@1',
    frontmatter: { title: 'C' },
    elements: {
      Video: [{ type: 'Video', name: 'C', slug: 'c', fields: { title: 'C' } }],
      Scene: [{ type: 'Scene', name: 's', slug: 's', description: 'narration', fields: {} }],
      Layer: [{ type: 'Layer', name: 'LT', slug: 'lt', fields: { type: 'lower-third', text: 'X' } }],
    },
  };

  await assert.rejects(
    compileVideo({
      scriptPath,
      model,
      synthesizeAssets: false,
      bags: { series: { components: '[lower-third=ghost]' }, blueprint: { components: '[lower-third=lower-third]' } },
    }),
    (err) => {
      assert.ok(err instanceof MissingAssetError);
      assert.match(err.message, /component/);
      assert.match(err.message, /ghost/);
      assert.match(err.message, /series/);
      assert.match(err.message, /searched/i);
      return true;
    },
  );
  fs.rmSync(root, { recursive: true, force: true });
});
