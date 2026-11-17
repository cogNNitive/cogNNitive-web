#!/usr/bin/env node

/**
 * nn-conntent/test/native-formats.test.mjs
 *
 * Native per-format rendering (spec S1, S3, S7, S8; tracker odd/tasks/native-format-rendering.md):
 *   - every entry of `output_formats` is compiled into its own HyperFrames project
 *     `hyperframes/<W>x<H>/` with its own manifest, and all manifests share one timeline;
 *   - assets are synthesized once; the format passes never call a provider;
 *   - each format renders to `<slug>_<W>x<H>.mp4` at the episode root, the first entry is
 *     the primary output, and no MP4 lands inside `hyperframes/`;
 *   - the animatic is one project in the primary aspect.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { compileVideo } from '../scripts/lib/compile.mjs';
import { renderVideo } from '../scripts/lib/render.mjs';
import { renderAnimatic } from '../scripts/lib/animatic.mjs';
import { AssetSynthesizer } from '../scripts/asset-synthesizer.mjs';
import { runHyperframesCheck } from '../scripts/hyperframes-render.mjs';

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) {
  delete process.env[k];
}

const SAMPLE = `---
level: 3
title: "Native formats"
---

# NN Video

## NN Video: Native formats
slug:: native
title:: Native formats

# NN Scene

## NN Scene: One
slug:: one

one two three four five

### NN Layer: One background
slug:: one-bg
type:: background
asset:: media/bg.png

# NN Scene

## NN Scene: Two
slug:: two

six seven eight nine ten eleven twelve
`;

const THREE = ['1920x1080', '1080x1920', '1080x1080'];
const bagsFor = (formats = THREE, extra = {}) => ({
  blueprint: { output_formats: formats, fit: 'cover', transition: 'none', ...extra },
});

// A PNG signature + IHDR (1920x1080).
const PNG_1920x1080 = Buffer.from('89504e470d0a1a0a0000000d4948445200000780000004380802000000', 'hex');

const fakeGsap = path.join(os.tmpdir(), `nn-gsap-native-${process.pid}.js`);
fs.writeFileSync(fakeGsap, '/* gsap */');

function fixture(doc = SAMPLE) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-native-formats-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  const series = path.join(root, 'series', 's');
  const episode = path.join(series, 'episodes', 'e');
  fs.mkdirSync(path.join(episode, 'media'), { recursive: true });
  fs.writeFileSync(
    path.join(series, 's_coNNtent_NN.md'),
    '---\nlevel: 3\nscope: true\ntitle: "S"\n---\n\n# NN Series\n\n## NN Series: S\nslug:: s\n',
    'utf8',
  );
  fs.writeFileSync(path.join(episode, 'media', 'bg.png'), PNG_1920x1080);
  const scriptPath = path.join(episode, 'e_coNNtent_NN.md');
  fs.writeFileSync(scriptPath, doc, 'utf8');
  return { root, episode, scriptPath, cacheDir: path.join(root, 'cache') };
}

const done = (dir) => fs.rmSync(dir, { recursive: true, force: true });
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** The shared timeline of a manifest: everything except the canvas. */
const timeline = (m) => ({
  fps: m.fps,
  totalDurationInFrames: m.totalDurationInFrames,
  scenes: m.tracks.scenes.map((s) => [s.id, s.fromFrame, s.durationInFrames]),
  audio: m.tracks.audio.map((a) => [a.id || a.kind, a.fromFrame, a.durationInFrames]),
  overlays: (m.tracks.overlays || []).map((o) => [o.id, o.fromFrame, o.durationInFrames]),
});

test('compile emits one project and one manifest per output format, sharing one timeline', async () => {
  const ep = fixture();
  try {
    const res = await compileVideo({ scriptPath: ep.scriptPath, bags: bagsFor(), synthesizeAssets: false, cacheDir: ep.cacheDir });
    assert.deepEqual(
      res.manifests.map((m) => `${m.width}x${m.height}`),
      THREE,
      'one manifest per declared format, in order',
    );
    assert.equal(res.manifest, res.manifests[0], 'the primary manifest is the first format');
    for (const size of THREE) {
      const [w, h] = size.split('x').map(Number);
      const dir = path.join(ep.episode, 'hyperframes', size);
      const manifest = readJson(path.join(dir, 'manifest.json'));
      assert.equal(manifest.width, w);
      assert.equal(manifest.height, h);
      assert.equal(path.resolve(manifest.metadata.hyperframesDir), path.resolve(dir));
      assert.equal(path.resolve(manifest.metadata.episodeDir), path.resolve(ep.episode));
      assert.ok(fs.existsSync(path.join(dir, 'assets')), `${size} stages its own assets`);
      assert.deepEqual(timeline(manifest), timeline(res.manifests[0]), `${size} shares the timeline`);
    }
    assert.equal(fs.existsSync(path.join(ep.episode, 'hyperframes', 'manifest.json')), false, 'no single-canvas manifest');
  } finally {
    done(ep.root);
  }
});

