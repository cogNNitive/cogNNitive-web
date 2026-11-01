/**
 * nn-video-script/test/series-scope.test.mjs
 *
 * The series bag of the parameter cascade comes from the context-resolution
 * scope chain (`<series>_scope_NN.md` folder scopes), not from a mandatory
 * `series_NN.md`. The legacy document stays as a fallback for domains that do
 * not declare scope markers yet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadCascadeBags } from '../scripts/lib/video-scope.mjs';
import { loadSeriesDocument, loadSeriesFor } from '../scripts/build-script-from-draft.mjs';

const DOMAIN = `---\ntitle: demo\n---\n\n# NN DomaiNN\n`;

const MARKER = (fields) => `---
level: 3
title: "Demo series"
scope: true
fills:
  some-procedure:
    some_slot: |
      filled text
---

# NN Series

## NN Series: demo
${fields}
`;

const LEGACY = (fields) => `---
level: 3
title: "Demo series"
---

# NN Series

## NN Series: demo
slug:: legacy-series
${fields}
`;

const SERIES_FIELDS = [
  'voice_id:: VoiceA',
  'music:: ../../shared/music/jazz.mp3',
  'music_volume:: 0.4',
].join('\n');

/** Builds a domaiNN with one series and one episode script; returns the script path. */
function makeDomain({ marker = true, legacy = false, deeper = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-series-scope-'));
  const series = path.join(root, 'series', 'demo-series');
  const episode = path.join(series, 'assets', 'episode-one');
  fs.mkdirSync(episode, { recursive: true });
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), DOMAIN, 'utf8');
  fs.writeFileSync(path.join(series, 'script_template.md'), '---\nlevel: 3\n---\n\n# template\n', 'utf8');
  if (marker) fs.writeFileSync(path.join(series, 'demo-series_scope_NN.md'), MARKER(SERIES_FIELDS), 'utf8');
  if (legacy) fs.writeFileSync(path.join(series, 'series_NN.md'), LEGACY(SERIES_FIELDS), 'utf8');
  if (deeper) {
    fs.writeFileSync(
      path.join(episode, 'episode-one_scope_NN.md'),
      MARKER('music_volume:: 0.06').replace('title: "Demo series"', 'title: "Episode one"'),
      'utf8',
    );
  }
  const script = path.join(episode, 'episode-one_video-script_demo-series_NN.md');
  fs.writeFileSync(script, '---\nlevel: 3\ntitle: "Episode one"\n---\n\n# NN Video\n', 'utf8');
  return { root, script, series };
}

function withDomain(options, fn) {
  const { root, script, series } = makeDomain(options);
  try {
    fn(script, { root, series });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('the series bag is read from the <series>_scope_NN.md marker (no series_NN.md needed)', () => {
  withDomain({}, (script) => {
    const bags = loadCascadeBags(script);
    assert.equal(bags.series.voice_id, 'VoiceA');
    assert.equal(String(bags.series.music).endsWith('shared/music/jazz.mp3'), true);
    assert.equal(Number(bags.series.music_volume), 0.4);
  });
});

test('a deeper folder scope overrides the series marker', () => {
  withDomain({ deeper: true }, (script) => {
    const bags = loadCascadeBags(script);
    assert.equal(Number(bags.series.music_volume), 0.06);
    assert.equal(bags.series.voice_id, 'VoiceA');
  });
});

test('a legacy series_NN.md supplies nothing: only a scope document defines the series level', () => {
  withDomain({ marker: false, legacy: true }, (script) => {
    const bags = loadCascadeBags(script);
    assert.equal(bags.series, undefined);
  });
});

test('without any series source no series bag is invented', () => {
  withDomain({ marker: false }, (script) => {
    const bags = loadCascadeBags(script);
    assert.equal(bags.series, undefined);
  });
});

test('the generator reads the series document from the marker and drops scope-only keys', () => {
  withDomain({}, (script, { series }) => {
    const doc = loadSeriesDocument(series);
    assert.equal(doc.slug, 'demo-series');
    assert.equal(doc.title, 'Demo series');
    assert.equal(/^scope:/m.test(doc.frontmatter), false);
    assert.equal(/^isolate:/m.test(doc.frontmatter), false);
    assert.equal(/^fills:/m.test(doc.frontmatter), false);
    assert.match(doc.frontmatter, /^level: 3$/m);
    assert.match(doc.frontmatter, /^title: "Demo series"$/m);
  });
});

test('loadSeriesFor finds the series through its scope document, ignoring a stale series_NN.md', () => {
  withDomain({ legacy: true }, (script) => {
    const both = loadSeriesFor(script);
    assert.equal(both.slug, 'demo-series');
    assert.equal(both.title, 'Demo series');
  });
  withDomain({}, (script) => {
    const markerOnly = loadSeriesFor(script);
    assert.equal(markerOnly.slug, 'demo-series');
  });
});
