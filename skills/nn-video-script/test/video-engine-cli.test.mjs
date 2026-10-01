#!/usr/bin/env node

/**
 * skills/nn-video-script/test/video-engine-cli.test.mjs
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(__dirname, '..', 'scripts', 'video-engine-cli.mjs');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'video-engine-cli-test-'));
}

const sampleScript = `
//ANYDEO_SPEC: V_0-3-3
# Video
- video_title: Neural Network Demo
- video_fps: 30

# Scenes

## Scene 1: Overview
@base Intro
Learn how artificial neural networks process multidimensional vectors.
- scene_type: chapter_title
- scene_duration: 3.0

@@ Title
- layer_type: text
- layer_level: 50
- layer_text_content: "NEURAL NETWORKS"

## Scene 2: Deep Dive
@base Architecture
Layers of interconnected weights extract high-level feature representations.
- scene_type: image_motion
- scene_duration: 4.0
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
    });

    assert.ok(fs.existsSync(manifestPath));
    const saved = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(saved.version, '1.0.0');
    assert.strictEqual(saved.compositionId, 'neural-network-demo');
    assert.strictEqual(saved.tracks.scenes.length, 2);
    assert.strictEqual(saved.totalDurationInFrames, 210); // (3.0 + 4.0) * 30 = 210 frames
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
    });

    assert.ok(fs.existsSync(videoPath));
    assert.strictEqual(result.outputVideoPath, videoPath);
    assert.strictEqual(result.totalFrames, 210);
    assert.strictEqual(result.totalDurationSeconds, 7.0);
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

    // CLI render
    const renderRes = spawnSync('node', [cliPath, 'render', manifestPath, '--output', videoPath], {
      encoding: 'utf8',
    });
    assert.strictEqual(renderRes.status, 0, `render CLI failed: ${renderRes.stderr}`);
    assert.ok(fs.existsSync(videoPath));
    assert.ok(/Rendered/.test(renderRes.stdout));
    assert.ok(
      /Remotion render skipped \(modules-unavailable\)/.test(renderRes.stderr),
      `Expected Remotion warning in stderr, got: ${renderRes.stderr}`
    );

    console.log('✔ CLI commands "compile" and "render" execute headlessly with exit code 0 and observable warning');
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

  // Test 6: Successful Remotion render seam
  {
    const tmpDir = makeTempDir();
    const fakeEntry = path.join(tmpDir, 'remotion-entry.tsx');
    fs.writeFileSync(fakeEntry, '// fake remotion entry', 'utf8');

    let bundledWith = null;
    let renderedMediaArgs = null;

    const fakeBundler = {
      bundle: async (options) => {
        bundledWith = options.entryPoint;
        return 'serve://bundle';
      },
    };

    const fakeRenderer = {
      renderMedia: async (options) => {
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
    assert.ok(renderedMediaArgs);
    assert.strictEqual(renderedMediaArgs.serveUrl, 'serve://bundle');
    assert.strictEqual(renderedMediaArgs.concurrency, 2);
    console.log('✔ Remotion render seam delegates to bundler and renderer when present');
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
    const fakeRenderer = { renderMedia: async () => {} };

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

  console.log('\nAll video engine CLI integration tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
