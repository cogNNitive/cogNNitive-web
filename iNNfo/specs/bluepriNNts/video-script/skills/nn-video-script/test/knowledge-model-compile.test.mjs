#!/usr/bin/env node

/**
 * nn-video-script/test/knowledge-model-compile.test.mjs
 *
 * Proves the re-pointed engine compiles the cocodrilo L3 guion to a Remotion
 * composition manifest from the STRUCTURED iNNfo model only:
 *  - one RemotionSceneTrack per Scene, in list order;
 *  - overlay text from the Layer `text::` field, never the layer name;
 *  - `template::` resolves from the Series L3 Template document;
 *  - quote/lower-third/b-roll overlays scheduled sequentially, no collision;
 *  - the compiler rejects markdown strings and the VUS parser is gone.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RemotionSceneCompiler, ScriptValidationError } from '../scripts/remotion-scene-compiler.mjs';
import { loadKnowledgeModel, loadTemplateModels } from '../scripts/lib/knowledge-model.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, '..');
const SAMPLE = path.join(__dirname, '..', '..', '..', '..', 'video-script', 'samples', 'el-cocodrilo-de-singapur_V_0-1-0_video-script_NN.md');

async function runTests() {
  console.log('Running iNNfo model compile tests...');

  // 1. Compile the cocodrilo sample from the structured model only.
  {
    const model = loadKnowledgeModel(SAMPLE);
    assert.ok(model.elements, 'reader produces a read_knowledge-shaped model');
    const templates = loadTemplateModels(path.dirname(SAMPLE));
    const compiler = new RemotionSceneCompiler();
    const manifest = compiler.compile(model, { templates });

    assert.strictEqual(manifest.version, '1.0.0');
    assert.strictEqual(manifest.compositionId, 'el-cocodrilo-de-singapur');
    assert.strictEqual(manifest.tracks.scenes.length, 3, 'one track per Scene');
    assert.deepStrictEqual(
      manifest.tracks.scenes.map((s) => s.id),
      ['scene_gancho', 'scene_intro', 'scene_noticia'],
      'scenes preserve list order',
    );

    // Overlay text comes from `text::`, never the layer name.
    const titles = manifest.tracks.overlays.filter((o) => o.type === 'kineticTitle').map((o) => o.config.heading);
    assert.ok(titles.includes('Villabotijos Today'));
    assert.ok(titles.includes('El cocodrilo de Singapur'));
    assert.ok(!titles.some((t) => /Gancho|Noticia/.test(t)), 'never falls back to the layer name');

    const lower = manifest.tracks.overlays.find((o) => o.type === 'lowerThird');
    assert.strictEqual(lower.config.title, 'Celedonio · el señor de Villabotijos');
    const broll = manifest.tracks.overlays.find((o) => o.type === 'broll');
    assert.strictEqual(broll.config.assetPath, 'media/techspot_snapshot.png');

    // Presenter → talking_avatar layer; brand → image layer; background → video.
    const drawTypes = manifest.tracks.scenes.flatMap((s) => s.props.layers.map((l) => l.layer_type));
    assert.ok(drawTypes.includes('talking_avatar'));
    assert.ok(drawTypes.includes('image'));
    assert.ok(drawTypes.includes('video'));

    // Template-resolved configuration reaches the manifest.
    const gancho = manifest.tracks.scenes[0];
    assert.strictEqual(gancho.props.template.voice, 'dcrR2vs2jKo');
    assert.strictEqual(gancho.props.template.model, 'replicate/minimax/speech-2.8-hd');

    console.log('✔ Cocodrilo compiles to a manifest from the iNNfo model (one track per Scene, list order)');
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

  // 4. The engine no longer imports the VUS parser/mirror. (The retired VUS
  //    scripts are removed in the teardown phase; here we assert the re-pointed
  //    engine modules themselves carry no VUS reference.)
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
  //    scene compiler consumes. This is the seam that keeps the installed
  //    skill's markdown adapter aligned with innfo-core `read_knowledge`; if
  //    innfo-core's output shape changes, this contract must change with it.
  {
    const { parseKnowledgeDocument } = await import('../scripts/lib/knowledge-model.mjs');
    const rawSample = fs.readFileSync(SAMPLE, 'utf8');
    const adapted = parseKnowledgeDocument(rawSample);
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
    assert.throws(() => compiler.compile(rawSample), (e) => e instanceof ScriptValidationError);
    console.log('✔ structural adapter stays contract-aligned with read_knowledge (drift guard)');
  }

  console.log('\nAll iNNfo model compile tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
