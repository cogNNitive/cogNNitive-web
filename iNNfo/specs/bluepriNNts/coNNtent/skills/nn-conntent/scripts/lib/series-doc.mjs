/**
 * nn-conntent/scripts/lib/series-doc.mjs
 *
 * Reads a Series' `<series>_coNNtent_NN.md` Series instance model, which doubles as the
 * scope document. The series scope document
 * is the only series-side input the engine needs outside the cascade: its title and
 * its identity. It outlived the draft pipeline (Slice 7b) because `render-thumbnail`
 * stamps the series title onto a thumbnail and the series root is what makes an
 * episode discoverable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { findSeriesRoot } from './video-scope.mjs';
import { parseKnowledgeDocument, slugify } from './knowledge-model.mjs';

/**
 * The raw frontmatter block (between the `---` fences) of an iNNfo document.
 * @param {string} content
 * @returns {string}
 */
export function extractFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(content ?? ''));
  return match ? match[1] : '';
}

/**
 * Top-level frontmatter keys that belong to a scope marker and must never be
 * copied into an episode script: they would turn the episode into a scope with
 * fills of its own.
 */
const MARKER_ONLY_KEYS = new Set(['scope', 'isolate', 'fills']);

/**
 * Drops a top-level key and its indented continuation lines from a frontmatter block.
 * @param {string} frontmatter
 * @param {Set<string>} [keys]
 * @returns {string}
 */
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
 * The series document of a folder: its unique `<series>_coNNtent_NN.md` Series instance
 * model, which doubles as the scope document. Returns null when there is none or the name
 * is ambiguous. The legacy `<series>_scope_NN.md` and `series_NN.md` are not series
 * documents any more.
 * @param {string} seriesDir
 * @returns {{ file: string, marker: boolean } | null}
 */
export function seriesDocumentFile(seriesDir) {
  const dir = path.resolve(seriesDir);
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }
  const markers = entries.filter((f) => f.endsWith('_coNNtent_NN.md')).sort();
  return markers.length === 1 ? { file: path.join(dir, markers[0]), marker: true } : null;
}

/**
 * Reads the Series document from a series folder (its `<series>_coNNtent_NN.md` Series
 * instance model). Scope-only keys are dropped, and its slug comes from the
 * filename stem because a scope document declares no `slug::` field.
 * @param {string} seriesDir
 * @returns {{ frontmatter: string, slug: string, title: string, fields: Record<string, string> }}
 */
export function loadSeriesDocument(seriesDir) {
  const found = seriesDocumentFile(seriesDir);
  if (!found) {
    throw new Error(
      `no series document in ${path.resolve(seriesDir)}: expected a <series>_coNNtent_NN.md Series instance model`,
    );
  }
  const content = fs.readFileSync(found.file, 'utf8');
  const model = parseKnowledgeDocument(content);
  const el = (model.elements.Series || [])[0] || {};
  const fields = el.fields || {};
  const title = fields.title || model.frontmatter.title || el.name || '';
  const fromStem = path.basename(found.file).replace(/_coNNtent_NN\.md$/, '');
  return {
    frontmatter: found.marker
      ? dropFrontmatterKeys(extractFrontmatter(content))
      : extractFrontmatter(content),
    // A marker is named after its series (unique-stem convention); its element
    // slug is derived from the heading and is not authoritative.
    slug: found.marker ? fromStem : el.slug || slugify(title),
    title,
    fields,
  };
}

/**
 * Locates the series document for an input folder: an explicit `--series <dir>` wins,
 * otherwise the series root the scope chain resolves (see `findSeriesRoot`).
 * @param {string} inputDir
 * @param {string} [seriesDirFlag]
 * @returns {({ frontmatter: string, slug: string, title: string, fields: Record<string, string>, dir: string }) | null}
 */
export function loadSeriesFor(inputDir, seriesDirFlag) {
  const dir = seriesDirFlag ? path.resolve(seriesDirFlag) : findSeriesRoot(inputDir);
  if (!dir || !seriesDocumentFile(dir)) return null;
  return { dir, ...loadSeriesDocument(dir) };
}
