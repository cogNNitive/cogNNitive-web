/**
 * nn-video-script/test/render-thumbnail-series.test.mjs
 *
 * Slice S4a (one thumbnail tool): `render-thumbnail.mjs` is the only Phase B
 * tool, and `--series <dir>` makes the subtitle and badge default to the Series
 * `title` read from the series scope document (folded in from `thumbnail-v1.mjs`).
 *
 * Covers the two-phase-thumbnail "Series title fills subtitle and badge" scenario
 * and the video-script-skill "One thumbnail tool" scenario.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCliArgs,
  resolveSeriesTitle,
  resolveThumbnailText,
} from '../scripts/render-thumbnail.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SERIES_CONTENT = `---
level: 3
parent_spec:
  name: "video-script_V_0-13-2"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Other Series"
---

# NN Series

## NN Series: Other Series
slug:: other-series
title:: Other Series
`;

function withSeries(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-thumb-series-'));
  fs.writeFileSync(path.join(dir, 'other-series_scope_NN.md'), SERIES_CONTENT, 'utf8');
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('Series title fills subtitle and badge when only --series is given', () => {
  withSeries((dir) => {
    const seriesTitle = resolveSeriesTitle({ seriesDir: dir });
    assert.equal(seriesTitle, 'Other Series');
    const text = resolveThumbnailText({ seriesTitle });
    assert.equal(text.subtitle, 'Other Series');
    assert.equal(text.badge, 'Other Series');
  });
});

test('explicit --subtitle and --badge win over the Series title', () => {
  const text = resolveThumbnailText({ subtitle: 'Custom sub', badge: 'Custom badge', seriesTitle: 'Other Series' });
  assert.equal(text.subtitle, 'Custom sub');
  assert.equal(text.badge, 'Custom badge');
});

test('without a series the badge falls back to the brand pill and subtitle stays empty', () => {
  const text = resolveThumbnailText({});
  assert.equal(text.subtitle, undefined);
  assert.equal(text.badge, 'iNNtrevistas');
});

test('parseCliArgs reads --series', () => {
  const parsed = parseCliArgs(['--base', 'b.png', '--title', 'T', '--out', 'o.png', '--series', '/tmp/s']);
  assert.equal(parsed.seriesDir, '/tmp/s');
});

test('render-thumbnail.mjs is the only Phase B thumbnail tool', () => {
  assert.ok(fs.existsSync(path.join(SKILL_DIR, 'scripts', 'render-thumbnail.mjs')));
  assert.equal(fs.existsSync(path.join(SKILL_DIR, 'scripts', 'thumbnail-v1.mjs')), false);
  assert.equal(fs.existsSync(path.join(SKILL_DIR, 'test', 'thumbnail-v1.test.mjs')), false);
});
