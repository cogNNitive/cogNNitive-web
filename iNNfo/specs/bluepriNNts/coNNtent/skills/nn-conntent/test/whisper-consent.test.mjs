/**
 * nn-conntent/test/whisper-consent.test.mjs
 *
 * ASR consent before spend (capability conntent-captions; tasks 3b-3.7):
 * - captions: off needs no whisper and is never blocked
 * - captions: words or lines with whisper missing fails before spend with whisper-missing
 * - caption_model ending in .en on non-English fails with caption-model-language-mismatch
 * - captions: words on unspaced languages (ja, zh) fails with captions-words-unsupported
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { EXIT_DONE, produce, ProduceStop } from '../scripts/produce.mjs';
import { assertProducible, readEpisode } from '../scripts/lib/episode.mjs';
import { isWhisperAvailable, setWhisperAvailable } from '../scripts/lib/captions-stage.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLUEPRINT = path.resolve(SKILL, '..', '..');

const SCENE = (captionsField = '') => `# NN Scene

## NN Scene: One
slug:: one
kind:: Libre
${captionsField}

one two three four five six seven eight nine ten
`;

const episodeDoc = ({
  status = 'draft',
  budget = '1.5',
  review = 'skip',
  language = 'es',
  scenes = SCENE(''),
  pin = 'V_0-19-0',
} = {}) => `---
level: 3
parent_spec:
  name: "coNNtent_V_0-19-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
blueprint_version: "${pin}"
title: "Captions Probe"
---

# NN Video

## NN Video: Probe
slug:: e
title:: Probe
language:: ${language}
status:: ${status}${budget === null ? '' : `\nbudget:: ${budget}`}
review_gates:: ${review === 'off' ? '[]' : review === 'skip' ? '[]' : '[script, preview]'}
output_formats:: [1920x1920]

${scenes}`;

function workspace(doc = episodeDoc()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-captions-consent-'));
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

const done = (dir) => {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
};

test('captions: off proceeds when whisper is missing', async () => {
  const ws = workspace(episodeDoc({ scenes: SCENE('captions:: off') }));
  setWhisperAvailable(false);
  try {
    const res = await produce({
      episodePath: ws.scriptPath,
      dryRun: true,
      deps: { log: () => {} },
    });
    assert.equal(res.code, EXIT_DONE);
  } finally {
    setWhisperAvailable(null);
    done(ws.root);
  }
});

test('captions: words fails with whisper-missing before spend when whisper is absent', async () => {
  const ws = workspace(episodeDoc({ scenes: SCENE('captions:: words') }));
  setWhisperAvailable(false);
  try {
    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        dryRun: true,
        deps: { log: () => {} },
      }),
      (err) => {
        assert.ok(err instanceof ProduceStop);
        assert.equal(err.code, 'whisper-missing');
        assert.equal(err.exitCode, 1);
        assert.match(err.message, /ensure-hyperframes\.mjs|skills-manager\.js|install/i);
        return true;
      },
    );
  } finally {
    setWhisperAvailable(null);
    done(ws.root);
  }
});

test('captions: lines also fails with whisper-missing when whisper is absent', async () => {
  const ws = workspace(episodeDoc({ scenes: SCENE('captions:: lines') }));
  setWhisperAvailable(false);
  try {
    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        dryRun: true,
        deps: { log: () => {} },
      }),
      (err) => {
        assert.ok(err instanceof ProduceStop);
        assert.equal(err.code, 'whisper-missing');
        assert.equal(err.exitCode, 1);
        return true;
      },
    );
  } finally {
    setWhisperAvailable(null);
    done(ws.root);
  }
});

test('English-only caption model (.en) on Spanish fails before spend with caption-model-language-mismatch', async () => {
  const ws = workspace(
    episodeDoc({
      language: 'es',
      scenes: SCENE('captions:: words\ncaption_model:: small.en'),
    }),
  );
  try {
    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        dryRun: true,
        deps: { log: () => {} },
      }),
      (err) => {
        assert.ok(err instanceof ProduceStop);
        assert.equal(err.code, 'caption-model-language-mismatch');
        assert.equal(err.exitCode, 1);
        assert.match(err.message, /small\.en/);
        assert.match(err.message, /es/);
        return true;
      },
    );
  } finally {
    done(ws.root);
  }
});

test('word captions for an unspaced language (ja) fails before spend with captions-words-unsupported', async () => {
  const wsJaWords = workspace(
    episodeDoc({
      language: 'ja',
      scenes: SCENE('captions:: words'),
    }),
  );
  try {
    await assert.rejects(
      produce({
        episodePath: wsJaWords.scriptPath,
        dryRun: true,
        deps: { log: () => {} },
      }),
      (err) => {
        assert.ok(err instanceof ProduceStop);
        assert.equal(err.code, 'captions-words-unsupported');
        assert.equal(err.exitCode, 1);
        assert.match(err.message, /ja/);
        return true;
      },
    );
  } finally {
    done(wsJaWords.root);
  }
});

test('lines captions for an unspaced language (ja) validates without captions-words-unsupported', async () => {
  const wsJaLines = workspace(
    episodeDoc({
      language: 'ja',
      scenes: SCENE('captions:: lines'),
    }),
  );
  setWhisperAvailable(true);
  try {
    const res = await produce({
      episodePath: wsJaLines.scriptPath,
      dryRun: true,
      deps: { log: () => {} },
    });
    assert.equal(res.code, EXIT_DONE);
  } finally {
    setWhisperAvailable(null);
    done(wsJaLines.root);
  }
});
