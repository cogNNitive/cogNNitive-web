/**
 * nn-conntent/test/library-folders.test.mjs
 *
 * `library/` validation: six allowed kind folders at domaiNN and series roots, unknown
 * kind folders rejected, and item names must match the lowercase pattern. Avatars live
 * inside the character folder. (capability conntent-library "Six kinds"; task 1b.3.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { validateLibrary, LIBRARY_KINDS } from '../scripts/lib/library.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

test('the six kind folders are all accepted at the domaiNN root', () => {
  const root = tmp('lib-folders-');
  for (const kind of LIBRARY_KINDS) fs.mkdirSync(path.join(root, 'library', kind), { recursive: true });
  assert.deepEqual(validateLibrary(path.join(root, 'library')), []);
  fs.rmSync(root, { recursive: true, force: true });
});

test('an unknown kind folder is rejected naming the allowed kinds', () => {
  const root = tmp('lib-folders-bad-');
  fs.mkdirSync(path.join(root, 'library', 'fonts'), { recursive: true });
  const findings = validateLibrary(path.join(root, 'library'));
  const hit = findings.find((f) => f.code === 'unknown-library-kind');
  assert.ok(hit, 'expected an unknown-library-kind finding');
  assert.match(hit.message, /fonts/);
  assert.match(hit.message, /music/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('an invalid item name is rejected with the allowed pattern', () => {
  const root = tmp('lib-folders-name-');
  fs.mkdirSync(path.join(root, 'library', 'music'), { recursive: true });
  fs.writeFileSync(path.join(root, 'library', 'music', 'Ambient Loop.mp3'), 'x', 'utf8');
  const hit = validateLibrary(path.join(root, 'library')).find((f) => f.code === 'invalid-library-name');
  assert.ok(hit, 'expected an invalid-library-name finding');
  assert.match(hit.message, /Ambient Loop\.mp3/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('avatars live inside the character, not under music/sounds/media', () => {
  const root = tmp('lib-folders-avatar-');
  fs.mkdirSync(path.join(root, 'library', 'characters', 'lucas', 'avatars'), { recursive: true });
  fs.writeFileSync(path.join(root, 'library', 'characters', 'lucas', 'avatars', 'a.png'), 'x', 'utf8');
  assert.deepEqual(validateLibrary(path.join(root, 'library')), []);
  fs.rmSync(root, { recursive: true, force: true });
});