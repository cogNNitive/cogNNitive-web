/**
 * nn-conntent/scripts/scene-project.mjs
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
import { safeArea, safeAreaCssVars } from './lib/safe-area.mjs';

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

/**
 * The pinned HyperFrames CLI binary in this skill's `node_modules/.bin` (the `.cmd`
 * shim on Windows). The one place that names it: render and transcription both run
 * this file, never `npx`.
 * @param {{ skillDir?: string, platform?: string }} [opts]
 */
export function resolveHyperframesCli({ skillDir, platform = process.platform } = {}) {
  const dir = skillDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  return path.join(dir, 'node_modules', '.bin', platform === 'win32' ? 'hyperframes.cmd' : 'hyperframes');
}

const roundMs = (seconds) => Math.round(seconds * 1000) / 1000;
const frameSeconds = (frames, fps) => roundMs((frames || 0) / fps);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const sceneSlug = (scene) => String(scene.slug || scene.id || 'scene').replace(/^scene_/, '') || 'scene';
const isVideoName = (name) => /\.(mp4|webm|mov|mkv|m4v)$/i.test(String(name || ''));

/** Drawable media layers (have a staged asset) sorted by paint order (`layer_z_index`). */
function drawableLayers(scene) {
  const layers = (scene?.props?.layers) || [];
  return layers
    .filter((l) => String(l.layer_asset_source || '').length > 0)
    .slice()
    .sort((a, b) => Number(a.layer_z_index ?? 0) - Number(b.layer_z_index ?? 0));
}

/**
 * `fit` classification tolerance (spec S2): an asset is `native` when its aspect ratio
 * is within 5% of the box aspect, |assetAspect / boxAspect - 1| <= 0.05, inclusive;
 * otherwise it is `mismatch`. 5% absorbs encoder rounding (1366x768, 1920x1088) without
 * calling a 4:3 asset native on a 16:9 canvas (a 25% difference).
 */
export const FIT_ASPECT_TOLERANCE = 0.05
/** The backdrop blur radius is 24px when the box's shorter side is 1920px... */
export const FIT_BLUR_REFERENCE_PX = 24
/** ...and scales linearly with the shorter side (13.5px at 1080). */
export const FIT_BLUR_REFERENCE_SIDE = 1920
/** Backdrop darkening for a `fit:: blur`/`card` layer. */
export const FIT_BLUR_BRIGHTNESS = 0.82
/** `card` geometry, as fractions of the box's shorter side: margin, corner radius, shadow offset and blur. */
export const FIT_CARD = Object.freeze({ inset: 0.05, radius: 0.02, shadowY: 0.012, shadowBlur: 0.04, shadowAlpha: 0.45 })

const round2 = (n) => Math.round(n * 100) / 100

/** The CSS blur radius of a `fit` backdrop for a box: proportional to its shorter side. */
export function fitBlurRadiusPx(boxWidth, boxHeight) {
  return round2((FIT_BLUR_REFERENCE_PX * Math.min(boxWidth, boxHeight)) / FIT_BLUR_REFERENCE_SIDE)
}

/** `native` when the asset aspect is within FIT_ASPECT_TOLERANCE of the box aspect, else `mismatch`. */
export function classifyFit(assetWidth, assetHeight, boxWidth, boxHeight) {
  const ratio = (assetWidth / assetHeight) / (boxWidth / boxHeight)
  // Rounded to 1e-9 so a ratio exactly on the boundary is not lost to float noise.
  return Math.round(Math.abs(ratio - 1) * 1e9) / 1e9 <= FIT_ASPECT_TOLERANCE ? 'native' : 'mismatch'
}

/** A manifest `layer_fit` as `{ native, mismatch }`: a legacy scalar means both keys; absent is null. */
function fitMapOf(raw) {
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw === 'object') return { native: String(raw.native || 'cover'), mismatch: String(raw.mismatch || 'cover') }
  const v = String(raw).toLowerCase()
  return { native: v, mismatch: v }
}

/** The asset size a layer carries (probed at compile), or a named error. */
function assetSizeOf(layer, why) {
  const w = Number(layer.layer_asset_width)
  const h = Number(layer.layer_asset_height)
  if (w > 0 && h > 0) return { width: w, height: h }
  throw new Error(
    `scene-project: layer "${layer.layer_asset_source}" has no asset size (layer_asset_width/height) and its fit ${why}; compile probes it`,
  )
}

/**
 * The treatment one layer gets on this canvas: null for an undeclared fit (today's cover
 * markup), otherwise the value of the key its classification picks. Classification only
 * runs when the two keys differ, so a single-valued fit needs no asset size.
 */
