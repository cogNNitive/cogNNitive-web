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
 *   <projectDir>/index.html            root: one scene host per Scene + overlay hosts + all audio
 *   <projectDir>/compositions/<s>.html one Sub-composition per Scene
 *   <projectDir>/hyperframes.json      project config
 *
 * Audio (narration + music) lives at the ROOT with global times: nested media
 * with a non-zero start basis inside a Sub-composition has ambiguous timing.
 * Overlay hosts also live at the ROOT (design D4) so their times are global and
 * they mount their slot component from `components/` in one nesting level.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sceneTransitionFragment } from './scene-transition.mjs';
import { overlayMount, SLOT_OF } from './overlay-blocks.mjs';
import { writeGuarded } from './lib/emit-guard.mjs';

/**
 * The pinned HyperFrames CLI version, read from this skill's `package.json` (the
 * single source of truth). npm installs and pins it; the render driver resolves
 * the local binary.
 */
export const HYPERFRAMES_PIN = (() => {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'),
    );
    return (pkg.dependencies && pkg.dependencies.hyperframes) || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

const roundMs = (seconds) => Math.round(seconds * 1000) / 1000;
const frameSeconds = (frames, fps) => roundMs((frames || 0) / fps);
/** Non-fatal emission warning (design D14: animation/narration mismatch). */
const warn = (message) => console.warn(`[scene-project] ${message}`);
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

function layerMarkup(layer, sceneDurationFrames, fps, trackBase, sceneSlug) {
  const name = String(layer.layer_asset_source);
  const dur = frameSeconds(sceneDurationFrames, fps);
  const z = Number(layer.layer_level ?? 0);
  const tag = isVideoName(name) ? 'video' : 'img';
  const mediaAttrs =
    tag === 'video'
      ? `muted playsinline data-has-audio="false"`
      : '';
  // A stable per-layer `id` gives HyperFrames Studio a target for its timeline and
  // canvas controls (an id-less clip triggers a lint warning).
  const id = `media-${esc(sceneSlug || 'scene')}-${trackBase}`;
  return (
    `<${tag} id="${id}" class="clip nn-media" data-start="0" data-duration="${dur}" ` +
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
  const componentMap = plan.components || manifest?.metadata?.components || {};
  const frame = plan.frame || manifest?.metadata?.frame || null;

  const compositions = scenes.map((scene) => {
    const slug = sceneSlug(scene);
    const dur = frameSeconds(scene.durationInFrames, fps);
    const layers = drawableLayers(scene);
    layers.forEach((l) => assets.push(String(l.layer_asset_source)));
    const layerHtml = layers.map((l, i) => layerMarkup(l, scene.durationInFrames, fps, i + 1, slug)).join('\n      ');
    const transition = sceneTransitionFragment(scene.transition, fps);
    const tween = transition ? `      ${transition.js}` : '';
    const html = `<template>
  <style>
    #root { position: absolute; inset: 0; overflow: hidden; }
    .nn-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  </style>
  <div id="root" data-composition-id="${esc(slug)}" data-width="${width}" data-height="${height}" data-duration="${dur}">
      ${layerHtml}
  </div>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
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

  const overlayHosts = overlays
    .map((o, i) => {
      const comp = componentMap[SLOT_OF[o.type]] || {};
      return overlayMount(o, {
        componentName: comp.name || SLOT_OF[o.type],
        noTimeline: comp.noTimeline === true,
        fps,
        frame,
        trackIndex: 10 + i,
        zIndex: 200 + i,
      });
    })
    .filter(Boolean)
    .join('\n');

  // Authored-animation hosts (design D4/D7): ROOT-level sub-compositions with
  // global times, mounted from `authored/<id>/index.html` (staged by the render
  // driver). The host duration is the SCENE duration so a shorter animation holds
  // its last frame; no `muted`, no playback-rate — the animation plays its own
  // audio at its authored level. A mismatch of more than one frame warns.
  let animationTrackIndex = 500;
  const animationHosts = scenes
    .map((scene) => {
      const anims = scene.animations || [];
      if (anims.length === 0) return '';
      const start = frameSeconds(scene.fromFrame, fps);
      const dur = frameSeconds(scene.durationInFrames, fps);
      const narrationFrames = scene.narrationDurationInFrames;
      return anims
        .map((a) => {
          if (Number.isFinite(narrationFrames) && Math.abs((Number(a.durationInFrames) || 0) - narrationFrames) > 1) {
            warn(
              `scene "${sceneSlug(scene)}": animation ${frameSeconds(a.durationInFrames, fps)}s differs from narration ${frameSeconds(narrationFrames, fps)}s`,
            );
          }
          return `  <div id="animation-${esc(a.id)}" class="clip" data-composition-id="${esc(a.id)}" data-composition-src="authored/${esc(a.id)}/index.html" data-start="${start}" data-duration="${dur}" data-track-index="${animationTrackIndex++}" data-track-kind="graphics"></div>`;
        })
        .join('\n');
    })
    .filter(Boolean)
    .join('\n');

  const sceneHosts = scenes
    .map((scene) => {
      const slug = sceneSlug(scene);
      const start = frameSeconds(scene.fromFrame, fps);
      const dur = frameSeconds(scene.durationInFrames, fps);
      return `  <div id="scene-${esc(slug)}" class="clip" data-composition-id="${esc(slug)}" data-composition-src="compositions/${esc(slug)}.html" data-start="${start}" data-duration="${dur}" data-track-index="0" data-track-kind="graphics" data-width="${width}" data-height="${height}"></div>`;
    })
    .join('\n');

  const audioEls = audio
    .map((track, i) => {
      const start = frameSeconds(track.fromFrame, fps);
      assets.push(String(track.assetPath));
      const loop = track.loop === true ? ' loop' : '';
      const kind = track.kind ? ` data-kind="${esc(track.kind)}"` : '';
      const vol = track.volume !== undefined ? ` data-volume="${track.volume}"` : '';
      // A sound effect (kind sfx) rides the root audio track with no data-duration
      // (design D6); narration and music keep theirs.
      const dur = track.kind === 'sfx' ? '' : ` data-duration="${frameSeconds(track.durationInFrames, fps)}"`;
      return `  <audio id="${esc(track.id)}"${kind} data-start="${start}"${dur} data-track-index="${100 + i}"${vol}${loop} src="assets/${esc(track.assetPath)}"></audio>`;
    })
    .join('\n');

  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${esc(compositionId)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  </head>
  <body>
    <div id="root" data-composition-id="${esc(compositionId)}" data-start="0" data-duration="${total}" data-width="${width}" data-height="${height}" data-fps="${fps}">
${sceneHosts}
${overlayHosts}
${animationHosts}
${plan.narrationCaptions ? `  <div id="captions" class="clip" data-track-kind="captions" data-start="0" data-duration="${total}" data-track-index="900"></div>\n` : ''}${audioEls}
    </div>
    <script>window.__timelines[${JSON.stringify(compositionId)}] = gsap.timeline({ paused: true });</script>
  </body>
</html>
`;

  const hyperframesJson = JSON.stringify(
    { composition: compositionId, fps, width, height, duration: total, pin: plan.pin || HYPERFRAMES_PIN },
    null,
    2,
  ) + '\n';

  /** @type {Record<string, string>} */
  const files = { 'index.html': indexHtml, 'hyperframes.json': hyperframesJson };
  for (const c of compositions) files[`compositions/${c.slug}.html`] = c.html;

  return { indexHtml, compositions, hyperframesJson, compositionId, total, assets, files };
}

/**
 * Writes the project to `plan.projectDir` through the regeneration guard.
 * Returns the written paths.
 * @param {object} manifest
 * @param {{ projectDir: string, pin?: string, components?: Record<string, { name: string, path: string }>, frame?: object, narrationCaptions?: boolean }} plan
 */
export function emitHyperframesProject(manifest, plan = {}) {
  if (!plan.projectDir) throw new Error('emitHyperframesProject: plan.projectDir is required');
  const built = buildProject(manifest, plan);
  const dir = path.resolve(plan.projectDir);
  writeGuarded(dir, built.files);

  return {
    projectDir: dir,
    indexHtml: path.join(dir, 'index.html'),
    compositions: built.compositions.map((c) => path.join(dir, 'compositions', `${c.slug}.html`)),
    assets: built.assets,
  };
}
