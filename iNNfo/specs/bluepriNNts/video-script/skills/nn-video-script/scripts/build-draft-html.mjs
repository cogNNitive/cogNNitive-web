#!/usr/bin/env node
/**
 * nn-video-script/scripts/build-draft-html.mjs
 *
 * Generates the self-contained interactive Review Console HTML artifact from a draft JSON artifact:
 * the JSON is embedded inline and every media thumbnail is inlined as a base64 data
 * URI, so the HTML is a single portable file (no assets folder) that works from file://.
 *
 * Series-parameterized through the parameter cascade: the display series title
 * comes from the `series_NN.md` document found by walking from the draft JSON's
 * folder (or an explicit `--series <dir>`); the template ships neutral
 * (`{{SERIES}}`).
 *
 * Usage:
 *   node build-draft-html.mjs <slug>_draft_V_x-y-z.json [--out <file.html>]
 *     [--series <dir>] [--series-title <name>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeriesFor } from './build-script-from-draft.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(argv, name) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function buildDraftHtml(draft, { baseDir, templatePath, seriesTitle = 'Series', title, description, reviewed } = {}) {
  const mimeFor = (p) => {
    const e = path.extname(p).toLowerCase();
    if (e === '.png') return 'image/png';
    if (e === '.webp') return 'image/webp';
    return 'image/jpeg';
  };
  const thumbs = {};
  for (const m of draft.media || []) {
    if (!m.thumb) continue;
    const tp = path.resolve(baseDir, m.thumb);
    try {
      thumbs[m.id] = 'data:' + mimeFor(tp) + ';base64,' + fs.readFileSync(tp).toString('base64');
    } catch {
      console.warn('thumb not found (skipped): ' + tp);
    }
  }

  // Probe draft_thumbs/ directory if present
  if (baseDir) {
    const draftThumbsDir = path.join(baseDir, 'draft_thumbs');
    if (fs.existsSync(draftThumbsDir) && fs.statSync(draftThumbsDir).isDirectory()) {
      try {
        const files = fs.readdirSync(draftThumbsDir);
        for (const f of files) {
          const full = path.join(draftThumbsDir, f);
          try {
            if (fs.statSync(full).isFile()) {
              thumbs[f] = 'data:' + mimeFor(full) + ';base64,' + fs.readFileSync(full).toString('base64');
            }
          } catch {}
        }
      } catch {}
    }
  }

  const effectiveTitle = title || draft.title || draft.slug || 'Video Script Review';
  const effectiveDescription = description || draft.description || 'Self-contained review artifact (HTML Quine). You can adjust editorial choices and cascade parameters, then click <b>Save & Package HTML</b> to save all decisions directly inside this same file to send it back via email.';
  const reviewedJson = reviewed ? JSON.stringify(reviewed, null, 2) : '';

  const tpl = fs.readFileSync(templatePath, 'utf8');
  return tpl
    .replace(/\{\{SERIES\}\}/g, seriesTitle)
    .replace(/\{\{TITLE\}\}/g, effectiveTitle)
    .replace(/\{\{DESCRIPTION\}\}/g, effectiveDescription)
    .replace('/*__DRAFT_JSON__*/', JSON.stringify(draft))
    .replace('/*__THUMBS_JSON__*/', JSON.stringify(thumbs))
    .replace('/*__REVIEWED_JSON__*/', reviewedJson);
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv[0] || argv[0] === '--help') {
    console.error('usage: node build-draft-html.mjs <draft.json> [--out <file.html>] [--series <dir>] [--series-title <name>]');
    process.exit(1);
  }
  const jsonPath = path.resolve(argv[0]);
  if (!fs.existsSync(jsonPath)) {
    console.error('draft JSON not found: ' + jsonPath);
    process.exit(1);
  }
  const draft = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const baseDir = path.dirname(jsonPath);
  const slug = draft.slug || path.basename(jsonPath).replace(/_draft.*\.json$/, '').replace(/\.json$/, '');
  const version = draft.version || 'v1';

  const reviewedPath = path.join(baseDir, `${slug}_reviewed.json`);
  let reviewed = null;
  if (fs.existsSync(reviewedPath)) {
    try {
      reviewed = JSON.parse(fs.readFileSync(reviewedPath, 'utf8'));
    } catch {}
  }

  const out = argValue(argv, 'out');
  const reviewConsolePath = out ? path.resolve(out) : path.join(baseDir, `${slug}_review_console.html`);
  const legacyDraftPath = path.join(baseDir, `${slug}_draft_${version}.html`);

  const series = loadSeriesFor(baseDir, argValue(argv, 'series'));
  const seriesTitle = argValue(argv, 'series-title') || (series && series.title) || (draft.series || 'Series');

  const html = buildDraftHtml(draft, {
    baseDir,
    templatePath: path.join(__dirname, 'draft-template.html'),
    seriesTitle,
    reviewed,
  });

  fs.writeFileSync(reviewConsolePath, html, 'utf8');
  if (!out) {
    fs.writeFileSync(legacyDraftPath, html, 'utf8');
  }

  const embedded = (html.match(/data:[^"]+;base64,/g) || []).length;
  console.log('Review console HTML written: ' + reviewConsolePath + ' (' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB, ' + embedded + ' thumbnails embedded)');
  if (!out) {
    console.log('Legacy draft alias written: ' + legacyDraftPath);
  }
}

const isMain =
  process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) main();
