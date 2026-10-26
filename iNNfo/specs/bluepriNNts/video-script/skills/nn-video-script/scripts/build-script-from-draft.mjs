#!/usr/bin/env node
/**
 * nn-video-script/scripts/build-script-from-draft.mjs
 *
 * Generates the final iNNfo Level-3 `video-script` document from a reviewed draft.
 * The reviewed JSON carries the decisions + narrations; the draft JSON carries the
 * scene structure (including fixed scenes such as the intro bumper). One Scene per
 * single visual.
 *
 * Series-parameterized: every series-specific value (template names, music default,
 * filenames, avatar/intro assets) is read from a `video.series.json` config, never
 * hardcoded. Without a config it uses neutral defaults.
 *
 * Usage:
 *   node build-script-from-draft.mjs <slug>_reviewed.json [--draft <draft.json>]
 *     [--series <series-dir> | --config <video.series.json>] [--out <script_NN.md>]
 */

import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SERIES_CONFIG = {
  series: 'series',
  seriesSpecName: '<series>_V_0-1-0',
  seriesSpecUrl: 'series/<series>/spec_NN.md',
  templateFull: '[[<series> :: Full]]',
  templateSection: '[[<series> :: Section]]',
  defaultMusic: '../../shared/music/bed.mp3',
  defaultMusicVolume: '0.4',
  defaultAvatarAsset: '../../shared/avatar/avatar_default.png',
  defaultIntroAsset: '../../shared/intro.mp4',
  scriptFilename: '<slug>_video-script_<series>_NN.md',
  defaultTransition: 'fade',
  specVersion: 'V_0-4-0',
  specUrl: 'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-4-0_NN.md',
};

/** Applies the series name to the `<series>` / `<slug>` placeholders. */
export function applySeriesTokens(config, slug) {
  const out = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = typeof v === 'string' ? v.replace(/<series>/g, config.series).replace(/<slug>/g, slug) : v;
  }
  return out;
}

