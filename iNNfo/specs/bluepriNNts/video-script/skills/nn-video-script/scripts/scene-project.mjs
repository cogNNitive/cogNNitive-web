/**
 * nn-video-script/scripts/scene-project.mjs
 *
 * Emits a deterministic HyperFrames project from a Composition Manifest. The
 * manifest is the contract; this module is the only place that decides
 * HyperFrames placement. It performs no network and imports no HyperFrames
 * module. Emission is deterministic: the same manifest yields byte-identical
 * files.
 *
 * Layout:
 *   <projectDir>/index.html            root: one scene host per Scene + all audio
 *   <projectDir>/compositions/<s>.html one Sub-composition per Scene
 *   <projectDir>/hyperframes.json      project config
 *
 * Audio (narration + music) lives at the ROOT with global times: nested media
 * with a non-zero start basis inside a Sub-composition has ambiguous timing.
 * Each Scene Sub-composition leaves a stable `<!-- nn-overlay-host -->` anchor
 * for the overlays change to fill.
 */

import fs from 'node:fs';
import path from 'node:path';
import { sceneTransitionFragment } from './scene-transition.mjs';
import { overlayHostMarkup } from './overlay-blocks.mjs';

export const HYPERFRAMES_PIN = '0.8.192';
export const OVERLAY_HOST_ANCHOR = '<!-- nn-overlay-host -->';

const roundMs = (seconds) => Math.round(seconds * 1000) / 1000;
const frameSeconds = (frames, fps) => roundMs((frames || 0) / fps);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sceneSlug = (scene) => String(scene.slug || scene.id || 'scene').replace(/^scene_/, '') || 'scene';
const isVideoName = (name) => /\.(mp4|webm|mov|mkv|m4v)$/i.test(String(name || ''));

/** Drawable media layers (have a staged asset) sorted by paint order (`layer_level`). */
function drawableLayers(scene) {
  const layers = (scene?.props?.layers) || [];
  return layers
    .filter((l) => String(l.layer_asset_source || '').length > 0)
    .slice()
    .sort((a, b) => Number(a.layer_level ?? 0) - Number(b.layer_level ?? 0));
}

function layerMarkup(layer, sceneDurationFrames, fps, trackBase) {
  const name = String(layer.layer_asset_source);
  const dur = frameSeconds(sceneDurationFrames, fps);
  const z = Number(layer.layer_level ?? 0);
  const tag = isVideoName(name) ? 'video' : 'img';
  const mediaAttrs =
    tag === 'video'
      ? `muted playsinline data-has-audio="false"`
      : '';
  return (
    `<${tag} class="clip nn-media" data-start="0" data-duration="${dur}" ` +
    `data-track-index="${trackBase}" ${mediaAttrs} src="assets/${esc(name)}" ` +
    `style="z-index:${Number.isFinite(z) ? z : 0}"></${tag}>`
  );
}

