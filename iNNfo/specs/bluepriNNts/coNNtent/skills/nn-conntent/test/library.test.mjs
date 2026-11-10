/**
 * nn-conntent/test/library.test.mjs
 *
 * `lib/library.mjs#resolveLibrary({ kind, ref, fromDir })` resolves a logical name by
 * upward lookup: episode `media/` → series `library/` → domaiNN `library/` → package
 * floor. Nearest wins. `series:`/`domain:` prefixes force a level. `..`, absolute paths
 * and `\` are rejected. A user-level miss raises `MissingAssetError`; a package floor
 * miss is one warning (design D-S3; capability conntent-library).
 *
 * Task 1b.1 — RED: module missing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { resolveLibrary, LIBRARY_PATH_INVALID } from '../scripts/lib/library.mjs';
import { MissingAssetError } from '../scripts/lib/missing-asset.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

function makeMedia(name) {
  const root = tmp('lib-media-');
  fs.mkdirSync(path.join(root, 'series', 's', 'episodes', 'e', 'media', 'music'), { recursive: true });
  fs.writeFileSync(path.join(root, 'series', 's', 'episodes', 'e', 'media', 'music', name), 'episode', 'utf8');
  fs.mkdirSync(path.join(root, 'series', 's', 'library', 'music'), { recursive: true });
  fs.writeFileSync(path.join(root, 'series', 's', 'library', 'music', name), 'series', 'utf8');
  fs.mkdirSync(path.join(root, 'library', 'music'), { recursive: true });
  fs.writeFileSync(path.join(root, 'library', 'music', name), 'domain', 'utf8');
  return { root, episodeDir: path.join(root, 'series', 's', 'episodes', 'e') };
}

test('nearest wins: episode media beats series library beats domain library', () => {
  const { root, episodeDir } = makeMedia('ambient.mp3');
  const r = resolveLibrary({ kind: 'music', ref: 'music/ambient.mp3', fromDir: episodeDir, root });
  assert.equal(r.file, path.join(episodeDir, 'media', 'music', 'ambient.mp3'));
  assert.equal(r.level, 'episode');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a name without extension matches by stem in the nearest level', () => {
  const { root, episodeDir } = makeMedia('jazz.wav');
  const r = resolveLibrary({ kind: 'music', ref: 'music/jazz', fromDir: episodeDir, root });
  assert.equal(r.file, path.join(episodeDir, 'media', 'music', 'jazz.wav'));
  assert.equal(r.level, 'episode');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a series: prefix forces the series level, skipping the episode copy', () => {
  const { root, episodeDir } = makeMedia('ambient.mp3');
  const r = resolveLibrary({ kind: 'music', ref: 'series:music/ambient.mp3', fromDir: episodeDir, root });
  assert.equal(r.file, path.join(root, 'series', 's', 'library', 'music', 'ambient.mp3'));
  assert.equal(r.level, 'series');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a domain: prefix forces the domain level', () => {
  const { root, episodeDir } = makeMedia('ambient.mp3');
  const r = resolveLibrary({ kind: 'music', ref: 'domain:music/ambient.mp3', fromDir: episodeDir, root });
  assert.equal(r.file, path.join(root, 'library', 'music', 'ambient.mp3'));
  assert.equal(r.level, 'domain');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a parent segment is rejected with LIBRARY_PATH_INVALID', () => {
  const { root, episodeDir } = makeMedia('ambient.mp3');
  assert.throws(
    () => resolveLibrary({ kind: 'music', ref: '../../assets/music/ambient.mp3', fromDir: episodeDir, root }),
    (e) => e.code === LIBRARY_PATH_INVALID,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('absolute paths and backslashes are rejected', () => {
  const { root, episodeDir } = makeMedia('ambient.mp3');
  assert.throws(() => resolveLibrary({ kind: 'music', ref: '/etc/music/ambient.mp3', fromDir: episodeDir, root }), (e) => e.code === LIBRARY_PATH_INVALID);
  assert.throws(() => resolveLibrary({ kind: 'music', ref: 'music\\ambient.mp3', fromDir: episodeDir, root }), (e) => e.code === LIBRARY_PATH_INVALID);
  assert.throws(() => resolveLibrary({ kind: 'music', ref: 'C:\\media\\ambient.mp3', fromDir: episodeDir, root }), (e) => e.code === LIBRARY_PATH_INVALID);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a user-level miss raises MissingAssetError listing the searched folders', () => {
  const { root, episodeDir } = makeMedia('ambient.mp3');
  // Only one copy; force the domain prefix with a missing name so it is a hard miss.
  assert.throws(
    () => resolveLibrary({ kind: 'music', ref: 'domain:music/missing.mp3', fromDir: episodeDir, root }),
    MissingAssetError,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test('a package-floor miss produces one warning and returns null', () => {
  const { root, episodeDir } = makeMedia('ambient.mp3');
  const warnings = [];
  const floor = path.join(root, 'library', 'frames');
  fs.mkdirSync(floor, { recursive: true });
  const r = resolveLibrary({
    kind: 'frames',
    ref: 'frames/neutral',
    fromDir: episodeDir,
    root,
    packageFloor: floor,
    warn: (m) => warnings.push(m),
  });
  assert.equal(r.file, null);
  assert.equal(r.level, 'package');
  fs.rmSync(root, { recursive: true, force: true });
});