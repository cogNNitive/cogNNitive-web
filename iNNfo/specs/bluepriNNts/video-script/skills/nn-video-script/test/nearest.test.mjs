/**
 * nn-video-script/test/nearest.test.mjs
 *
 * RED→GREEN tests for scripts/lib/nearest.mjs: the one folder walker shared by
 * components, sounds, frames and the series document (design D2/D3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findNearest, findNearestByStem, findSeriesRoot } from '../scripts/lib/nearest.mjs';

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nn-nearest-'));
}

test('findNearest prefers the episode, then series, then domain, then fallback', () => {
  const root = tmp();
  const domain = path.join(root, 'domain');
  const series = path.join(domain, 'series-a');
  const episode = path.join(series, 'ep-01');
  fs.mkdirSync(path.join(episode, 'components'), { recursive: true });
  fs.mkdirSync(path.join(series, 'components'), { recursive: true });
  fs.mkdirSync(path.join(domain, 'components'), { recursive: true });
  fs.mkdirSync(path.join(root, 'fallback', 'components'), { recursive: true });

  const rel = 'components/lower-third.html';
  fs.writeFileSync(path.join(episode, rel), 'episode');
  fs.writeFileSync(path.join(series, rel), 'series');
  fs.writeFileSync(path.join(domain, rel), 'domain');
  fs.writeFileSync(path.join(root, 'fallback', rel), 'fallback');

  const opts = { stopDir: domain, fallbackDir: path.join(root, 'fallback') };
  assert.equal(fs.readFileSync(findNearest(episode, rel, opts).path, 'utf8'), 'episode');
  assert.equal(fs.readFileSync(findNearest(series, rel, opts).path, 'utf8'), 'series');
  assert.equal(fs.readFileSync(findNearest(domain, rel, opts).path, 'utf8'), 'domain');

  fs.rmSync(path.join(episode, rel));
  assert.equal(fs.readFileSync(findNearest(episode, rel, opts).path, 'utf8'), 'series');

  fs.rmSync(path.join(series, rel));
  assert.equal(fs.readFileSync(findNearest(episode, rel, opts).path, 'utf8'), 'domain');

  fs.rmSync(path.join(domain, rel));
  assert.equal(fs.readFileSync(findNearest(episode, rel, opts).path, 'utf8'), 'fallback');

  fs.rmSync(path.join(root, 'fallback', rel));
  const miss = findNearest(episode, rel, opts);
  assert.equal(miss.path, null);
  assert.ok(miss.searched.length >= 4, 'a miss lists every path searched');
  assert.ok(miss.searched.some((p) => p.endsWith(path.join('domain', 'components', 'lower-third.html'))));
  fs.rmSync(root, { recursive: true, force: true });
});

test('findNearest stopDir is inclusive and folders are optional', () => {
  const root = tmp();
  const domain = path.join(root, 'domain');
  const episode = path.join(domain, 'series', 'ep');
  fs.mkdirSync(episode, { recursive: true });
  fs.mkdirSync(path.join(domain, 'frames'), { recursive: true });
  fs.writeFileSync(path.join(domain, 'frames', 'neutral.md'), '# frame');

  const found = findNearest(episode, 'frames/neutral.md', { stopDir: domain });
  assert.equal(found.path, path.join(domain, 'frames', 'neutral.md'));

  // A missing intermediate folder is simply not a match.
  const miss = findNearest(episode, 'components/missing.html', { stopDir: domain });
  assert.equal(miss.path, null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findNearestByStem matches any extension and prefers the nearest folder', () => {
  const root = tmp();
  const series = path.join(root, 'domain', 'series-a');
  const episode = path.join(series, 'ep');
  fs.mkdirSync(path.join(episode, 'sounds'), { recursive: true });
  fs.mkdirSync(path.join(series, 'sounds'), { recursive: true });
  fs.writeFileSync(path.join(series, 'sounds', 'whoosh.wav'), 'wav');
  fs.writeFileSync(path.join(episode, 'sounds', 'whoosh.mp3'), 'mp3');

  const opts = { stopDir: path.join(root, 'domain') };
  assert.equal(findNearestByStem(episode, 'sounds', 'whoosh', opts).path, path.join(episode, 'sounds', 'whoosh.mp3'));
  fs.rmSync(path.join(episode, 'sounds', 'whoosh.mp3'));
  assert.equal(findNearestByStem(episode, 'sounds', 'whoosh', opts).path, path.join(series, 'sounds', 'whoosh.wav'));

  const miss = findNearestByStem(episode, 'sounds', 'nope', opts);
  assert.equal(miss.path, null);
  assert.ok(miss.searched.length >= 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test('findSeriesRoot returns the nearest series below the domain root', () => {
  const root = tmp();
  const domain = path.join(root, 'domain');
  const series = path.join(domain, 'series-a');
  const episode = path.join(series, 'ep-01');
  fs.mkdirSync(episode, { recursive: true });
  fs.writeFileSync(path.join(series, 'series_NN.md'), '# series');

  assert.equal(findSeriesRoot(episode, domain), series);
  assert.equal(findSeriesRoot(series, domain), series);

  // A script directly under the domain root has no series.
  assert.equal(findSeriesRoot(domain, domain), undefined);

  // A marker AT the domain root is ignored.
  fs.writeFileSync(path.join(domain, 'series_rules.md'), '# rules');
  assert.equal(findSeriesRoot(path.join(domain, 'loose-ep'), domain), undefined);

  // `series_rules.md` and `script_template.md` are markers too.
  fs.writeFileSync(path.join(series, 'series_NN.md'), '');
  fs.rmSync(path.join(series, 'series_NN.md'));
  fs.writeFileSync(path.join(series, 'script_template.md'), '# t');
  assert.equal(findSeriesRoot(episode, domain), series);
  fs.rmSync(root, { recursive: true, force: true });
});