/** Pure: build the project text without touching the filesystem. */
export function buildProject(manifest, plan = {}) {
  const fps = Number(manifest.fps) || 30;
  const width = Number(manifest.width) || 1920;
  const height = Number(manifest.height) || 1080;
  const total = roundMs(Number(manifest.totalDurationInSeconds) || 0);
  const compositionId = String(manifest.compositionId || 'composition');
  const scenes = manifest?.tracks?.scenes || [];
  const audio = manifest?.tracks?.audio || [];
  const overlays = manifest?.tracks?.overlays || [];
  const assets = [];

  const compositions = scenes.map((scene) => {
    const slug = sceneSlug(scene);
    const dur = frameSeconds(scene.durationInFrames, fps);
    const layers = drawableLayers(scene);
    layers.forEach((l) => assets.push(String(l.layer_asset_source)));
    const layerHtml = layers.map((l, i) => layerMarkup(l, scene.durationInFrames, fps, i + 1)).join('\n      ');
    const sceneOverlays = overlays.filter(
      (o) => o.fromFrame >= scene.fromFrame && o.fromFrame < scene.fromFrame + scene.durationInFrames,
    );
    const overlayHtml = sceneOverlays
      .map((o, i) =>
        overlayHostMarkup(o, scene.fromFrame, fps, {
          seriesFrame: plan.seriesFrame,
          sceneBlock: plan.sceneBlock,
          trackIndex: 10 + i,
        }),
      )
      .filter(Boolean)
      .join('\n      ');
    const transition = sceneTransitionFragment(scene.transition, fps);
    const tween = transition ? `      ${transition.js}` : '';
    const html = `<template>
  <style>
    #root { position: absolute; inset: 0; overflow: hidden; background: #0b0b0f; }
    .nn-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  </style>
  <div id="root" data-width="${width}" data-height="${height}" data-duration="${dur}">
      ${layerHtml}
      ${overlayHtml}
      ${OVERLAY_HOST_ANCHOR}
  </div>
  <script>
    (function () {
      const tl = gsap.timeline({ paused: true });
${tween}
      window.__timelines[${JSON.stringify(slug)}] = tl;
    })();
  </script>
</template>
`;
    return { slug, html };
  });

  const sceneHosts = scenes
    .map((scene) => {
      const slug = sceneSlug(scene);
      const start = frameSeconds(scene.fromFrame, fps);
      const dur = frameSeconds(scene.durationInFrames, fps);
      return `  <div id="scene-${esc(slug)}" class="clip" data-composition-id="${esc(slug)}" data-start="${start}" data-duration="${dur}" data-track-index="0" data-track-kind="graphics"></div>`;
    })
    .join('\n');

  const audioEls = audio
    .map((track, i) => {
      const start = frameSeconds(track.fromFrame, fps);
      const dur = frameSeconds(track.durationInFrames, fps);
      assets.push(String(track.assetPath));
      const loop = track.loop === true ? ' loop' : '';
      const kind = track.kind ? ` data-kind="${esc(track.kind)}"` : '';
      const vol = track.volume !== undefined ? ` data-volume="${track.volume}"` : '';
      return `  <audio id="${esc(track.id)}"${kind} data-start="${start}" data-duration="${dur}" data-track-index="${100 + i}"${vol}${loop} src="assets/${esc(track.assetPath)}"></audio>`;
    })
    .join('\n');

  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${esc(compositionId)}</title>
  </head>
  <body>
    <div id="root" data-composition-id="${esc(compositionId)}" data-start="0" data-duration="${total}" data-width="${width}" data-height="${height}" data-fps="${fps}">
${sceneHosts}
${plan.narrationCaptions ? `  <div id="captions" class="clip" data-track-kind="captions" data-start="0" data-duration="${total}" data-track-index="900"></div>\n` : ''}${audioEls}
    </div>
  </body>
</html>
`;

  const hyperframesJson = JSON.stringify(
    { composition: compositionId, fps, width, height, duration: total, pin: plan.pin || HYPERFRAMES_PIN },
    null,
    2,
  ) + '\n';

  return { indexHtml, compositions, hyperframesJson, compositionId, total, assets };
}

/**
 * Writes the project to `plan.projectDir`. Returns the written paths.
 * @param {object} manifest
 * @param {{ projectDir: string, pin?: string }} plan
 */
export function emitHyperframesProject(manifest, plan = {}) {
  if (!plan.projectDir) throw new Error('emitHyperframesProject: plan.projectDir is required');
  const built = buildProject(manifest, plan);
  const dir = path.resolve(plan.projectDir);
  const compDir = path.join(dir, 'compositions');
  fs.mkdirSync(compDir, { recursive: true });

  const indexHtml = path.join(dir, 'index.html');
  fs.writeFileSync(indexHtml, built.indexHtml, 'utf8');
  fs.writeFileSync(path.join(dir, 'hyperframes.json'), built.hyperframesJson, 'utf8');
  const compositions = built.compositions.map((c) => {
    const p = path.join(compDir, `${c.slug}.html`);
    fs.writeFileSync(p, c.html, 'utf8');
    return p;
  });

  return { projectDir: dir, indexHtml, compositions, assets: built.assets };
}
