#!/usr/bin/env node

/**
 * nn-conntent/test/episode-project-layout.test.mjs
 *
 * Slice 5 layout contract (capability cognnitive-video-engine):
 *   - the engine project lives in `<episode>/hyperframes/` (manifest, index.html,
 *     compositions/, assets/, vendor/) and there is no `build/`, `public/` or `audio/`;
 *   - assets are hardlinks to the provider cache, never content-addressed copies;
 *   - a copy-mode run deletes `hyperframes/assets/` after a successful render;
 *   - the project loads GSAP from `vendor/gsap.min.js`, never from a network URL.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { compileVideo } from '../scripts/lib/compile.mjs';
import { renderVideo } from '../scripts/lib/render.mjs';
import { sameFile, resetCopyModeWarning } from '../scripts/lib/stage-assets.mjs';

const SAMPLE = `---
level: 3
title: "Project layout"
---

# NN Video

## NN Video: Project layout
slug:: project-layout
title:: Project layout

# NN Scene

## NN Scene: One
slug:: one

one two three four five

### NN Layer: One background
slug:: one-bg
type:: background
asset:: media/bg.png
`;

const bags = { blueprint: { output_formats: ['1920x1920'], fit: 'cover', transition: 'none' } };

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-project-layout-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  const series = path.join(root, 'series', 's');
  const episode = path.join(series, 'assets', 'e');
  fs.mkdirSync(path.join(episode, 'media'), { recursive: true });
  fs.writeFileSync(
    path.join(series, 's_coNNtent_NN.md'),
    '---\nlevel: 3\nscope: true\ntitle: "S"\n---\n\n# NN Series\n\n## NN Series: S\nslug:: s\n',
    'utf8',
  );
  fs.writeFileSync(path.join(episode, 'media', 'bg.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const scriptPath = path.join(episode, 'e_coNNtent_NN.md');
  fs.writeFileSync(scriptPath, SAMPLE, 'utf8');
  return { root, series, episode, scriptPath, cacheDir: path.join(root, 'cache') };
}

const done = (dir) => fs.rmSync(dir, { recursive: true, force: true });

test('compile writes the whole project under <episode>/hyperframes/ and no build/', async () => {
  const ep = fixture();
  try {
    await compileVideo({ scriptPath: ep.scriptPath, bags, synthesizeAssets: false, cacheDir: ep.cacheDir });

    assert.ok(fs.existsSync(path.join(ep.episode, 'hyperframes', 'manifest.json')), 'the manifest lives under hyperframes/');
    assert.ok(fs.existsSync(path.join(ep.episode, 'hyperframes', 'assets')), 'staging is the asset dir');
    assert.equal(fs.existsSync(path.join(ep.episode, 'build')), false, 'no build/ directory');
    assert.equal(fs.existsSync(path.join(ep.episode, 'public')), false, 'no public/ directory');
    assert.equal(fs.existsSync(path.join(ep.episode, 'audio')), false, 'no audio/ handoff');
    assert.equal(fs.existsSync(path.join(ep.episode, 'manifest.json')), false, 'no manifest at the episode root');

    const manifest = JSON.parse(fs.readFileSync(path.join(ep.episode, 'hyperframes', 'manifest.json'), 'utf8'));
    assert.equal(path.resolve(manifest.metadata.hyperframesDir), path.resolve(ep.episode, 'hyperframes'));
    assert.equal(path.resolve(manifest.metadata.assetsDir), path.resolve(ep.episode, 'hyperframes', 'assets'));
    assert.equal(manifest.metadata.linkMode, 'link');
  } finally {
    done(ep.root);
  }
});

test('a staged media asset is a hardlink to the source, not a copy', async () => {
  const ep = fixture();
  try {
    await compileVideo({ scriptPath: ep.scriptPath, bags, synthesizeAssets: false, cacheDir: ep.cacheDir });
    const assets = fs.readdirSync(path.join(ep.episode, 'hyperframes', 'assets'));
    const staged = assets.find((name) => name.endsWith('.png'));
    assert.ok(staged, `the png was staged: ${assets.join(', ')}`);
    const source = path.join(ep.episode, 'media', 'bg.png');
    const dest = path.join(ep.episode, 'hyperframes', 'assets', staged);
    assert.ok(sameFile(source, dest), 'the staged asset IS the source file');
    assert.ok(fs.statSync(dest).nlink >= 2);
    assert.match(staged, /^bg_[0-9a-f]{12}\.png$/, 'no bare basename: the name keeps the content hash');
  } finally {
    done(ep.root);
  }
});

test('an authored folder colliding by case fails naming the collision and writes nothing', async () => {
  const ep = fixture();
  try {
    fs.mkdirSync(path.join(ep.episode, 'Hyperframes'), { recursive: true });
    await assert.rejects(
      compileVideo({ scriptPath: ep.scriptPath, bags, synthesizeAssets: false, cacheDir: ep.cacheDir }),
      /Hyperframes/,
    );
    assert.equal(fs.existsSync(path.join(ep.episode, 'hyperframes', 'manifest.json')), false, 'nothing was written');
  } finally {
    done(ep.root);
  }
});

test('a copy-mode render deletes hyperframes/assets/ after a successful render', async () => {
  const ep = fixture();
  try {
    resetCopyModeWarning();
    const link = () => {
      const err = new Error('cross-device link');
      err.code = 'EXDEV';
      throw err;
    };
    await renderVideo({
      scriptPath: ep.scriptPath,
      bags,
      cacheDir: ep.cacheDir,
      synthesizeAssets: false,
      stageDeps: { link, warn: () => {} },
      gsapPath: fakeGsap(ep.root),
      hyperframesRun: async (_cmd, args) => {
        fs.writeFileSync(args[args.indexOf('--output') + 1], 'master');
        return { status: 0 };
      },
    });
    assert.equal(fs.existsSync(path.join(ep.episode, 'hyperframes', 'assets')), false, 'copy mode cleans up');
    assert.ok(fs.existsSync(path.join(ep.episode, 'project-layout_1920x1920.mp4')), 'the master is in the episode folder');
  } finally {
    resetCopyModeWarning();
    done(ep.root);
  }
});

test('a link-mode render keeps the assets and the emitted project loads GSAP from vendor/', async () => {
  const ep = fixture();
  try {
    await renderVideo({
      scriptPath: ep.scriptPath,
      bags,
      cacheDir: ep.cacheDir,
      synthesizeAssets: false,
      gsapPath: fakeGsap(ep.root),
      hyperframesRun: async (_cmd, args) => {
        fs.writeFileSync(args[args.indexOf('--output') + 1], 'master');
        return { status: 0 };
      },
    });
    const projectDir = path.join(ep.episode, 'hyperframes');
    assert.ok(fs.existsSync(path.join(projectDir, 'assets')), 'link mode keeps the links');
    assert.ok(fs.existsSync(path.join(projectDir, 'vendor', 'gsap.min.js')), 'GSAP is vendored');
    for (const file of ['index.html', path.join('compositions', 'one.html')]) {
      const html = fs.readFileSync(path.join(projectDir, file), 'utf8');
      assert.ok(html.includes('vendor/gsap.min.js'), `${file} loads the vendored GSAP`);
      assert.doesNotMatch(html, /https?:\/\/[^"']*\.js/, `${file} loads no network script`);
    }
  } finally {
    done(ep.root);
  }
});

/** A stand-in for the pinned GSAP build, so the test never depends on the install. */
function fakeGsap(root) {
  const file = path.join(root, 'gsap.min.js');
  fs.writeFileSync(file, '/* gsap */');
  return file;
}
