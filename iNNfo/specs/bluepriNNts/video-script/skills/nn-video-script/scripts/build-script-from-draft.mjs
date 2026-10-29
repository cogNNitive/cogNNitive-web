#!/usr/bin/env node
/**
 * nn-video-script/scripts/build-script-from-draft.mjs
 *
 * Generates the final iNNfo Level-3 `video-script` document from a reviewed draft.
 * The reviewed JSON is the single source of truth for per-scene decisions (narration,
 * choice, overlays); the draft JSON only supplies the scene structure (including fixed
 * scenes such as the intro bumper). One Scene per single visual.
 *
 * Series-parameterized through the parameter cascade (design D10/D11): every
 * series value (presenter/intro assets, per-scene templates) is read from the
 * `series_NN.md` bag, the domain Video Defaults or the package Video Defaults,
 * never from a side config. The generated document's frontmatter is copied from
 * the series document and its filename uses the Series slug. Cascaded scene
 * values the engine resolves itself (`music`, `music_volume`, `transition`,
 * `fit`) are never written.
 *
 * Usage:
 *   node build-script-from-draft.mjs <slug>_reviewed.json [--draft <draft.json>]
 *     [--series <series-dir>] [--out <script_NN.md>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadCascadeBags, resolve, findSeriesRoot } from './lib/video-scope.mjs';
import { resolveWorkspace } from './lib/video-guard.mjs';
import { parseKnowledgeDocument, slugify } from './lib/knowledge-model.mjs';

/** The raw frontmatter block (between the `---` fences) of an iNNfo document. */
export function extractFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(content ?? ''));
  return match ? match[1] : '';
}

/**
 * The output filename for a generated script: `<videoSlug>_video-script_<seriesSlug>_NN.md`.
 * Both slugs come from documents (the reviewed JSON and the series `slug::`), never
 * from a hardcoded series name.
 * @param {string} seriesSlug
 * @param {string} videoSlug
 * @returns {string}
 */
export function scriptFilename(seriesSlug, videoSlug) {
  return `${videoSlug}_video-script_${seriesSlug}_NN.md`;
}

/**
 * Top-level frontmatter keys that belong to a scope marker and must never be
 * copied into an episode script: they would turn the episode into a scope with
 * fills of its own.
 */
const MARKER_ONLY_KEYS = new Set(['scope', 'isolate', 'fills']);

/** Drops a top-level key and its indented continuation lines from a frontmatter block. */
export function dropFrontmatterKeys(frontmatter, keys = MARKER_ONLY_KEYS) {
  const out = [];
  let dropping = false;
  for (const line of String(frontmatter ?? '').split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+):/);
    if (m) dropping = keys.has(m[1]);
    if (!dropping) out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

/**
 * The series document of a folder: the legacy `series_NN.md` when present, else
 * the unique `<series>_scope_NN.md` scope marker. Returns null when neither
 * exists or the marker name is ambiguous.
 * @param {string} seriesDir
 * @returns {{ file: string, marker: boolean } | null}
 */
export function seriesDocumentFile(seriesDir) {
  const dir = path.resolve(seriesDir);
  const legacy = path.join(dir, 'series_NN.md');
  if (fs.existsSync(legacy)) return { file: legacy, marker: false };
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const markers = entries.filter((f) => f.endsWith('_scope_NN.md')).sort();
  return markers.length === 1 ? { file: path.join(dir, markers[0]), marker: true } : null;
}

/**
 * Reads the Series document from a series folder (`series_NN.md`, or its
 * `<series>_scope_NN.md` marker). A marker's scope-only keys are dropped, and
 * its slug comes from the filename stem because it declares no `slug::` field.
 * @param {string} seriesDir
 * @returns {{ frontmatter: string, slug: string, title: string, fields: Record<string, string> }}
 */
export function loadSeriesDocument(seriesDir) {
  const found = seriesDocumentFile(seriesDir);
  if (!found) {
    throw new Error(
      `no series document in ${path.resolve(seriesDir)}: expected series_NN.md or a <series>_scope_NN.md marker`,
    );
  }
  const content = fs.readFileSync(found.file, 'utf8');
  const model = parseKnowledgeDocument(content);
  const el = (model.elements.Series || [])[0] || {};
  const fields = el.fields || {};
  const title = fields.title || model.frontmatter.title || el.name || '';
  const fromStem = path.basename(found.file).replace(/_scope_NN\.md$/, '');
  return {
    frontmatter: found.marker ? dropFrontmatterKeys(extractFrontmatter(content)) : extractFrontmatter(content),
    // A marker is named after its series (unique-stem convention); its element
    // slug is derived from the heading and is not authoritative.
    slug: found.marker ? fromStem : el.slug || slugify(title),
    title,
    fields,
  };
}

/**
 * Locates the series document for an input folder: an explicit `--series <dir>` wins,
 * otherwise the nearest ancestor holding a `series_NN.md` marker strictly below the
 * workspace root.
 * @param {string} inputDir
 * @param {string} [seriesDirFlag]
 * @returns {({ frontmatter: string, slug: string, title: string, fields: Record<string, string>, dir: string }) | null}
 */
/**
 * Locates the series document for an input folder: an explicit `--series <dir>` wins,
 * otherwise the nearest ancestor holding a series marker strictly below the
 * workspace root. The document is `series_NN.md` or the `<series>_scope_NN.md` marker.
 * @param {string} inputDir
 * @param {string} [seriesDirFlag]
 * @returns {({ frontmatter: string, slug: string, title: string, fields: Record<string, string>, dir: string }) | null}
 */
