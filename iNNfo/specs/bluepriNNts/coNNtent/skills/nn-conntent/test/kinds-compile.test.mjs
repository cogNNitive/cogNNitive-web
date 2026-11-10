#!/usr/bin/env node

/**
 * nn-conntent/test/kinds-compile.test.mjs
 *
 * Compile-level proof of the series grammar: a kind's chrome becomes ordinary overlays for
 * the cascaded language, and a fixed kind is inserted by the engine in placed order
 * (capability video-scene-kinds).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { loadCascadeBags, withScriptPresets } from '../scripts/lib/video-scope.mjs';
import { loadKnowledgeModel } from '../scripts/lib/knowledge-model.mjs';

const seriesDoc = `---
level: 3
scope: true
title: "Series"
---

# NN Series

## NN Series: S
slug:: s
language:: es

# NN Scene Kind

## NN Scene Kind: Gancho
slug:: gancho
narration:: on
chrome:: [watermark]

## NN Scene Kind: Intro
slug:: intro
narration:: off
fixed:: first
asset:: media/bumper.mp4

# NN Chrome

## NN Chrome: es
slug:: chrome-es
language:: es
watermark:: generado con IA
`;

const episodeDoc = `---
level: 3
blueprint_version: "V_0-15-0"
title: "Ep"
---

# NN Video

## NN Video: Ep
slug:: ep
title:: Ep

# NN Scene

## NN Scene: One
slug:: one
kind:: Gancho

One two three.

# NN Layer

### NN Layer: Shot
type:: background
asset:: media/shot.png
`;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kinds-compile-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  fs.writeFileSync(
    path.join(root, 'video-defaults_NN.md'),
    '# NN Video Defaults\n\n## NN Video Defaults: D\nslug:: d\noutput_formats:: [1920x1920]\nreview_gates:: [preview]\n',
    'utf8',
  );
  const series = path.join(root, 'series', 's');
  fs.mkdirSync(series, { recursive: true });
  fs.writeFileSync(path.join(series, 's_coNNtent_NN.md'), seriesDoc, 'utf8');
  const ep = path.join(series, 'assets', 'ep');
  fs.mkdirSync(path.join(ep, 'media'), { recursive: true });
  fs.writeFileSync(path.join(ep, 'ep_NN.md'), episodeDoc, 'utf8');
  fs.writeFileSync(path.join(ep, 'media', 'shot.png'), 'png', 'utf8');
  fs.writeFileSync(path.join(ep, 'media', 'bumper.mp4'), 'mp4', 'utf8');
  return { root, ep, scriptPath: path.join(ep, 'ep_NN.md') };
}

test('kind chrome becomes an overlay and a fixed kind is inserted first', () => {
  const { root, ep, scriptPath } = fixture();
  try {
    const model = loadKnowledgeModel(scriptPath);
    const bags = withScriptPresets(loadCascadeBags(ep), model, scriptPath);
    const compiler = new SceneCompiler();
    const lowered = compiler.lowerKnowledgeModel(model, { bags, scriptDir: ep });
    assert.deepEqual(
      lowered.scenes.map((s) => s.name),
      ['Intro', 'One'],
      'the fixed first scene precedes the authored scene',
    );
    const one = lowered.scenes.find((s) => s.name === 'One');
    assert.equal(one.kind, 'Gancho');
    assert.ok(
      one.layers.some((l) => l.properties?.layer_type === 'watermark'),
      'the kind chrome is applied as an overlay',
    );
    const intro = lowered.scenes.find((s) => s.name === 'Intro');
    assert.equal(intro.fixed, true);
    assert.equal(intro.narration, '');
    assert.ok(intro.layers.length > 0, 'the fixed scene carries its asset layer');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
