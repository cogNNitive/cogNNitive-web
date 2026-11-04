/**
 * nn-conntent/scripts/lib/stage-assets.mjs
 *
 * How the engine makes a provider cache asset available to the HyperFrames project: a
 * hardlink to the cache entry, never a copy (capability cognnitive-video-engine "Assets Are
 * Linked, Not Copied"). A link keeps one file on disk, so the episode folder holds no
 * hash-named duplicate of a cache entry and the cache stays read-only.
 *
 * When the filesystem refuses a link (`EXDEV` across volumes, `EPERM` without the privilege,
 * `ENOTSUP` on the filesystem) the engine falls back to a file copy with clone-on-write where
 * supported, records `link_mode: copy` and warns ONCE per process.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Link failures the engine may answer with a copy. Any other error is a real failure. */
export const LINK_FALLBACK_CODES = new Set(['EXDEV', 'EPERM', 'ENOTSUP']);

/** Warned once per process: one line per run, not one per asset. */
let copyModeWarned = false;

/** Test seam: forget that the copy-mode warning was already printed. */
export function resetCopyModeWarning() {
  copyModeWarned = false;
}

export class StagedAssetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'StagedAssetError';
    this.code = code;
  }
}

/** True when both paths are the same file on disk (same device and inode/file index). */
export function sameFile(a, b) {
  try {
    const sa = fs.statSync(a);
    const sb = fs.statSync(b);
    return sa.dev === sb.dev && sa.ino === sb.ino && sa.ino !== 0;
  } catch {
    return false;
  }
}

/**
 * The bundle-relative name of a staged asset: `<basename>_<sha256-prefix><ext>`. The hash
 * keeps two sources that share a basename from colliding, and makes the name change when the
 * bytes change (so a stale link is never served).
 * @param {string} abs
 * @returns {string}
 */
export function assetName(abs) {
  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs) || '';
  const base = path.basename(abs, ext).replace(/[^a-zA-Z0-9._-]+/g, '_') || 'asset';
  const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);
  return `${base}_${hash}${ext}`;
}

/**
 * Makes `dest` the same file as `src`, or a copy when a link is refused.
 *
 * @param {string} src
 * @param {string} dest
 * @param {{ link?: (src: string, dest: string) => void, copy?: (src: string, dest: string) => void, warn?: (message: string) => void }} [deps]
 *   Seams for tests: `link` throws a coded error, `copy` records the fallback.
 * @returns {{ mode: 'link' | 'copy', staged: boolean }} `staged` is false when the destination
 *   already held the same file, so no repeated work is reported.
 */
export function linkOrCopy(src, dest, deps = {}) {
  const link = deps.link || ((a, b) => fs.linkSync(a, b));
  const copy =
    deps.copy ||
    ((a, b) => fs.copyFileSync(a, b, fs.constants.COPYFILE_FICLONE));
  const warn = deps.warn || ((message) => console.warn(message));

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    if (sameFile(src, dest)) return { mode: 'link', staged: false };
    // A previous run left a copy (or a stale link): replace it with a link.
    fs.rmSync(dest, { force: true });
  }

  try {
    link(src, dest);
    return { mode: 'link', staged: true };
  } catch (err) {
    if (!LINK_FALLBACK_CODES.has(err?.code)) throw err;
    copy(src, dest);
    if (!copyModeWarned) {
      copyModeWarned = true;
      warn(
        `[stage-assets] hardlink refused (${err.code}); copying assets instead. ` +
          `link_mode: copy — the staged assets are deleted after a successful render.`,
      );
    }
    return { mode: 'copy', staged: true };
  }
}

/**
 * Resolves the pinned GSAP build the emitted project must load from `vendor/` (capability
 * cognnitive-video-engine "Render Is Hermetic": no network at render time).
 * @param {{ resolve?: () => string }} [deps]
 * @returns {string | null}
 */
export function resolveGsapPath(deps = {}) {
  const resolve = deps.resolve || (() => require.resolve('gsap/dist/gsap.min.js'));
  try {
    const found = resolve();
    return found && fs.existsSync(found) ? found : null;
  } catch {
    return null;
  }
}

/** The pinned GSAP build, or a loud named failure: the project would load nothing at render. */
export function assertGsapPresent(deps = {}) {
  const found = resolveGsapPath(deps);
  if (!found) {
    throw new StagedAssetError(
      'gsap-missing',
      'gsap is not installed: the emitted project references vendor/gsap.min.js and this render is hermetic ' +
        '(no network). Install the pinned dependency and re-run `node scripts/ensure-hyperframes.mjs --check`.',
    );
  }
  return found;
}
