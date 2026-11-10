#!/usr/bin/env node

/**
 * nn-conntent/scripts/build-field-registry.mjs
 *
 * Generates `lib/field-registry.generated.json` from the `coNNtent` blueprint: every Field
 * Definition with its Concepts, type, options, default-less metadata and cascade flag, plus
 * the `validation.conditional_fields` table. The engine, guards, presets and docs read this
 * registry instead of hand-copied lists (design A11, capability video-field-registry).
 *
 * The parser is nn-core's `parseKnowledge`, reached through the drift-guarded core mirror.
 *
 * Usage:
 *   node scripts/build-field-registry.mjs [--check] [--spec <path>] [--out <path>]
 *
 *   --check   render and compare to the committed file; exit 1 on drift.
 *   --spec    override the blueprint path (tests).
 *   --out     override the output path (tests).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SPEC = path.resolve(here, '..', '..', '..', 'spec_NN.md');
const DEFAULT_OUT = path.join(here, 'lib', 'field-registry.generated.json');

/** Concepts that make a Field a cascade parameter. `Layer` carries explicit fields. */
const CASCADE_CONCEPTS = ['Video Defaults', 'Series', 'Scene Kind', 'Preset', 'Video', 'Scene', 'Layer'];

/** Non-cascading fields that MAY sit on cascade concepts but are record-class (spec list). */
const RECORD_FIELDS = new Set([
  'tags', 'title', 'description', 'script', 'master', 'thumbnail', 'status', 'translation_of', 'kind',
  'review', 'role', 'narration', 'max_duration', 'fixed', 'chrome', 'asset', 'prompt', 'text', 'text_from',
  'position', 'type', 'placement', 'timing', 'style', 'source', 'enter_animation', 'exit_animation', 'z_index',
  'log', 'version', 'file', 'delivered_version',
]);

/**
 * The one scope-class table (capability conntent-field-registry "Every Field Declares
 * One Scope Class"). Non-cascading fields are `record`.
 */
export const SCOPE_CLASSES = {
  render: new Set(['Video Defaults', 'Series', 'Scene Kind', 'Preset', 'Video', 'Scene', 'Layer']),
  video: new Set(['Video Defaults', 'Series', 'Video']),
  domain: new Set(['Video Defaults']),
  record: new Set([]),
};

/** Levels per class, in cascade order (outer → inner) for resolution. */
export const SCOPE_LEVELS = {
  render: ['domain', 'series', 'kind', 'video', 'scene', 'layer'],
  video: ['domain', 'series', 'video'],
  domain: ['domain'],
  record: [],
};

/** Concept → cascade level name (the level the concept contributes at resolution). */
const CONCEPT_LEVELS = {
  'Video Defaults': 'domain',
  Series: 'series',
  'Scene Kind': 'kind',
  Preset: null, // a Preset is expanded per level, never a node of its own
  Video: 'video',
  Scene: 'scene',
  Layer: 'layer',
};

/** Reads `validation.conditional_fields` from the blueprint frontmatter (OR groups). */
export function parseConditionalFields(specText) {
  const out = {};
  let inBlock = false;
  for (const line of specText.split(/\r?\n/)) {
    if (/^\s*conditional_fields:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    const m = /^\s+([A-Za-z0-9_-]+):\s*\[([^\]]*)\]/.exec(line);
    if (!m) break;
    out[m[1]] = m[2].split(',').map((s) => s.trim()).filter(Boolean);
  }
  return out;
}

/** Normalizes a `concept::` value to a list. */
function conceptsOf(raw) {
  if (raw === undefined || raw === null) return [];
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
}

/**
 * Builds the registry from blueprint text.
 * @param {string} specText
 * @returns {{ blueprint: string, blueprint_version: string, generated_from: string, fields: Record<string, any>, conditional_fields: Record<string, string[]> }}
 */
