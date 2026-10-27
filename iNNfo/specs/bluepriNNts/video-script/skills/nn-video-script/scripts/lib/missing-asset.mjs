/**
 * nn-video-script/scripts/lib/missing-asset.mjs
 *
 * The shared missing-named-file rule (design D21). A cascade value carries the
 * level that supplied it; when the nearest-folder walk finds no file for a name,
 * the severity follows who asked for it:
 *
 *   - a user level (cli, layer, scene, video, series, domain) is a promise:
 *     `MissingAssetError` naming the name, the level and every path searched,
 *     raised before any synthesis or render so nothing is spent;
 *   - the blueprint Video Defaults is a hint: a name that ships no file is
 *     skipped with one warning, so a fresh install still renders;
 *   - no resolved name (source null) is silent.
 *
 * Pure module: no provider import, no filesystem access. Components, sounds and
 * frames all reuse it (S6/S7).
 */

/** Raised when a user-level name resolves to no file at any cascade level. */
export class MissingAssetError extends Error {
  /**
   * @param {{ kind: string, name: string, source: string, searched: string[] }} entry
   */
  constructor({ kind, name, source, searched = [] }) {
    const paths = searched.length > 0 ? `; searched:\n${searched.map((p) => `  - ${p}`).join('\n')}` : '';
    super(`${kind} "${name}" (set by ${source}) not found${paths}`);
    this.name = 'MissingAssetError';
    this.kind = kind;
    this.assetName = name;
    this.source = source;
    this.searched = searched;
  }
}

/** Names already warned about this process (one warning per kind+name). */
const warnedOnce = new Set();

/** Test seam: forget which names have been warned about. */
export function resetMissingAssetWarnings() {
  warnedOnce.clear();
}

/**
 * Applies the D21 rule to one unresolved name.
 * @param {{ kind: string, name: string | null, source: string | null, searched?: string[] }} entry
 * @param {{ warn?: (message: string) => void }} [options]
 * @returns {{ skipped: boolean, warning: boolean }}
 */
export function checkMissingAsset(entry, options = {}) {
  const { kind, name, source, searched = [] } = entry;
  if (!source) return { skipped: false, warning: false };
  if (source !== 'blueprint') throw new MissingAssetError({ kind, name, source, searched });

  const key = `${kind}:${name}`;
  if (warnedOnce.has(key)) return { skipped: true, warning: false };
  warnedOnce.add(key);
  const warn = options.warn || console.warn;
  const paths = searched.length > 0 ? `; searched:\n${searched.map((p) => `  - ${p}`).join('\n')}` : '';
  warn(`⚠️ [video-engine] ${kind} "${name}" (blueprint default) not found${paths}`);
  return { skipped: true, warning: true };
}
