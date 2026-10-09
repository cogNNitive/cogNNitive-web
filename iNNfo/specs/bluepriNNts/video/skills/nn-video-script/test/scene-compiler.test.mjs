#!/usr/bin/env node

/**
 * nn-video-script/test/scene-compiler.test.mjs
 *
 * Unit tests for RemotionSceneCompiler:
 * - VUS/markdown script parsing and manifest generation
 * - Accurate frame math (frames = ceil(durationInSeconds * fps))
 * - Timeline continuity without gaps
 * - Visual overlays (lowerThird, kineticTitle, conceptCallout) frame offsets & props
 * - Error handling for invalid inputs
 */

import assert from 'node:assert';
import { RemotionSceneCompiler } from '../scripts/remotion-scene-compiler.mjs';

const sampleScript = `
//ANYDEO_SPEC: V_0-3-3
# Video
- video_title: Quantum Computing Explained
- video_fps: 30

# Scenes

## Scene 1: Introduction
@base Intro Scene
Welcome to the fascinating world of quantum computing.
- scene_type: chapter_title
- scene_duration: 4.5
- scene_transition: fade

@@ Lower Third
- layer_type: lowerThird
- layer_title: Dr. Alice Smith
- layer_subtitle: Quantum Researcher
- layer_speaker_tag: Lead Scientist
- from_frame_offset: 15
- duration_in_frames: 75

## Scene 2: The Core Mechanism
@base Mechanism
Superposition allows qubits to exist in multiple states simultaneously.
- scene_type: concept_diagram
- scene_duration: 6.0

@@ Diagram Layer
- layer_type: conceptCallout
- layer_label: Superposition
- layer_description: Qubit in alpha|0> + beta|1> state
- layer_icon: atom

@@ Heading
- layer_type: kineticTitle
- layer_heading: Quantum States
- layer_theme: accent

## Scene 3: Conclusion
@base Outro
Join us next time as we explore quantum entanglement.
- scene_type: image_motion
- scene_duration: 3.0
`;

