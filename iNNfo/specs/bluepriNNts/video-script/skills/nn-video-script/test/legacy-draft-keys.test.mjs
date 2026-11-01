/**
 * nn-video-script/test/legacy-draft-keys.test.mjs
 *
 * A draft or reviewed JSON carrying a retired key is rejected loudly with
 * `legacy-draft-keys`, naming the key and its replacement; it is never ignored
 * or translated (a silent drop could fall back to a default model and spend).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { RETIRED_DRAFT_KEYS, findLegacyKeys, assertNoLegacyKeys } from '../scripts/lib/legacy-draft-keys.mjs';
import { buildScript } from '../scripts/build-script-from-draft.mjs';
import { buildDraftHtml } from '../scripts/build-draft-html.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(__dirname, '..', 'scripts');
const TEMPLATE = path.join(SCRIPTS, 'draft-template.html');

const names = (doc) => findLegacyKeys(doc, RETIRED_DRAFT_KEYS).map((f) => f.key).sort();

test('the retired list maps each retired key to its replacement', () => {
  assert.deepEqual(RETIRED_DRAFT_KEYS, {
    template: 'presets',
    speed: 'voice_speed',
    emotion: 'voice_emotion',
    tts_model: 'voice_model',
    music: 'background_audio',
    music_volume: 'background_audio_volume',
    presenter_asset: 'avatar',
    intro_asset: 'intro',
  });
});

test('every place the requirement names is checked', () => {
  assert.deepEqual(names({ config: [{ key: 'music_volume', value: '0.2' }] }), ['music_volume']);
  assert.deepEqual(names({ videoOverrides: { speed: '1.1' } }), ['speed']);
  assert.deepEqual(names({ config: { effective: { music: 'a.mp3' }, overrides: { emotion: 'calm' } } }), ['emotion', 'music']);
  assert.deepEqual(names({ scenes: [{ slug: 's', sceneOverrides: { tts_model: 'x' } }] }), ['tts_model']);
  assert.deepEqual(names({ scenes: [{ slug: 's', template: 'Full' }] }), ['template']);
});

test('current keys, avatar model ids and off-schema keys are not legacy', () => {
  const ok = {
    config: [{ key: 'voice_speed', value: '1' }, { key: 'whatever_custom', value: 'x' }],
    videoOverrides: { background_audio_volume: '0.3' },
    scenes: [{ slug: 's', presets: 'Full', choice: { type: 'avatar', model: 'pruna-ai/p-video-2-pro/avatar' }, sceneOverrides: { transition: 'fade' } }],
  };
  assert.deepEqual(names(ok), []);
  assert.doesNotThrow(() => assertNoLegacyKeys(ok, 'x.json'));
});

test('the error is legacy-draft-keys and names the script, the key and its replacement', () => {
  assert.throws(
    () => assertNoLegacyKeys({ videoOverrides: { music_volume: '0.2' } }, 'demo/reviewed.json'),
    (e) => e.code === 'legacy-draft-keys' && /legacy-draft-keys/.test(e.message) && /demo\/reviewed\.json/.test(e.message) && /music_volume/.test(e.message) && /background_audio_volume/.test(e.message),
  );
});

test('buildScript fails on a legacy key in the reviewed or the draft JSON', () => {
  const rev = { slug: 'demo', title: 'Demo', videoOverrides: { music_volume: '0.2' }, scenes: [] };
  assert.throws(() => buildScript(rev, null, { bags: {}, frontmatter: '' }), /legacy-draft-keys.*music_volume/s);
  const dr = { scenes: [{ slug: 's', name: 'S', template: 'Full' }] };
  assert.throws(() => buildScript({ slug: 'd', title: 'D', scenes: [] }, dr, { bags: {}, frontmatter: '' }), /legacy-draft-keys.*template/s);
});

test('build-script-from-draft CLI exits 1 and writes no script', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-keys-'));
  const reviewed = path.join(dir, 'reviewed.json');
  fs.writeFileSync(reviewed, JSON.stringify({ slug: 'demo', title: 'Demo', videoOverrides: { music_volume: '0.2' }, scenes: [] }));
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, 'build-script-from-draft.mjs'), reviewed], { encoding: 'utf8' });
  const wrote = fs.readdirSync(dir).some((f) => f.endsWith('.md'));
  fs.rmSync(dir, { recursive: true, force: true });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /legacy-draft-keys/);
  assert.match(r.stderr, /music_volume/);
  assert.equal(wrote, false);
});

test('the console builder rejects a legacy draft or reviewed state, in Node and in the page', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-keys-'));
  const draft = { slug: 'demo', title: 'Demo', scenes: [{ slug: 's', name: 'S', template: 'Full' }] };
  assert.throws(() => buildDraftHtml(draft, { baseDir: dir, templatePath: TEMPLATE }), /legacy-draft-keys.*template/s);
  assert.throws(
    () => buildDraftHtml({ slug: 'demo', scenes: [] }, { baseDir: dir, templatePath: TEMPLATE, reviewed: { videoOverrides: { speed: '1' } } }),
    /legacy-draft-keys.*speed/s,
  );
  // The page repeats the check on the state it loads, from the same function source.
  const html = buildDraftHtml({ slug: 'demo', scenes: [] }, { baseDir: dir, templatePath: TEMPLATE });
  assert.match(html, /function findLegacyKeys/);
  assert.match(html, /legacy-draft-keys/);
  assert.doesNotMatch(html, /__RETIRED_KEYS__|__FIND_LEGACY_KEYS__/);
  fs.rmSync(dir, { recursive: true, force: true });
});
