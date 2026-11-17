#!/usr/bin/env node

/**
 * nn-conntent/test/render-in-place.test.mjs
 *
 * Render contract (cognnitive-video-engine): render takes no output option, renders each
 * format to E/hyperframes/<W>x<H>/render.tmp.mp4 and renames it over E/<slug>_<W>x<H>.mp4
 * only on success; compile has no --output/--out. Offline: the HyperFrames runner is
 * injected. The fixture declares one output format, so one output is rendered.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { renderVideo, VideoRenderError } from '../scripts/lib/render.mjs';

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) {
  delete process.env[k];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compileCliPath = path.join(__dirname, '..', 'scripts', 'lib', 'compile.mjs');
const renderCliPath = path.join(__dirname, '..', 'scripts', 'lib', 'render.mjs');

const script = `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: "coNNtent_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/coNNtent/spec_NN.md"
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
output_formats:: [1920x1080]

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
  return { dir, scriptPath, output: path.join(dir, 'nn-demo_1920x1080.mp4'), tmp: path.join(dir, 'hyperframes', '1920x1080', 'render.tmp.mp4') };
}

/** A stand-in for the pinned GSAP build: emission vendors it into `vendor/`. */
const fakeGsap = path.join(os.tmpdir(), `nn-gsap-inplace-${process.pid}.js`);
fs.writeFileSync(fakeGsap, '/* gsap */');

const base = (ep) => ({ scriptPath: ep.scriptPath, cacheDir: path.join(ep.dir, 'cache'), synthesizeAssets: false, gsapPath: fakeGsap });
const cli = (args, env = {}) =>
  spawnSync('node', [args[0] === 'compile' ? compileCliPath : renderCliPath, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NN_HYPERFRAMES_DISABLE: '1', ...env },
  });

// (a) render without --output is accepted and writes the output in place.
{
  const ep = makeEpisode();
  const res = cli(['render', ep.scriptPath, '--allow-mock', '--cache-dir', path.join(ep.dir, 'cache')]);
  assert.strictEqual(res.status, 0, `render without --output must be accepted: ${res.stderr}`);
  assert.ok(fs.existsSync(ep.output), 'the output is written in the episode folder');
  assert.ok(!fs.existsSync(ep.tmp), 'no render.tmp.mp4 is left behind');
  assert.deepStrictEqual(
    fs.readdirSync(ep.dir).filter((f) => f.endsWith('.mp4')),
    ['nn-demo_1920x1080.mp4'],
    'the output is named from the Video slug and its format, not the title',
  );
  console.log('✔ render accepts no --output and writes <slug>_1920x1080.mp4 in place');
}

// (b) success: the renderer targets hyperframes/<W>x<H>/render.tmp.mp4, then it is renamed over the output.
{
  const ep = makeEpisode();
  fs.writeFileSync(ep.output, 'previous-output');
  let target = null;
  let outputDuringRender = null;
  const result = await renderVideo({
    ...base(ep),
    hyperframesRun: async (_cmd, args) => {
      target = args[args.indexOf('--output') + 1];
      outputDuringRender = fs.readFileSync(ep.output, 'utf8');
      fs.writeFileSync(target, 'new-output');
      return { status: 0 };
    },
  });
  assert.strictEqual(path.resolve(target), ep.tmp, 'the renderer writes hyperframes/<W>x<H>/render.tmp.mp4');
  assert.strictEqual(outputDuringRender, 'previous-output', 'the previous output is intact while rendering');
  assert.strictEqual(fs.readFileSync(ep.output, 'utf8'), 'new-output');
  assert.ok(!fs.existsSync(ep.tmp), 'render.tmp.mp4 was renamed away');
  assert.strictEqual(result.outputVideoPath, ep.output);
  console.log('✔ a successful render goes through render.tmp.mp4 and renames over the output');
}

// (c) failure: a previous output stays byte-identical; with none, no output appears.
for (const previous of ['previous-output', null]) {
  const ep = makeEpisode();
  if (previous) fs.writeFileSync(ep.output, previous);
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
  if (previous) assert.strictEqual(fs.readFileSync(ep.output, 'utf8'), previous, 'the previous output is untouched');
  else assert.ok(!fs.existsSync(ep.output), 'no half-written output');
  assert.ok(!fs.existsSync(ep.tmp), 'the partial temp file is removed');
}
console.log('✔ a failed render leaves the previous output untouched and no partial file');

// A manifest without the Video slug is refused: no silent fallback to compositionId.
{
  const ep = makeEpisode();
  const manifestPath = path.join(ep.dir, 'm.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ compositionId: 'x-title', metadata: { hyperframesDir: path.join(ep.dir, 'hyperframes') } }));
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