test('a cascade that declares one format compiles exactly one project', async () => {
  const ep = fixture();
  try {
    const res = await compileVideo({
      scriptPath: ep.scriptPath,
      bags: bagsFor(['1080x1920']),
      synthesizeAssets: false,
      cacheDir: ep.cacheDir,
    });
    assert.deepEqual(res.manifests.map((m) => `${m.width}x${m.height}`), ['1080x1920']);
    assert.deepEqual(fs.readdirSync(path.join(ep.episode, 'hyperframes')), ['1080x1920']);
  } finally {
    done(ep.root);
  }
});

test('an output format that is not <W>x<H> fails before anything is written', async () => {
  const ep = fixture();
  try {
    await assert.rejects(
      compileVideo({ scriptPath: ep.scriptPath, bags: bagsFor(['1920x1080', 'square']), synthesizeAssets: false, cacheDir: ep.cacheDir }),
      /unsupported-output-format: "square"/,
    );
    assert.equal(fs.existsSync(path.join(ep.episode, 'hyperframes')), false);
  } finally {
    done(ep.root);
  }
});

test('narration is synthesized once: the format passes never call a provider', async () => {
  // Every provider entry point of the synthesizer is counted; the cache starts cold, so a
  // second synthesis of the same narration would show up as more calls.
  const counted = ['synthesizeTTS', 'resolveMedia', '_runWaveSpeedJob', '_runReplicateImageJob', '_resolveTalkingAvatar'];
  const calls = {};
  const originals = Object.fromEntries(counted.map((name) => [name, AssetSynthesizer.prototype[name]]));
  for (const name of counted) {
    AssetSynthesizer.prototype[name] = function (...args) {
      calls[name] = (calls[name] || 0) + 1;
      return originals[name].apply(this, args);
    };
  }
  const runs = {};
  try {
    for (const formats of [['1920x1080'], THREE]) {
      for (const k of Object.keys(calls)) delete calls[k];
      const ep = fixture();
      try {
        const res = await compileVideo({ scriptPath: ep.scriptPath, bags: bagsFor(formats), cacheDir: ep.cacheDir });
        runs[formats.length] = {
          calls: { ...calls },
          synthesized: res.newAssetsSynthesized,
          audio: res.manifests.map((m) => JSON.stringify(m.tracks.audio.map((a) => [a.assetPath ? 1 : 0, a.fromFrame, a.durationInFrames]))),
        };
      } finally {
        done(ep.root);
      }
    }
  } finally {
    for (const name of counted) AssetSynthesizer.prototype[name] = originals[name];
  }
  assert.ok(runs[1].calls.synthesizeTTS > 0, 'the narration was synthesized (the test is not vacuous)');
  assert.ok(runs[1].synthesized > 0, 'one format synthesized its narration');
  assert.deepEqual(runs[3].calls, runs[1].calls, 'three formats make exactly the synthesizer calls of one');
  assert.equal(runs[3].synthesized, runs[1].synthesized, 'three formats synthesize exactly what one does');
  assert.equal(runs[3].audio.length, 3);
  assert.equal(new Set(runs[3].audio).size, 1, 'every format carries the same narration timing');
});

test('render writes <slug>_<W>x<H>.mp4 per format at the episode root, primary first', async () => {
  const ep = fixture();
  try {
    const projects = [];
    const result = await renderVideo({
      scriptPath: ep.scriptPath,
      bags: bagsFor(),
      cacheDir: ep.cacheDir,
      synthesizeAssets: false,
      gsapPath: fakeGsap,
      hyperframesRun: async (_cmd, args) => {
        const target = args[args.indexOf('--output') + 1];
        projects.push(path.dirname(target));
        fs.writeFileSync(target, `mp4 ${path.basename(path.dirname(target))}`);
        return { status: 0 };
      },
    });
    const names = THREE.map((size) => `native_${size}.mp4`);
    assert.deepEqual(result.outputs.map((o) => path.basename(o.path)), names);
    assert.deepEqual(result.outputs.map((o) => o.format), THREE);
    assert.equal(result.outputVideoPath, path.join(ep.episode, names[0]), 'the primary output is the first format');
    assert.deepEqual(projects.map((p) => path.relative(ep.episode, p).split(path.sep).join('/')), THREE.map((s) => `hyperframes/${s}`));
    assert.deepEqual(fs.readdirSync(ep.episode).filter((f) => f.endsWith('.mp4')).sort(), [...names].sort());
    for (const size of THREE) {
      assert.equal(fs.readFileSync(path.join(ep.episode, `native_${size}.mp4`), 'utf8'), `mp4 ${size}`);
      const leftovers = fs.readdirSync(path.join(ep.episode, 'hyperframes', size)).filter((f) => f.endsWith('.mp4'));
      assert.deepEqual(leftovers, [], `no MP4 inside hyperframes/${size}`);
    }
  } finally {
    done(ep.root);
  }
});

