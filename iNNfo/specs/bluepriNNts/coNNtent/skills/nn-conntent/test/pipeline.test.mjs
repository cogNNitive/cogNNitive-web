#!/usr/bin/env node

/**
 * nn-conntent/test/pipeline.test.mjs
 *
 * Slice 3b-2.2: the stage order lives in `lib/pipeline.mjs` and `produce.mjs` is a CLI
 * over it. Slice 4c.4 (capability console-regeneration, "Regeneration after every engine
 * exit"): the pipeline regenerates the domaiNN console through the one shared writer in a
 * `finally`, after every engine write, with `open` true only for an exit that needs a
 * human (10, 11, 12); a regeneration failure never changes the exit code.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { EXIT_BUDGET, EXIT_DONE, EXIT_QA, EXIT_REVIEW, ProduceStop, produce } from '../scripts/lib/pipeline.mjs';
import { readEpisode } from '../scripts/lib/episode.mjs';

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) delete process.env[k];

// These tests assert when the pipeline asks the writer to open the console, so they must not
// inherit `INNFO_CONSOLE_NO_OPEN` from the caller (`scripts/verify.js` sets it for every suite).
// The writer is always injected here, so nothing real is opened.
delete process.env.INNFO_CONSOLE_NO_OPEN;

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLUEPRINT = path.resolve(SKILL, '..', '..');
const read = (rel) => fs.readFileSync(path.join(SKILL, rel), 'utf8');

const SCENE = `# NN Scene

## NN Scene: One
slug:: one
kind:: Libre

one two three four five six seven eight nine ten
`;

const episodeDoc = ({ status = 'draft', budget = '1.5', review = 'skip', pin = 'V_0-19-0' } = {}) => `---
level: 3
parent_spec:
  name: "coNNtent_V_0-19-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "${pin}"
title: "Probe episode"
---

# NN Video

## NN Video: Probe
slug:: e
title:: Probe
status:: ${status}${budget === null ? '' : `\nbudget:: ${budget}`}
review_gates:: ${review === 'off' ? '[]' : review === 'preview' ? '[preview]' : review === 'skip' ? '[]' : '[script, preview]'}
output_formats:: [1920x1920]

${SCENE}`;

function workspace(doc = episodeDoc()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-pipeline-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '---\nname: "Probe"\nworkspace_id: "probe"\n---\n\n# NN DomaiNN\n', 'utf8');
  fs.mkdirSync(path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'V_0-19-0'), { recursive: true });
  fs.copyFileSync(
    path.join(BLUEPRINT, 'spec_NN.md'),
    path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'spec_NN.md'),
  );
  fs.copyFileSync(
    path.join(BLUEPRINT, 'spec_NN.md'),
    path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'V_0-19-0', 'spec_NN.md'),
  );
  fs.copyFileSync(path.join(BLUEPRINT, 'defaults', 'video-defaults_NN.md'), path.join(root, 'video-defaults_NN.md'));
  fs.mkdirSync(path.join(root, 'changes'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'specs', 'defiNNe_V_0-1-0_NN.md'),
    '---\nspec_version: "V_0-1-0"\nlevel: 0\ntitle: "L0"\n---\n\n# NN DefiNNition\n',
    'utf8',
  );
  const seriesDir = path.join(root, 'series', 's');
  const episode = path.join(seriesDir, 'episodes', 'e');
  fs.mkdirSync(episode, { recursive: true });
  fs.writeFileSync(
    path.join(seriesDir, 's_coNNtent_NN.md'),
    '---\nlevel: 3\nscope: true\nparent_spec:\n  name: "coNNtent_V_0-15-1"\n  url: "https://example.invalid/coNNtent/spec_NN.md"\ntitle: "S"\n---\n\n# NN Series\n\n## NN Series: S\nslug:: s\nlanguage:: es\n',
    'utf8',
  );
  const scriptPath = path.join(episode, 'e_coNNtent_NN.md');
  fs.writeFileSync(scriptPath, doc, 'utf8');
  return { root, episode, scriptPath };
}

const done = (dir) => fs.rmSync(dir, { recursive: true, force: true });

/** A render seam: writes the master, the manifest and the index the overlay QA reads. */
function fakeRender({ indexHtml } = {}) {
  return async (opts) => {
    const dir = path.dirname(opts.scriptPath);
    const master = path.join(dir, 'probe_1920x1920.mp4');
    fs.writeFileSync(master, 'master-bytes');
    const hyperframesDir = path.join(dir, 'hyperframes');
    fs.mkdirSync(hyperframesDir, { recursive: true });
    const manifest = {
      fps: 30,
      tracks: {
        scenes: [{ id: 'scene_one', slug: 'one', fromFrame: 0, props: { title: 'Opening', layers: [] } }],
        overlays: [],
      },
      metadata: { scriptSource: opts.scriptPath },
    };
    fs.writeFileSync(path.join(hyperframesDir, 'manifest.json'), JSON.stringify(manifest));
    if (indexHtml !== null) {
      fs.writeFileSync(
        path.join(hyperframesDir, 'index.html'),
        indexHtml || '<!doctype html><html><body><div id="root"></div></body></html>',
      );
    }
    return { outputVideoPath: master, renderTimeMs: 1, linkMode: 'link', spentUsd: 0.25 };
  };
}

