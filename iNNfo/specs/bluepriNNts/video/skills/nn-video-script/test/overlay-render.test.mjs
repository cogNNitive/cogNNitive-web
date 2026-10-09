#!/usr/bin/env node

/**
 * nn-video-script/test/overlay-render.test.mjs
 *
 * Guards that every overlay type the compiler emits for a `>`-only script is
 * actually renderable. The React components cannot run under node, so `Scene.tsx`
 * selects its component through the pure `rendererForOverlay` selector; this test
 * fails if a mapping is dropped, which would silently render nothing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RemotionSceneCompiler } from '../scripts/remotion-scene-compiler.mjs';
import { rendererForOverlay, OVERLAY_RENDERERS } from '../scripts/scene/overlay-registry.mjs';

const sceneScript = (body) =>
  [
    '//ANYDEO_SPEC: V_0-3-3',
    '# Video',
    '- video_title: Overlay Render',
    '- video_fps: 30',
    '',
    '# Scenes',
    '',
    '## Scene 1: Overlay Render',
    '@base Overlay Scene',
    '- scene_duration: 20',
    '',
    ...body,
    '',
  ].join('\n');

describe('overlay rendering coverage', () => {
  it('maps every emitted > overlay type to a renderer', () => {
    const compiler = new RemotionSceneCompiler({ fps: 30 });
    const manifest = compiler.compile(
      sceneScript([
        '> quote: "Stay hungry"',
        '> lower-third: "Dr. Alice Smith" [subtitle="Quantum Researcher"]',
        '> broll: media/engine.png [source="NASA"]',
      ]),
    );
    const events = manifest.tracks.overlays.filter((o) => o.id.includes('_event_'));
    assert.equal(events.length, 3, 'three blockquote overlays emitted');
    for (const event of events) {
      assert.ok(
        rendererForOverlay(event.type),
        `overlay type "${event.type}" must map to a renderer (else Scene.tsx renders null)`,
      );
    }
    assert.equal(rendererForOverlay('quote'), 'Quote');
    assert.equal(rendererForOverlay('broll'), 'Broll');
    assert.equal(rendererForOverlay('lowerThird'), 'LowerThird');
  });

  it('returns null only for genuinely unknown overlay types', () => {
    assert.equal(rendererForOverlay('not-a-real-overlay'), null);
    assert.deepEqual(Object.keys(OVERLAY_RENDERERS).sort(), [
      'broll',
      'captions',
      'conceptCallout',
      'kineticTitle',
      'lowerThird',
      'quote',
    ]);
  });
});
