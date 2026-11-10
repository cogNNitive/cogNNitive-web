/**
 * nn-conntent/test/plan-library-record.test.mjs
 *
 * Each resolved logical name yields a resolution record { name, level, path } and the
 * plan lists it. A reference that climbs (`../../assets/music/ambient.mp3` from a series
 * doc) is rejected with `LIBRARY_PATH_INVALID` (capability conntent-library "The Plan And
 * The Console Report The Resolved File"; F9; task 1b.5 — RED: header record missing).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { libraryResolutionRecord, resolveLibrary, LIBRARY_PATH_INVALID } from '../scripts/lib/library.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

function makeMedia() {
  const root = tmp('plan-lib-');
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  fs.mkdirSync(path.join(root, 'library', 'music'), { recursive: true });
  fs.writeFileSync(path.join(root, 'library', 'music', 'ambient.mp3'), 'domain', 'utf8');
  fs.mkdirSync(path.join(root, 'series', 's', 'library', 'music'), { recursive: true });
  fs.writeFileSync(path.join(root, 'series', 's', 'library', 'music', 'jazz.wav'), 'series', 'utf8');
  fs.mkdirSync(path.join(root, 'series', 's', 'episodes', 'e', 'media', 'music'), { recursive: true });
  fs.writeFileSync(path.join(root, 'series', 's', 'episodes', 'e', 'media', 'music', 'intro.mp3'), 'episode', 'utf8');
  return { root, episodeDir: path.join(root, 'series', 's', 'episodes', 'e') };
}

test('libraryResolutionRecord reports the resolved name, level and path', () => {
  const { root, episodeDir } = makeMedia();
  const r = resolveLibrary({ kind: 'music', ref: 'music/jazz', fromDir: episodeDir, root });
  const rec = libraryResolutionRecord({ field: 'background_audio', name: 'music/jazz', resolved: r, root });
  assert.equal(rec.field, 'background_audio');
  assert.equal(rec.name, 'music/jazz');
  assert.equal(rec.level, 'series');
  assert.equal(rec.path, 'series/s/library/music/jazz.wav');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a prefixed name is recorded as written with the forced level', () => {
  const { root, episodeDir } = makeMedia();
  const r = resolveLibrary({ kind: 'music', ref: 'domain:music/ambient.mp3', fromDir: episodeDir, root });
  const rec = libraryResolutionRecord({ field: 'background_audio', name: 'domain:music/ambient.mp3', resolved: r });
  assert.equal(rec.name, 'domain:music/ambient.mp3');
  assert.equal(rec.level, 'domain');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a reference that climbs from a series doc fails with LIBRARY_PATH_INVALID (F9)', () => {
  const { root, episodeDir } = makeMedia();
  assert.throws(
    () => resolveLibrary({ kind: 'music', ref: '../../assets/music/ambient.mp3', fromDir: episodeDir, root }),
    (e) => e.code === LIBRARY_PATH_INVALID,
  );
  fs.rmSync(root, { recursive: true, force: true });
});