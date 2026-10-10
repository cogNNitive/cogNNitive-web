#!/usr/bin/env node

/**
 * nn-video-script/test/video-engine-cli.test.mjs
 *
 * Integration tests for video-engine-cli:
 * - CLI compilation of script to manifest
 * - CLI rendering to MP4 with execution metrics
 * - CLI preview command
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  compileVideo,
  renderVideo,
  previewVideo,
  resolveRemotionEntryPoint,
  tryRemotionRender,
} from '../scripts/video-engine-cli.mjs';

// Hermetic: a maintainer machine may export real provider keys. Tests must never reach a paid provider.
for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'ELEVENLABS_API_KEY', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) {
  delete process.env[k];
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, '..', 'scripts', 'video-engine-cli.mjs');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'video-engine-cli-test-'));
}

const sampleScript = `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: "video-script_V_0-1-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/video-script/spec_NN.md"
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
    const manifestPath = path.join(tmpDir, 'manifest.json');
    fs.writeFileSync(scriptPath, sampleScript, 'utf8');

    const result = await compileVideo({
      scriptPath,
      outputPath: manifestPath,
      cacheDir: path.join(tmpDir, 'cache'),
      synthesizeAssets: false,
    });

    assert.ok(fs.existsSync(manifestPath));
    const saved = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(saved.version, '1.0.0');
    assert.strictEqual(saved.compositionId, 'neural-network-demo');
    assert.strictEqual(saved.tracks.scenes.length, 2);
    // No declared duration: derived from narration (9 and 8 words @ 2.5 wps).
    assert.strictEqual(saved.totalDurationInFrames, 204);
    console.log('✔ Programmatic compilation generates valid manifest and synthesizes audio tracks');
  }

  // Test 2: Programmatic render
  {
    const tmpDir = makeTempDir();
    const scriptPath = path.join(tmpDir, 'script.md');
    const videoPath = path.join(tmpDir, 'output.mp4');
    fs.writeFileSync(scriptPath, sampleScript, 'utf8');

    const result = await renderVideo({
      scriptPath,
      outputVideoPath: videoPath,
      cacheDir: path.join(tmpDir, 'cache'),
      synthesizeAssets: false,
      loadModule: async () => null,
      allowMock: true,
    });

    assert.ok(fs.existsSync(videoPath));
    assert.strictEqual(result.outputVideoPath, videoPath);
    assert.strictEqual(result.totalFrames, 204);
    assert.strictEqual(result.totalDurationSeconds, 6.8);
    assert.ok(result.renderTimeMs >= 0);
    console.log('✔ Programmatic render produces master video and summary metrics');
  }

  // Test 3: CLI execution via child_process spawn
  {
    const tmpDir = makeTempDir();
    const scriptPath = path.join(tmpDir, 'script.md');
    const manifestPath = path.join(tmpDir, 'manifest.json');
    const videoPath = path.join(tmpDir, 'rendered.mp4');
    fs.writeFileSync(scriptPath, sampleScript, 'utf8');

    // CLI compile
    const compRes = spawnSync('node', [cliPath, 'compile', scriptPath, '--output', manifestPath], {
      encoding: 'utf8',
    });
    assert.strictEqual(compRes.status, 0, `compile CLI failed: ${compRes.stderr}`);
    assert.ok(fs.existsSync(manifestPath));
    assert.ok(/Compiled manifest/.test(compRes.stdout));

    // CLI render (Remotion unavailable in CI → explicit --allow-mock)
    const renderRes = spawnSync('node', [cliPath, 'render', manifestPath, '--output', videoPath, '--allow-mock'], {
      encoding: 'utf8',
    });
    assert.strictEqual(renderRes.status, 0, `render CLI failed: ${renderRes.stderr}`);
    assert.ok(fs.existsSync(videoPath));
    assert.ok(/Rendered/.test(renderRes.stdout));
    assert.ok(
      /mock/i.test(renderRes.stderr),
      `Expected a mock notice in stderr under --allow-mock, got: ${renderRes.stderr}`
    );

    console.log('✔ CLI commands "compile" and "render" execute headlessly with --allow-mock');
  }

  // Test 4: Preview command
  {
    const res = await previewVideo({ port: 3050 });
    assert.strictEqual(res.port, 3050);
    assert.strictEqual(res.previewUrl, 'http://localhost:3050');
    console.log('✔ CLI preview returns active preview configuration');
  }

  // Test 5: Entry-point resolution and missing modules seam
  {
    const defaultEntry = resolveRemotionEntryPoint();
    assert.ok(typeof defaultEntry === 'string');
    assert.ok(defaultEntry.endsWith('remotion-entry.tsx'));

    const unavailableRes = await tryRemotionRender(
      { manifest: {}, outputPath: 'out.mp4' },
      { loadModule: async () => null }
    );
    assert.strictEqual(unavailableRes.rendered, false);
    assert.strictEqual(unavailableRes.reason, 'modules-unavailable');
    console.log('✔ Entry-point resolution does not throw and unavailable modules report correctly');
  }

  // Test 6: Successful Remotion render seam — selectComposition then renderMedia.
  {
    const tmpDir = makeTempDir();
    const fakeEntry = path.join(tmpDir, 'remotion-entry.tsx');
    fs.writeFileSync(fakeEntry, '// fake remotion entry', 'utf8');

    let bundledWith = null;
    let selectedArgs = null;
    let renderedMediaArgs = null;
    const callOrder = [];

    const fakeBundler = {
      bundle: async (options) => {
        bundledWith = options.entryPoint;
        return 'serve://bundle';
      },
    };

    const fakeRenderer = {
      selectComposition: async (options) => {
        callOrder.push('selectComposition');
        selectedArgs = options;
        return { id: options.id, fps: 30, width: 1920, height: 1080, durationInFrames: 90 };
      },
      renderMedia: async (options) => {
        callOrder.push('renderMedia');
        renderedMediaArgs = options;
      },
    };

    const loadModule = async (id) => {
      if (id === '@remotion/bundler') return fakeBundler;
      if (id === '@remotion/renderer') return fakeRenderer;
      return null;
    };

    const mockManifest = {
      compositionId: 'comp-1',
      fps: 30,
      totalDurationInFrames: 90,
      width: 1920,
      height: 1080,
    };

    const res = await tryRemotionRender(
      { manifest: mockManifest, outputPath: path.join(tmpDir, 'out.mp4'), concurrency: 2 },
      { loadModule, scriptsDir: tmpDir }
    );

    assert.strictEqual(res.rendered, true);
    assert.strictEqual(bundledWith, fakeEntry);
    assert.deepStrictEqual(callOrder, ['selectComposition', 'renderMedia'], 'renderer must selectComposition before renderMedia');
    assert.ok(selectedArgs, 'selectComposition must be called');
    assert.strictEqual(selectedArgs.serveUrl, 'serve://bundle');
    assert.strictEqual(selectedArgs.inputProps, mockManifest);
    assert.ok(renderedMediaArgs, 'renderMedia must be called');
    assert.strictEqual(renderedMediaArgs.serveUrl, 'serve://bundle');
    assert.strictEqual(renderedMediaArgs.codec, 'h264');
    assert.strictEqual(renderedMediaArgs.concurrency, 2);
    assert.strictEqual(renderedMediaArgs.composition.id, selectedArgs.id, 'renderMedia must use the composition returned by selectComposition');
    console.log('✔ Remotion render seam selects the composition then renders it');
  }

  // Test 7: Remotion bundler/renderer error seam
  {
    const tmpDir = makeTempDir();
    const fakeEntry = path.join(tmpDir, 'remotion-entry.tsx');
    fs.writeFileSync(fakeEntry, '// fake remotion entry', 'utf8');

    const fakeBundler = {
      bundle: async () => {
        throw new Error('Simulated bundler failure');
      },
    };
    const fakeRenderer = {
      selectComposition: async () => ({}),
      renderMedia: async () => {},
    };

    const loadModule = async (id) => {
      if (id === '@remotion/bundler') return fakeBundler;
      if (id === '@remotion/renderer') return fakeRenderer;
      return null;
    };

    const res = await tryRemotionRender(
      { manifest: { compositionId: 'comp-2' }, outputPath: path.join(tmpDir, 'out.mp4') },
      { loadModule, scriptsDir: tmpDir }
    );

    assert.strictEqual(res.rendered, false);
    assert.ok(
      /^error: Simulated bundler failure/.test(res.reason),
      `Expected error reason, got: ${res.reason}`
    );
    console.log('✔ Remotion render seam captures unexpected errors into reason string without throwing');
  }

  // Test 8: renderVideo throws a named VideoRenderError when Remotion is unavailable,
  // and emits no mock unless --allow-mock is passed.
  {
    const tmpDir = makeTempDir();
    const scriptPath = path.join(tmpDir, 'script.md');
    const videoPath = path.join(tmpDir, 'strict.mp4');
    fs.writeFileSync(scriptPath, sampleScript, 'utf8');

    await assert.rejects(
      () =>
        renderVideo({
          scriptPath,
          outputVideoPath: videoPath,
          cacheDir: path.join(tmpDir, 'cache'),
          loadModule: async () => null,
        }),
      (err) => err.name === 'VideoRenderError',
      'renderVideo must throw a named VideoRenderError when Remotion is unavailable'
    );
    assert.ok(!fs.existsSync(videoPath), 'no mock may be written without --allow-mock');
    console.log('✔ renderVideo hard-fails with a named error and writes no mock');
  }

  // Test 9: renderVideo writes a mock only behind allowMock, and exits non-zero otherwise.
  {
    const tmpDir = makeTempDir();
    const scriptPath = path.join(tmpDir, 'script.md');
    const videoPath = path.join(tmpDir, 'mock.mp4');
    fs.writeFileSync(scriptPath, sampleScript, 'utf8');

    const result = await renderVideo({
      scriptPath,
      outputVideoPath: videoPath,
      cacheDir: path.join(tmpDir, 'cache'),
      loadModule: async () => null,
      allowMock: true,
    });
    assert.ok(fs.existsSync(videoPath), 'allowMock must write a mock file');
    assert.strictEqual(result.mocked, true, 'the summary must flag the mock');
    console.log('✔ renderVideo writes a mock only behind allowMock');
  }

  console.log('\nAll video engine CLI integration tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
