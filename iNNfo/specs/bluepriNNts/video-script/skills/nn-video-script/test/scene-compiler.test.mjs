#!/usr/bin/env node

/**
 * nn-video-script/test/scene-compiler.test.mjs
 *
 * Unit tests for RemotionSceneCompiler against the structured iNNfo model:
 * - accurate frame math (frames = ceil(durationInSeconds * fps))
 * - timeline continuity without gaps
 * - `type::` → overlay/layer mapping and frame offsets
 * - audio-driven duration synchronization
 * - `transition::` passthrough
 */

import assert from 'node:assert';
import { RemotionSceneCompiler } from '../scripts/remotion-scene-compiler.mjs';

/** Builds a read_knowledge-shaped model for tests. */
function model({ title = 'Test Video', scenes = [], layers = [] } = {}) {
  return {
    version: 'innfo-read-knowledge@1',
    frontmatter: { title },
    elements: {
      Video: [{ type: 'Video', name: title, slug: 'test-video', fields: { title } }],
      Scene: scenes,
      Layer: layers,
    },
  };
}

function scene(name, slug, narration = '', fields = {}) {
  return { type: 'Scene', name, slug, description: narration, fields };
}

function layer(name, slug, fields = {}) {
  return { type: 'Layer', name, slug, fields };
}

async function runTests() {
  console.log('Running Remotion Scene Compiler unit tests...');
  const compiler = new RemotionSceneCompiler({ fps: 30, width: 1920, height: 1080 });

  // Test 1: compile into a typed manifest.
  {
    const manifest = compiler.compile(model({
      title: 'Quantum Computing Explained',
      scenes: [
        scene('Introduction', 'introduction', 'Welcome to quantum computing.', { transition: 'fade' }),
        scene('Core Mechanism', 'core-mechanism', 'Superposition allows qubits.'),
        scene('Conclusion', 'conclusion', 'Join us next time.'),
      ],
      layers: [
        layer('Lower Third', 'lower-third', { type: 'lower-third', text: 'Dr. Alice Smith', position: 'bottom' }),
        layer('Heading', 'heading', { type: 'title', text: 'Quantum States', position: 'bottom' }),
      ],
    }));
    assert.strictEqual(manifest.version, '1.0.0');
    assert.strictEqual(manifest.compositionId, 'quantum-computing-explained');
    assert.strictEqual(manifest.tracks.scenes.length, 3);
    assert.strictEqual(manifest.metadata.generator, 'cogNNitive Video Engine');
    console.log('✔ Compiles a multi-scene model into a typed Remotion composition manifest');
  }

  // Test 2: frame calculations and timeline continuity.
  {
    const m = model({
      title: 'Timeline',
      scenes: [
        scene('One', 'one', 'a b c d e f g h i j'), // 10 words
        scene('Two', 'two', 'a b c d e f g h i j k l m n o'), // 15 words
        scene('Three', 'three', 'a b c'),
      ],
    });
    const manifest = new RemotionSceneCompiler({ fps: 30, wordsPerSecond: 5 }).compile(m);
    const [s1, s2, s3] = manifest.tracks.scenes;
    // 10 words / 5 wps = 2s -> max(3,2)=3s -> 90 frames.
    assert.strictEqual(s1.fromFrame, 0);
    assert.strictEqual(s1.durationInFrames, 90);
    assert.strictEqual(s2.fromFrame, 90);
    assert.strictEqual(s2.durationInFrames, 90); // 15/5 = 3s
    assert.strictEqual(s3.fromFrame, 180);
    assert.strictEqual(manifest.totalDurationInFrames, 270);
    console.log('✔ Accurate frame math and continuous timeline sequence without gaps');
  }

  // Test 3: overlay mapping and text sourced from `text::`.
  {
    const m = model({
      title: 'Overlays',
      scenes: [scene('Scene', 'scene', 'narration')],
      layers: [
        layer('Lower Third', 'lt', { type: 'lower-third', text: 'Dr. Alice Smith', position: 'bottom' }),
        layer('Title', 'title', { type: 'title', text: 'Quantum States', position: 'bottom' }),
        layer('Quote', 'quote', { type: 'quote', text: 'To be or not to be' }),
      ],
    });
    const manifest = compiler.compile(m);
    const overlays = manifest.tracks.overlays;
    assert.strictEqual(overlays.length, 3);
    const lt = overlays.find((o) => o.type === 'lowerThird');
    assert.strictEqual(lt.config.title, 'Dr. Alice Smith');
    const title = overlays.find((o) => o.type === 'kineticTitle');
    assert.strictEqual(title.config.heading, 'Quantum States');
    const q = overlays.find((o) => o.type === 'quote');
    assert.strictEqual(q.config.text, 'To be or not to be');
    console.log('✔ Overlay components map from type:: with text from the text:: field');
  }

  // Test 4: audio-driven duration synchronization.
  {
    const m = model({ title: 'Audio', scenes: [scene('One', 'one', 'hello world')] });
    const manifest = compiler.compile(m, { audioDurations: { scene_one: 5.2 } });
    assert.strictEqual(manifest.tracks.scenes[0].durationInFrames, 156); // ceil(5.2*30)
    console.log('✔ Audio duration overrides calculate precise timeline frame alignment');
  }

  // Test 5: transition:: reaches the manifest.
  {
    const m = model({ title: 'Trans', scenes: [scene('One', 'one', 'hi', { transition: 'slide-left' })] });
    const manifest = compiler.compile(m);
    assert.deepStrictEqual(manifest.tracks.scenes[0].transition, {
      type: 'slide-left',
      durationInFrames: 15,
      easing: 'bezier(0.16,1,0.3,1)',
    });
    console.log('✔ transition:: is carried into the scene track');
  }

  // Test 6: scene `music::` emits a looping background-music track; an absolute
  //         path is rejected.
  {
    const m = model({
      title: 'Music',
      scenes: [scene('One', 'one', 'hello world', { music: '../../shared/music/loop.m4a' })],
    });
    const manifest = compiler.compile(m);
    const music = manifest.tracks.audio.filter((a) => a.id.startsWith('bgmusic_'));
    assert.strictEqual(music.length, 1);
    const sc = manifest.tracks.scenes[0];
    assert.strictEqual(music[0].sceneId, sc.id);
    assert.strictEqual(music[0].fromFrame, sc.fromFrame);
    assert.strictEqual(music[0].durationInFrames, sc.durationInFrames);
    assert.strictEqual(music[0].kind, 'music');
    assert.strictEqual(music[0].loop, true);
    assert.strictEqual(music[0].assetPath, '../../shared/music/loop.m4a');

    const abs = model({ title: 'Bad', scenes: [scene('One', 'one', 'hi', { music: 'C:/x.m4a' })] });
    assert.throws(() => compiler.compile(abs), /Invalid music/i);
    console.log('✔ scene music:: emits a looping bgmusic track; absolute paths are rejected');
  }

  console.log('\nAll scene compiler unit tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
