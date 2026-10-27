/**
 * nn-video-script/test/emit-guard.test.mjs
 *
 * RED→GREEN tests for scripts/lib/emit-guard.mjs: regeneration refuses a
 * hand-edited emitted file and names it, regenerates a deleted file, and writes
 * a byte-stable `.nn-emit.json` record (design D9).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeGuarded, RegenerationRefusedError, EMIT_RECORD } from '../scripts/lib/emit-guard.mjs';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nn-emit-'));
}

test('writeGuarded writes the files and a stable record', () => {
  const dir = tmp();
  const files = { 'index.html': '<html>a</html>', 'compositions/one.html': '<template>b</template>' };
  writeGuarded(dir, files);
  assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), '<html>a</html>');
  assert.equal(fs.readFileSync(path.join(dir, 'compositions', 'one.html'), 'utf8'), '<template>b</template>');

  const record = JSON.parse(fs.readFileSync(path.join(dir, EMIT_RECORD), 'utf8'));
  assert.deepEqual(Object.keys(record.files), ['compositions/one.html', 'index.html']);
  const before = fs.readFileSync(path.join(dir, EMIT_RECORD), 'utf8');
  // Idempotent: an untouched project regenerates byte-identically.
  writeGuarded(dir, files);
  assert.equal(fs.readFileSync(path.join(dir, EMIT_RECORD), 'utf8'), before);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('writeGuarded refuses a hand-edited file and names it, writing nothing', () => {
  const dir = tmp();
  const files = { 'index.html': '<html>a</html>', 'compositions/one.html': '<template>b</template>' };
  writeGuarded(dir, files);
  fs.writeFileSync(path.join(dir, 'index.html'), '<html>HAND EDIT</html>');

  const next = { 'index.html': '<html>a2</html>', 'compositions/one.html': '<template>b2</template>' };
  assert.throws(
    () => writeGuarded(dir, next),
    (err) => err instanceof RegenerationRefusedError && /index\.html/.test(err.message),
  );
  // Nothing was written.
  assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), '<html>HAND EDIT</html>');
  assert.equal(fs.readFileSync(path.join(dir, 'compositions', 'one.html'), 'utf8'), '<template>b</template>');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('writeGuarded regenerates a deleted recorded file', () => {
  const dir = tmp();
  const files = { 'index.html': '<html>a</html>', 'compositions/one.html': '<template>b</template>' };
  writeGuarded(dir, files);
  fs.rmSync(path.join(dir, 'compositions', 'one.html'));
  writeGuarded(dir, files);
  assert.equal(fs.readFileSync(path.join(dir, 'compositions', 'one.html'), 'utf8'), '<template>b</template>');
  fs.rmSync(dir, { recursive: true, force: true });
});