export function loadSeriesFor(inputDir, seriesDirFlag) {
  const dir = seriesDirFlag
    ? path.resolve(seriesDirFlag)
    : findSeriesRoot(inputDir, resolveWorkspace(inputDir).root);
  if (!dir || !seriesDocumentFile(dir)) return null;
  return { dir, ...loadSeriesDocument(dir) };
}

/** Pure: build the L3 script markdown from a reviewed draft and the cascade bags. */
export function buildScript(reviewed, draft, options = {}) {
  const bags = options.bags || {};
  const frontmatter = options.frontmatter || '';
  const byslug = new Map((reviewed.scenes || []).map((s) => [s.slug, s]));
  const draftBySlug = new Map(((draft && draft.scenes) || []).map((s) => [s.slug, s]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const humanName = (s) => (s || '').replace(/-/g, ' ').replace(/^\d+ /, '').trim();
  const d = draft || { scenes: reviewed.scenes };

  // A scene template is a per-scene draft decision; it is the only template the
  // tool writes. Scenes without one rely on the cascade (the engine resolves it).
  const templateFor = (scene) => {
    const fromDraft = draftBySlug.get(scene.slug);
    const fromReviewed = byslug.get(scene.slug);
    return (fromDraft && fromDraft.template) || (fromReviewed && fromReviewed.template) || '';
  };

  function layersFor(scene, choice) {
    const head = '### NN Layer: ';
    if (scene.kind === 'fixed') {
      const asset = resolve('intro_asset', bags).value;
      const lines = [head + humanName(scene.name) + ' Background', 'slug:: ' + scene.slug + '-background', 'type:: background'];
      if (asset) lines.push('asset:: ' + asset);
      lines.push('position:: center');
      return lines.join('\n');
    }
    if (choice && choice.type === 'avatar') {
      const asset = resolve('presenter_asset', bags).value;
      const lines = [head + humanName(scene.name) + ' Presenter', 'slug:: ' + scene.slug + '-presenter', 'type:: presenter'];
      if (asset) lines.push('asset:: ' + asset);
      lines.push('avatar_model:: ' + choice.model);
      if (choice.quality === 'ALTA') {
        lines.push('avatar_resolution:: ' + (choice.resolution || '768p'));
      }
      return lines.join('\n');
    }
    if (choice && choice.type === 'media') {
      return [
        head + humanName(scene.name) + ' Visual',
        'slug:: ' + scene.slug + '-visual',
        'type:: background',
        'asset:: ' + choice.asset,
        'position:: center',
      ].join('\n');
    }
    // An animation choice points at an authored HyperFrames project directory
    // (design D7); the engine mounts it as a sub-composition, so no overlay text
    // or position is written.
    if (choice && choice.type === 'animation') {
      const asset = choice.asset || 'media/' + scene.slug;
      return [
        head + humanName(scene.name) + ' Animation',
        'slug:: ' + scene.slug + '-animation',
        'type:: animation',
        'asset:: ' + asset,
      ].join('\n');
    }
    return null;
  }

  const CATALOG = (reviewed.overlays && reviewed.overlays.length ? reviewed.overlays : d.overlays) || [];

  // `assigned` = the reviewed scene's overlays (the decision); the draft scene's apply only when no reviewed scene exists.
  function sceneOverlayLayers(scene, assigned) {
    const cat = Object.fromEntries(CATALOG.map((o) => [o.id, o]));
    const listed = assigned ?? scene.overlays ?? [];
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
    const narration = scene.kind === 'fixed' ? '' : (r ? r.narration : scene.narration) || '';
    const lines = ['## NN Scene: ' + scene.name, '', 'slug:: ' + scene.slug];
    const template = templateFor(scene);
    if (template) lines.push('template:: ' + template);
    lines.push('', narration, '');
    const layers = layersFor(scene, r ? r.choice : null);
    if (layers) lines.push(layers);
    const ovls = scene.kind === 'fixed' ? '' : sceneOverlayLayers(scene, r ? r.overlays || [] : undefined);
    if (ovls) lines.push(ovls);
    return lines.join('\n');
  }

  const ordered = d.scenes || reviewed.scenes;
  const blocks = ordered.map(sceneBlock).join('\n\n');

  return [
    '---',
    frontmatter,
    '---',
    '',
    '# NN Video',
    '',
    '## NN Video: ' + reviewed.title,
    '',
    'slug:: ' + reviewed.slug,
    'title:: ' + reviewed.title,
    'sources:: [' + (reviewed.sources || []).join(', ') + ']',
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
    console.error('usage: node build-script-from-draft.mjs <reviewed.json> [--draft <draft.json>] [--series <series-dir>] [--out <out.md>]');
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
  const inputDir = path.dirname(reviewedPath);
  const seriesDir = flag('--series');
  const bags = loadCascadeBags(seriesDir || inputDir);
  const series = loadSeriesFor(inputDir, seriesDir);
  const frontmatter = series ? series.frontmatter : '';
  const seriesSlug = (series && series.slug) || (bags.series && bags.series.slug) || reviewed.slug;
  const outPath = flag('--out') || path.join(inputDir, scriptFilename(seriesSlug, reviewed.slug));
  const md = buildScript(reviewed, draft, { bags, frontmatter });
  fs.writeFileSync(outPath, md, 'utf8');
  console.log('Script written: ' + outPath + ' (' + (Buffer.byteLength(md) / 1024).toFixed(1) + ' KB)');
}

import { fileURLToPath } from 'node:url';
const isMain =
  process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) main();
