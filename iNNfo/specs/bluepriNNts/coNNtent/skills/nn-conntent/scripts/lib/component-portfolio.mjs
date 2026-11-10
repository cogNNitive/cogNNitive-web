/**
 * nn-conntent/scripts/lib/component-portfolio.mjs
 *
 * The component portfolio: a component is a folder `library/components/<name>/`
 * holding `COMPONENT.md` (frontmatter + prose), `index.html` (the mountable HTML)
 * and `preview.mp4` (a short rendered preview). The frontmatter declares `name`,
 * `slot`, `variables`, `duration`, `aspect`, `source` and `tokens`
 * (capability conntent-component-portfolio). A `source` of `registry:<item>@<ver>`
 * must also declare `license` (SPDX) and ship a `LICENSE` file; `local` components
 * are authored in-repo. A missing `preview.mp4` in a package item fails; outside the
 * package it only warns.
 *
 * Zero external dependencies (nn-core via the shared mirror). ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseKnowledge } = require('./nn-core.generated.cjs');

/** The folder kind name (`conntent-library` six-kind set includes `components`). */
export const COMPONENT_DIR = 'components';
export const COMPONENT_FILENAME = 'COMPONENT.md';

const KNOWN_KEYS = new Set(['name', 'slot', 'variables', 'duration', 'aspect', 'source', 'tokens', 'license']);
const SLOT_NAMES = ['title', 'lower-third', 'caption', 'quote', 'watermark', 'b-roll'];
const VARIABLE_TYPES = new Set(['string', 'number', 'color', 'file']);
const ASPECTS = new Set(['16:9', '9:16', '1:1', 'any']);

/** Whether a component source is vendored (not `local`). */
export function isVendored(source) {
  return typeof source === 'string' && /^registry:[\w@./-]+@[\w.+-]+$/i.test(source.trim());
}

/** A pinned version: exact, no ranges, no `latest`. */
const PINNED = /^registry:[\w@./-]+@(?!latest$)[\d]+(?:\.[\d]+){1,2}(?:[-+][\w.-]+)?$/i;

function asList(v) {
  return Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? [v] : [];
}

/**
 * Reads and validates one component folder against the COMPONENT.md schema.
 * @param {string} dir `.../library/components/<name>`
 * @param {{ packageItem?: boolean, warn?: (message: string) => void }} [opts]
 * @returns {{ name: string, slot: string, variables: Array<{ name: string, type: string, default: unknown, required: boolean }>,
 *   duration: number|'scene', aspect: string[], source: string, tokens: string[], license: string|null }}
 */
export function validateComponent(dir, opts = {}) {
  const { packageItem = true, warn = () => {} } = opts;
  const file = path.join(dir, COMPONENT_FILENAME);
  if (!fs.existsSync(file)) throw componentError(dir, `${COMPONENT_FILENAME} is missing`);
  const parsed = parseKnowledge(fs.readFileSync(file, 'utf8'));
  const front = parsed.frontmatter || {};

  for (const key of Object.keys(front)) {
    if (!KNOWN_KEYS.has(key)) throw componentError(dir, `unknown key "${key}"`);
  }

  const name = front.name === undefined ? '' : String(front.name);
  if (name !== path.basename(dir)) throw componentError(dir, `name "${name}" != folder "${path.basename(dir)}"`);
  if (!fs.existsSync(path.join(dir, 'index.html'))) throw componentError(dir, 'index.html is missing');

  const slot = front.slot === undefined ? '' : String(front.slot);
  if (!SLOT_NAMES.includes(slot)) {
    throw componentError(dir, `slot "${slot}" is unknown; accepted: ${SLOT_NAMES.join(', ')}`);
  }

  const variables = asList(front.variables).map((v, i) => {
    if (typeof v !== 'object' || v === null) throw componentError(dir, `variables[${i}] must be an object`);
    const vname = v.name === undefined ? '' : String(v.name);
    if (!/^[a-z][a-z0-9_]*$/.test(vname)) throw componentError(dir, `variables[${i}].name "${vname}" must be snake_case`);
    const type = String(v.type || '');
    if (!VARIABLE_TYPES.has(type)) throw componentError(dir, `variables[${i}].type "${type}" invalid`);
    const required = v.required === true || v.required === 'true';
    if (required && v.default !== undefined && v.default !== null) {
      throw componentError(dir, `variables.${vname}: a required variable must not define a default`);
    }
    return { name: vname, type, default: v.default ?? null, required };
  });
  const seen = new Set();
  for (const v of variables) {
    if (seen.has(v.name)) throw componentError(dir, `variables.${v.name} is duplicated`);
    seen.add(v.name);
  }

  const duration = front.duration;
  const durOk = duration === 'scene' || (typeof duration === 'number' && Number.isFinite(duration) && duration > 0);
  if (!durOk) throw componentError(dir, `duration "${String(duration)}" must be > 0 or "scene"`);

  const aspect = asList(front.aspect).map(String);
  if (aspect.length === 0 || aspect.some((a) => !ASPECTS.has(a))) {
    throw componentError(dir, `aspect must be non-empty and one of: ${[...ASPECTS].join(', ')}`);
  }

  const source = front.source === undefined ? '' : String(front.source);
  const vendored = isVendored(source);
  if (source !== 'local' && !vendored) {
    throw componentError(dir, `source "${source}" must be "local" or a pinned "registry:<item>@<version>" (no ranges, no latest)`);
  }
  if (vendored) {
    if (!PINNED.test(source)) throw componentError(dir, `source "${source}" must pin an exact version (no ranges, no latest)`);
    if (front.license === undefined || front.license === null || String(front.license).trim() === '') {
      throw componentError(dir, 'a registry component must declare "license" (SPDX)');
    }
    if (!fs.existsSync(path.join(dir, 'LICENSE'))) throw componentError(dir, 'a registry component must ship a LICENSE file');
  }

  const preview = path.join(dir, 'preview.mp4');
  if (!fs.existsSync(preview)) {
    if (packageItem) throw componentError(dir, 'a package component must ship preview.mp4');
    warn(`component-missing-preview: ${name} has no preview.mp4`);
  }

  return {
    name,
    slot,
    variables,
    duration: duration === 'scene' ? 'scene' : Number(duration),
    aspect,
    source,
    tokens: asList(front.tokens).map(String),
    license: front.license === undefined || front.license === null ? null : String(front.license),
  };
}

function componentError(dir, reason) {
  const err = new Error(`component-invalid: ${path.basename(dir)} — ${reason}`);
  err.code = 'component-invalid';
  return err;
}

/**
 * The packaged components of the blueprint package `library/components/`.
 * @param {string|null} [bpsRoot] The blueprint package root (defaults to the coNNtent package).
 * @returns {Array<{ name: string, dir: string, slot: string, source: string }>}
 */
export function packagedComponents(bpsRoot = null) {
  const root = bpsRoot || path.resolve(here(), '..', '..', '..', '..');
  const dir = path.join(root, 'library', COMPONENT_DIR);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    const c = validateComponent(full);
    out.push({ name: c.name, dir: full, slot: c.slot, source: c.source });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function here() {
  return path.dirname(fileURLToPath(import.meta.url));
}