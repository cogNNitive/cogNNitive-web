#!/usr/bin/env node

/**
 * nn-video-script/test/render-in-place.test.mjs
 *
 * Render contract (cognnitive-video-engine): render takes no output option, renders to
 * E/build/render.tmp.mp4 and renames it over E/<slug>_1920x1920.mp4 only on success;
 * compile has no --output/--out. Offline: the HyperFrames runner is injected.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { masterPath } from '../scripts/finalize-video.mjs';
import { renderVideo, VideoRenderError } from '../scripts/video-engine-cli.mjs';

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) {
  delete process.env[k];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, '..', 'scripts', 'video-engine-cli.mjs');

const script = `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: "video-script_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
title: "Neural Network Demo!"
---

# NN index

* [[Video]]
  * [[Scene]]
    * [[Layer]]

# NN Video

## NN Video: Neural Network Demo!
slug:: nn-demo
title:: Neural Network Demo!

# NN Scene

## NN Scene: Overview
slug:: overview
transition:: none

Learn how neural networks process multidimensional input vectors today
`;

function makeEpisode() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-in-place-'));
  const scriptPath = path.join(dir, 'script.md');
  fs.writeFileSync(scriptPath, script, 'utf8');
  return { dir, scriptPath, master: path.join(dir, 'nn-demo_1920x1920.mp4'), tmp: path.join(dir, 'build', 'render.tmp.mp4') };
}

const base = (ep) => ({ scriptPath: ep.scriptPath, cacheDir: path.join(ep.dir, 'cache'), synthesizeAssets: false });
const cli = (args, env = {}) =>
  spawnSync('node', [cliPath, ...args], { encoding: 'utf8', env: { ...process.env, NN_HYPERFRAMES_DISABLE: '1', ...env } });

// (a) render without --output is accepted and writes the master in place.
{
  const ep = makeEpisode();
  const res = cli(['render', ep.scriptPath, '--allow-mock', '--cache-dir', path.join(ep.dir, 'cache')]);
  assert.strictEqual(res.status, 0, `render without --output must be accepted: ${res.stderr}`);
  assert.ok(fs.existsSync(ep.master), 'the master is written in the episode folder');
  assert.ok(!fs.existsSync(ep.tmp), 'no render.tmp.mp4 is left behind');
  assert.strictEqual(masterPath(ep.dir), ep.master, 'the master is named from the Video slug, not the title; finalize finds it');
  console.log('✔ render accepts no --output and writes <slug>_1920x1920.mp4 in place');
}

// (b) success: the renderer targets build/render.tmp.mp4, then it is renamed over the master.
{
  const ep = makeEpisode();
  fs.writeFileSync(ep.master, 'previous-master');
  let target = null;
  let masterDuringRender = null;
  const result = await renderVideo({
    ...base(ep),
    hyperframesRun: async (_cmd, args) => {
      target = args[args.indexOf('--output') + 1];
      masterDuringRender = fs.readFileSync(ep.master, 'utf8');
      fs.writeFileSync(target, 'new-master');
      return { status: 0 };
    },
  });
  assert.strictEqual(path.resolve(target), ep.tmp, 'the renderer writes build/render.tmp.mp4');
  assert.strictEqual(masterDuringRender, 'previous-master', 'the previous master is intact while rendering');
  assert.strictEqual(fs.readFileSync(ep.master, 'utf8'), 'new-master');
  assert.ok(!fs.existsSync(ep.tmp), 'render.tmp.mp4 was renamed away');
  assert.strictEqual(result.outputVideoPath, ep.master);
  console.log('✔ a successful render goes through render.tmp.mp4 and renames over the master');
}

// (c) failure: a previous master stays byte-identical; with none, no master appears.
for (const previous of ['previous-master', null]) {
  const ep = makeEpisode();
  if (previous) fs.writeFileSync(ep.master, previous);
  await assert.rejects(
    renderVideo({
      ...base(ep),
      hyperframesRun: async (_cmd, args) => {
        fs.writeFileSync(args[args.indexOf('--output') + 1], 'half-written');
        return { status: 1, stderr: 'boom' };
      },
    }),
    (err) => err instanceof VideoRenderError,
  );
  if (previous) assert.strictEqual(fs.readFileSync(ep.master, 'utf8'), previous, 'the previous master is untouched');
  else assert.ok(!fs.existsSync(ep.master), 'no half-written master');
  assert.ok(!fs.existsSync(ep.tmp), 'the partial temp file is removed');
}
console.log('✔ a failed render leaves the previous master untouched and no partial file');

// A manifest without the Video slug is refused: no silent fallback to compositionId.
{
  const ep = makeEpisode();
  const manifestPath = path.join(ep.dir, 'm.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ compositionId: 'x-title', metadata: { buildDir: path.join(ep.dir, 'build') } }));
  await assert.rejects(renderVideo({ manifestPath }), /slug/i);
  assert.deepStrictEqual(fs.readdirSync(ep.dir).filter((f) => f.endsWith('.mp4')), []);
  console.log('✔ a missing Video slug is a clear error');
}

// (d) the removed options fail loudly, and the usage does not list them.
for (const [command, flag] of [['compile', '--output'], ['compile', '--out'], ['render', '--output'], ['render', '--out']]) {
  const ep = makeEpisode();
  const res = cli([command, ep.scriptPath, flag, path.join(ep.dir, 'x'), '--allow-mock']);
  assert.notStrictEqual(res.status, 0, `${command} ${flag} must exit non-zero`);
  assert.match(res.stderr, new RegExp(`Unknown option ${flag}\\b`));
  assert.ok(!/--out(put)?[ =\]]/.test(res.stderr.split('\n').slice(1).join('\n')), 'usage must not list --output/--out');
}
console.log('✔ compile/render refuse --output and --out');

console.log('\nAll render-in-place tests passed.');
