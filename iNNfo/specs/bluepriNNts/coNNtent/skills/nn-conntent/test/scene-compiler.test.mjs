#!/usr/bin/env node

/**
 * nn-conntent/test/scene-compiler.test.mjs
 *
 * Unit tests for SceneCompiler against the structured iNNfo model:
 * - accurate frame math (frames = ceil(durationInSeconds * fps))
 * - timeline continuity without gaps
 * - `type::` → overlay/layer mapping and frame offsets
 * - audio-driven duration synchronization
 * - `transition::` passthrough
 */

import assert from 'node:assert';
import { SceneCompiler, assignLayersToScenes } from '../scripts/scene-compiler.mjs';

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
  console.log('Running Scene Compiler unit tests...');
  const compiler = new SceneCompiler({ fps: 30, width: 1920, height: 1920 });

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
    console.log('✔ Compiles a multi-scene model into a typed composition manifest');
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
    const manifest = new SceneCompiler({ fps: 30, wordsPerSecond: 5, width: 1920, height: 1920 }).compile(m);
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

  // Test 3b: a full-scene lower-third must not displace quote/b-roll slots.
  {
    const m = model({
      title: 'Overlay Slots',
      scenes: [scene('Scene', 'scene', 'narration narration narration narration narration narration')],
      layers: [
        layer('Lower Third', 'lt', { type: 'lower-third', text: 'Host Name', position: 'bottom' }),
        layer('Quote', 'q', { type: 'quote', text: 'A quote' }),
        layer('B-Roll', 'br', { type: 'b-roll', asset: 'media/shot.png' }),
      ],
    });
    const manifest = compiler.compile(m);
    const overlays = manifest.tracks.overlays;
    const quote = overlays.find((o) => o.type === 'quote');
    const broll = overlays.find((o) => o.type === 'broll');
    const scene0 = manifest.tracks.scenes[0];
    assert.ok(quote, 'quote is emitted');
    assert.ok(broll, 'b-roll is not dropped when a lower-third is present');
    assert.strictEqual(quote.fromFrame, scene0.fromFrame, 'lower-third does not displace the quote into a later slot');
    assert.strictEqual(broll.fromFrame, quote.fromFrame + quote.durationInFrames, 'quote and b-roll are back-to-back slots');
    console.log('✔ full-scene lower-third does not displace quote/b-roll slots');
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
    });
    console.log('✔ transition:: is carried into the scene track');
  }

  // Test 6: scene `background_audio::` emits a looping track; an absolute
  //         path is rejected.
  {
    const m = model({
      title: 'Music',
      scenes: [scene('One', 'one', 'hello world', { background_audio: '../../shared/music/loop.m4a' })],
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

    const abs = model({ title: 'Bad', scenes: [scene('One', 'one', 'hi', { background_audio: 'C:/x.m4a' })] });
    assert.throws(() => compiler.compile(abs), /Invalid background audio/i);
    console.log('✔ scene music:: emits a looping bgmusic track; absolute paths are rejected');
  }

  // Test 7: nested layer binding via explicit parentSlug (even without slug prefix match).
  {
    const scs = [
      scene('Scene Alpha', 'scene-alpha', 'Narration for alpha'),
      scene('Scene Beta', 'scene-beta', 'Narration for beta'),
    ];
    const lys = [
      { type: 'Layer', name: 'Random Title', slug: 'unrelated-slug-xyz', parentSlug: 'scene-beta', fields: { type: 'title', text: 'Overlay on Beta' } },
      { type: 'Layer', name: 'Alpha Avatar', slug: 'avatar-standalone', parentElement: { concept: 'Scene', name: 'Scene Alpha', slug: 'scene-alpha' }, fields: { type: 'presenter', asset: 'avatar.png', prompt: 'Talking avatar' } },
    ];
    const buckets = assignLayersToScenes(scs, lys);
    assert.strictEqual(buckets[0].length, 1);
    assert.strictEqual(buckets[0][0].name, 'Alpha Avatar');
    assert.strictEqual(buckets[1].length, 1);
    assert.strictEqual(buckets[1][0].name, 'Random Title');

    // Compile end-to-end to verify scene track layer lowering
    const m = model({
      title: 'Nested Test Video',
      scenes: scs,
      layers: lys,
    });
    const manifest = compiler.compile(m);
    assert.strictEqual(manifest.tracks.scenes.length, 2);
    // Alpha has 1 layer (presenter)
    assert.strictEqual(manifest.tracks.scenes[0].props.layers.length, 1);
    assert.strictEqual(manifest.tracks.scenes[0].props.layers[0].name, 'Alpha Avatar');
    // Beta has 1 overlay (title)
    const betaOverlays = manifest.tracks.overlays.filter((o) => o.fromFrame >= manifest.tracks.scenes[1].fromFrame);
    assert.strictEqual(betaOverlays.length, 1);
    assert.strictEqual(betaOverlays[0].type, 'kineticTitle');
    console.log('✔ explicit parentSlug / parentElement binds layers without slug-prefix match');
  }

  // Test 8: legacy flat fallback continues binding via slug prefix.
  {
    const scs = [
      scene('Scene Alpha', 'scene-alpha', 'Alpha narration'),
      scene('Scene Beta', 'scene-beta', 'Beta narration'),
    ];
    const lys = [
      { type: 'Layer', name: 'Layer A', slug: 'scene-alpha-title', fields: { type: 'title', text: 'Alpha Title' } },
      { type: 'Layer', name: 'Layer B', slug: 'scene-beta-lowerthird', fields: { type: 'lower-third', text: 'Beta Subtitle' } },
    ];
    const buckets = assignLayersToScenes(scs, lys);
    assert.strictEqual(buckets[0].length, 1);
    assert.strictEqual(buckets[0][0].slug, 'scene-alpha-title');
    assert.strictEqual(buckets[1].length, 1);
    assert.strictEqual(buckets[1][0].slug, 'scene-beta-lowerthird');
    console.log('✔ legacy flat scripts lacking parentSlug resolve via slug-prefix fallback');
  }

  // Test 9 (Task 2.1): scene text layers are lowered to overlays.
  {
    const scs = [
      scene('Scene One', 'scene-one', 'First scene narration with enough words to have length'),
      scene('Scene Two', 'scene-two', 'Second scene narration with no text layers at all'),
    ];
    const lys = [
      layer('Main Title', 'scene-one-title', { type: 'text', style: 'title', text: 'Botijos News', position: 'bottom' }),
      layer('Presenter Subtitle', 'scene-one-lt', { type: 'text', style: 'lower-third', text: 'Dr. Host', position: 'bottom' }),
      layer('Speech Caption', 'scene-one-caption', { type: 'text', style: 'caption', text: 'Captioned words' }),
      layer('Background Video', 'scene-one-media', { type: 'media', asset: 'media/bg.mp4' }),
      layer('Talking Presenter', 'scene-one-avatar', { type: 'avatar', asset: 'avatars/host.png' }),
    ];
    const manifest = compiler.compile(model({ title: 'Text Layer Lowering', scenes: scs, layers: lys }));
    
    // Assert 3 overlays created for Scene 1 with declared texts
    const overlays = manifest.tracks.overlays;
    assert.strictEqual(overlays.length, 3, 'expected exactly 3 overlays from text layers');
    const titleOverlay = overlays.find((o) => o.type === 'kineticTitle');
    assert.ok(titleOverlay, 'title lowered to kineticTitle');
    assert.strictEqual(titleOverlay.config.heading, 'Botijos News', 'text comes from declared text field');
    
    const ltOverlay = overlays.find((o) => o.type === 'lowerThird');
    assert.ok(ltOverlay, 'lower-third lowered to lowerThird');
    assert.strictEqual(ltOverlay.config.title, 'Dr. Host', 'text comes from declared text field');

    const captionOverlay = overlays.find((o) => o.type === 'captions');
    assert.ok(captionOverlay, 'caption lowered to captions');

    // Assert no layer_type: text left in props.layers
    const scene1 = manifest.tracks.scenes[0];
    const scene1Layers = scene1.props.layers || [];
    assert.strictEqual(scene1Layers.some((l) => l.properties?.layer_type === 'text'), false, 'no layer_type: text left in props.layers');

    // Assert scene 2 (no text layers) adds no text overlay
    const scene2 = manifest.tracks.scenes[1];
    const scene2Overlays = overlays.filter((o) => o.fromFrame >= scene2.fromFrame);
    assert.strictEqual(scene2Overlays.length, 0, 'scene without text layers adds no text overlay');

    // Global timing
    assert.strictEqual(titleOverlay.fromFrame, scene1.fromFrame, 'overlay starts at scene start + offset');
    console.log('✔ Text layers lowered to typed overlays and removed from props.layers');
  }

  // Test 10 (Task 2.2): text Layer with missing or unknown style fails checkScript with unknown-text-style
  {
    const badModelMissing = model({
      title: 'Missing Style',
      scenes: [scene('Scene One', 'scene-one', 'Narration')],
      layers: [layer('Broken Text', 'broken-text', { type: 'text', text: 'Hello' })],
    });
    const resMissing = compiler.checkScript(badModelMissing);
    assert.strictEqual(resMissing.ok, false, 'checkScript should fail on missing text style');
    assert.ok(resMissing.errors.some((e) => e.code === 'unknown-text-style'), 'fails with unknown-text-style when style is missing');

    const badModelUnknown = model({
      title: 'Unknown Style',
      scenes: [scene('Scene One', 'scene-one', 'Narration')],
      layers: [layer('Broken Text', 'broken-text', { type: 'text', style: 'marquee', text: 'Hello' })],
    });
    const resUnknown = compiler.checkScript(badModelUnknown);
    assert.strictEqual(resUnknown.ok, false, 'checkScript should fail on unknown text style');
    assert.ok(resUnknown.errors.some((e) => e.code === 'unknown-text-style'), 'fails with unknown-text-style when style is unknown');
    console.log('✔ checkScript fails with unknown-text-style on missing or unknown text style');
  }

  // Test 11 (Phase 7): language cascades to properties.scene_language; missing language fails
  {
    const modelWithLang = model({
      title: 'Spanish Video',
      scenes: [scene('Scene Uno', 'scene-uno', 'Hola')],
    });
    modelWithLang.elements.Video[0].fields.language = 'es';
    const lowered = compiler.lowerKnowledgeModel(modelWithLang, { fps: 30, width: 1920, height: 1920 });
    assert.strictEqual(lowered.scenes[0].properties.scene_language, 'es', 'scene_language is cascaded from Video');

    const modelNoLang = model({
      title: 'No Language Video',
      scenes: [scene('Scene One', 'scene-one', 'Hello', { kind: 'Libre' })],
    });
    modelNoLang.frontmatter.blueprint_version = 'V_0-15-0';
    delete modelNoLang.elements.Video[0].fields.language;
    assert.throws(
      () => compiler.lowerKnowledgeModel(modelNoLang, { fps: 30, width: 1920, height: 1920 }),
      (err) => err.code === 'missing-language',
      'fails with missing-language when no language is declared',
    );
    console.log('✔ language cascades to scene_language; missing language fails');
  }

  console.log('\nAll scene compiler unit tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
