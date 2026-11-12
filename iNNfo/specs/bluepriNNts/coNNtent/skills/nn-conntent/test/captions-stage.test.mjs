/**
 * nn-conntent/test/captions-stage.test.mjs
 *
 * Alignment stage, model derivation, 90% coverage threshold, caching,
 * and project emission with caption-skin.html (capability conntent-captions).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  alignEpisodeCaptions,
  resolveCaptionModel,
} from '../scripts/lib/captions-stage.mjs';
import {
  CAPTION_MATCH_MIN,
  captionsCacheKey,
  transcribeArgs,
} from '../scripts/lib/captions.mjs';
import { ProduceStop } from '../scripts/produce.mjs';
import { readTimingRows } from '../scripts/lib/facts.mjs';
import { buildProject } from '../scripts/scene-project.mjs';
import { emitHyperframesFrame } from '../scripts/lib/frame-tokens.mjs';

const wordsOf = (tokens, gap = 0.5) =>
  tokens.map((text, index) => ({ text, start: index * gap, end: index * gap + gap * 0.9 }));

test('model derivation with no model installed: small.en for en, small for others, never default', () => {
  assert.equal(resolveCaptionModel({ language: 'en', installedModels: [] }), 'small.en');
  assert.equal(resolveCaptionModel({ language: 'es', installedModels: [] }), 'small');
  assert.equal(resolveCaptionModel({ language: 'fr', installedModels: [] }), 'small');
  assert.equal(resolveCaptionModel({ language: 'es', captionModel: 'medium', installedModels: [] }), 'medium');
});

test('transcribe command line always names a model explicitly', () => {
  const enArgs = transcribeArgs({ audioPath: 'a.wav', model: 'small.en' });
  assert.ok(enArgs.includes('--model'));
  assert.equal(enArgs[enArgs.indexOf('--model') + 1], 'small.en');
  assert.ok(!enArgs.includes('--language'), 'en needs no --language arg');

  const esArgs = transcribeArgs({ audioPath: 'a.wav', model: 'small', language: 'es' });
  assert.ok(esArgs.includes('--model'));
  assert.equal(esArgs[esArgs.indexOf('--model') + 1], 'small');
  assert.ok(esArgs.includes('--language'));
  assert.equal(esArgs[esArgs.indexOf('--language') + 1], 'es');
});

test('caption-alignment-failed stops with exit 1 if coverage < 0.90', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-captions-stage-'));
  try {
    const scriptPath = path.join(dir, 'test_coNNtent_NN.md');
    const doc = `---
level: 3
parent_spec:
  name: "coNNtent_V_0-17-0"
  url: "https://example.invalid"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-17-0"
title: "Coverage Test"
---
# NN Video
## NN Video: Coverage
slug:: test
language:: en
captions:: words
output_formats:: [1920x1920]

# NN Scene
## NN Scene: Low Match
slug:: low_match
kind:: Libre
w0 w1 w2 w3 w4 w5 w6 w7 w8 w9
`;
    fs.writeFileSync(scriptPath, doc, 'utf8');
    fs.writeFileSync(path.join(dir, 'dummy.mp3'), 'fake-audio-bytes', 'utf8');

    // Mock transcribe returning only 8 of 10 words (80% match)
    const tenWords = 'w0 w1 w2 w3 w4 w5 w6 w7 w8 w9'.split(' ');
    const mockTranscribe = () => ({
      ok: true,
      engine: 'parakeet',
      model: 'small.en',
      durationSeconds: 5,
      words: wordsOf(tenWords.slice(0, 8)),
    });

    await assert.rejects(
      alignEpisodeCaptions({
        scriptPath,
        deps: {
          runTranscribe: mockTranscribe,
          audioAssets: { low_match: { assetPath: 'dummy.mp3', sha256: 'dummy-sha' } },
          audioPath: path.join(dir, 'dummy.mp3'),
        },
      }),
      (err) => {
        assert.ok(err instanceof ProduceStop);
        assert.equal(err.code, 'caption-alignment-failed');
        assert.equal(err.exitCode, 1);
        assert.match(err.message, /low_match/);
        return true;
      },
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('silent scene without narration is skipped without error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-captions-silent-'));
  try {
    const scriptPath = path.join(dir, 'test_coNNtent_NN.md');
    const doc = `---
level: 3
parent_spec:
  name: "coNNtent_V_0-17-0"
  url: "https://example.invalid"
knowledge_version: "V_0-1-0"
blueprint_version: "V_0-17-0"
title: "Silent Test"
---
# NN Video
## NN Video: Silent
slug:: silent
language:: en
captions:: words
output_formats:: [1920x1920]

# NN Scene
## NN Scene: No Speech
slug:: no_speech
kind:: Libre
`;
    fs.writeFileSync(scriptPath, doc, 'utf8');

    let called = false;
    const res = await alignEpisodeCaptions({
      scriptPath,
      deps: {
        runTranscribe: () => {
          called = true;
          return { ok: true, words: [] };
        },
      },
    });
    assert.equal(called, false, 'silent scene must not call transcribe');
    assert.equal(res.ok, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cache hit skips transcribe call; model or text change misses', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-captions-cache-'));
  try {
    const dummyAudio = path.join(dir, 'audio.mp3');
    fs.writeFileSync(dummyAudio, 'fake-audio-bytes', 'utf8');

    const cacheDir = path.join(dir, 'cache');
    let transcribeCalls = 0;
    let currentWords = 'one two three'.split(' ');
    const mockTranscribe = () => {
      transcribeCalls++;
      return {
        ok: true,
        engine: 'auto',
        model: 'small.en',
        durationSeconds: 5,
        words: wordsOf(currentWords),
      };
    };

    const run = (text, model) => {
      currentWords = text.split(' ');
      return alignEpisodeCaptions({
        scriptPath: '',
        model: {
          elements: {
            Video: [{ fields: { slug: 'test', language: 'en', captions: 'words', caption_model: model } }],
            Scene: [{ slug: 'sc1', fields: { slug: 'sc1', narration: text } }],
          },
        },
        cacheDir,
        deps: {
          runTranscribe: mockTranscribe,
          audioPath: dummyAudio,
        },
      });
    };

    // 1st run: miss -> calls transcribe
    await run('one two three', 'small.en');
    assert.equal(transcribeCalls, 1);

    // 2nd run with same inputs: hit -> does NOT call transcribe
    await run('one two three', 'small.en');
    assert.equal(transcribeCalls, 1, 'cache hit must not invoke transcribe');

    // 3rd run with different text: miss -> calls transcribe
    await run('one two four', 'small.en');
    assert.equal(transcribeCalls, 2, 'text change must miss cache');

    // 4th run with different model: miss -> calls transcribe
    await run('one two three', 'medium.en');
    assert.equal(transcribeCalls, 3, 'model change must miss cache');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('captions stage records timing row and has zero cost', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-captions-facts-'));
  try {
    const dummyAudio = path.join(dir, 'audio.mp3');
    fs.writeFileSync(dummyAudio, 'fake-audio-bytes', 'utf8');

    const facts = { rootDir: dir, runId: 'r1', episode: 'e1' };
    await alignEpisodeCaptions({
      scriptPath: '',
      model: {
        elements: {
          Video: [{ fields: { slug: 'test', language: 'en', captions: 'words' } }],
          Scene: [{ slug: 'sc1', fields: { slug: 'sc1', narration: 'hello world' } }],
        },
      },
      facts,
      deps: {
        runTranscribe: () => ({
          ok: true,
          engine: 'auto',
          model: 'small.en',
          durationSeconds: 2,
          words: wordsOf('hello world'.split(' ')),
        }),
        audioPath: dummyAudio,
      },
    });

    const rows = readTimingRows(dir);
    assert.ok(rows.length > 0, 'timings row written');
    const row = rows.find((r) => r.stage === 'captions');
    assert.ok(row, 'captions stage row found');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('buildProject emits #captions host with entries when narrationCaptions is set', () => {
  const manifest = {
    version: '1.0.0',
    compositionId: 'captions-demo',
    fps: 30,
    width: 1080,
    height: 1080,
    totalDurationInFrames: 90,
    totalDurationInSeconds: 3,
    tracks: {
      scenes: [{ id: 's1', slug: 's1', fromFrame: 0, durationInFrames: 90, props: { layers: [] } }],
      audio: [],
      overlays: [],
    },
    metadata: {},
  };

  const captions = [
    { text: 'Hello', start: 0.1, end: 0.5 },
    { text: 'World', start: 0.6, end: 1.0 },
  ];

  const { indexHtml } = buildProject(manifest, { narrationCaptions: captions });
  assert.match(indexHtml, /<div id="captions"[^>]*data-track-kind="captions"/);
  assert.match(indexHtml, /data-start="0\.1"/);
  assert.match(indexHtml, /Hello/);
  assert.match(indexHtml, /World/);

  // When disabled (null/false), no captions host
  const { indexHtml: noCaptionsHtml } = buildProject(manifest, { narrationCaptions: null });
  assert.ok(!noCaptionsHtml.includes('id="captions"'));
});

test('frame caption-skin.html is copied to project directory alongside frame.md', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-frame-skin-'));
  try {
    const frameDir = path.join(dir, 'frame');
    fs.mkdirSync(frameDir, { recursive: true });
    fs.writeFileSync(path.join(frameDir, 'FRAME.md'), '# Frame', 'utf8');
    fs.writeFileSync(path.join(frameDir, 'caption-skin.html'), '<style>.cap{}</style>', 'utf8');

    const projectDir = path.join(dir, 'project');
    fs.mkdirSync(projectDir, { recursive: true });

    emitHyperframesFrame({ frameDir, projectDir });
    assert.ok(fs.existsSync(path.join(projectDir, 'hyperframes', 'frame.md')));
    assert.ok(fs.existsSync(path.join(projectDir, 'hyperframes', 'caption-skin.html')));
    const skinContent = fs.readFileSync(path.join(projectDir, 'hyperframes', 'caption-skin.html'), 'utf8');
    assert.equal(skinContent, '<style>.cap{}</style>');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
