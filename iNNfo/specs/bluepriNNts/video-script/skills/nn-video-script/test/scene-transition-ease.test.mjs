#!/usr/bin/env node

/**
 * nn-video-script/test/scene-transition-ease.test.mjs
 *
 * A Scene's `transition::` MUST reach the emitted project as a GSAP ease name,
 * never as a CSS `bezier(...)` string. The emitter's default ease (`power2.out`)
 * applies when the compiler carries no `easing`.
 */

import assert from 'node:assert';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { buildProject } from '../scripts/scene-project.mjs';

/** Builds a read_knowledge-shaped model for the test. */
function model({ scenes = [], layers = [] } = {}) {
  return {
    version: 'innfo-read-knowledge@1',
    frontmatter: { title: 'Ease' },
    elements: {
      Video: [{ type: 'Video', name: 'Ease', slug: 'ease', fields: { title: 'Ease' } }],
      Scene: scenes,
      Layer: layers,
    },
  };
}

async function runTests() {
  console.log('Running scene-transition ease tests...');
  const compiler = new SceneCompiler({ fps: 30 });

  const manifest = compiler.compile(model({
    scenes: [{ type: 'Scene', name: 'Fade', slug: 'fade', description: 'hello world', fields: { transition: 'fade' } }],
  }));

  const scene = manifest.tracks.scenes[0];
  assert.ok(scene.transition, 'the scene carries a transition');
  assert.strictEqual(scene.transition.type, 'fade');
  assert.strictEqual(scene.transition.easing, undefined, 'the compiler must not write a CSS easing string');

  const emitted = Object.values(buildProject(manifest).files).join('\n');
  assert.match(emitted, /ease: 'power2\.out'/, 'the emitted tween carries the GSAP ease power2.out');
  assert.ok(!emitted.includes('bezier('), 'no emitted file contains bezier(');

  console.log('✔ scene transition emits the GSAP ease power2.out and no bezier(');
  console.log('\nAll scene-transition ease tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
