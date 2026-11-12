#!/usr/bin/env node

/**
 * nn-conntent/test/animation-layer.test.mjs
 *
 * RED→GREEN tests for the `animation` Layer type and authored-project mounting
 * (design D7/D8, slice S8). The model side (this file's first block) proves a
 * `type:: animation` Layer is valid with an `asset::` and rejected without, and
 * that an unknown type is rejected. The mounting side (later blocks) proves the
 * authored project is read pre-compile (id + duration), a narrated scene lasts its
 * narration (the animation is trimmed or looped to it), the host is a root
 * sub-composition with its own audio (no `muted`, no playback-rate), and ids of
 * different projects must not collide.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { buildProject } from '../scripts/scene-project.mjs';
import { stageAuthoredProjects } from '../scripts/hyperframes-render.mjs';
import {
  readAuthoredProject,
  resolveAnimations,
  assertAnimationIds,
  AnimationProjectError,
  AnimationIdCollisionError,
} from '../scripts/lib/animations.mjs';

const cliPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'lib', 'compile.mjs');

function tmp(prefix = 'nn-animation-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A minimal authored HyperFrames project root: id + duration + a nested asset. */
const AUTHED = `<!doctype html>
<html lang="en">
  <body>
    <div id="root" data-composition-id="demo-anim" data-start="0" data-duration="6" data-width="1080" data-height="1080"></div>
  </body>
</html>
`;

function model({ layers = [], scenes = [] } = {}) {
  return {
    version: 'innfo-read-knowledge@1',
    frontmatter: { title: 'Anim' },
    elements: {
      Video: [{ type: 'Video', name: 'Anim', slug: 'anim', fields: { title: 'Anim' } }],
      Scene: scenes,
      Layer: layers,
    },
  };
}

const scene = (name, slug, narration = '') => ({ type: 'Scene', name, slug, description: narration, fields: {} });
const layer = (name, slug, fields) => ({ type: 'Layer', name, slug, fields });

test('a type:: animation Layer is valid with an asset', () => {
  const compiler = new SceneCompiler({ width: 1920, height: 1920 });
  const guard = compiler.checkScript(
    model({
      scenes: [scene('S', 's', 'hello')],
      layers: [layer('Anim', 'a', { type: 'animation', asset: 'assets/demo' })],
    }),
  );
  assert.equal(guard.ok, true, JSON.stringify(guard.errors));
});

test('a type:: animation Layer without an asset is rejected', () => {
  const compiler = new SceneCompiler({ width: 1920, height: 1920 });
  const guard = compiler.checkScript(
    model({
      scenes: [scene('S', 's', 'hello')],
      layers: [layer('Anim', 'a', { type: 'animation' })],
    }),
  );
  assert.equal(guard.ok, false);
  assert.ok(guard.errors.some((e) => e.code === 'missing-conditional-field'), JSON.stringify(guard.errors));
});

test('an unknown layer type is rejected', () => {
  const compiler = new SceneCompiler({ width: 1920, height: 1920 });
  const guard = compiler.checkScript(
    model({
      scenes: [scene('S', 's', 'hello')],
      layers: [layer('X', 'x', { type: 'nope', asset: 'a.png' })],
    }),
  );
  assert.equal(guard.ok, false);
  assert.ok(guard.errors.some((e) => e.code === 'unknown-layer-type'), JSON.stringify(guard.errors));
});

// --- Pre-pass: the authored project declares id + duration --------------------