const thumbStubs = () => ({
  thumbnailBase: 'first-frame.png',
  renderThumbnails: async ({ episodeDir, slug }) => [{ path: path.join(episodeDir, slug + '_thumbnail_stub.png') }],
  qa: {
    qaMaster: async () => ({ ok: true, checks: [] }),
    qaOutputSet: async () => ({ ok: true, checks: [] }),
  },
});

/** An injected writer that records every regeneration and can read the engine state. */
function recorder(scriptPath) {
  const calls = [];
  const writeConsole = async (opts) => {
    calls.push({ ...opts, doc: fs.readFileSync(scriptPath, 'utf8') });
    return { status: 'unchanged', path: path.join(opts.rootDir, 'domaiNN_console.html'), opened: opts.open };
  };
  return { calls, writeConsole };
}

const stopOf = async (promise) =>
  promise.then(
    (result) => {
      throw new Error(`expected a ProduceStop, got ${JSON.stringify(result)}`);
    },
    (err) => {
      assert.ok(err instanceof ProduceStop, `expected a ProduceStop, got ${err?.name}: ${err?.message}`);
      return err;
    },
  );

test('the stage order lives in lib/pipeline.mjs and produce.mjs is a CLI over it', () => {
  const pipeline = read('scripts/lib/pipeline.mjs');
  const cli = read('scripts/produce.mjs');

  assert.match(pipeline, /export async function produce/, 'the pipeline exports produce');
  assert.match(pipeline, /finally\s*\{/, 'the pipeline owns the finally');
  assert.match(pipeline, /regenerateOnExit/, 'the finally regenerates the console');
  assert.match(cli, /from '\.\/lib\/pipeline\.mjs'/, 'produce.mjs is a CLI over the pipeline');
  assert.doesNotMatch(cli, /synthesizeEpisodeAssets|renderEpisodeThumbnails/, 'no stage body is left in the CLI');
});

test('a gate stop regenerates the console and opens it (exit 10)', async () => {
  const ws = workspace(episodeDoc({ review: 'required' }));
  const { calls, writeConsole } = recorder(ws.scriptPath);
  try {
    const err = await stopOf(produce({ episodePath: ws.scriptPath, deps: { writeConsole, ...thumbStubs(), log: () => {} } }));
    assert.equal(err.exitCode, EXIT_REVIEW);
    assert.equal(calls.length, 1, 'exactly one regeneration');
    assert.equal(calls[0].rootDir, ws.root, 'the domain root is the target');
    assert.equal(calls[0].scope, 'domain', 'the domaiNN console is regenerated');
    assert.equal(calls[0].open, true, 'a gate stop opens the console');
  } finally {
    done(ws.root);
  }
});

test('a spend stop regenerates after the engine wrote status:: approved (exit 11)', async () => {
  const ws = workspace(episodeDoc({ budget: null }));
  const { calls, writeConsole } = recorder(ws.scriptPath);
  try {
    const err = await stopOf(produce({ episodePath: ws.scriptPath, deps: { writeConsole, ...thumbStubs(), log: () => {} } }));
    assert.equal(err.exitCode, EXIT_BUDGET);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].open, true, 'a spend stop needs the human');
    assert.match(calls[0].doc, /status:: approved/, 'the writer runs after the lifecycle write');
  } finally {
    done(ws.root);
  }
});

