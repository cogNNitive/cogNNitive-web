#!/usr/bin/env node

/**
 * scripts/generate-canonical-registry.mjs
 *
 * Regenerates the embedded `*_SPEC_CONTENT` string constants in
 * `iNNfo/packages/innfo-core/src/schema/canonical-registry.ts` from their
 * on-disk spec files, so the offline fallback mirrors the canonical specs
 * byte-for-byte.
 *
 * The registry's structural metadata (names, versions, aliases) is preserved;
 * only the spec text literals are rewritten.
 *
 * Usage:
 *   node scripts/generate-canonical-registry.mjs [--check]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const REGISTRY = path.join(
  REPO_ROOT,
  'iNNfo',
  'packages',
  'innfo-core',
  'src',
  'schema',
  'canonical-registry.ts',
);

const SPEC_ROOT = path.join(REPO_ROOT, 'iNNfo', 'specs');

/** const name -> on-disk spec path (relative to iNNfo/specs). */
const MAP = {
  DEFINNITION_SPEC_CONTENT: 'defiNNition_V_0-1-0_NN.md',
  INNFO_SPEC_CONTENT: 'iNNfo_V_0-3-0_NN.md',
  PROCEDURES_SPEC_CONTENT: 'bluepriNNts/procedures/spec_NN.md',
  SOURCES_SPEC_CONTENT: 'bluepriNNts/sources/spec_NN.md',
  ARTIFACTS_SPEC_CONTENT: 'bluepriNNts/artifacts/spec_NN.md',
  ORGANIZATION_SPEC_CONTENT: 'bluepriNNts/organization/spec_NN.md',
  METRICS_SPEC_CONTENT: 'bluepriNNts/metrics/spec_NN.md',
  WORKSPACE_SPEC_CONTENT: 'bluepriNNts/workspace_spec_NN.md',
  COGNNITIVE_SPEC_CONTENT: 'bluepriNNts/cogNNitive/spec_NN.md',
  ANALYSIS_SPEC_CONTENT: 'bluepriNNts/analysis/spec_NN.md',
  PROJECTS_SPEC_CONTENT: 'bluepriNNts/projects/spec_NN.md',
  BUSINESS_MODEL_SPEC_CONTENT: 'bluepriNNts/business-model/spec_NN.md',
  BUSINESS_SPEC_CONTENT: 'bluepriNNts/business/spec_NN.md',
};

/**
 * Finds the end index (exclusive) of a JS string/template literal starting at
 * `start` (which must point at the opening quote/backtick).
 */
function literalEnd(src, start) {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    i += 1;
  }
  throw new Error(`Unterminated literal starting at ${start}`);
}

function escapeString(content) {
  return JSON.stringify(content);
}

function main() {
  const check = process.argv.includes('--check');
  const src = fs.readFileSync(REGISTRY, 'utf-8');
  let updated = src;
  const changed = [];

  for (const [name, rel] of Object.entries(MAP)) {
    const diskPath = path.join(SPEC_ROOT, rel);
    if (!fs.existsSync(diskPath)) {
      console.error(`generate-canonical-registry: missing spec ${diskPath}`);
      process.exit(2);
    }
    const content = fs.readFileSync(diskPath, 'utf-8').replace(/\r\n/g, '\n');

    const marker = `const ${name} = `;
    const at = updated.indexOf(marker);
    if (at === -1) {
      console.error(`generate-canonical-registry: const ${name} not found`);
      process.exit(2);
    }
    const litStart = at + marker.length;
    const litEnd = literalEnd(updated, litStart);
    const replacement = escapeString(content);
    if (updated.slice(litStart, litEnd) !== replacement) {
      changed.push(name);
      updated = updated.slice(0, litStart) + replacement + updated.slice(litEnd);
    }
  }

  if (updated === src) {
    console.log(`generate-canonical-registry: OK — all mirrors up to date (${Object.keys(MAP).length} specs).`);
    return;
  }

  if (check) {
    console.error(`generate-canonical-registry: DRIFT — ${changed.join(', ')}. Re-run without --check.`);
    process.exit(1);
  }

  fs.writeFileSync(REGISTRY, updated, 'utf-8');
  console.log(`generate-canonical-registry: updated ${changed.length} mirror(s): ${changed.join(', ')}`);
}

main();