export function chosenFit(layer, box) {
  if (layer.layer_avatar_origin) return 'cover';
  const map = fitMapOf(layer.layer_fit)
  if (!map) return null
  if (map.native === map.mismatch) return map.native
  const size = assetSizeOf(layer, 'needs a native/mismatch classification')
  return map[classifyFit(size.width, size.height, box.width, box.height)]
}

function layerMarkup(layer, sceneDurationFrames, fps, trackBase, sceneSlug, box) {
  const name = String(layer.layer_asset_source);
  const dur = frameSeconds(sceneDurationFrames, fps);
  const z = Number(layer.layer_z_index ?? 0);
  const tag = isVideoName(name) ? 'video' : 'img';
  const mediaAttrs =
    tag === 'video'
      ? `muted playsinline data-has-audio="false"`
      : '';
  let objectPos = 'center center';
  if (layer.layer_position) {
    const p = String(layer.layer_position).toLowerCase();
    if (p === 'top') objectPos = 'center top';
    else if (p === 'bottom') objectPos = 'center bottom';
    else if (p === 'center') objectPos = 'center center';
    else objectPos = layer.layer_position;
  }
  // Every format renders natively, so there is no headroom to compensate: the retired
  // `center 12%` offset is gone (design D5).
  // A stable per-layer `id` gives HyperFrames Studio a target for its timeline and
  // canvas controls (an id-less clip triggers a lint warning).
  const id = `media-${esc(sceneSlug || 'scene')}-${trackBase}`;
  const fit = chosenFit(layer, box);
  const zIndex = Number.isFinite(z) ? z : 0;
  // `placement:: inset` (spec S6): the layer's box is the canvas safe area, so every
  // element is placed there explicitly; a full-canvas box keeps the shared `inset: 0`.
  const geom = Number.isFinite(box.x)
    ? `inset:auto;left:${box.x}px;top:${box.y}px;width:${box.width}px;height:${box.height}px;`
    : '';
  const ox = Number.isFinite(box.x) ? box.x : 0;
  const oy = Number.isFinite(box.y) ? box.y : 0;
  // A `component:<name>` fit is mounted at the root (see fitComponentHosts), never here.
  if (fit && fit.startsWith('component:')) return '';
  // `blur` and `card` keep the WHOLE asset visible over a backdrop built from the same
  // asset filling the box and blurred, so a 16:9 image in a 9:16 box shows no empty
  // band. Both elements are the same file: no new palette is introduced, and the
  // backdrop carries no audio of its own (`muted`). The radius scales with the box.
  const backdrop = () =>
    `<${tag} id="${id}-backdrop" class="clip nn-media nn-media-backdrop" data-start="0" data-duration="${dur}" ` +
    `data-track-index="${trackBase}" ${mediaAttrs} aria-hidden="true" src="assets/${esc(name)}" ` +
    `style="z-index:${zIndex};${geom}object-position:${objectPos};object-fit:cover;` +
    `filter:blur(${fitBlurRadiusPx(box.width, box.height)}px) brightness(${FIT_BLUR_BRIGHTNESS});"></${tag}>`;
  // `card` presents the whole asset, never cropped, as a card over the designed frame:
  // the blurred self-backdrop. The card is sized to the asset's own aspect inside a
  // margin of FIT_CARD.inset of the shorter side, centered, with rounded corners and a
  // soft shadow, all proportional to the box.
  if (fit === 'card') {
    const size = assetSizeOf(layer, 'is card');
    const side = Math.min(box.width, box.height);
    const inset = Math.round(FIT_CARD.inset * side);
    const scale = Math.min((box.width - 2 * inset) / size.width, (box.height - 2 * inset) / size.height);
    const w = Math.round(size.width * scale);
    const h = Math.round(size.height * scale);
    const left = ox + Math.round((box.width - w) / 2);
    const top = oy + Math.round((box.height - h) / 2);
    const card =
      `<${tag} id="${id}" class="clip nn-media nn-media-card" data-start="0" data-duration="${dur}" ` +
      `data-track-index="${trackBase}" ${mediaAttrs} src="assets/${esc(name)}" ` +
      `style="z-index:${zIndex};inset:auto;left:${left}px;top:${top}px;width:${w}px;height:${h}px;object-fit:contain;` +
      `border-radius:${Math.round(FIT_CARD.radius * side)}px;` +
      `box-shadow:0 ${Math.round(FIT_CARD.shadowY * side)}px ${Math.round(FIT_CARD.shadowBlur * side)}px rgba(0,0,0,${FIT_CARD.shadowAlpha});"></${tag}>`;
    return backdrop() + '\n      ' + card;
  }
  if (fit === 'contain') {
    return (
      `<${tag} id="${id}" class="clip nn-media" data-start="0" data-duration="${dur}" ` +
      `data-track-index="${trackBase}" ${mediaAttrs} src="assets/${esc(name)}" ` +
      `style="z-index:${zIndex};${geom}object-position:${objectPos};object-fit:contain;"></${tag}>`
    );
  }
  if (fit === 'blur') {
    const foreground =
      `<${tag} id="${id}" class="clip nn-media nn-media-foreground" data-start="0" data-duration="${dur}" ` +
      `data-track-index="${trackBase}" ${mediaAttrs} src="assets/${esc(name)}" ` +
      `style="z-index:${zIndex};${geom}object-position:${objectPos};object-fit:contain;"></${tag}>`;
    return backdrop() + '\n      ' + foreground;
  }
  return (
    `<${tag} id="${id}" class="clip nn-media" data-start="0" data-duration="${dur}" ` +
    `data-track-index="${trackBase}" ${mediaAttrs} src="assets/${esc(name)}" ` +
    `style="z-index:${zIndex};${geom}object-position:${objectPos};"></${tag}>`
  );
}

