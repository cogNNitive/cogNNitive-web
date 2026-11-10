/**
 * nn-conntent/scripts/lib/layout.mjs
 *
 * The one folder contract for a coNNtent domaiNN. `assertLayout(root)` walks the
 * tree and returns one `legacy-layout` finding per detected legacy path (an episode
 * under `series/<s>/assets/<slug>/`, root or series `sounds/`, `components/`,
 * `frames/`, `series/<s>/assets/`, `video-guard.json`), each naming the new location.
 * A clean tree returns `[]`.
 *
 * Premise: no backwards compatibility. These layouts are rejected, never adapted;
 * no alias, reader or migration script exists. Wired into the console export in Slice 1a;
 * `produce`, `check_domain` and the entry point adopt it in the slices that rewrite them.
 *
 * (capability conntent-folder-contract "Legacy Layouts Are Rejected, Not Adapted";
 * conntent-library "Legacy Root Folders Are Rejected").
 */

import fs from 'node:fs';
import path from 'node:path';

/** The finding code for a rejected legacy layout. */
export const LAYOUT_LEGACY = 'legacy-layout';

const EPISODE_DOC_RE = /_coNNtent_NN\.md$/;

/** Heavy or generated directories that are never part of a domaiNN's authored layout. */
const SKIP_DIRS = new Set(['node_modules', '.git', '.cogNNitive', 'artifacts', 'dist', 'docs']);

/**
 * Legacy kind folders that used to live at a root or series root and now live under
 * `library/<name>/`. Detectable even when empty so a partially-migrated tree is
 * rejected up front.
 */
const LEGACY_KIND_FOLDERS = new Set(['sounds', 'components', 'frames']);

/** Walks `dir` recursively and returns every directory path (relative) below one base. */
function listDescendantDirs(root, dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const next = path.join(dir, e.name);
    out.push(path.relative(root, next).split(path.sep).join('/'));
    out.push(...listDescendantDirs(root, next));
  }
  return out;
}

/**
 * Detects every legacy path under `root` and returns one finding per path.
 * @param {string} root the domaiNN root
 * @returns {Array<{code: string, path: string, message: string}>}
 */
export function assertLayout(root) {
  const findings = [];

  // Legacy episode folders under series/<s>/assets/<slug>/ that hold an episode
  // document, and any other content under series/<s>/assets/.
  const dirs = listDescendantDirs(root, root);
  const seriesAssets = new Map(); // rel -> { abs, hasEP, episodeSlugs:Set, other:boolean }
  for (const rel of dirs) {
    const m = rel.match(/^series\/[^/]+\/assets(?:\/|$)/);
    if (!m) continue;
    const series = rel.split('/')[1];
    const isLeaf = rel === `series/${series}/assets`;
    if (isLeaf) {
      // The `assets/` folder itself: report it as legacy "series media" if it holds any
      // entry that is not a legacy episode subfolder (e.g. a loose file) — the episode
      // subfolders are each reported separately below.
      let loose = false;
      try {
        for (const child of fs.readdirSync(path.join(root, rel))) {
          const childAbs = path.join(root, rel, child);
          let isDir = false;
          try {
            isDir = fs.statSync(childAbs).isDirectory();
          } catch {
            isDir = false;
          }
          if (!isDir) {
            loose = true;
            break;
          }
        }
      } catch {
        loose = true;
      }
      seriesAssets.set(rel, { abs: path.join(root, rel), hasEP: false, episodeSlugs: new Set(), other: loose });
      continue;
    }
    const tail = rel.slice(`series/${series}/assets/`.length);
    if (tail.includes('/')) continue; // deeper than <slug>/ is swept with its parent below
    const entry = seriesAssets.get(`series/${series}/assets`) || seriesAssets.set(`series/${series}/assets`, { abs: null, hasEP: false, episodeSlugs: new Set(), other: false }).get(`series/${series}/assets`);
    const abs = path.join(root, rel);
    try {
      const hasDoc = fs.readdirSync(abs).some((name) => EPISODE_DOC_RE.test(name));
      if (hasDoc) entry.episodeSlugs.add(tail);
      else entry.other = true;
    } catch {
      entry.other = true;
    }
  }
  for (const [rel, rec] of seriesAssets) {
    const series = rel.split('/')[1];
    for (const slug of rec.episodeSlugs) {
      findings.push({
        code: LAYOUT_LEGACY,
        path: `series/${series}/assets/${slug}`,
        message: `episodes now live in \`series/${series}/episodes/${slug}/\`; recreate this domaiNN`,
      });
    }
    // The parent itself is reported as "series media" only when it holds content that
    // is not a legacy episode folder.
    if (rec.other) {
      findings.push({
        code: LAYOUT_LEGACY,
        path: rel,
        message: `series media now lives in \`series/${series}/library/<kind>/\`; recreate this domaiNN`,
      });
    }
  }

  // Legacy kind folders at the domaiNN root, at a series root, or inside an episode.
  // `library/` and `media/` are the supported homes for those names, so a path under
  // either is never a legacy finding. Only those three locations are matched, never an
  // arbitrary depth or a series slug that happens to equal a kind name.
  for (const rel of dirs) {
    const seg = rel.split('/');
    if (seg.some((s) => s === 'library' || s === 'media')) continue;
    const inKindRoot =
      seg.length === 1 || // domaiNN root: `sounds/`
      (seg.length === 3 && seg[0] === 'series' && seg[2] !== 'episodes') || // series root: `series/<s>/sounds/`
      (seg.length === 4 && seg[0] === 'series' && seg[2] === 'episodes'); // episode: `series/<s>/episodes/<slug>/sounds/`
    if (!inKindRoot) continue;
    const base = seg[seg.length - 1];
    if (!LEGACY_KIND_FOLDERS.has(base)) continue;
    findings.push({
      code: LAYOUT_LEGACY,
      path: rel,
      message: `\`${base}/\` is no longer supported; reusable files now live in \`library/${base}/\` (episode-only files in \`media/${base}/\`); recreate this domaiNN`,
    });
  }

  // Retired spend-guard file at the root.
  if (fs.existsSync(path.join(root, 'video-guard.json'))) {
    findings.push({
      code: LAYOUT_LEGACY,
      path: 'video-guard.json',
      message: '`video-guard.json` is retired; allow models through `model-catalog_NN.md`',
    });
  }

  // Retired single-ledger path: the ledger now lives under `.cognnitive/video/`.
  if (fs.existsSync(path.join(root, '.cognnitive', 'video-ledger.jsonl'))) {
    findings.push({
      code: LAYOUT_LEGACY,
      path: path.join('.cognnitive', 'video-ledger.jsonl').split(path.sep).join('/'),
      message: 'the ledger now lives in `.cognnitive/video/ledger.jsonl`',
    });
  }

  return findings;
}