/**
 * nn-video-script/scripts/lib/nearest.mjs
 *
 * The one folder walker shared by every name→file resolution (components,
 * sounds, frames) and by the series-document locator (design D2/D3).
 *
 * A name is resolved by walking from the script directory upward, most specific
 * first, up to and including `stopDir` (the workspace root), then the skill
 * `fallbackDir`. A miss returns the exact paths tried so the caller can raise a
 * loud, actionable error (design D21). Pure filesystem module, no provider
 * import.
 */

import fs from 'node:fs';
import path from 'node:path';

/** The three markers that make a folder a series root. */
export const SERIES_MARKERS = ['series_NN.md', 'series_rules.md', 'script_template.md'];

/**
 * Walks from `startDir` up to `stopDir` (inclusive) then `fallbackDir`, returning
 * the first existing file at `relPath` (posix or native separators).
 * @param {string} startDir
 * @param {string} relPath
 * @param {{ stopDir?: string, fallbackDir?: string }} [opts]
 * @returns {{ path: string | null, searched: string[] }}
 */
export function findNearest(startDir, relPath, opts = {}) {
  const { stopDir, fallbackDir } = opts;
  const rel = relPath.split(/[\\/]/).filter(Boolean).join(path.sep);
  const searched = [];
  const stop = stopDir ? path.resolve(stopDir) : null;
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, rel);
    searched.push(candidate);
    if (fs.existsSync(candidate)) return { path: candidate, searched };
    if (stop && dir === stop) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (fallbackDir) {
    const candidate = path.join(path.resolve(fallbackDir), rel);
    searched.push(candidate);
    if (fs.existsSync(candidate)) return { path: candidate, searched };
  }
  return { path: null, searched };
}

/**
 * Like `findNearest`, but matches `<dir>/<dirName>/<stem>.<any extension>` in the
 * nearest folder that holds such a file (sounds ship as `.mp3`, `.wav`, ...).
 * @param {string} startDir
 * @param {string} dirName
 * @param {string} stem
 * @param {{ stopDir?: string, fallbackDir?: string }} [opts]
 * @returns {{ path: string | null, searched: string[] }}
 */
export function findNearestByStem(startDir, dirName, stem, opts = {}) {
  const { stopDir, fallbackDir } = opts;
  const searched = [];
  const dirs = [];
  const stop = stopDir ? path.resolve(stopDir) : null;
  let dir = path.resolve(startDir);
  for (;;) {
    dirs.push(dir);
    if (stop && dir === stop) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  if (fallbackDir) dirs.push(path.resolve(fallbackDir));

  for (const base of dirs) {
    const folder = path.join(base, dirName);
    const probe = path.join(folder, `${stem}.*`);
    searched.push(probe);
    let entries;
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch {
      continue;
    }
    const match = entries
      .filter((e) => e.isFile() && path.parse(e.name).name === stem)
      .map((e) => e.name)
      .sort()[0];
    if (match) return { path: path.join(folder, match), searched };
  }
  return { path: null, searched };
}

/**
 * The series folder that owns a script: the nearest ancestor (inclusive) holding
 * a series marker, **strictly below** `domainRoot`. A script directly under the
 * domain root, or a marker AT the domain root, never yields a series level.
 * @param {string} startDir
 * @param {string} [domainRoot]
 * @returns {string | undefined}
 */
export function findSeriesRoot(startDir, domainRoot) {
  const stop = domainRoot ? path.resolve(domainRoot) : null;
  let dir = path.resolve(startDir);
  for (;;) {
    if (stop && dir === stop) return undefined;
    if (SERIES_MARKERS.some((m) => fs.existsSync(path.join(dir, m)))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
