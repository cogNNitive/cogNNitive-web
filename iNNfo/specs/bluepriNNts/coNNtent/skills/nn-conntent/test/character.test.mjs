/**
 * nn-conntent/test/character.test.mjs
 *
 * A Character is a folder `library/characters/<name>/` (domaiNN/series) or
 * `media/characters/<name>/` (episode) with `CHARACTER.md` frontmatter
 * (`names`, `voices`, `default_pose`, `avatar_model`, `avatar_resolution`,
 * `default_background`) plus `avatars/`, `backgrounds/` and `voice/` sub-folders.
 * `character::` resolves through the cascade; the character parameters act like a
 * preset placed directly beneath the explicit fields of the level that sets it
 * (D19), so scene `character:: maria` brings her voice/avatar/pose for that scene
 * while the series host `lucas` serves the others. (capability conntent-character;
 * task 2d.1 — RED: module missing.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadCharacter, findCharacter } from '../scripts/lib/characters.mjs';
import { createCascade } from '../scripts/lib/cascade.mjs';

function characterDir(root, name, { over = {}, body = '## Speaking style\nDirect.\n\n## Narrative style\nClear.\n\n## Never says\nJargon.\n\n## Examples\n"Hello."\n' } = {}) {
  const dir = path.join(root, 'library', 'characters', name);
  fs.mkdirSync(path.join(dir, 'avatars'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'backgrounds'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'voice'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'avatars', 'neutral.png'), 'png', 'utf8');
  fs.writeFileSync(path.join(dir, 'avatars', 'smiling.png'), 'png', 'utf8');
  fs.writeFileSync(path.join(dir, 'backgrounds', 'studio.png'), 'png', 'utf8');
  fs.writeFileSync(path.join(dir, 'voice', 'sample.wav'), 'wav', 'utf8');
  const front = {
    name,
    voices: { es: 'lucas-es', en: 'lucas-en' },
    default_pose: 'neutral',
    avatar_model: 'wavespeed-ai/infinitetalk-fast',
    avatar_resolution: '720p',
    default_background: 'studio',
    ...over,
  };
  fs.writeFileSync(
    path.join(dir, 'CHARACTER.md'),
    `---\n${Object.entries(front).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n')}\n---\n\n${body}`,
    'utf8',
  );
  return dir;
}

test('loadCharacter reads the frontmatter and validates name, voices and pose', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-char-'));
  const dir = characterDir(root, 'lucas');
  const c = loadCharacter(dir);
  assert.equal(c.name, 'lucas');
  assert.deepEqual(c.voices, { es: 'lucas-es', en: 'lucas-en' });
  assert.equal(c.defaultPose, 'neutral');
  assert.equal(c.avatarModel, 'wavespeed-ai/infinitetalk-fast');
  assert.equal(c.avatarResolution, '720p');
  assert.equal(c.defaultBackground, 'studio');
  assert.deepEqual(c.poses, ['neutral', 'smiling']);
  assert.deepEqual(c.backgrounds, ['studio']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findCharacter resolves the domaiNN library characters', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-char-'));
  characterDir(root, 'lucas');
  const found = findCharacter(root, 'lucas');
  assert.ok(found, 'character is found');
  assert.equal(path.basename(found), 'lucas');
  assert.equal(fs.existsSync(path.join(found, 'CHARACTER.md')), true);
  assert.throws(() => findCharacter(root, 'nobody'), /character-not-found/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('the series host serves the scenes that set no character', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-char-'));
  const lucas = path.basename(characterDir(root, 'lucas'));
  const bags = {
    domain: {},
    series: { character: 'lucas' },
    kind: {},
    video: { language: 'es' },
    scene: {},
    layer: {},
    blueprint: {},
  };
  const c = createCascade({ bags, characterOf: (name) => loadCharacter(findCharacter(root, name)) });
  const voice = c.at('scene-1').get('voice');
  assert.equal(voice.value, 'lucas-es');
  assert.equal(voice.source, 'series:character:lucas');
  assert.equal(c.at('scene-1').get('pose').value, 'neutral');
  assert.equal(c.at('scene-1').get('avatar_model').value, 'wavespeed-ai/infinitetalk-fast');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a scene guest overrides the host for that scene only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-char-'));
  const lucas = path.basename(characterDir(root, 'lucas'));
  const maria = path.basename(characterDir(root, 'maria', { over: { voices: { es: 'maria-es' }, default_pose: 'smiling' } }));
  const base = {
    domain: {},
    series: { character: 'lucas' },
    kind: {},
    video: { language: 'es' },
    scene: {},
    layer: {},
    blueprint: {},
  };
  const characterOf = (name) => loadCharacter(findCharacter(root, name));
  const sceneBags = { ...base, scene: { character: 'maria' } };
  const casc = createCascade({ bags: sceneBags, characterOf });
  assert.equal(casc.at('scene-1').get('voice').value, 'maria-es');
  assert.equal(casc.at('scene-1').get('voice').source, 'scene:character:maria');
  assert.equal(casc.at('scene-1').get('pose').value, 'smiling');
  // The other scene (no guest) keeps the host.
  const hostCasc = createCascade({ bags: base, characterOf });
  assert.equal(hostCasc.at('scene-2').get('voice').value, 'lucas-es');
  fs.rmSync(root, { recursive: true, force: true });
});

test('an explicit field of the level beats the character node of the same level', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-char-'));
  const lucas = path.basename(characterDir(root, 'lucas'));
  const bags = {
    domain: {},
    series: { character: 'lucas', voice: 'custom-voice' },
    kind: {},
    video: { language: 'es' },
    scene: {},
    layer: {},
    blueprint: {},
  };
  const characterOf = (name) => loadCharacter(findCharacter(root, name));
  const c = createCascade({ bags, characterOf });
  const voice = c.at('scene-1').get('voice');
  assert.equal(voice.value, 'custom-voice');
  assert.equal(voice.source, 'series');
  fs.rmSync(root, { recursive: true, force: true });
});