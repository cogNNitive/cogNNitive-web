/**
 * nn-video-script/test/series-root.test.mjs
 *
 * The series root is the outermost folder scope link below the domain root of the
 * nn-core scope chain: a scope document is recognised by frontmatter `scope: true`,
 * never by filename, and a broken chain is surfaced instead of swallowed
 * (capability video-folder-contract "Series Root Is Anchored On Scope Documents").
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { findSeriesRoot, loadCascadeBags } from '../scripts/lib/video-scope.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const scopeDoc = (title, extra = '') =>
  `---\nlevel: 3\nscope: true\ntitle: "${title}"\n${extra}---\n\n# NN Series\n\n## NN Series: ${title}\nslug:: ${title.toLowerCase()}\n`;

function domain() {
  const root = tmp('nn-series-root-');
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  return root;
}

test('a series anchored only by its scope document resolves', () => {
  const root = domain();
  const series = path.join(root, 'series', 's');
  const episode = path.join(series, 'assets', 'e');
  fs.mkdirSync(episode, { recursive: true });
  fs.writeFileSync(path.join(series, 's_scope_NN.md'), scopeDoc('S'), 'utf8');

  assert.equal(findSeriesRoot(episode), series);
  assert.equal(Number(fs.existsSync(path.join(series, 'series_NN.md'))), 0);
  fs.rmSync(root, { recursive: true, force: true });
});

test('nested scopes resolve to the outermost one below the domain root', () => {
  const root = domain();
  const series = path.join(root, 'series', 's');
  const nested = path.join(series, 'assets');
  const episode = path.join(nested, 'e');
  fs.mkdirSync(episode, { recursive: true });
  fs.writeFileSync(path.join(series, 's_scope_NN.md'), scopeDoc('S'), 'utf8');
  fs.writeFileSync(path.join(nested, 'assets_scope_NN.md'), scopeDoc('Assets'), 'utf8');

  assert.equal(findSeriesRoot(episode), series);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a duplicate scope marker is surfaced, not swallowed', () => {
  const root = domain();
  const series = path.join(root, 'series', 's');
  const episode = path.join(series, 'assets', 'e');
  fs.mkdirSync(episode, { recursive: true });
  fs.writeFileSync(path.join(series, 's_scope_NN.md'), scopeDoc('S'), 'utf8');
  fs.writeFileSync(path.join(series, 'other_scope_NN.md'), scopeDoc('Other'), 'utf8');

  assert.throws(() => findSeriesRoot(episode), /DUPLICATE_SCOPE_MARKER/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a folder holding only a legacy marker is not a series', () => {
  const root = domain();
  const series = path.join(root, 'series', 's');
  const episode = path.join(series, 'assets', 'e');
  fs.mkdirSync(episode, { recursive: true });
  for (const legacy of ['series_NN.md', 'series_rules.md', 'script_template.md']) {
    fs.writeFileSync(path.join(series, legacy), '# legacy\n', 'utf8');
  }
  assert.equal(findSeriesRoot(episode), undefined);

  const bags = loadCascadeBags(episode);
  assert.equal(bags.series, undefined, 'a legacy marker supplies no cascade value');
  fs.rmSync(root, { recursive: true, force: true });
});

test('an episode outside any scope folder has no series', () => {
  const root = domain();
  const episode = path.join(root, 'loose-episode');
  fs.mkdirSync(episode, { recursive: true });
  assert.equal(findSeriesRoot(episode), undefined);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a stale legacy marker supplies no cascade value next to a scope document', () => {
  const root = domain();
  const series = path.join(root, 'series', 's');
  const episode = path.join(series, 'assets', 'e');
  fs.mkdirSync(episode, { recursive: true });
  fs.writeFileSync(path.join(series, 's_scope_NN.md'), scopeDoc('S'), 'utf8');
  fs.writeFileSync(path.join(series, 'series_NN.md'), '---\nlevel: 3\ntitle: "Old"\n---\n\n# NN Series\n\n## NN Series: Old\ntransition:: wipe\n', 'utf8');

  const bags = loadCascadeBags(episode);
  assert.equal(bags.series.transition, undefined);
  fs.rmSync(root, { recursive: true, force: true });
});
