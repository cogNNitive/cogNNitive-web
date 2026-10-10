#!/usr/bin/env node

/**
 * nn-video-script/test/knowledge-model-compile.test.mjs
 *
 * Proves the re-pointed engine compiles an L3 guion to a Remotion composition
 * manifest from the STRUCTURED iNNfo model only (a generic inline fixture — the
 * repo ships no series/episode content):
 *  - one RemotionSceneTrack per Scene, in list order;
 *  - overlay text from the Layer `text::` field, never the layer name;
 *  - `template::` resolves from the Series L3 Template document;
 *  - quote/lower-third/b-roll overlays scheduled sequentially, no collision;
 *  - the compiler rejects markdown strings and declared timing, and the VUS parser is gone.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RemotionSceneCompiler, ScriptValidationError } from '../scripts/remotion-scene-compiler.mjs';
import { loadKnowledgeModel, loadTemplateModels, parseKnowledgeDocument } from '../scripts/lib/knowledge-model.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, '..');

const SAMPLE_DOC = `---
level: 3
parent_spec:
  name: "video-script_V_0-1-0"
  url: "https://example.invalid/video-script/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Demo Clip"
---

# NN Video

## NN Video: Demo Clip
slug:: demo-clip
title:: Demo Clip

# NN Scene

## NN Scene: Opening
slug:: opening
template:: [[Demo Series :: Presenter Full]]
music:: media/bed.m4a
transition:: fade

Welcome to the demo.

## NN Scene: Body
slug:: body
template:: [[Demo Series :: Presenter Full]]

This is the body narration.

# NN Layer

## NN Layer: Presenter Opening
slug:: presenter-opening
type:: presenter
asset:: media/face.jpeg

## NN Layer: Background Opening
slug:: background-opening
type:: background
asset:: media/intro.mp4

## NN Layer: Title Opening
slug:: title-opening
type:: title
text:: Demo Title

## NN Layer: Presenter Body
slug:: presenter-body
type:: presenter
asset:: media/face.jpeg

## NN Layer: Lower Third Body
slug:: lower-third-body
type:: lower-third
text:: Host Name

## NN Layer: B-Roll Body
slug:: broll-body
type:: b-roll
asset:: media/shot.png
`;

const TEMPLATES_DOC = `---
level: 3
parent_spec:
  name: "demo_V_0-1-0"
  url: "./spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Demo Series"
---

# NN Template

## NN Template: Presenter Full
slug:: presenter-full
tool:: wavespeed
voice:: demo-voice
model:: minimax/speech-2.8-hd
`;

/** Writes the generic fixture into a temp dir and returns its paths. */
function writeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-model-compile-'));
  const scriptPath = path.join(dir, 'script_NN.md');
  fs.writeFileSync(scriptPath, SAMPLE_DOC, 'utf8');
  fs.writeFileSync(path.join(dir, 'templates_V_0-1-0_demo_NN.md'), TEMPLATES_DOC, 'utf8');
  return { dir, scriptPath };
}

