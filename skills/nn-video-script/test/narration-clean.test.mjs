import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RemotionSceneCompiler } from '../scripts/remotion-scene-compiler.mjs';
import { estimateScriptCost } from '../scripts/asset-cost-estimator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures', 'inflacion-script.md');

const parse = (text) => new RemotionSceneCompiler({}).parseScript(text);
const compile = (text) => {
  const c = new RemotionSceneCompiler({});
  return c.compile(c.parseScript(text), {});
};

const BS = String.fromCharCode(92); // a JSON backslash, written without escape confusion
const OVERLAY_TITLE = '<!-- overlay: kineticTitle { "heading": "Cosicah {x}", "subheading": "explicás por ' + BS + '"un señor' + BS + '"", "from_frame_offset": 6, "duration_seconds": 3 } -->';
const OVERLAY_THIRD = '<!-- overlay: lowerThird { "title": "Celedonio", "subtitle": "el señor de Villabotijos", "from_frame_offset": 0, "duration_seconds": 5 } -->';

const script = (body) =>
  ['//ANYDEO_SPEC: V_0-3-3', '# Video', '- video_title: T', '- video_fps: 30', '', '# Scenes', '', '## Scene 1: Intro', '@base Intro', ''].join('\n') + body + '\n';

describe('narration never contains HTML comments', () => {
  it('overlay hints before and after the narration, several per scene, are not spoken', () => {
    const text = script([OVERLAY_TITLE, OVERLAY_THIRD, '', '- scene_duration: 5', '', 'Hola, esto es la narración.', '', OVERLAY_THIRD].join('\n'));
    const [sc] = parse(text).scenes;
    assert.equal(sc.narration, 'Hola, esto es la narración.');
    assert.ok(!/<!--|-->|overlay:/.test(sc.narration));
  });

  it('collects every overlay with its type, JSON fields, frame offset and duration', () => {
    const text = script([OVERLAY_TITLE, OVERLAY_THIRD, '', '- scene_duration: 5', '', 'Narration text.', '', OVERLAY_THIRD].join('\n'));
    const manifest = compile(text);
    const overlays = manifest.tracks.overlays;
    assert.equal(overlays.length, 3);
    assert.deepEqual(overlays.map((o) => o.type), ['kineticTitle', 'lowerThird', 'lowerThird']);
    const scene = manifest.tracks.scenes[0];
    assert.equal(overlays[0].fromFrame - scene.fromFrame, 6);
    assert.equal(overlays[0].durationInFrames, 90);
    assert.equal(overlays[1].durationInFrames, 150);
    assert.equal(overlays[0].config.heading, 'Cosicah {x}');
    assert.equal(overlays[0].config.subheading, 'explicás por "un señor"');
    assert.equal(overlays[1].config.title, 'Celedonio');
  });

  it('ordinary HTML comments (single and multi-line, inline) are never spoken either', () => {
    const text = script(['<!-- TODO: rewrite this scene -->', 'First line <!-- inline note --> of narration.', '<!--', 'multi', 'line', '-->', 'Second line.'].join('\n'));
    const [sc] = parse(text).scenes;
    assert.equal(sc.narration, 'First line of narration. Second line.');
    assert.equal(compile(text).tracks.overlays.length, 0);
  });

  it('a malformed overlay hint is dropped from the narration and does not create an overlay', () => {
    const text = script(['<!-- overlay: kineticTitle { not json } -->', 'Clean narration.'].join('\n'));
    const [sc] = parse(text).scenes;
    assert.equal(sc.narration, 'Clean narration.');
    assert.equal(compile(text).tracks.overlays.length, 0);
  });

  it('multi-line prose is one space-joined line (the cache key of the old compiler)', () => {
    const [sc] = parse(script('Line one of the paragraph.\nLine two continues.\n\nA second paragraph.')).scenes;
    assert.equal(sc.narration, 'Line one of the paragraph. Line two continues. A second paragraph.');
  });

  it('the estimator prices the clean narration only', () => {
    const clean = estimateScriptCost(script(['Hola.'].join('\n')), {});
    const withHints = estimateScriptCost(script([OVERLAY_TITLE, OVERLAY_THIRD, 'Hola.', OVERLAY_THIRD].join('\n')), {});
    assert.equal(withHints.summary.totalCharacters, clean.summary.totalCharacters);
    assert.equal(withHints.summary.totalCharacters, 5);
  });
});

describe('real episode regression (inflacion)', () => {
  const text = fs.readFileSync(FIXTURE, 'utf8');

  it('scene 0 narration is the clean question and the episode has exactly 5 overlays', () => {
    const parsed = parse(text);
    assert.equal(parsed.scenes[0].narration, '¿Sabes quéh e lo queh la inflación?');
    for (const sc of parsed.scenes) assert.ok(!/<!--|overlay:/.test(sc.narration), sc.id);
    assert.equal(compile(text).tracks.overlays.length, 5);
  });
});
