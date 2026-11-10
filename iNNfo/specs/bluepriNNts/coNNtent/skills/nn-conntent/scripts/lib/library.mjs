/**
 * nn-conntent/scripts/lib/library.mjs
 *
 * The one logical-name lookup for reusable media (design D-S3; capability conntent-library).
 *
 * `resolveLibrary({ kind, ref, fromDir })` resolves `ref` of the form `[series:|domain:]`
 * `<kind>/<path>` by upward lookup, starting at the consuming episode and going out:
 * episode `media/`, series `library/`, domaiNN `library/`, then the blueprint package
 * floor (frames/components only). The first match wins. `..`, absolute paths and `\` are
 * rejected (`LIBRARY_PATH_INVALID`). A user-level miss is a `MissingAssetError` naming the
 * folders searched; a package floor miss is one warning.
 */

import fs from 'node:fs';
import path from 'node:path';
import { MissingAssetError } from './missing-asset.mjs';

/** Error code for a path that climbs (`..`), is absolute, or uses a backslash. */
export const LIBRARY_PATH_INVALID = 'LIBRARY_PATH_INVALID';

/** The six reusable kind folders (conntent-library "Six kinds"). */
export const LIBRARY_KINDS = new Set(['music', 'sounds', 'frames', 'components', 'characters', 'media']);

/** The resolution levels, in lookup order (outward). */
const LEVELS = ['episode', 'series', 'domain', 'package'];

/** True when `ref` is a direct item (no `/`) — resolves inside the episode media only. */
function isDirectName(ref) {
  return !ref.includes('/');
}

/** Normalizes the ref path and rejects escapes; returns { kindRel, forced } or throws. */
function parseRef(kind, ref) {
  let forced = null;
  if (ref.startsWith('series:')) {
    forced = 'series';
    ref = ref.slice('series:'.length);
  } else if (ref.startsWith('domain:')) {
    forced = 'domain';
    ref = ref.slice('domain:'.length);
  } else if (/^(episode:|package:|[a-z]+:)/i.test(ref)) {
    const kind = new Error(`invalid reference prefix in "${ref}"`);
    kind.code = LIBRARY_PATH_INVALID;
    throw kind;
  }
  if (ref.split('\\').length > 1 || ref.startsWith('/') || ref.startsWith('\\') || /^[a-zA-Z]:/.test(ref)) {
    const e = new Error(`library reference "${ref}" must be a relative logical name, not a path`);
    e.code = LIBRARY_PATH_INVALID;
    throw e;
  }
  const segs = ref.split('/').filter(Boolean);
  if (segs.some((s) => s === '..')) {
    const e = new Error(`library reference "${ref}" must not climb above the folder`);
    e.code = LIBRARY_PATH_INVALID;
    throw e;
  }
  // The first segment names the kind folder; the remainder is the path inside it.
  // A direct name (no `/`) carries no kind segment; resolution stays inside its own
  // `media/<kind>/` folder below.
  let rest;
  if (isDirectName(ref)) {
    rest = segs[0] || '';
  } else {
    if (segs[0] !== kind) {
      const e = new Error(`library reference "${ref}" must start with the "${kind}" kind folder`);
      e.code = LIBRARY_PATH_INVALID;
      throw e;
    }
    rest = segs.slice(1).join('/');
  }
  return { kindRel: rest, forced };
}

/** The `library/<kind>/` folder at a scope, or the episode `media/<kind>/` for episodes. */
function scopeDir(level, root, fromDir) {
  if (level === 'episode') return path.join(fromDir, 'media');
  if (level === 'series') {
    const seriesDir = path.dirname(path.dirname(fromDir)); // series/<s>
    return path.join(seriesDir, 'library');
  }
  if (level === 'domain') return path.join(root, 'library');
  return null; // package handled separately
}

/** Folder kinds: an "item" is a folder (`frames/<name>/`, `characters/<name>/`,
 * `components/<name>/`). File kinds match a file (any extension of the kind). */
const FOLDER_KINDS = new Set(['frames', 'characters', 'components']);

/** Matches a file or folder by exact name or stem. Folder kinds (`frames`, `components`,
 * `characters`) match a subfolder; file kinds match a file (any extension of the kind). */
function matchFile(dir, kind, label) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  const wantDir = FOLDER_KINDS.has(kind);
  const target = path.basename(label);
  const nameNoExt = path.parse(target).name;
  for (const e of entries) {
    if (wantDir ? !e.isDirectory() : !e.isFile()) continue;
    if (e.name === target) return path.join(dir, e.name);
    if (path.parse(e.name).name === nameNoExt) return path.join(dir, e.name);
  }
  return null;
}

/**
 * Resolves a logical name by upward lookup.
 * @returns {{ file: string|null, level: string, searched: string[] }}
 */