async function runTests() {
  console.log('Running Remotion Scene Compiler unit tests...');
  const compiler = new RemotionSceneCompiler({ fps: 30, width: 1920, height: 1080 });

  // Test 1: Compile sample script into typed manifest
  {
    const manifest = compiler.compile(sampleScript);
    assert.strictEqual(manifest.version, '1.0.0');
    assert.strictEqual(manifest.compositionId, 'quantum-computing-explained');
    assert.strictEqual(manifest.fps, 30);
    assert.strictEqual(manifest.width, 1920);
    assert.strictEqual(manifest.height, 1080);
    assert.strictEqual(manifest.tracks.scenes.length, 3);
    assert.strictEqual(manifest.metadata.generator, 'cogNNitive Video Engine');
    console.log('✔ Compiles multi-scene script into typed Remotion composition manifest');
  }

  // Test 2: Frame calculations and timeline continuity
  {
    const manifest = compiler.compile(sampleScript);
    const [scene1, scene2, scene3] = manifest.tracks.scenes;

    // Scene 1: 4.5s * 30 fps = 135 frames
    assert.strictEqual(scene1.fromFrame, 0);
    assert.strictEqual(scene1.durationInFrames, 135);
    assert.strictEqual(scene1.sceneType, 'chapter_title');
    assert.deepStrictEqual(scene1.transition, { type: 'fade', durationInFrames: 15, easing: 'bezier(0.16,1,0.3,1)' });

    // Scene 2: 6.0s * 30 fps = 180 frames, starts at 135
    assert.strictEqual(scene2.fromFrame, 135);
    assert.strictEqual(scene2.durationInFrames, 180);
    assert.strictEqual(scene2.sceneType, 'concept_diagram');

    // Scene 3: 3.0s * 30 fps = 90 frames, starts at 315
    assert.strictEqual(scene3.fromFrame, 315);
    assert.strictEqual(scene3.durationInFrames, 90);
    assert.strictEqual(scene3.sceneType, 'image_motion');

    // Total frames = 135 + 180 + 90 = 405 frames = 13.5s
    assert.strictEqual(manifest.totalDurationInFrames, 405);
    assert.strictEqual(manifest.totalDurationInSeconds, 13.5);
    console.log('✔ Accurate frame math and continuous timeline sequence without gaps');
  }

  // Test 3: Overlay tracks compilation (lowerThird, kineticTitle, conceptCallout)
  {
    const manifest = compiler.compile(sampleScript);
    const overlays = manifest.tracks.overlays;
    assert.strictEqual(overlays.length, 3);

    // lowerThird
    const lt = overlays.find((o) => o.type === 'lowerThird');
    assert.ok(lt);
    assert.strictEqual(lt.fromFrame, 15);
    assert.strictEqual(lt.durationInFrames, 75);
    assert.strictEqual(lt.config.title, 'Dr. Alice Smith');
    assert.strictEqual(lt.config.subtitle, 'Quantum Researcher');
    assert.strictEqual(lt.config.speakerTag, 'Lead Scientist');

    // conceptCallout
    const cc = overlays.find((o) => o.type === 'conceptCallout');
    assert.ok(cc);
    assert.strictEqual(cc.fromFrame, 135);
    assert.strictEqual(cc.durationInFrames, 180);
    assert.strictEqual(cc.config.label, 'Superposition');
    assert.strictEqual(cc.config.icon, 'atom');

    // kineticTitle
    const kt = overlays.find((o) => o.type === 'kineticTitle');
    assert.ok(kt);
    assert.strictEqual(kt.fromFrame, 135);
    assert.strictEqual(kt.config.heading, 'Quantum States');
    assert.strictEqual(kt.config.theme, 'accent');

    console.log('✔ Visual overlay component compilers configure lowerThird, kineticTitle, conceptCallout accurately');
  }

  // Test 4: Audio-driven duration synchronization
  {
    const manifest = compiler.compile(sampleScript, {
      audioDurations: {
        scene_1_scene_1_introduction: 5.2,
      },
    });
    const scene1 = manifest.tracks.scenes[0];
    // 5.2s * 30 fps = ceil(156) = 156 frames
    assert.strictEqual(scene1.durationInFrames, 156);
    console.log('✔ Audio duration overrides calculate precise timeline frame alignment');
  }

  // Test 6: VUS `# Sets`, `@template`, `@scene` and `@@layer` hierarchy
  {
    const vusScript = `
//ANYDEO_SPEC: V_0-3-3
# Sets
## Set 1: Studio Setup
- set_lighting: dramatic

# Video
- video_title: Series Episode 1
- video_fps: 30

# Scenes
## @scene Scene A: The Hook
@template news-intro
Welcome back viewers to our deep dive.
- scene_tts_model: elevenlabs
- scene_voice: rachel
- scene_duration: 4.0

@@ Background Layer
- layer_type: image
- layer_asset_source: /assets/studio.png

@@ Overlay Kinetic
- layer_type: kineticTitle
- layer_heading: Breaking News

## @scene Scene B: The Investigation
@template explainer
Here is what we discovered after analyzing the logs.
- scene_tts_model: openai-tts
- scene_voice: alloy
- scene_duration: 5.0

@@ Diagram Layer
- layer_type: conceptCallout
- layer_label: Architecture Drift
- layer_description: Unsynchronized node graphs detected
`;

    const manifest = compiler.compile(vusScript);
    assert.strictEqual(manifest.tracks.scenes.length, 2);
    assert.strictEqual(manifest.tracks.scenes[0].props.title.includes('The Hook'), true);
    assert.strictEqual(manifest.tracks.scenes[1].props.title.includes('The Investigation'), true);
    assert.strictEqual(manifest.tracks.scenes[0].durationInFrames, 120); // 4.0s * 30fps
    assert.strictEqual(manifest.tracks.scenes[1].durationInFrames, 150); // 5.0s * 30fps

    // Overlays per scene mapping
    const overlays = manifest.tracks.overlays;
    assert.strictEqual(overlays.length, 2);
    assert.strictEqual(overlays[0].type, 'kineticTitle');
    assert.strictEqual(overlays[0].fromFrame, 0);
    assert.strictEqual(overlays[1].type, 'conceptCallout');
    assert.strictEqual(overlays[1].fromFrame, 120);

    console.log('✔ VUS # Sets, @template, @scene headers and per-scene layer mapping test passed');
  }

  // Test 7: Canonical VUS `@Template Scene Title` without `##` headers (Issue #107) and parser parity
  {
    const canonicalVus = `
//ANYDEO_SPEC: V_0-3-3
# Video
- video_title: Cosicah Episode 1
- video_fps: 30

# Templates
@template news-intro
- scene_tts_model: elevenlabs
- scene_voice: rachel

@template explainer
- scene_tts_model: openai-tts
- scene_voice: alloy

# Scenes

@news-intro Hook: The Discovery
We found something shocking in the deep network logs.
- scene_duration: 4.0

@@ Overlay Lower Third
- layer_type: lowerThird
- layer_title: Lead Analyst

@explainer Deep Dive: Architecture
Here is how the packets were traversing the gateway.
- scene_duration: 6.0

@explainer Conclusion: Next Steps
Stay tuned for part two of our investigation.
- scene_duration: 3.5
`;

    const manifest = compiler.compile(canonicalVus);
    assert.strictEqual(manifest.tracks.scenes.length, 3);
    assert.strictEqual(manifest.tracks.scenes[0].id, 'scene_1_hook_the_discovery');
    assert.strictEqual(manifest.tracks.scenes[1].id, 'scene_2_deep_dive_architecture');
    assert.strictEqual(manifest.tracks.scenes[2].id, 'scene_3_conclusion_next_steps');

    // Layer mapping test
    assert.strictEqual(manifest.tracks.scenes[0].props.layers.length, 1);
    assert.strictEqual(manifest.tracks.scenes[1].props.layers.length, 0);

    // Parity test against parse() from the vendored parser mirror
    const { parse: parseVus } = await import('../scripts/lib/innfo-video-parser.generated.mjs');
    const parserRes = parseVus(canonicalVus);
    const parserScenes = (parserRes.project.sections || []).flatMap((s) => s.scenes || []);
    assert.strictEqual(manifest.tracks.scenes.length, parserScenes.length);
    for (let i = 0; i < parserScenes.length; i++) {
      assert.strictEqual(manifest.tracks.scenes[i].props.title, parserScenes[i].scene_name);
    }

    console.log('✔ Canonical VUS @template scene declaration and parser parity test passed (Issue #107)');
  }

  // Test: first-class style props — captions default + font + transition easing, no HTML comments
  {
    const styled = `
# Video
- video_title: Styled Test
- video_font: Inter
- video_caption_style: tiktok
- video_transition: fade

# Scenes

## Scene 1: Hook
Hello world this is a caption test.
- scene_duration: 4.0
- caption_size: 90

@@ Name Card
- layer_type: lowerThird
- layer_title: Host
- font_family: Inter
- font_size: 44
`;
    const manifest = compiler.compile(styled, { style: { video_caption_highlight: '#39E508' } });
    const scene = manifest.tracks.scenes[0];
    assert.strictEqual(scene.props.fontFamily, 'Inter');
    assert.strictEqual(scene.props.captionStyle, 'tiktok');
    assert.strictEqual(scene.transition.easing, 'bezier(0.16,1,0.3,1)');
    const caps = manifest.tracks.overlays.find((o) => o.type === 'captions');
    assert.ok(caps, 'scene caption default emits a captions overlay');
    assert.strictEqual(caps.config.size, 90);
    assert.strictEqual(caps.config.highlight, '#39E508');
    const lt = manifest.tracks.overlays.find((o) => o.type === 'lowerThird');
    assert.strictEqual(lt.config.fontFamily, 'Inter');
    assert.strictEqual(lt.config.fontSize, 44);
    console.log('✔ First-class style props: captions default + font + transition easing');
  }

  console.log('\nAll scene compiler unit tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