test('copy mode keeps every later format staged until that format has rendered', async () => {
  const ep = fixture();
  try {
    const seen = [];
    await renderVideo({
      scriptPath: ep.scriptPath,
      bags: bagsFor(),
      cacheDir: ep.cacheDir,
      synthesizeAssets: false,
      gsapPath: fakeGsap,
      stageDeps: { link: () => { const e = new Error('cross-device'); e.code = 'EXDEV'; throw e; } },
      hyperframesRun: async (_cmd, args) => {
        const target = args[args.indexOf('--output') + 1];
        const project = path.dirname(target);
        const staged = fs.readdirSync(path.join(project, 'assets')).filter((f) => f.endsWith('.png'));
        seen.push([path.basename(project), staged.length]);
        fs.writeFileSync(target, 'mp4');
        return { status: 0 };
      },
    });
    assert.deepEqual(seen, THREE.map((s) => [s, 1]), 'each format still had its asset when it rendered');
    for (const size of THREE) {
      assert.equal(fs.existsSync(path.join(ep.episode, 'hyperframes', size, 'assets')), false, `${size} cleaned up after its own render`);
    }
  } finally {
    done(ep.root);
  }
});

test('the frame is emitted into each format project, never a nested hyperframes/', async () => {
  const ep = fixture(SAMPLE.replace('title:: Native formats', 'title:: Native formats\nframe:: plain'));
  try {
    const frameDir = path.join(ep.root, 'library', 'frames', 'plain');
    fs.mkdirSync(frameDir, { recursive: true });
    fs.writeFileSync(path.join(frameDir, 'FRAME.md'), '---\nname: plain\n---\n\n## Palette\n\n- primary: #112233\n', 'utf8');
    await compileVideo({ scriptPath: ep.scriptPath, bags: bagsFor(THREE, { frame: 'plain' }), synthesizeAssets: false, cacheDir: ep.cacheDir });
    for (const size of THREE) {
      assert.ok(fs.existsSync(path.join(ep.episode, 'hyperframes', size, 'frame.md')), `${size}/frame.md`);
      assert.equal(fs.existsSync(path.join(ep.episode, 'hyperframes', size, 'hyperframes')), false, `no hyperframes/${size}/hyperframes/`);
    }
  } finally {
    done(ep.root);
  }
});

test('the animatic is one project in the primary aspect, its MP4 at the episode root', async () => {
  const ep = fixture();
  try {
    let project = null;
    const result = await renderAnimatic({
      scriptPath: ep.scriptPath,
      primaryWidth: 1080,
      primaryHeight: 1920,
      bags: bagsFor(['1080x1920', '1920x1080']),
      cacheDir: ep.cacheDir,
      synthesizeAssets: false,
      gsapPath: fakeGsap,
      hyperframesRun: async (_cmd, args) => {
        const target = args[args.indexOf('--output') + 1];
        project = path.dirname(target);
        fs.writeFileSync(target, 'animatic');
        return { status: 0 };
      },
    });
    assert.equal(path.basename(project), 'animatic', 'the animatic project is hyperframes/animatic/');
    assert.equal(result.outputVideoPath, path.join(ep.episode, 'native_animatic_640x1138.mp4'));
    assert.equal(result.outputs.length, 1, 'one animatic, never one per format');
    assert.deepEqual(fs.readdirSync(path.join(ep.episode, 'hyperframes')).sort(), ['animatic']);
  } finally {
    done(ep.root);
  }
});

test('hyperframes check runs the pinned CLI on a format project and fails closed', async () => {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-hf-check-'));
  try {
    fs.writeFileSync(path.join(project, 'index.html'), '<div></div>');
    let ran = null;
    const ok = await runHyperframesCheck({ projectDir: project }, {
      run: async (cmd, args) => {
        ran = { cmd, args };
        return { status: 0, stdout: '{"ok":true}' };
      },
    });
    assert.equal(ok.ok, true);
    assert.match(String(ran.cmd), /node_modules[\\/]\.bin[\\/]hyperframes(\.cmd)?$/, 'the pinned CLI, never npx');
    assert.deepEqual(ran.args, ['check', '--json', path.resolve(project)]);

    const failed = await runHyperframesCheck({ projectDir: project }, {
      run: async () => ({ status: 1, stdout: 'outside_safe_zone' }),
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.reason, 'hyperframes-check-exit-1');
    assert.match(failed.detail, /outside_safe_zone/);

    const missing = await runHyperframesCheck({ projectDir: project }, { cliPath: path.join(project, 'no-such-cli') });
    assert.deepEqual(missing, { ok: false, reason: 'hyperframes-missing' });
  } finally {
    done(project);
  }
});
