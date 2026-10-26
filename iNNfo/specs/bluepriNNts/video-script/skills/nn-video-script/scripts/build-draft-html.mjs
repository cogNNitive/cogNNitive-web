#!/usr/bin/env node
/**
 * nn-video-script/scripts/build-draft-html.mjs
 *
 * Generates the self-contained draft HTML VIEW from a draft JSON artifact: the
 * JSON is embedded inline and every media thumbnail is inlined as a base64 data
 * URI, so the HTML is a single portable file (no assets folder) that works from
 * file://.
 *
 * Series-parameterized: the display series title comes from a `video.series.json`
 * config (or --series-title); the template ships neutral (`{{SERIES}}`).
 *
 * Usage:
 *   node build-draft-html.mjs <slug>_draft_V_x-y-z.json [--out <file.html>]
 *     [--series <dir> | --config <video.series.json>] [--series-title <name>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeriesConfig } from './build-script-from-draft.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(argv, name) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
}

export function buildDraftHtml(draft, { baseDir, templatePath, seriesTitle = 'Series' } = {}) {
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
  const tpl = fs.readFileSync(templatePath, 'utf8');
  return tpl
    .replace(/\{\{SERIES\}\}/g, seriesTitle)
    .replace('/*__DRAFT_JSON__*/', JSON.stringify(draft))
    .replace('/*__THUMBS_JSON__*/', JSON.stringify(thumbs));
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv[0] || argv[0] === '--help') {
    console.error('usage: node build-draft-html.mjs <draft.json> [--out <file.html>] [--series <dir> | --config <file>] [--series-title <name>]');
    process.exit(1);
  }
  const jsonPath = path.resolve(argv[0]);
  if (!fs.existsSync(jsonPath)) {
    console.error('draft JSON not found: ' + jsonPath);
    process.exit(1);
  }
  const draft = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const baseDir = path.dirname(jsonPath);
  const out = argValue(argv, 'out');
  const outPath = out ? path.resolve(out) : jsonPath.replace(/\.json$/i, '.html');
  const cfg = loadSeriesConfig(argv);
  const seriesTitle = argValue(argv, 'series-title') || cfg.seriesTitle || cfg.series || 'Series';

  const html = buildDraftHtml(draft, {
    baseDir,
    templatePath: path.join(__dirname, 'draft-template.html'),
    seriesTitle,
  });
  fs.writeFileSync(outPath, html, 'utf8');
  const embedded = (html.match(/data:[^"]+;base64,/g) || []).length;
  console.log('Draft HTML written: ' + outPath + ' (' + (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB, ' + embedded + ' thumbnails embedded)');
}

const isMain =
  process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) main();
