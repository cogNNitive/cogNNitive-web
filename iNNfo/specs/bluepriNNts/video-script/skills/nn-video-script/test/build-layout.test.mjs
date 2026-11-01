/**
 * nn-video-script/test/build-layout.test.mjs
 *
 * Engine output lives under one gitignored `build/` folder, and a keyless run
 * stores its placeholders under their own key (design D2/D10, capability
 * cognnitive-video-engine "Cache Identity ..." and "Engine Output ...").
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { compileVideo } from '../scripts/video-engine-cli.mjs';
import { AssetSynthesizer } from '../scripts/asset-synthesizer.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';

const SAMPLE = `---
level: 3
title: "Build layout"
---

# NN Video

## NN Video: Build layout
slug:: build-layout
title:: Build layout

# NN Scene

## NN Scene: One

slug:: one

one two three four five

### NN Layer: One background
slug:: one-bg
type:: background
asset:: media/bg.png
`;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-build-layout-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  const series = path.join(root, 'series', 's');
  const episode = path.join(series, 'assets', 'e');
  fs.mkdirSync(path.join(episode, 'media'), { recursive: true });
  fs.writeFileSync(path.join(series, 's_scope_NN.md'), '---\nlevel: 3\nscope: true\ntitle: "S"\n---\n\n# NN Series\n\n## NN Series: S\nslug:: s\n', 'utf8');
  fs.writeFileSync(path.join(episode, 'media', 'bg.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const scriptPath = path.join(episode, 'e_video-script_s_NN.md');
  fs.writeFileSync(scriptPath, SAMPLE, 'utf8');
  return { root, series, episode, scriptPath };
}

const bags = { blueprint: { master_resolution: '1920x1920', fit: 'cover', transition: 'none' } };

test('compile writes its output only under build/', async () => {
  const { root, episode, scriptPath } = fixture();
  await compileVideo({ scriptPath, bags, synthesizeAssets: false, cacheDir: path.join(root, 'cache') });

  assert.ok(fs.existsSync(path.join(episode, 'build', '.nn-build')), 'the build marker exists');
  assert.ok(fs.existsSync(path.join(episode, 'build', 'manifest.json')), 'the manifest lives under build/');
  assert.ok(fs.existsSync(path.join(episode, 'build', 'hyperframes', 'assets')), 'staging is the asset dir');
  assert.equal(fs.existsSync(path.join(episode, 'public')), false, 'no public/ at the episode root');
  assert.equal(fs.existsSync(path.join(episode, 'audio')), false, 'no audio/ handoff any more');
  assert.equal(fs.existsSync(path.join(episode, 'manifest.json')), false, 'no manifest at the episode root');
  assert.equal(fs.existsSync(path.join(episode, 'hyperframes')), false, 'no hyperframes/ at the episode root');

  const manifest = JSON.parse(fs.readFileSync(path.join(episode, 'build', 'manifest.json'), 'utf8'));
  assert.equal(path.resolve(manifest.metadata.buildDir), path.resolve(episode, 'build'));
  assert.ok(path.isAbsolute(manifest.metadata.publicDir), 'staged paths stay absolute');
  fs.rmSync(root, { recursive: true, force: true });
});

test('the manifest is regenerated on every compile, so a stale one cannot be rendered', async () => {
  const { root, episode, scriptPath } = fixture();
  await compileVideo({ scriptPath, bags, synthesizeAssets: false, cacheDir: path.join(root, 'cache') });
  const first = fs.readFileSync(path.join(episode, 'build', 'manifest.json'), 'utf8');
  fs.writeFileSync(scriptPath, SAMPLE.replace('one two three four five', 'one two three four five six seven'), 'utf8');
  await compileVideo({ scriptPath, bags, synthesizeAssets: false, cacheDir: path.join(root, 'cache') });
  const second = fs.readFileSync(path.join(episode, 'build', 'manifest.json'), 'utf8');
  assert.notEqual(first, second, 'the second compile rewrote the manifest');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a keyless run stores its placeholders under their own key', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-keyless-'));
  const cache = new CacheManager({ baseDir: root });
  const synth = new AssetSynthesizer({ cacheManager: cache, env: {}, guard: { authorized: async () => null } });
  const res = await synth.synthesizeTTS('one two three', { voice: 'Ana' });
  const real = cache.computeHash('one two three', synth._withResolvedVoice({ voice: 'Ana' }));
  assert.ok(fs.existsSync(path.join(root, 'tts', `${real}-offline.mp3`)) || res.assetPath.includes('-offline'));
  assert.equal(fs.existsSync(path.join(root, 'tts', `${real}.mp3`)), false, 'the real key is untouched');
  fs.rmSync(root, { recursive: true, force: true });
});