test('readAuthoredProject reads the root data-composition-id and data-duration', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, 'index.html'), AUTHED, 'utf8');
  const project = readAuthoredProject(dir);
  assert.equal(project.id, 'demo-anim');
  assert.equal(project.durationSeconds, 6);
  assert.equal(readAuthoredProject(path.join(dir, 'missing')), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('resolveAnimations reads every animation Layer and its project, keyed by scene', () => {
  const root = tmp();
  const projDir = path.join(root, 'assets', 'demo');
  fs.mkdirSync(projDir, { recursive: true });
  fs.writeFileSync(path.join(projDir, 'index.html'), AUTHED, 'utf8');
  const scenes = [
    { id: 'scene_a', slug: 'a', layers: [{ type: 'animation', name: 'A', slug: 'a-anim', properties: { layer_asset_source: 'assets/demo' } }] },
    { id: 'scene_b', slug: 'b', layers: [{ type: 'title', name: 'T', slug: 't' }] },
  ];
  const animations = resolveAnimations({ scenes, scriptDir: root });
  assert.deepEqual(Object.keys(animations), ['scene_a']);
  assert.equal(animations.scene_a[0].id, 'demo-anim');
  assert.equal(animations.scene_a[0].durationSeconds, 6);
  assert.equal(animations.scene_a[0].sourceDir, projDir);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a missing animation project fails loudly with a named error', () => {
  const root = tmp();
  const scenes = [{ id: 'scene_a', slug: 'a', layers: [{ type: 'animation', name: 'A', slug: 'a-anim', properties: { layer_asset_source: 'assets/nope' } }] }];
  assert.throws(
    () => resolveAnimations({ scenes, scriptDir: root }),
    (err) => {
      assert.ok(err instanceof AnimationProjectError);
      assert.match(err.message, /assets[\\/]nope[\\/]index\.html/);
      return true;
    },
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('an authored id colliding with a scene slug, root id, component id or another animation is an error naming both', () => {
  const cases = [
    { animations: { scene_a: [{ id: 'b' }] }, sceneSlugs: ['b'], rootId: 'demo', componentIds: [] },
    { animations: { scene_a: [{ id: 'demo' }] }, sceneSlugs: [], rootId: 'demo', componentIds: [] },
    { animations: { scene_a: [{ id: 'lower-third' }] }, sceneSlugs: [], rootId: 'demo', componentIds: ['lower-third'] },
    { animations: { scene_a: [{ id: 'x' }], scene_b: [{ id: 'x' }] }, sceneSlugs: [], rootId: 'demo', componentIds: [] },
  ];
  for (const c of cases) {
    assert.throws(
      () => assertAnimationIds(c),
      (err) => {
        assert.ok(err instanceof AnimationIdCollisionError, err.message);
        assert.match(err.message, /collides/);
        return true;
      },
    );
  }
  // A clean set passes.
  assert.doesNotThrow(() => assertAnimationIds({ animations: { scene_a: [{ id: 'demo-anim' }] }, sceneSlugs: ['a'], rootId: 'demo', componentIds: ['lower-third'] }));
});

// --- Scene duration: the narration sets it (#615) ------------------------------

test('a narrated scene lasts its narration; only a scene without narration takes the animation length', () => {
  const compiler = new SceneCompiler({ fps: 30, wordsPerSecond: 5, width: 1920, height: 1920 });
  // 5 words / 5 wps = 1s -> max(3,1) = 3s narration; a 6s animation does NOT extend it.
  const long = compiler.compile(
    model({ scenes: [scene('S', 's', 'one two three four five')] }),
    { animations: { scene_s: [{ id: 'demo-anim', durationSeconds: 6, sourceDir: '/x' }] } },
  );
  assert.equal(long.tracks.scenes[0].durationInFrames, 90);
  assert.equal(long.tracks.scenes[0].animations[0].durationInFrames, 180);
  // 30 words / 5 wps = 6s narration; a 4s animation does not shorten it.
  const short = compiler.compile(
    model({ scenes: [scene('S', 's', 'w '.repeat(30).trim())] }),
    { animations: { scene_s: [{ id: 'demo-anim', durationSeconds: 4, sourceDir: '/x' }] } },
  );
  assert.equal(short.tracks.scenes[0].durationInFrames, 180);
  assert.equal(short.tracks.scenes[0].narrationDurationInFrames, 180);
  assert.equal(short.tracks.scenes[0].animations[0].durationInFrames, 120);
  // No narration: the animation sets the length.
  const silent = compiler.compile(
    model({ scenes: [scene('S', 's', '')] }),
    { animations: { scene_s: [{ id: 'demo-anim', durationSeconds: 6, sourceDir: '/x' }] } },
  );
  assert.equal(silent.tracks.scenes[0].durationInFrames, 180);
});

// --- Root mount + emission ----------------------------------------------------

function manifestWithAnimation({ narrationFrames = 180, animationFrames = 180 } = {}) {
  return {
    compositionId: 'demo',
    fps: 30,
    width: 1080,
    height: 1080,
    totalDurationInFrames: narrationFrames,
    totalDurationInSeconds: narrationFrames / 30,
    tracks: {
      scenes: [
        {
          id: 'scene_a',
          slug: 'a',
          fromFrame: 0,
          durationInFrames: narrationFrames,
          narrationDurationInFrames: narrationFrames,
          animations: [{ id: 'demo-anim', durationInFrames: animationFrames, sourceDir: '/x' }],
          props: { layers: [] },
        },
      ],
      audio: [],
      overlays: [],
    },
    metadata: {},
  };
}

test('an animation mounts as a root sub-composition with its own audio (no muted, no playback-rate)', () => {
  const { indexHtml, compositions } = buildProject(manifestWithAnimation());
  assert.match(indexHtml, /data-composition-src="authored\/demo-anim\/index\.html"/);
  assert.match(indexHtml, /data-composition-id="demo-anim"/);
  assert.match(indexHtml, /id="animation-a-demo-anim"/);
  assert.match(indexHtml, /data-start="0"[^>]*data-duration="6"/);
  const host = indexHtml.match(/<div id="animation-a-demo-anim"[^>]*>/)[0];
  assert.doesNotMatch(host, /muted/);
  assert.doesNotMatch(host, /playback/i);
  for (const c of compositions) assert.doesNotMatch(c.html, /demo-anim/, 'animations live at the root, not in a scene sub-composition');
});

test('a longer animation is trimmed to the scene: one host lasting the scene', () => {
  const { indexHtml } = buildProject(manifestWithAnimation({ narrationFrames: 120, animationFrames: 180 }));
  const hosts = indexHtml.match(/<div id="animation-a-demo-anim[^"]*"[^>]*>/g);
  assert.equal(hosts.length, 1);
  assert.match(hosts[0], /data-duration="4"/);
});

test('an animation within one frame of the scene is one host, never a one-frame loop', () => {
  const { indexHtml } = buildProject(manifestWithAnimation({ narrationFrames: 180, animationFrames: 179 }));
  const hosts = indexHtml.match(/<div id="animation-a-demo-anim[^"]*"[^>]*>/g);
  assert.equal(hosts.length, 1);
  assert.match(hosts[0], /data-duration="6"/);
});

// --- Staging ------------------------------------------------------------------

test('staging copies authored/<id>/ and skips .hyperframes/', () => {
  const src = tmp('nn-authored-src-');
  const projectDir = tmp('nn-authored-proj-');
  fs.writeFileSync(path.join(src, 'index.html'), AUTHED, 'utf8');
  fs.mkdirSync(path.join(src, '.hyperframes'));
  fs.writeFileSync(path.join(src, '.hyperframes', 'cache.bin'), 'x', 'utf8');
  fs.mkdirSync(path.join(src, 'assets'));
  fs.writeFileSync(path.join(src, 'assets', 'clip.png'), 'x', 'utf8');

  stageAuthoredProjects({ tracks: { scenes: [{ animations: [{ id: 'demo-anim', sourceDir: src }] }] } }, projectDir);

  const staged = path.join(projectDir, 'authored', 'demo-anim');
  assert.ok(fs.existsSync(path.join(staged, 'index.html')));
  assert.ok(fs.existsSync(path.join(staged, 'assets', 'clip.png')));
  assert.ok(!fs.existsSync(path.join(staged, '.hyperframes')));
  fs.rmSync(src, { recursive: true, force: true });
  fs.rmSync(projectDir, { recursive: true, force: true });
});

// --- compile --dry-run scene target durations ---------------------------------

const DRY_SCRIPT = `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: "coNNtent_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/coNNtent/spec_NN.md"
title: "Animation Demo"
---

# NN index

* [[Video]]
  * [[Scene]]
    * [[Layer]]

# NN Video

## NN Video: Animation Demo
slug:: animation-demo
title:: Animation Demo

# NN Scene

## NN Scene: Overview
slug:: overview

Learn how neural networks process multidimensional input vectors today
`;

test('compile --dry-run prints each scene target duration (estimated)', () => {
  const root = tmp('nn-anim-dry-');
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  const ep = path.join(root, 'ep');
  fs.mkdirSync(ep, { recursive: true });
  const scriptPath = path.join(ep, 'script.md');
  fs.writeFileSync(scriptPath, DRY_SCRIPT, 'utf8');
  const res = spawnSync('node', [cliPath, 'compile', scriptPath, '--dry-run'], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /scene overview: [\d.]+s \(estimated\)/);
  fs.rmSync(root, { recursive: true, force: true });
});
