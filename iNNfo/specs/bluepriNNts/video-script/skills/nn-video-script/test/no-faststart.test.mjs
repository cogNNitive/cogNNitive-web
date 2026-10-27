/**
 * nn-video-script/test/no-faststart.test.mjs
 *
 * Provider clips are cached exactly as delivered (S3 spike PASS): a raw
 * `moov`-at-end clip renders fine through the pinned CLI, so the `+faststart`
 * remux, its module and its `.needs-faststart` marker are gone from the engine.
 * `render-formats.mjs` still applies `+faststart` to final deliverables (design
 * D8) and is the only allowed match.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALLOWED = new Set(['scripts/render-formats.mjs', 'test/no-faststart.test.mjs', 'test/render-formats.test.mjs']);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(mjs|js|cjs|md|json|html)$/i.test(entry.name)) out.push(full);
  }
}

test('the faststart module and marker are gone from the engine', () => {
  assert.equal(fs.existsSync(path.join(SKILL_DIR, 'scripts', 'lib', 'faststart.mjs')), false);

  const files = [];
  walk(SKILL_DIR, files);
  const offenders = [];
  for (const file of files) {
    const rel = path.relative(SKILL_DIR, file).split(path.sep).join('/');
    if (ALLOWED.has(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (/needs-faststart|from '\.\/lib\/faststart|require\(.*faststart/i.test(text)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `faststart residue remains: ${offenders.join(', ')}`);
});