export function resolveLibrary({ kind, ref, fromDir, root, warn, packageFloor, throwOnMiss = true }) {
  if (!LIBRARY_KINDS.has(kind)) throw new Error(`unknown library kind "${kind}"`);
  const { kindRel, forced } = parseRef(kind, ref);
  if (isDirectName(ref)) {
    // A bare file name resolves inside the episode media only.
    const dir = path.join(fromDir, 'media', kind);
    const file = matchFile(dir, kind, kindRel);
    return { file, level: file ? 'episode' : null, searched: [path.join(dir, kindRel)] };
  }
  const rootDir = root || inferRoot(fromDir);
  const searched = [];
  // Package floor is frames/components only.
  const allowFloor = kind === 'frames' || kind === 'components';
  const dirs = [];
  for (const level of LEVELS) {
    if (forced && forced !== level) continue;
    if (level === 'package') break; // package handled after the upward walk
    const base = scopeDir(level, rootDir, fromDir);
    if (!base) continue;
    if (level === 'series' && path.basename(path.dirname(fromDir)) !== 'episodes') {
      // No series level when the episode is not under `series/<s>/episodes/`.
      continue;
    }
    dirs.push([level, path.join(base, kind)]);
  }
  if (allowFloor && packageFloor) dirs.push(['package', packageFloor]);

  for (const [level, dir] of dirs) {
    const file = matchFile(dir, kind, kindRel);
    searched.push(path.join(dir, kindRel));
    if (file) return { file, level, searched };
  }

  // A miss keyed only at the package floor is a warning, not an error.
  if (allowFloor && packageFloor && dirs.length > 0 && dirs[dirs.length - 1][0] === 'package') {
    const warnFn = warn || (() => {});
    warnFn(`⚠️ [video-engine] ${kind} "${ref}" not found at the package floor`);
    return { file: null, level: 'package', searched };
  }

  if (!throwOnMiss) return { file: null, level: null, searched };

  const source = forced || 'video';
  throw new MissingAssetError({ kind, name: ref, source, searched });
}

/** Derives the domaiNN root from an episode directory by walking to `doc/NN.md`. */
function inferRoot(fromDir) {
  let dir = path.resolve(fromDir);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'domaiNN_NN.md'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return dir;
    dir = parent;
  }
}

/**
 * Reduces a resolution into the plan/console record `{ field, name, level, path }`.
 * `path` is relative to the domaiNN root when `root` is given, else the absolute path.
 * (capability conntent-library "The Plan And The Console Report The Resolved File".)
 * @param {{ field: string, name: string, resolved: { file: string|null, level: string|null }, root?: string }} input
 */
export function libraryResolutionRecord({ field, name, resolved, root }) {
  const rec = { field, name, level: resolved.level ?? null };
  if (resolved.file && root) {
    const file = resolved.file.split(path.sep).join('/');
    const base = String(root).split(path.sep).join('/').replace(/\/+$/, '');
    rec.path = file.startsWith(base + '/') ? file.slice(base.length + 1) : file;
  } else {
    rec.path = resolved.file;
  }
  return rec;
}

/** Item/file-name pattern: lowercase, each segment `[a-z0-9]+([-_][a-z0-9]+)*` before the extension. */
const LIBRARY_ITEM_RE = /^[a-z0-9]+([-_][a-z0-9]+)*$/;

/**
 * Validates a `library/` folder at one scope (domaiNN or series root).
 * Rejects unknown kind folders (`unknown-library-kind`) and non-conforming item names
 * (`invalid-library-name`). (capability conntent-library "Six kinds".)
 * @returns {Array<{code: string, path: string, message: string}>}
 */
export function validateLibrary(libraryDir) {
  const findings = [];
  if (!fs.existsSync(libraryDir)) return findings;
  let entries;
  try {
    entries = fs.readdirSync(libraryDir, { withFileTypes: true });
  } catch {
    return findings;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!LIBRARY_KINDS.has(e.name)) {
        findings.push({
          code: 'unknown-library-kind',
          path: path.join(libraryDir, e.name),
          message: `library kind "${e.name}" is unknown; allowed kinds: ${[...LIBRARY_KINDS].join(', ')}`,
        });
      } else {
        findings.push(...validateLibraryKindFolder(path.join(libraryDir, e.name), e.name));
      }
    } else if (!LIBRARY_ITEM_RE.test(e.name.replace(/\.[^.]+$/, ''))) {
      findings.push({
        code: 'invalid-library-name',
        path: path.join(libraryDir, e.name),
        message: `"${e.name}" does not match the lowercase item-name pattern`,
      });
    }
  }
  return findings;
}

function validateLibraryKindFolder(dir, kind) {
  const findings = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return findings;
  }
  for (const e of entries) {
    if (e.isDirectory()) continue; // frames/<name>/ components/<name>/ characters/<name>/ are folders
    const base = e.name.replace(/\.[^.]+$/, '');
    if (!LIBRARY_ITEM_RE.test(base)) {
      findings.push({
        code: 'invalid-library-name',
        path: path.join(dir, e.name),
        message: `"${e.name}" does not match the lowercase item-name pattern`,
      });
    }
  }
  return findings;
}