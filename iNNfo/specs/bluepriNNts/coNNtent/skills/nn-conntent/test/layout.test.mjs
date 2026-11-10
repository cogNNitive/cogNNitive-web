/**
 * nn-conntent/test/layout.test.mjs
 *
 * `lib/layout.mjs#assertLayout(root)` is the one folder contract. It returns zero
 * findings on a clean tree and one `legacy-layout` finding per legacy path, with the
 * message from the spec's table naming the path found and the new location.
 * (capability conntent-folder-contract "Legacy Layouts Are Rejected, Not Adapted";
 * conntent-library "Legacy Root Folders Are Rejected").
 *
 * Task 1a.1 — RED: module missing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { assertLayout, LAYOUT_LEGACY } from '../scripts/lib/layout.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

const EPISODE_DOC = (slug) =>
  `---\nlevel: 3\ntitle: "Episode"\n---\n\n# NN Video\n\n## NN Video: ${slug}\nslug:: ${slug}\n`;

function cleanDomain() {
  const root = tmp('layout-clean-');
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  fs.mkdirSync(path.join(root, 'library', 'frames', 'neutral'), { recursive: true });
  fs.writeFileSync(path.join(root, 'library', 'frames', 'neutral', 'FRAME.md'), '# frame\n', 'utf8');
  fs.mkdirSync(path.join(root, 'series', 's', 'episodes', 'e'), { recursive: true });
  fs.writeFileSync(path.join(root, 'series', 's', 's_coNNtent_NN.md'), '---\nlevel: 3\nscope: true\n---\n', 'utf8');
  fs.writeFileSync(path.join(root, 'series', 's', 'episodes', 'e', 'e_coNNtent_NN.md'), EPISODE_DOC('e'), 'utf8');
  return root;
}

test('a clean tree returns zero findings', () => {
  const root = cleanDomain();
  assert.equal(assertLayout(root).length, 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('an episode under series/<s>/assets/ is rejected with the episodes location', () => {
  const root = cleanDomain();
  fs.mkdirSync(path.join(root, 'series', 's', 'assets', 'legacy-ep'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'series', 's', 'assets', 'legacy-ep', 'legacy-ep_coNNtent_NN.md'),
    EPISODE_DOC('legacy-ep'),
    'utf8',
  );

  const findings = assertLayout(root);
  const hit = findings.find((f) => f.code === LAYOUT_LEGACY && /assets\/legacy-ep/.test(f.path));
  assert.ok(hit, 'expected a legacy-layout finding for the assets episode');
  assert.match(hit.message, /episodes now live in `series\/s\/episodes\/legacy-ep\/`/);
  assert.match(hit.message, /recreate this domaiNN/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('root and series sounds/, components/, frames/ are each rejected with the library location', () => {
  for (const dir of ['sounds', 'components', 'frames']) {
    const root = cleanDomain();
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(path.join(root, dir, 'x.mp3'), 'x', 'utf8');

    const findings = assertLayout(root);
    const hit = findings.find((f) => f.code === LAYOUT_LEGACY && RegExp(`\\b${dir}\\/?$`).test(f.path));
    assert.ok(hit, `expected a finding for root ${dir}/`);
    assert.match(hit.message, new RegExp('`' + dir + '/`'));
    assert.match(hit.message, new RegExp('library/' + dir + '/'));
    assert.match(hit.message, /recreate this domaiNN/);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a series-root sounds/ folder is rejected', () => {
  const root = cleanDomain();
  fs.mkdirSync(path.join(root, 'series', 's', 'sounds'), { recursive: true });
  fs.writeFileSync(path.join(root, 'series', 's', 'sounds', 'whoosh.mp3'), 'x', 'utf8');

  const findings = assertLayout(root);
  const hit = findings.find((f) => f.code === LAYOUT_LEGACY && /series\/s\/sounds/.test(f.path));
  assert.ok(hit, 'expected a finding for the series sounds/ folder');
  assert.match(hit.message, /library\/sounds\//);
  fs.rmSync(root, { recursive: true, force: true });
});

test('video-guard.json at the root is rejected with the catalog replacement', () => {
  const root = cleanDomain();
  fs.writeFileSync(path.join(root, 'video-guard.json'), '{}', 'utf8');

  const findings = assertLayout(root);
  const hit = findings.find((f) => f.code === LAYOUT_LEGACY && /video-guard\.json$/.test(f.path));
  assert.ok(hit, 'expected a finding for video-guard.json');
  assert.match(hit.message, /video-guard\.json/);
  assert.match(hit.message, /model-catalog_NN\.md/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('several legacy paths are aggregated in one call', () => {
  const root = cleanDomain();
  fs.writeFileSync(path.join(root, 'video-guard.json'), '{}', 'utf8');
  fs.mkdirSync(path.join(root, 'sounds'), { recursive: true });
  fs.mkdirSync(path.join(root, 'series', 's', 'assets', 'old'), { recursive: true });
  fs.writeFileSync(path.join(root, 'series', 's', 'assets', 'old', 'old_coNNtent_NN.md'), EPISODE_DOC('old'), 'utf8');

  const findings = assertLayout(root).filter((f) => f.code === LAYOUT_LEGACY);
  assert.equal(findings.length, 3, `expected 3 aggregated findings, got ${findings.length}`);
  fs.rmSync(root, { recursive: true, force: true });
});

test('heavy/generated directories do not trigger legacy-kind findings', () => {
  const root = cleanDomain();
  fs.mkdirSync(path.join(root, 'node_modules', '@scope', 'pkg', 'components'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dist', 'components'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs', 'sounds'), { recursive: true });
  assert.equal(assertLayout(root).length, 0, 'node_modules/dist/docs are never part of the authored layout');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a series whose slug equals a legacy kind name is not a legacy finding', () => {
  const root = tmp('layout-seriesnames-');
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  // A series legitimately slugged "sounds" — the kind-folder rule only fires at the
  // series *root* (`series/<s>/sounds/`), not for a series folder named `sounds`.
  fs.mkdirSync(path.join(root, 'series', 'sounds', 'episodes', 'e'), { recursive: true });
  fs.writeFileSync(path.join(root, 'series', 'sounds', 'sounds_coNNtent_NN.md'), '---\nlevel: 3\nscope: true\n---\n', 'utf8');
  fs.writeFileSync(path.join(root, 'series', 'sounds', 'episodes', 'e', 'e_coNNtent_NN.md'), EPISODE_DOC('e'), 'utf8');
  assert.equal(assertLayout(root).length, 0, 'a series slug equal to a kind name is not a legacy finding');
  fs.rmSync(root, { recursive: true, force: true });
});

test('a loose file under series/<s>/assets/ is reported as legacy series media', () => {
  const root = cleanDomain();
  fs.mkdirSync(path.join(root, 'series', 's', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'series', 's', 'assets', 'cover.png'), 'x', 'utf8');
  const hit = assertLayout(root).find((f) => f.code === LAYOUT_LEGACY && /series\/s\/assets$/.test(f.path));
  assert.ok(hit, 'a loose file under assets/ must be reported');
  assert.match(hit.message, /library\/<kind>\//);
  fs.rmSync(root, { recursive: true, force: true });
});