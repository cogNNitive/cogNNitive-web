import test from 'node:test';
import assert from 'node:assert/strict';
import { renderOverlay } from '../scripts/overlay-blocks.mjs';

const sceneFrom = 90;
const fps = 30;

test('a lower-third renders its visible text as a timed clip', () => {
  const o = { id: 'o1', type: 'lowerThird', fromFrame: 90, durationInFrames: 60, config: { title: 'Lucas Cervera', position: 'bottom-left' } };
  const html = renderOverlay(o, sceneFrom, fps, { width: 1080, height: 1080 });
  assert.match(html, /class="clip nn-overlay"/);
  assert.match(html, /data-overlay-type="lowerThird"/);
  assert.match(html, /Lucas Cervera/);
  assert.match(html, /data-start="0"/);
  assert.match(html, /data-duration="2"/);
  assert.match(html, /left:\d+px/);
  assert.doesNotMatch(html, /<audio/);
});

test('a watermark renders its text', () => {
  const o = { id: 'w', type: 'watermark', fromFrame: 90, durationInFrames: 30, config: { text: 'generado con IA' } };
  const html = renderOverlay(o, sceneFrom, fps, { width: 1080 });
  assert.match(html, /generado con IA/);
  assert.match(html, /text-align:center/);
});

test('a kinetic title uses the heading', () => {
  const o = { id: 't', type: 'kineticTitle', fromFrame: 90, durationInFrames: 30, config: { heading: 'Titular' } };
  assert.match(renderOverlay(o, sceneFrom, fps, { width: 1920 }), /Titular/);
});

test('a b-roll embeds its staged media', () => {
  const o = { id: 'b', type: 'broll', fromFrame: 90, durationInFrames: 30, config: { assetPath: 'clip_abc.mp4', fit: 'contain' } };
  const html = renderOverlay(o, sceneFrom, fps, { width: 1080 });
  assert.match(html, /<video /);
  assert.match(html, /src="assets\/clip_abc\.mp4"/);
  assert.match(html, /object-fit:contain/);
});

test('a quote renders a centered card and an unknown type returns null', () => {
  const o = { id: 'q', type: 'quote', fromFrame: 90, durationInFrames: 30, config: { text: 'Cita' } };
  assert.match(renderOverlay(o, sceneFrom, fps, { width: 1080 }), /Cita/);
  assert.equal(renderOverlay({ id: 'x', type: 'nope', fromFrame: 90, durationInFrames: 30, config: {} }, sceneFrom, fps, {}), null);
});