test('a failed QA regenerates and opens (exit 12)', async () => {
  const ws = workspace(episodeDoc());
  const { calls, writeConsole } = recorder(ws.scriptPath);
  try {
    const err = await stopOf(
      produce({
        episodePath: ws.scriptPath,
        deps: {
          writeConsole,
          ...thumbStubs(),
          render: fakeRender(),
          qa: {
            qaMaster: async () => ({ ok: false, checks: [{ id: 'mock-fail', status: 'fail' }] }),
            qaOutputSet: async () => ({ ok: true, checks: [] }),
          },
          log: () => {},
        },
      }),
    );
    assert.equal(err.exitCode, EXIT_QA);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].open, true);
  } finally {
    done(ws.root);
  }
});

test('an autopilot run regenerates and does not open (exit 0)', async () => {
  const ws = workspace(episodeDoc());
  const { calls, writeConsole } = recorder(ws.scriptPath);
  try {
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: { writeConsole, ...thumbStubs(), render: fakeRender(), log: () => {} },
    });
    assert.equal(result.code, EXIT_DONE);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].open, false, 'a run with no open gate needs no browser');
    assert.match(calls[0].doc, /status:: delivered/, 'the writer runs after the delivery write');
  } finally {
    done(ws.root);
  }
});

test('--no-open and INNFO_CONSOLE_NO_OPEN=1 keep the browser closed on a gate stop', async () => {
  const ws = workspace(episodeDoc({ review: 'required' }));
  const first = recorder(ws.scriptPath);
  const second = recorder(ws.scriptPath);
  const previous = process.env.INNFO_CONSOLE_NO_OPEN;
  try {
    await stopOf(produce({ episodePath: ws.scriptPath, noOpen: true, deps: { writeConsole: first.writeConsole, log: () => {} } }));
    assert.equal(first.calls[0].open, false, '--no-open wins');

    process.env.INNFO_CONSOLE_NO_OPEN = '1';
    await stopOf(produce({ episodePath: ws.scriptPath, deps: { writeConsole: second.writeConsole, log: () => {} } }));
    assert.equal(second.calls[0].open, false, 'the environment flag wins');
  } finally {
    if (previous === undefined) delete process.env.INNFO_CONSOLE_NO_OPEN;
    else process.env.INNFO_CONSOLE_NO_OPEN = previous;
    done(ws.root);
  }
});

test('a regeneration failure keeps the exit code and is reported with the error', async () => {
  const ws = workspace(episodeDoc({ review: 'required' }));
  const lines = [];
  try {
    const err = await stopOf(
      produce({
        episodePath: ws.scriptPath,
        deps: {
          writeConsole: async () => {
            throw new Error('console assets not found');
          },
          log: (line) => lines.push(line),
        },
      }),
    );
    assert.equal(err.exitCode, EXIT_REVIEW, 'the gate exit code survives');
    assert.match(lines.join('\n'), /console/i, 'the failure is reported');
    assert.match(lines.join('\n'), /console assets not found/, 'the error text is reported');
  } finally {
    done(ws.root);
  }
});

test('the regeneration reflects the human changeset applied on start', async () => {
  const ws = workspace(episodeDoc());
  const { calls, writeConsole } = recorder(ws.scriptPath);
  try {
    fs.writeFileSync(
      path.join(ws.root, 'changes', 'ws_ana_1_changes_NN.md'),
      `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: changes
  url: "https://example.invalid/changes/spec_NN.md"
blueprint_version: "0.1.0"
status: proposed
title: "Human edit"
author_kind: human
origin: console
reviewer: Ana
---

# NN index

* [[Change]]

# NN Change

## NN Change: c-01
op:: update_field
target:: s/e@e&title
to:: Console title
evidence:: decision
`,
      'utf8',
    );
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: { writeConsole, ...thumbStubs(), render: fakeRender(), log: () => {} },
    });
    assert.equal(result.code, EXIT_DONE);
    assert.equal(readEpisode(ws.scriptPath).fields.title, 'Console title');
    assert.equal(calls.length, 1);
    assert.match(calls[0].doc, /title:: Console title/, 'the writer reads the applied state');
  } finally {
    done(ws.root);
  }
});
