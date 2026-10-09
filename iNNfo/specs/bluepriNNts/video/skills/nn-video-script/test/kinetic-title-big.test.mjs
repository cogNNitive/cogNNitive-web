import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RemotionSceneCompiler } from '../scripts/remotion-scene-compiler.mjs';
import {
  resolveKineticTitleLayout,
  DEFAULT_HEADING_SIZE,
  DEFAULT_SUBHEADING_SIZE,
} from '../scripts/scene/kinetic-title-layout.mjs';

const compile = (text) => {
  const c = new RemotionSceneCompiler({});
  return c.compile(c.parseScript(text), {});
};

const script = (body) =>
  ['//ANYDEO_SPEC: V_0-3-3', '# Video', '- video_title: T', '- video_fps: 30', '', '# Scenes', '', '## Scene 1: Outro', '@base Outro', ''].join('\n') + body + '\n';

describe('resolveKineticTitleLayout', () => {
  it('keeps the historical look when no size or anchor is configured', () => {
    const l = resolveKineticTitleLayout({ heading: 'A', subheading: 'B', theme: 'dark' });
    assert.equal(l.headingSize, 88);
    assert.equal(l.subheadingSize, 40);
    assert.equal(DEFAULT_HEADING_SIZE, 88);
    assert.equal(DEFAULT_SUBHEADING_SIZE, 40);
    assert.equal(l.justifyContent, 'center');
    assert.equal(l.textShadow, undefined);
    assert.equal(l.maxWidth, undefined);
    assert.equal(l.textWrap, undefined);
    assert.equal(l.big, false);
  });

  it('uses configured sizes, adds a legible shadow and a wrapping width cap', () => {
    const l = resolveKineticTitleLayout({ headingSize: 120, subheadingSize: '60' });
    assert.equal(l.headingSize, 120);
    assert.equal(l.subheadingSize, 60);
    assert.equal(l.big, true);
    assert.match(l.textShadow, /rgba\(0,\s*0,\s*0/);
    assert.equal(l.maxWidth, '92%');
    assert.equal(l.textWrap, 'balance');
  });

  it('ignores invalid sizes and clamps absurd ones', () => {
    assert.equal(resolveKineticTitleLayout({ headingSize: 'big' }).headingSize, 88);
    assert.equal(resolveKineticTitleLayout({ headingSize: -5 }).headingSize, 88);
    assert.equal(resolveKineticTitleLayout({ headingSize: 0 }).headingSize, 88);
    assert.equal(resolveKineticTitleLayout({ headingSize: 99999 }).headingSize, 400);
    assert.equal(resolveKineticTitleLayout({ headingSize: 99999 }).big, true);
  });

  it('maps the anchor to a vertical position and ignores unknown values', () => {
    assert.equal(resolveKineticTitleLayout({ anchor: 'top' }).justifyContent, 'flex-start');
    assert.equal(resolveKineticTitleLayout({ anchor: 'bottom' }).justifyContent, 'flex-end');
    assert.equal(resolveKineticTitleLayout({ anchor: 'center' }).justifyContent, 'center');
    assert.equal(resolveKineticTitleLayout({ anchor: 'sideways' }).justifyContent, 'center');
  });
});

describe('kineticTitle size options reach the manifest', () => {
  it('defaults: only the documented style props, no big-text keys (existing manifests unchanged)', () => {
    const m = compile(script(['<!-- overlay: kineticTitle { "heading": "H", "subheading": "S", "duration_seconds": 3 } -->', '', '- scene_duration: 5', '', 'Hola.'].join('\n')));
    const cfg = m.tracks.overlays[0].config;
    // fontFamily/fontSize/fontWeight/textStroke come from the style-props change (video-flex);
    // headingSize/subheadingSize/anchor stay absent until explicitly configured.
    assert.deepEqual(
      Object.keys(cfg).sort(),
      ['animationStyle', 'fontFamily', 'fontSize', 'fontWeight', 'heading', 'subheading', 'textStroke', 'theme'],
    );
  });

  it('overlay hint: heading_size, subheading_size and anchor are passed through', () => {
    const hint = '<!-- overlay: kineticTitle { "heading": "H", "subheading": "S", "heading_size": 130, "subheading_size": 70, "anchor": "bottom", "duration_seconds": 3 } -->';
    const m = compile(script([hint, '', '- scene_duration: 5', '', 'Hola.'].join('\n')));
    const cfg = m.tracks.overlays[0].config;
    assert.equal(cfg.headingSize, 130);
    assert.equal(cfg.subheadingSize, 70);
    assert.equal(cfg.anchor, 'bottom');
  });

  it('layer properties: same pass-through for a `@@ layer` with layer_type kineticTitle', () => {
    const m = compile(script([
      '- scene_duration: 5', '', 'Hola.', '',
      '@@ Titulo', '- layer_type: kineticTitle', '- layer_heading: Grande', '- heading_size: 150', '- anchor: top',
    ].join('\n')));
    const cfg = m.tracks.overlays[0].config;
    assert.equal(cfg.heading, 'Grande');
    assert.equal(cfg.headingSize, 150);
    assert.equal(cfg.anchor, 'top');
  });
});
