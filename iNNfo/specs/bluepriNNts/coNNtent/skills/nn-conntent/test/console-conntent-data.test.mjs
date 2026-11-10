/**
 * nn-conntent/test/console-conntent-data.test.mjs
 *
 * The unified console data module: Domain -> Series -> Episode, the pending inbox with
 * re-open causes, every field with its effective value and source level, and hashes that
 * match the engine (capability conntent-domain-console; design D-C3; tasks 4b.1/4b.2).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path';
import { fileURLToPath } from 'node:url'

import { collect } from '../../../assets/console-view-conntent.data.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BP = path.resolve(HERE, '..')

const SERIES = `---
level: 3
scope: true
parent_spec:
  name: "coNNtent_V_0-17-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
title: "Probe Series"
---

# NN Series

## NN Series: S
slug:: s
language:: es
voice:: series-voice
`

const EPISODE = `---
level: 3
parent_spec:
  name: "coNNtent_V_0-17-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
blueprint_version: "V_0-17-0"
title: "Probe episode"
---

# NN Video

## NN Video: Probe
slug:: e
title:: Probe
status:: draft
review_gates:: [script]
output_formats:: [1920x1920]

# NN Scene

## NN Scene: One
slug:: one
kind:: Libre

one two three four five six seven eight nine ten
`

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-conntent-data-'))
  fs.writeFileSync(
    path.join(root, 'domaiNN_NN.md'),
    '---\nname: "Probe"\nworkspace_id: "probe"\n---\n\n# NN DomaiNN\n',
    'utf8',
  )
  const seriesDir = path.join(root, 'series', 's')
  const episodeDir = path.join(seriesDir, 'episodes', 'e')
  fs.mkdirSync(episodeDir, { recursive: true })
  fs.writeFileSync(path.join(seriesDir, 's_coNNtent_NN.md'), SERIES, 'utf8')
  fs.writeFileSync(path.join(episodeDir, 'e_coNNtent_NN.md'), EPISODE, 'utf8')
  fs.mkdirSync(path.join(root, 'changes'), { recursive: true })
  return { root, seriesDir, episodeDir, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
}

test('the data module builds Domain -> Series -> Episode', async () => {
  const ws = workspace()
  try {
    const data = await collect({ rootDir: ws.root })
    assert.equal(data.tree.series.length, 1)
    assert.equal(data.tree.series[0].slug, 's')
    assert.equal(data.tree.series[0].title, 'Probe Series')
    assert.equal(data.tree.series[0].episodes.length, 1)
    const episode = data.tree.series[0].episodes[0]
    assert.equal(episode.slug, 'e')
    assert.equal(episode.modelId, 's/e')
    assert.equal(episode.language, 'es')
    assert.equal(episode.reviewGates[0], 'script')
  } finally {
    ws.cleanup()
  }
});

test('every field carries its effective value and source level', async () => {
  const ws = workspace()
  try {
    const episode = (await collect({ rootDir: ws.root })).tree.series[0].episodes[0]
    assert.equal(episode.scenes.length, 1)
    const voice = episode.scenes[0].fields.voice
    assert.equal(voice.value, 'series-voice')
    assert.equal(voice.source, 'series')
    assert.equal(episode.scenes[0].fields.language.value, 'es')
  } finally {
    ws.cleanup()
  }
});

test('the pending inbox lists every open gate with its scene', async () => {
  const ws = workspace()
  try {
    const data = await collect({ rootDir: ws.root })
    assert.equal(data.pending.length, 1)
    assert.equal(data.pending[0].episode, 'e')
    assert.equal(data.pending[0].gate, 'script')
    assert.equal(data.pending[0].scene, 'one')
    assert.equal(data.pending[0].state, 'open')
  } finally {
    ws.cleanup()
  }
});

test('the scene hashes are the engine hashes and change with the narration', async () => {
  const ws = workspace()
  try {
    const before = (await collect({ rootDir: ws.root })).tree.series[0].episodes[0]
    assert.match(before.scenes[0].scriptHash, /^[0-9a-f]{64}$/)
    assert.equal(before.scenes[0].previewHash, null, 'preview is off in review_gates')

    fs.writeFileSync(
      path.join(ws.episodeDir, 'e_coNNtent_NN.md'),
      EPISODE.replace('one two three four five six seven eight nine ten', 'one two three four five six seven eight nine eleven'),
      'utf8',
    )
    const after = (await collect({ rootDir: ws.root })).tree.series[0].episodes[0]
    assert.notEqual(after.scenes[0].scriptHash, before.scenes[0].scriptHash)
  } finally {
    ws.cleanup()
  }
});

test('a translation is flagged stale on the scenes whose original changed', async () => {
  const ws = workspace()
  try {
    const translationDir = path.join(ws.seriesDir, 'episodes', 'tr')
    fs.mkdirSync(translationDir, { recursive: true })
    fs.writeFileSync(
      path.join(translationDir, 'tr_coNNtent_NN.md'),
      `---
level: 3
parent_spec:
  name: "coNNtent_V_0-17-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
blueprint_version: "V_0-17-0"
title: "Translation"
---

# NN Video

## NN Video: Translation
slug:: tr
title:: Translation
status:: draft
review_gates:: [script]
output_formats:: [1920x1920]
translation_of:: e
language:: en

# NN Scene

## NN Scene: One
slug:: one
kind:: Libre

uno dos tres cuatro cinco seis siete ocho nueve diez
`,
      'utf8',
    );
    const originalHash = (await collect({ rootDir: ws.root })).tree.series[0].episodes.find(
      (episode) => episode.slug === 'e',
    ).scenes[0].scriptHash;
    const record = {
      scenes: { one: { script: { subject: { source: { scene: 'one', hash: originalHash } } } } },
    };
    fs.mkdirSync(path.join(ws.root, '.cognnitive', 'video', 'reviews'), { recursive: true });
    fs.writeFileSync(
      path.join(ws.root, '.cognnitive', 'video', 'reviews', 's__tr.json'),
      JSON.stringify(record),
      'utf8',
    );

    const unchanged = (await collect({ rootDir: ws.root })).tree.series[0].episodes.find(
      (episode) => episode.slug === 'tr',
    );
    assert.equal(unchanged.scenes[0].stale, undefined, 'nothing changed, nothing is stale');

    fs.writeFileSync(
      path.join(ws.episodeDir, 'e_coNNtent_NN.md'),
      EPISODE.replace('one two three four five six seven eight nine ten', 'one two three four five six seven eight nine ELEVEN'),
      'utf8',
    );
    const stale = (await collect({ rootDir: ws.root })).tree.series[0].episodes.find(
      (episode) => episode.slug === 'tr',
    );
    assert.equal(stale.scenes[0].stale, true, 'the original scene changed');
    assert.deepEqual(stale.staleScenes, ['one'], 'the flag names the scene');
  } finally {
    ws.cleanup();
  }
});

test('a delivered episode reports its versions, path, contents and delivery page', async () => {
  const ws = workspace()
  try {
    fs.mkdirSync(path.join(ws.episodeDir, 'deliveries', 'v1'), { recursive: true })
    fs.writeFileSync(
      path.join(ws.episodeDir, 'deliveries', 'v1', 'delivery.json'),
      JSON.stringify({ version: 'v1', outputs_hash: 'x', input_fingerprint: 'y', files: [] }),
      'utf8',
    );
    fs.writeFileSync(path.join(ws.episodeDir, 'deliveries', 'v1', 'e_1920x1920.mp4'), 'bytes', 'utf8');
    fs.writeFileSync(path.join(ws.episodeDir, 'deliveries', 'v1', 'e_delivery.html'), '<html></html>', 'utf8');
    fs.mkdirSync(path.join(ws.episodeDir, 'deliveries', 'v2'), { recursive: true });
    fs.writeFileSync(path.join(ws.episodeDir, 'deliveries', 'v2', 'e_1920x1920.mp4'), 'bytes', 'utf8');
    const episode = (await collect({ rootDir: ws.root })).tree.series[0].episodes[0];
    assert.deepEqual(
      episode.deliveries.map((d) => d.version),
      ['v2', 'v1'],
      'newest first',
    );
    assert.equal(episode.latestDelivery, 'v2');
    const v1 = episode.deliveries.find((d) => d.version === 'v1');
    assert.equal(v1.path, 'series/s/episodes/e/deliveries/v1');
    assert.deepEqual(v1.files, ['delivery.json', 'e_1920x1920.mp4', 'e_delivery.html']);
    assert.equal(v1.html, 'series/s/episodes/e/deliveries/v1/e_delivery.html');
    assert.equal(episode.deliveries.find((d) => d.version === 'v2').html, null);
  } finally {
    ws.cleanup();
  }
});