export function buildRegistry(specText) {
  const { parseKnowledge } = require('./lib/nn-core.generated.cjs');
  const parsed = parseKnowledge(specText);
  const frontmatter = parsed.frontmatter || {};
  const fields = {};
  for (const element of parsed.elements.get('Field Definition') || []) {
    const raw = element.fields || {};
    const concepts = conceptsOf(raw.concept);
    const scope = raw.scope === undefined || raw.scope === null ? null : String(raw.scope).toLowerCase();
    const cascadeCandidates = concepts.some((c) => CASCADE_CONCEPTS.includes(c));

    // Validate scope class. A known record field (or explicit `scope:: record`) is never
    // cascade even when its Concepts touch cascade levels.
    if (scope === 'record' || RECORD_FIELDS.has(element.name)) {
      // non-cascading
    } else if (cascadeCandidates) {
      if (!scope || !(scope in SCOPE_CLASSES)) {
        throw new Error(`scope-missing: field "${element.name}" is a cascade parameter and must declare scope:: render|video|domain`);
      }
      const allowed = SCOPE_CLASSES[scope];
      for (const c of concepts) {
        if (CASCADE_CONCEPTS.includes(c) && !allowed.has(c)) {
          throw new Error(
            `scope-concept-mismatch: field "${element.name}" (class ${scope}) does not allow concept "${c}"; allowed: ${[...allowed].sort().join(', ')}`,
          );
        }
      }
    }

    const isCascade = !(scope === 'record' || RECORD_FIELDS.has(element.name)) && Boolean(scope in SCOPE_CLASSES) && cascadeCandidates;
    const cls = isCascade ? scope : 'record';
    // A field's levels come from the Concepts it lists (a render field without `Layer`
    // must not resolve at the `layer` level) — sparse within the class order.
    const conceptLevels = isCascade
      ? [...new Set(concepts.map((c) => CONCEPT_LEVELS[c]).filter((l) => l !== null))]
      : [];
    const levels = isCascade ? SCOPE_LEVELS[scope].filter((l) => conceptLevels.includes(l)) : [];
    fields[element.name] = {
      concepts,
      scope: cls,
      levels: levels.slice(),
      type: raw.type === undefined ? null : String(raw.type),
      options: Array.isArray(raw.options) ? raw.options.map(String) : raw.options ? [String(raw.options)] : [],
      multiple: raw.multiple === true || raw.multiple === 'true',
      cascade: isCascade,
      description: raw.description === undefined ? '' : String(raw.description),
    };
  }
  return {
    blueprint: String(frontmatter.blueprint_name || 'coNNtent'),
    blueprint_version: String(frontmatter.blueprint_version || ''),
    generated_from: 'spec_NN.md',
    fields,
    conditional_fields: parseConditionalFields(specText),
  };
}

/** Renders the committed artifact (stable key order, two-space indent, trailing newline). */
export function renderRegistry(registry) {
  const fields = {};
  for (const name of Object.keys(registry.fields).sort()) fields[name] = registry.fields[name];
  return `${JSON.stringify({ ...registry, fields }, null, 2)}\n`;
}

function main() {
  const args = process.argv.slice(2);
  const flag = (name) => {
    const i = args.indexOf(name);
    return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
  };
  const check = args.includes('--check');
  const specPath = path.resolve(flag('--spec') || DEFAULT_SPEC);
  const outPath = path.resolve(flag('--out') || DEFAULT_OUT);
  if (!fs.existsSync(specPath)) {
    console.error(`build-field-registry: blueprint not found at ${specPath}`);
    process.exit(2);
  }
  const rendered = renderRegistry(buildRegistry(fs.readFileSync(specPath, 'utf8')));
  if (check) {
    const committed = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n') : null;
    if (rendered === committed) {
      console.log(`build-field-registry: OK — ${path.relative(process.cwd(), outPath)} is up to date.`);
      return;
    }
    console.error(`build-field-registry: DRIFT — ${path.relative(process.cwd(), outPath)} is stale. Re-run without --check.`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, rendered, 'utf8');
  console.log(`build-field-registry: wrote ${path.relative(process.cwd(), outPath)}.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