export function loadSeriesConfig(argv) {
  const i = argv.indexOf('--config');
  const s = argv.indexOf('--series');
  let file = null;
  if (i >= 0) file = argv[i + 1];
  else if (s >= 0) file = path.join(argv[s + 1], 'video.series.json');
  if (file && fs.existsSync(file)) {
    return { ...DEFAULT_SERIES_CONFIG, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  }
  return { ...DEFAULT_SERIES_CONFIG };
}

/** Pure: build the L3 script markdown from a reviewed draft and a series config. */
export function buildScript(reviewed, draft, config) {
  const cfg = config;
  const merged = applySeriesTokens(cfg, reviewed.slug);
  const rev = { ...reviewed, config: { effective: { ...(reviewed.config?.effective || {}), ...merged } } };
  const cfgEff = rev.config.effective;
  const byslug = new Map(rev.scenes.map((s) => [s.slug, s]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const humanName = (s) => (s || '').replace(/-/g, ' ').replace(/^\d+ /, '').trim();
  const templateFor = (slug) => (slug === '00-gancho' ? cfgEff.templateFull : cfgEff.templateSection);
  const d = draft || { scenes: rev.scenes };

  function layersFor(scene, choice) {
    const head = '### NN Layer: ';
    if (scene.kind === 'fixed') {
      return [
        head + humanName(scene.name) + ' Background',
        'slug:: ' + scene.slug + '-background',
        'type:: background',
        'asset:: ' + cfgEff.defaultIntroAsset,
        'fit:: cover',
        'position:: center',
      ].join('\n');
    }
    if (choice && choice.type === 'avatar') {
      const lines = [
        head + humanName(scene.name) + ' Presenter',
        'slug:: ' + scene.slug + '-presenter',
        'type:: presenter',
        'asset:: ' + (cfgEff.avatar_image || cfgEff.defaultAvatarAsset),
        'model:: ' + choice.model,
      ];
      if (choice.quality === 'ALTA' || scene.slug === '00-gancho') {
        lines.push('avatar_resolution:: ' + (choice.resolution || '768p'));
      }
      return lines.join('\n');
    }
    if (choice && (choice.type === 'media' || choice.type === 'animation')) {
      const asset = choice.type === 'animation' ? 'media/' + scene.slug + '_animacion_1080x1080.mp4' : choice.asset;
      return [
        head + humanName(scene.name) + ' Visual',
        'slug:: ' + scene.slug + '-visual',
        'type:: background',
        'asset:: ' + asset,
        'fit:: cover',
        'position:: center',
      ].join('\n');
    }
    return null;
  }

  const CATALOG = (rev.overlays && rev.overlays.length ? rev.overlays : d.overlays) || [];

  function sceneOverlayLayers(scene) {
    const cat = Object.fromEntries(CATALOG.map((o) => [o.id, o]));
    const listed = scene.overlays || [];
    const rows = [];
    const seen = new Set();
    for (const o of listed) {
      const base = o.ref ? cat[o.ref] : null;
      rows.push({
        id: o.id || (base && base.id),
        type: o.type || (base && base.type) || 'caption',
        text: o.text !== undefined && o.text !== '' ? o.text : base ? base.text : '',
        position: o.position || (base && base.position) || 'bottom-right',
      });
      seen.add(o.id);
      if (o.ref) seen.add(o.ref);
    }
    for (const c of CATALOG) if (c.default && !seen.has(c.id)) rows.push({ id: c.id, type: c.type, text: c.text, position: c.position });
    return rows
      .filter((r) => r.text)
      .map((r) =>
        [
          '### NN Layer: ' + humanName(scene.name) + ' ' + cap(r.type),
          'slug:: ' + scene.slug + '-' + r.id,
          'type:: ' + r.type,
          'text:: ' + r.text,
          'position:: ' + r.position,
        ].join('\n'),
      )
      .join('\n\n');
  }

  function sceneBlock(scene) {
    const r = byslug.get(scene.slug);
    const narration = scene.kind === 'fixed' ? '' : r ? r.narration : scene.narration;
    const lines = ['## NN Scene: ' + scene.name, '', 'slug:: ' + scene.slug];
    lines.push('template:: ' + templateFor(scene.slug));
    lines.push('music:: ' + (cfgEff.music || cfgEff.defaultMusic));
    lines.push('music_volume:: ' + (cfgEff.music_volume || cfgEff.defaultMusicVolume));
    lines.push('transition:: ' + (cfgEff.transition || cfgEff.defaultTransition));
    lines.push('', narration, '');
    const layers = layersFor(scene, r ? r.choice : null);
    if (layers) lines.push(layers);
    const ovls = scene.kind === 'fixed' ? '' : sceneOverlayLayers(scene);
    if (ovls) lines.push(ovls);
    return lines.join('\n');
  }

  const ordered = d.scenes || rev.scenes;
  const blocks = ordered.map(sceneBlock).join('\n\n');

  return [
    '---',
    'spec_version: "' + cfgEff.specVersion + '"',
    'spec_url: "' + cfgEff.specUrl + '"',
    'level: 3',
    'parent_spec:',
    '  name: "' + cfgEff.seriesSpecName + '"',
    '  url: "' + cfgEff.seriesSpecUrl + '"',
    'knowledge_version: "V_0-1-0"',
    'title: ' + JSON.stringify(rev.title),
    '---',
    '',
    '> [!NOTE]',
    '> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/).',
    '',
    '# NN Video',
    '',
    '## NN Video: ' + rev.title,
    '',
    'slug:: ' + rev.slug,
    'title:: ' + rev.title,
    'sources:: [' + (rev.sources || []).join(', ') + ']',
    '',
    '# NN Scene',
    '',
    blocks,
    '',
  ].join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv[0] || argv[0] === '--help') {
    console.error('usage: node build-script-from-draft.mjs <reviewed.json> [--draft <draft.json>] [--series <dir> | --config <file>] [--out <out.md>]');
    process.exit(1);
  }
  const flag = (n) => {
    const i = argv.indexOf(n);
    return i >= 0 ? path.resolve(argv[i + 1]) : null;
  };
  const reviewedPath = path.resolve(argv[0]);
  const reviewed = JSON.parse(fs.readFileSync(reviewedPath, 'utf8'));
  const draftPath = flag('--draft');
  const draft = draftPath ? JSON.parse(fs.readFileSync(draftPath, 'utf8')) : null;
  const cfg = loadSeriesConfig(argv);
  const mergedCfg = applySeriesTokens(cfg, reviewed.slug);
  const outPath = flag('--out') || path.join(path.dirname(reviewedPath), mergedCfg.scriptFilename);
  const md = buildScript(reviewed, draft, cfg);
  fs.writeFileSync(outPath, md, 'utf8');
  console.log('Script written: ' + outPath + ' (' + (Buffer.byteLength(md) / 1024).toFixed(1) + ' KB)');
}

import { fileURLToPath } from 'node:url';
const isMain =
  process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) main();
