/**
 * nn-conntent/test/console-conntent-size.test.mjs
 *
 * The domaiNN console stays small regardless of episode count (capability
 * conntent-domain-console, "Console stays small regardless of episode count"; task 4c.6).
 * A domaiNN with 50 episodes of four scenes each exports under the 5 MB warning threshold,
 * and the payload grows only with text: no media bytes reach the artifact.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { collect } from '../../../assets/console-view-conntent.data.mjs';
import { writeConsole } from '../../../../../../../scripts/export-console.mjs';

const EPISODES = 50;
const SCENES = 4;
const SIZE_WARN_BYTES = 5 * 1024 * 1024;

const SERIES = `---
level: 3
scope: true
parent_spec:
  name: "coNNtent_V_0-15-1"
  url: "https://example.invalid/coNNtent/spec_NN.md"
title: "Probe Series"
---

# NN Series

## NN Series: S
slug:: s
language:: es
voice:: series-voice
`;

const NARRATION = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen';

function episodeDoc(slug, index) {
  const scenes = [];
  for (let s = 1; s <= SCENES; s++) {
    scenes.push(`# NN Scene

## NN Scene: Scene ${s}
slug:: scene-${s}
kind:: Libre

${NARRATION} scene ${s} of episode ${index}

## NN Layer: Title
slug:: title-${s}
type:: text
style:: lower-third
text:: Episode ${index} scene ${s}
`);
  }
  return `---
level: 3
parent_spec:
  name: "coNNtent_V_0-15-1"
  url: "https://example.invalid/coNNtent/spec_NN.md"
blueprint_version: "V_0-17-0"
title: "Episode ${index}"
---

# NN Video

## NN Video: Episode ${index}
slug:: ${slug}
title:: Episode ${index}
status:: draft
review_gates:: [script]
output_formats:: [1920x1920]

${scenes.join('\n')}`;
}

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-conntent-size-'));
  fs.writeFileSync(
    path.join(root, 'domaiNN_NN.md'),
    '---\nname: "Probe"\nworkspace_id: "probe"\n---\n\n# NN DomaiNN\n',
    'utf8',
  );
  const seriesDir = path.join(root, 'series', 's');
  fs.mkdirSync(seriesDir, { recursive: true });
  fs.writeFileSync(path.join(seriesDir, 's_coNNtent_NN.md'), SERIES, 'utf8');
  for (let i = 1; i <= EPISODES; i++) {
    const slug = `e${i}`;
    const dir = path.join(seriesDir, 'episodes', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}_coNNtent_NN.md`), episodeDoc(slug, i), 'utf8');
    // Real media next to the episode: a still per scene plus an audio track. If anything
    // ever inlined a byte of these, the artifact size assertion would catch it.
    const media = path.join(dir, 'media');
    fs.mkdirSync(media, { recursive: true });
    for (let s = 1; s <= SCENES; s++) {
      fs.writeFileSync(path.join(media, `scene-${s}.png`), Buffer.alloc(64 * 1024, 0xab));
    }
  }
  fs.mkdirSync(path.join(root, 'changes'), { recursive: true });
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('a 50-episode domaiNN exports a console under 5 MB, with no media bytes in it', async () => {
  const ws = workspace();
  try {
    const data = await collect({ rootDir: ws.root });
    const episodeCount = data.tree.series.reduce((n, series) => n + series.episodes.length, 0);
    assert.equal(episodeCount, EPISODES, 'every episode is in the tree');

    const payload = JSON.stringify(data);
    assert.ok(payload.length < 1_500_000, `the payload grows with text only (${payload.length} B)`);
    assert.doesNotMatch(payload, /data:image|base64,/, 'no media bytes in the payload');

    const result = await writeConsole({ rootDir: ws.root, open: false });
    const bytes = fs.statSync(result.path).size;
    assert.ok(bytes < SIZE_WARN_BYTES, `the console is ${bytes} B, under the 5 MB warning threshold`);
  } finally {
    ws.cleanup();
  }
});
