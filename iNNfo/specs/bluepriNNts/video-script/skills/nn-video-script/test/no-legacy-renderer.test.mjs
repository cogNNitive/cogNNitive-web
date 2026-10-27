#!/usr/bin/env node

/**
 * nn-video-script/test/no-legacy-renderer.test.mjs
 *
 * The single residue guard for the skill tree: no file except this one may
 * mention "remotion" (case-insensitive). It also proves the manifest carries no
 * dead fields — no scene track has `sceneType`, and every overlay `config` key is
 * one the project emitter actually reads.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { buildProject } from '../scripts/scene-project.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.resolve(__dirname, '..');
const SELF = fileURLToPath(import.meta.url);

/** Walks the skill tree, skipping this guard test and any node_modules. */
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

function model({ scenes = [], layers = [] } = {}) {
  return {
    version: 'innfo-read-knowledge@1',
    frontmatter: { title: 'Residue' },
    elements: {
      Video: [{ type: 'Video', name: 'Residue', slug: 'residue', fields: { title: 'Residue' } }],
      Scene: scenes,
      Layer: layers,
    },
  };
}

async function runTests() {
  console.log('Running no-legacy-renderer residue tests...');

  // 1. Skill tree is free of Remotion text.
  {
    const offenders = [];
    for (const file of walk(SKILL_DIR)) {
      if (path.resolve(file) === path.resolve(SELF)) continue;
      if (/remotion/i.test(fs.readFileSync(file, 'utf8'))) {
        offenders.push(path.relative(SKILL_DIR, file).split(path.sep).join('/'));
      }
    }
    assert.deepStrictEqual(offenders, [], `files must not mention "remotion": ${offenders.join(', ')}`);
    console.log('✔ the skill tree is free of Remotion text');
  }

  // 2. Manifest carries no dead fields.
  {
    const compiler = new SceneCompiler({ fps: 30 });
    const manifest = compiler.compile(model({
      scenes: [{ type: 'Scene', name: 'Scene', slug: 'scene', description: 'narration', fields: {} }],
      layers: [
        { type: 'Layer', name: 'Title', slug: 'title', fields: { type: 'title', text: 'Heading' } },
        { type: 'Layer', name: 'Caption', slug: 'caption', fields: { type: 'caption', text: 'A caption' } },
      ],
    }));
    for (const scene of manifest.tracks.scenes) {
      assert.ok(!('sceneType' in scene), 'a scene track must not carry sceneType');
    }
    // Every overlay config key must be one the emitter reads (`cfg.<key>` in overlay-blocks.mjs).
    const emitterSrc = fs.readFileSync(path.join(SKILL_DIR, 'scripts', 'overlay-blocks.mjs'), 'utf8');
    const readKeys = new Set([...emitterSrc.matchAll(/\bcfg\.([A-Za-z0-9_]+)/g)].map((m) => m[1]));
    for (const overlay of manifest.tracks.overlays) {
      for (const key of Object.keys(overlay.config || {})) {
        assert.ok(readKeys.has(key), `overlay config key "${key}" is not read by the emitter`);
      }
    }
    assert.ok(Object.values(buildProject(manifest).files).length > 0);
    console.log('✔ the manifest carries no sceneType and no unread overlay config keys');
  }

  console.log('\nAll no-legacy-renderer residue tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
