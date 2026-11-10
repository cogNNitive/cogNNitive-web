/**
 * nn-conntent/test/character-precedence.test.mjs
 *
 * Character parameters sit directly beneath the explicit fields of the level that
 * sets them (D19/D-K2): a kind preset or an explicit value that wins over the active
 * Character's `voice`/`avatar`/`pose`/`background`/`avatar_model`/`avatar_resolution`
 * emits a `character-override` warning naming the field, the winning source and the
 * Character, deduplicated per field+source (once per scope, not per scene). A guest
 * scene resolves against its own Character and warns nothing. (capability
 * conntent-character, conntent-presets C9; task 2d.3 — RED: no override detector.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { characterOverrides } from '../scripts/lib/characters.mjs';
import { createCascade } from '../scripts/lib/cascade.mjs';
import { loadPresetIndex, presetSourceFromFile } from '../scripts/lib/presets.mjs';

const CHARACTER_FIELDS = ['voice', 'avatar', 'pose', 'background', 'avatar_model', 'avatar_resolution'];

const lucas = {
  name: 'lucas',
  voices: { es: 'lucas-es' },
  defaultPose: 'neutral',
  avatarModel: 'wavespeed-ai/infinitetalk-fast',
  avatarResolution: '720p',
  defaultBackground: 'studio',
};

const maria = { ...lucas, name: 'maria', voices: { es: 'maria-es' }, defaultPose: 'smiling' };

const chars = { lucas, maria };
const characterOf = (name) => chars[name] || null;

/** A preset index with one Preset `Presenter` that sets `voice`. */
function kindPresetIndex() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-char-preset-'));
  const doc = path.join(dir, 's_coNNtent_NN.md');
  fs.writeFileSync(
    doc,
    `---
level: 3
---
# NN Series

## NN Series: S
slug:: s

# NN Preset

## NN Preset: Presenter
voice:: kind-voice
`,
    'utf8',
  );
  const index = loadPresetIndex([presetSourceFromFile(doc)]);
  fs.rmSync(dir, { recursive: true, force: true });
  return index;
}

/** One resolution position per scope to check. */
function warnOf(bags, position = {}) {
  const cascade = createCascade({ bags, characterOf, language: 'es' });
  return characterOverrides({ cascade, characterOf, position });
}

test('an explicit field that wins over the host character warns once per field+source', () => {
  const bags = {
    domain: {},
    series: { character: 'lucas' },
    kind: { presets: [] },
    video: { language: 'es', avatar: 'other.png' },
    scene: {},
    layer: {},
    blueprint: {},
  };
  const warns = warnOf(bags);
  const hit = warns.find((w) => w.field === 'avatar');
  assert.ok(hit, 'avatar override is warned');
  assert.equal(hit.code, 'character-override');
  assert.equal(hit.source, 'video');
  assert.equal(hit.character, 'lucas');
  // avatar_model / avatar_resolution / pose / background / voice are NOT overridden
  // when only the avatar was set explicitly.
  assert.equal(warns.filter((w) => w.field === 'avatar_model').length, 0);
});

test('a kind preset overriding the host voice warns with the kind:preset source', () => {
  const bags = {
    domain: {},
    series: { character: 'lucas', presets: [] },
    kind: { presets: ['Presenter'] },
    video: { language: 'es' },
    scene: {},
    layer: {},
    blueprint: {},
    presetIndex: kindPresetIndex(),
  };
  const cascade = createCascade({ bags, characterOf, language: 'es' });
  const warns = characterOverrides({ cascade, characterOf });
  const hit = warns.find((w) => w.field === 'voice');
  assert.ok(hit, 'voice override is warned');
  assert.equal(hit.source, 'kind:preset:Presenter');
  assert.equal(hit.character, 'lucas');
});

test('a guest scene resolves against its own character and warns nothing', () => {
  const bags = {
    domain: {},
    series: { character: 'lucas' },
    kind: { presets: [] },
    video: { language: 'es' },
    scene: { character: 'maria' },
    layer: {},
    blueprint: {},
  };
  const warns = warnOf(bags);
  assert.deepEqual(warns, [], 'no override warning for the guest scene');
});

test('repeated overrides collapse to one warning per field+source', () => {
  const bags = {
    domain: {},
    series: { character: 'lucas' },
    kind: { presets: [] },
    video: { language: 'es', voice: 'fixed' },
    scene: {},
    layer: {},
    blueprint: {},
  };
  const warns = warnOf(bags, { layer: null });
  assert.equal(warns.filter((w) => w.field === 'voice').length, 1, 'voice warned once');
});

test('the character fields list is the closed set the character supplies', () => {
  assert.deepEqual([...CHARACTER_FIELDS].sort(), [
    'avatar', 'avatar_model', 'avatar_resolution', 'background', 'pose', 'voice',
  ]);
});