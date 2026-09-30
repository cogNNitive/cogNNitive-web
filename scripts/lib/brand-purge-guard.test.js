'use strict';

const assert = require('node:assert');
const { findViolations } = require('./brand-purge-guard.js');

const A = 'Any' + 'deo';
const V = 'Vid' + 'GeNN';

function hits(files) {
  return findViolations(files.map(([path, content]) => ({ path, content })));
}

// 1. Flags either name in any case, in content.
assert.strictEqual(hits([['docs/a.md', `see ${A} and ${V.toLowerCase()}`]]).length, 1);
assert.strictEqual(hits([['docs/a.md', `${V.toUpperCase()}_ROOT`]]).length, 1);
assert.strictEqual(hits([['docs/a.md', 'cogNNitive-video only']]).length, 0);

// 2. Flags file names.
assert.strictEqual(hits([[`procedures/generate_${A.toLowerCase()}_script_NN.md`, 'clean']]).length, 1);

// 3. Excluded paths are never scanned.
assert.strictEqual(hits([['iNNfo/packages/innfo-video-parser/specs/V_0-3-3.json', A]]).length, 0);
assert.strictEqual(hits([['openspec/changes/archive/x/tasks.md', V]]).length, 0);
assert.strictEqual(hits([['openspec/specs/x/spec.md', V]]).length, 1);

// 4. VUS syntax literals pass, but a second mention on the same line still fails.
const header = `//${A.toUpperCase()}_SPEC: V_0-3-3`;
assert.strictEqual(hits([['s/script.md', header]]).length, 0);
assert.strictEqual(hits([['s/script.md', `- video_${A.toLowerCase()}_specification: V_0-3-3`]]).length, 0);
assert.strictEqual(hits([['s/script.md', `${header} by ${A}`]]).length, 1);

// 5. Binary content (null) is skipped; the name still counts.
assert.strictEqual(hits([['img/logo.png', null]]).length, 0);

// 6. The real tree is clean.
const path = require('node:path');
const res = require('node:child_process').spawnSync(process.execPath, [path.join(__dirname, 'brand-purge-guard.js')], {
  encoding: 'utf8',
});
assert.strictEqual(res.status, 0, `tracked tree must be clean:\n${res.stderr}`);

console.log('brand-purge-guard tests passed');