async function runTests() {
  console.log('Running iNNfo model compile tests...');

  const { dir, scriptPath } = writeFixture();

  // 1. Compile the generic fixture from the structured model only.
  {
    const model = loadKnowledgeModel(scriptPath);
    assert.ok(model.elements, 'reader produces a read_knowledge-shaped model');
    const templates = loadTemplateModels(dir);
    const compiler = new RemotionSceneCompiler();
    const manifest = compiler.compile(model, { templates });

    assert.strictEqual(manifest.version, '1.0.0');
    assert.strictEqual(manifest.compositionId, 'demo-clip');
    assert.strictEqual(manifest.tracks.scenes.length, 2, 'one track per Scene');
    assert.deepStrictEqual(
      manifest.tracks.scenes.map((s) => s.id),
      ['scene_opening', 'scene_body'],
      'scenes preserve list order',
    );

    // Overlay text comes from `text::`, never the layer name.
    const titles = manifest.tracks.overlays.filter((o) => o.type === 'kineticTitle').map((o) => o.config.heading);
    assert.ok(titles.includes('Demo Title'));
    assert.ok(!titles.some((t) => t === 'Title Opening'), 'never falls back to the layer name');

    const lower = manifest.tracks.overlays.find((o) => o.type === 'lowerThird');
    assert.strictEqual(lower.config.title, 'Host Name');
    const broll = manifest.tracks.overlays.find((o) => o.type === 'broll');
    assert.strictEqual(broll.config.assetPath, 'media/shot.png');

    // Presenter → talking_avatar layer; background → video.
    const drawTypes = manifest.tracks.scenes.flatMap((s) => s.props.layers.map((l) => l.layer_type));
    assert.ok(drawTypes.includes('talking_avatar'));
    assert.ok(drawTypes.includes('video'));

    // Template-resolved configuration reaches the manifest.
    const opening = manifest.tracks.scenes[0];
    assert.strictEqual(opening.props.template.voice, 'demo-voice');
    assert.strictEqual(opening.props.template.model, 'minimax/speech-2.8-hd');

    console.log('✔ fixture compiles to a manifest from the iNNfo model (one track per Scene, list order)');
  }

  // 2. Sequential overlay scheduling has no temporal collision.
  {
    const model = {
      elements: {
        Video: [{ type: 'Video', name: 'V', fields: { title: 'V' }, slug: 'v' }],
        Scene: [{ type: 'Scene', name: 'S', slug: 's', description: 'narration', fields: {} }],
        Layer: [
          { type: 'Layer', name: 'Quote A', slug: 'qa', fields: { type: 'quote', text: 'one' } },
          { type: 'Layer', name: 'Quote B', slug: 'qb', fields: { type: 'quote', text: 'two' } },
        ],
      },
    };
    const manifest = new RemotionSceneCompiler().compile(model);
    const seq = manifest.tracks.overlays.filter((o) => o.type === 'quote').sort((a, b) => a.fromFrame - b.fromFrame);
    assert.strictEqual(seq.length, 2);
    assert.ok(seq[1].fromFrame >= seq[0].fromFrame + seq[0].durationInFrames, 'overlays never overlap');
    console.log('✔ quote/lower-third/b-roll overlays are scheduled sequentially without collision');
  }

  // 3. The guard rejects invalid documents before any manifest.
  {
    const compiler = new RemotionSceneCompiler();
    // Two Videos.
    assert.throws(
      () => compiler.compile({ elements: { Video: [{ name: 'a' }, { name: 'b' }], Scene: [], Layer: [] } }),
      (e) => e instanceof ScriptValidationError && e.errors.some((x) => x.code === 'one-video-per-document'),
    );
    // Unknown type.
    assert.throws(
      () => compiler.compile({ elements: { Video: [{ name: 'a', fields: { title: 'a' } }], Scene: [], Layer: [{ name: 'L', fields: { type: 'telepathy' } }] } }),
      (e) => e instanceof ScriptValidationError && e.errors.some((x) => x.code === 'unknown-layer-type'),
    );
    // Missing conditional field.
    assert.throws(
      () => compiler.compile({ elements: { Video: [{ name: 'a', fields: { title: 'a' } }], Scene: [], Layer: [{ name: 'L', fields: { type: 'title' } }] } }),
      (e) => e instanceof ScriptValidationError && e.errors.some((x) => x.code === 'missing-conditional-field'),
    );
    // Markdown is never re-parsed.
    assert.throws(
      () => compiler.compile('# Scene\nsome prose'),
      (e) => e instanceof ScriptValidationError && e.errors.some((x) => x.code === 'markdown-not-accepted'),
    );
    // No declared duration or timing on any Concept.
    for (const [concept, fields] of [
      ['Video', { title: 'a', duration: '12' }],
      ['Scene', { duration_seconds: '12' }],
      ['Layer', { type: 'quote', text: 'x', from_frame_offset: '30' }],
      ['Layer', { type: 'b-roll', asset: 'x.png', from_seconds_offset: '2' }],
    ]) {
      const doc = {
        elements: {
          Video: [{ name: 'a', fields: { title: 'a' } }],
          Scene: [{ name: 'S', fields: {} }],
          Layer: [{ name: 'L', fields: { type: 'quote', text: 'x' } }],
        },
      };
      const target = concept === 'Video' ? doc.elements.Video[0] : concept === 'Scene' ? doc.elements.Scene[0] : doc.elements.Layer[0];
      target.fields = fields;
      assert.throws(
        () => compiler.compile(doc),
        (e) => e instanceof ScriptValidationError && e.errors.some((x) => x.code === 'declared-duration'),
        `declared duration on ${concept} must be rejected`,
      );
    }
    console.log('✔ invalid L3 stops compilation with a named non-zero error; markdown and declared duration are rejected');
  }

  // 4. The engine no longer imports the VUS parser/mirror.
  {
    const engineModules = ['remotion-scene-compiler.mjs', 'video-engine-cli.mjs', 'asset-cost-estimator.mjs', 'synthesize-avatar.mjs', 'lib/knowledge-model.mjs', 'lib/tts-options.mjs'];
    const offenders = [];
    for (const rel of engineModules) {
      const src = fs.readFileSync(path.join(SKILL_DIR, 'scripts', rel), 'utf8');
      if (/parseVus|innfo-video-parser/.test(src)) offenders.push(rel);
    }
    assert.deepStrictEqual(offenders, [], `no VUS parser import allowed; found in: ${offenders.join(', ')}`);
    console.log('✔ engine imports no VUS parser/mirror');
  }

  // 5. Drift guard: the zero-dependency structural adapter
  //    (`lib/knowledge-model.mjs`) must emit the same read_knowledge shape the
  //    scene compiler consumes.
  {
    const adapted = parseKnowledgeDocument(SAMPLE_DOC);
    for (const key of ['frontmatter', 'taxonomy', 'elements', 'rawContent']) {
      assert.ok(key in adapted, `adapter output must expose read_knowledge key "${key}"`);
    }
    assert.strictEqual(typeof adapted.elements, 'object');
    for (const [concept, list] of Object.entries(adapted.elements)) {
      assert.ok(Array.isArray(list), `elements.${concept} must be an array`);
      for (const el of list) {
        assert.strictEqual(el.type, concept, `element.type must equal its concept (${concept})`);
        assert.strictEqual(typeof el.name, 'string');
        assert.strictEqual(typeof el.fields, 'object');
      }
    }
    // The compiler accepts exactly this shape and rejects raw markdown.
    const compiler = new RemotionSceneCompiler();
    assert.ok(compiler.compile(adapted).tracks.scenes.length > 0);
    assert.throws(() => compiler.compile(SAMPLE_DOC), (e) => e instanceof ScriptValidationError);
    console.log('✔ structural adapter stays contract-aligned with read_knowledge (drift guard)');
  }

  fs.rmSync(dir, { recursive: true, force: true });
  console.log('\nAll iNNfo model compile tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
