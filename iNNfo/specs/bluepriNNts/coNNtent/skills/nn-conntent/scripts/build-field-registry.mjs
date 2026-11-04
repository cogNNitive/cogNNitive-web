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

/** Concepts that make a Field a cascade parameter. */
const CASCADE_CONCEPTS = ['Video Defaults', 'Series', 'Scene Kind', 'Preset', 'Video', 'Scene'];

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
    fields[element.name] = {
      concepts,
      type: raw.type === undefined ? null : String(raw.type),
      options: Array.isArray(raw.options) ? raw.options.map(String) : raw.options ? [String(raw.options)] : [],
      multiple: raw.multiple === true || raw.multiple === 'true',
      cascade: concepts.some((c) => CASCADE_CONCEPTS.includes(c)),
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
