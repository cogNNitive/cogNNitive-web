/**
 * nn-conntent/scripts/lib/canonical.mjs
 *
 * The single canonical-JSON + sha256 primitive shared by the review subjects and the
 * plan slices (capability conntent-review-gates / conntent-run-facts). Keys sorted,
 * `undefined` dropped, UTF-8, no insignificant whitespace.
 *
 * Zero external dependencies. ESM module.
 */

import crypto from 'node:crypto';

function sortValue(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(sortValue);
  if (typeof value !== 'object') return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue;
    out[key] = sortValue(value[key]);
  }
  return out;
}

/** Canonical JSON: stable key order, no whitespace, `undefined` dropped. */
export function canonicalJson(value) {
  return JSON.stringify(sortValue(value));
}

/** Lowercase hex sha256 of the UTF-8 bytes of `text`. */
export function sha256Hex(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}
