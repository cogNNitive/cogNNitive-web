#!/usr/bin/env node

/**
 * nn-video-script/test/no-vus-artifacts.test.mjs
 *
 * Teardown assertion for the big-bang VUS removal: the skill MUST ship no VUS
 * parser artifact and MUST reference no VUS parse code path. Scans the skill's
 * non-test files (SKILL.md, references/, scripts/) for the retired artifact
 * identifiers and fails if any remain.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, '..');
const SKIP_DIRS = new Set(['node_modules', '.git', 'test']);
const FORBIDDEN = /innfo-video-parser|vus-parse|vus-spec|vus\.peggy|vus_spec/i;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function run() {
  console.log('Running no-VUS-artifacts scan...');
  const offenders = [];
  for (const file of walk(SKILL_DIR, [])) {
    const rel = path.relative(SKILL_DIR, file).split(path.sep).join('/');
    if (FORBIDDEN.test(rel)) {
      offenders.push(`${rel} (file name)`);
      continue;
    }
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (FORBIDDEN.test(text)) offenders.push(rel);
  }
  assert.deepStrictEqual(offenders, [], `VUS artifacts must be gone; found in: ${offenders.join(', ')}`);
  console.log('✔ no VUS parser artifact or reference remains in the skill');
  console.log('\nNo-VUS-artifacts scan passed! ✨');
}

run();
