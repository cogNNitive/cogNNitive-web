#!/usr/bin/env node

/**
 * nn-video-script/test/video-engine-cli.test.mjs
 *
 * Integration tests for video-engine-cli (HyperFrames renderer):
 * - CLI compilation of a script to a manifest
 * - Programmatic render through the HyperFrames driver seam
 * - CLI render with --allow-mock (CI placeholder)
 * - The removed preview command is refused
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { compileVideo, renderVideo } from '../scripts/video-engine-cli.mjs';

// Hermetic: a maintainer machine may export real provider keys. Tests must never reach a paid provider.
for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) {
  delete process.env[k];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, '..', 'scripts', 'video-engine-cli.mjs');
const CLI_SRC = fs.readFileSync(cliPath, 'utf8');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'video-engine-cli-test-'));
}

const sampleScript = `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: "video-script_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
title: "Neural Network Demo"
---

# NN index

* [[Video]]
  * [[Scene]]
    * [[Layer]]

# NN Video

## NN Video: Neural Network Demo
slug:: neural-network-demo
title:: Neural Network Demo

# NN Scene

## NN Scene: Overview
slug:: overview
transition:: none

Learn how neural networks process multidimensional input vectors today

## NN Scene: Deep Dive
slug:: deep-dive

Interconnected weight layers extract high level feature representations
`;

async function runTests() {
  console.log('Running Video Engine CLI integration tests...');

  // Test 1: Programmatic compile
  {
    const tmpDir = makeTempDir();
    const scriptPath = path.join(tmpDir, 'script.md');
    // The manifest is a build artifact: compile always writes build/manifest.json.
    const manifestPath = path.join(tmpDir, 'build', 'manifest.json');
    fs.writeFileSync(scriptPath, sampleScript, 'utf8');

    const result = await compileVideo({
      scriptPath,
      cacheDir: path.join(tmpDir, 'cache'),
      synthesizeAssets: false,
    });

    assert.ok(fs.existsSync(manifestPath), 'compile writes build/manifest.json');
    const saved = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(saved.version, '1.0.0');
    assert.strictEqual(saved.compositionId, 'neural-network-demo');
    assert.strictEqual(saved.tracks.scenes.length, 2);
    // No declared duration: derived from narration (9 and 8 words @ 2.5 wps).
    assert.strictEqual(saved.totalDurationInFrames, 204);
    console.log('✔ Programmatic compilation generates valid manifest and synthesizes audio tracks');
  }

  // Test 2: Programmatic render through the HyperFrames driver seam
  {
    const tmpDir = makeTempDir();
    const scriptPath = path.join(tmpDir, 'script.md');
    const videoPath = path.join(tmpDir, 'neural-network-demo_1920x1920.mp4');
    fs.writeFileSync(scriptPath, sampleScript, 'utf8');

    let ran = null;
    const result = await renderVideo({
      scriptPath,
      cacheDir: path.join(tmpDir, 'cache'),
      synthesizeAssets: false,
      hyperframesRun: async (cmd, args) => {
        ran = { cmd, args };
        fs.writeFileSync(args[args.indexOf('--output') + 1], 'fake-mp4-bytes');
        return { status: 0 };
      },
    });

    assert.ok(ran, 'the HyperFrames runner must be invoked');
    assert.notStrictEqual(ran.cmd, 'npx', 'the render must resolve the local pinned CLI, never npx');
    assert.ok(/hyperframes(\.cmd)?$/.test(String(ran.cmd)), 'the resolved command is the local hyperframes binary');
    assert.match(ran.args.join(' '), /render/);
    assert.ok(fs.existsSync(videoPath));
    assert.strictEqual(result.outputVideoPath, videoPath);
    assert.strictEqual(result.totalFrames, 204);
    assert.strictEqual(result.totalDurationSeconds, 6.8);
    assert.ok(result.renderTimeMs >= 0);
    console.log('✔ Programmatic render emits the project and renders via HyperFrames');
  }

  // Test 3: CLI execution via child_process spawn (--allow-mock, renderer disabled)
  {
    const tmpDir = makeTempDir();
    const scriptPath = path.join(tmpDir, 'script.md');
    const manifestPath = path.join(tmpDir, 'build', 'manifest.json');
    const videoPath = path.join(tmpDir, 'neural-network-demo_1920x1920.mp4');
    fs.writeFileSync(scriptPath, sampleScript, 'utf8');

    const compRes = spawnSync('node', [cliPath, 'compile', scriptPath], { encoding: 'utf8' });
    assert.strictEqual(compRes.status, 0, `compile CLI failed: ${compRes.stderr}`);
    assert.ok(fs.existsSync(manifestPath), 'compile writes build/manifest.json');
    assert.ok(/Compiled manifest/.test(compRes.stdout));

    const manifestArgRes = spawnSync('node', [cliPath, 'render', manifestPath, '--allow-mock'], {
      encoding: 'utf8',
      env: { ...process.env, NN_HYPERFRAMES_DISABLE: '1' },
    });
    assert.notStrictEqual(manifestArgRes.status, 0, 'rendering a manifest is refused');

    const renderRes = spawnSync('node', [cliPath, 'render', scriptPath, '--allow-mock'], {
      encoding: 'utf8',
      env: { ...process.env, NN_HYPERFRAMES_DISABLE: '1' },
    });
    assert.strictEqual(renderRes.status, 0, `render CLI failed: ${renderRes.stderr}`);
    assert.ok(fs.existsSync(videoPath));
    assert.ok(/Rendered/.test(renderRes.stdout));
    assert.ok(/mock/i.test(renderRes.stderr), `Expected a mock notice in stderr under --allow-mock, got: ${renderRes.stderr}`);
    console.log('✔ CLI commands "compile" and "render" execute headlessly with --allow-mock');
  }

  // Test 4: The removed `preview` command is refused with a usage that lists
  //         only `compile` and `render`.
  {
    const res = spawnSync('node', [cliPath, 'preview', 'script.md'], { encoding: 'utf8' });
    assert.notStrictEqual(res.status, 0, 'an unknown command must exit non-zero');
    const output = `${res.stdout}\n${res.stderr}`;
    assert.match(output, /Usage: node video-engine-cli\.mjs <compile\|render>/);
    assert.ok(!output.includes('<compile|render|preview>'), 'usage must not list a preview command');
    assert.ok(!/^\s*preview /m.test(output), 'usage must not list a preview command line');
    console.log('✔ the removed preview command is refused with a compile/render usage');
  }

  // Test 5: The CLI uses the HyperFrames driver
  {
    assert.ok(/tryHyperframesRender|hyperframes-render/.test(CLI_SRC), 'the CLI must use the HyperFrames driver');
    console.log('✔ the CLI uses the HyperFrames driver');
  }

  console.log('\nAll Video Engine CLI integration tests passed! 🎉');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