/**
 * The box a media layer is drawn in: the whole canvas, or with `placement:: inset` the
 * canvas safe area (spec S6), which is also the box `fit` classifies the asset against.
 */
function layerBox(layer, width, height) {
  if (String(layer.layer_placement || '') !== 'inset') return { width, height };
  const safe = safeArea({ width, height });
  return { x: safe.x, y: safe.y, width: safe.width, height: safe.height };
}

/** Pure: build the project text without touching the filesystem. */
export function buildProject(manifest, plan = {}) {
  const fps = Number(manifest.fps) || 30;
  // Width and height are required: the canvas is one declared output format, so the
  // projector never invents 1920x1080 (design D3).
  const width = Number(manifest.width);
  const height = Number(manifest.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(
      'scene-project: the manifest carries no width/height; compile with an output_formats declaration',
    );
  }
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
    const layerHtml = layers
      .map((l, i) => layerMarkup(l, scene.durationInFrames, fps, i + 1, slug, layerBox(l, width, height)))
      .filter(Boolean)
      .join('\n      ');
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
  <script src="vendor/gsap.min.js"></script>
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
        width,
        height,
      });
    })
    .filter(Boolean)
    .join('\n');

  // Authored-animation hosts (design D4/D7): ROOT-level sub-compositions with
  // global times, mounted from `authored/<id>/index.html` (staged by the render
  // driver). The scene length is fixed before this point (narration when the scene
  // has it); the animation fits it: a longer one is TRIMMED (one host lasting the
  // scene) and a shorter one is LOOPED (consecutive hosts of the animation's length,
  // the last one trimmed). Every host id is namespaced per mount
  // (`animation-<scene>-<id>[-<n>]`), so one project can be mounted by several
  // scenes; HyperFrames gives each mount of the same composition id its own runtime
  // instance. No `muted`, no playback-rate: the animation plays its own audio.
  let animationTrackIndex = 500;
  const animationHosts = scenes
    .map((scene) => {
      const anims = scene.animations || [];
      if (anims.length === 0) return '';
      const slug = sceneSlug(scene);
      const sceneFrames = Math.max(0, Number(scene.durationInFrames) || 0);
      return anims
        .map((a) => {
          const animFrames = Math.max(0, Number(a.durationInFrames) || 0);
          const loops = animFrames > 0 && animFrames < sceneFrames - 1 ? Math.ceil(sceneFrames / animFrames) : 1;
          const step = loops > 1 ? animFrames : sceneFrames;
          const hosts = [];
          for (let k = 0; k < loops; k++) {
            const from = (Number(scene.fromFrame) || 0) + k * step;
            const frames = Math.min(step, sceneFrames - k * step);
            const id = `animation-${slug}-${a.id}${loops > 1 ? `-${k + 1}` : ''}`;
            hosts.push(
              `  <div id="${esc(id)}" class="clip" data-composition-id="${esc(a.id)}" data-composition-src="authored/${esc(a.id)}/index.html" data-start="${frameSeconds(from, fps)}" data-duration="${frameSeconds(frames, fps)}" data-track-index="${animationTrackIndex++}" data-track-kind="graphics"></div>`,
            );
          }
          return hosts.join('\n');
        })
        .join('\n');
    })
    .filter(Boolean)
    .join('\n');

  // `fit:: component:<name>` hosts: ROOT-level sub-compositions with global times, like
  // the overlay and authored-animation hosts above. A scene is itself a sub-composition,
  // and the slot components already mount at the root in one nesting level; mounting a
  // component inside a scene would nest two levels, which no other mount in this
  // project does. The host lasts the scene, paints above the scene hosts (DOM order)
  // with the layer's own z-index, and stays below every overlay (z-index 200+). The
  // component receives `{ src, width, height, asset_width, asset_height }`; the render
  // driver stages it into `components/<name>.html` from `metadata.fitComponents`.
  const fitComponentMap = plan.fitComponents || manifest?.metadata?.fitComponents || {};
  let fitTrackIndex = 600;
  const fitHosts = scenes
    .flatMap((scene) => {
      const slug = sceneSlug(scene);
      return drawableLayers(scene).map((layer, i) => {
        const fit = chosenFit(layer, { width, height });
        if (!fit || !fit.startsWith('component:')) return '';
        const name = fit.slice('component:'.length);
        const size = assetSizeOf(layer, `is ${fit}`);
        const values = JSON.stringify({
          src: `assets/${layer.layer_asset_source}`,
          width,
          height,
          asset_width: size.width,
          asset_height: size.height,
        })
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/'/g, '&#39;');
        const z = Number(layer.layer_z_index ?? 0);
        const noTimeline = fitComponentMap[name]?.noTimeline ? ' data-no-timeline' : '';
        return (
          `  <div id="fit-${esc(slug)}-${i + 1}" class="clip" data-composition-id="${esc(name)}" ` +
          `data-composition-src="components/${esc(name)}.html" data-start="${frameSeconds(scene.fromFrame, fps)}" ` +
          `data-duration="${frameSeconds(scene.durationInFrames, fps)}" data-track-index="${fitTrackIndex++}" ` +
          `data-track-kind="graphics" data-width="${width}" data-height="${height}"${noTimeline} ` +
          `data-variable-values='${values}' style="position:absolute;inset:0;z-index:${Number.isFinite(z) ? z : 0}"></div>`
        );
      });
    })
    .filter(Boolean)
    .join('\n');

  const sceneHosts = scenes
    .map((scene) => {
      const slug = sceneSlug(scene);
      const start = frameSeconds(scene.fromFrame, fps);
      const dur = frameSeconds(scene.durationInFrames, fps);
      return `  <div id="scene-${esc(slug)}" class="clip" data-composition-id="${esc(slug)}" data-composition-src="compositions/${esc(slug)}.html" data-start="${start}" data-duration="${dur}" data-track-index="0" data-track-kind="graphics" data-width="${width}" data-height="${height}" style="position:absolute;inset:0;"></div>`;
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

  // Compile turns aligned narration captions into `captions` overlays (one per
  // readable segment), which mount the caption component above like any overlay.
  // The raw word host is only emitted for a manifest that carries no such overlays,
  // so the same words are never drawn twice.
  let captionsHostHtml = '';
  const narrationCaptions = plan.narrationCaptions ?? manifest?.metadata?.narrationCaptions ?? manifest?.captions;
  const hasCaptionOverlays = overlays.some((o) => o?.type === 'captions');
  if (narrationCaptions && !hasCaptionOverlays) {
    let inner = '';
    if (Array.isArray(narrationCaptions)) {
      inner = narrationCaptions
        .map((entry) => {
          const s = roundMs(Number(entry.start) || 0);
          const e = roundMs(Number(entry.end) || s);
          const d = roundMs(e - s);
          const cls = entry.kind ? `caption-${entry.kind}` : 'caption-entry';
          return `    <span class="${cls}" data-start="${s}" data-end="${e}" data-duration="${d}">${esc(entry.text)}</span>`;
        })
        .join('\n');
      if (inner) inner = '\n' + inner + '\n  ';
    } else if (typeof narrationCaptions === 'string') {
      inner = narrationCaptions;
    }
    captionsHostHtml = `  <div id="captions" class="clip" data-track-kind="captions" data-start="0" data-duration="${total}" data-track-index="900">${inner}</div>\n`;
  }

  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${esc(compositionId)}</title>
    <style>
      #root { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; }
      .clip { position: absolute; inset: 0; }
    </style>
    <script src="vendor/gsap.min.js"></script>
  </head>
  <body>
    <div id="root" data-composition-id="${esc(compositionId)}" data-start="0" data-duration="${total}" data-width="${width}" data-height="${height}" data-fps="${fps}" style="position:relative;width:${width}px;height:${height}px;overflow:hidden;${safeAreaCssVars({ width, height })};">
${sceneHosts}
${overlayHosts}
${animationHosts}
${fitHosts ? `${fitHosts}\n` : ''}${captionsHostHtml}${audioEls}
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
  const narrationCaptions = plan.narrationCaptions ?? manifest?.metadata?.narrationCaptions ?? manifest?.captions;
  const built = buildProject(manifest, { ...plan, narrationCaptions });
  const dir = path.resolve(plan.projectDir);
  writeGuarded(dir, built.files);

  return {
    projectDir: dir,
    indexHtml: path.join(dir, 'index.html'),
    compositions: built.compositions.map((c) => path.join(dir, 'compositions', `${c.slug}.html`)),
    assets: built.assets,
  };
}
