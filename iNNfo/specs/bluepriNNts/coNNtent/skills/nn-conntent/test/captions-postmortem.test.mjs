/**
 * nn-conntent/test/captions-postmortem.test.mjs
 *
 * Regression tests for the coNNtent production post-mortem (#607, #616):
 * - each scene aligns against its OWN narration audio; a missing one is
 *   `caption-audio-missing`, never the first cached TTS file;
 * - the captions stage (writer) and compile (reader) share one cache key, and the
 *   aligned words reach the video as `captions` overlays grouped into segments;
 * - a corrupt captions cache entry is a named error, not a silent skip;
 * - the coverage guard matches spelled-out numbers against digits;
 * - transcription runs the pinned HyperFrames CLI (never `npx`) through `spawnTool`;
 * - the whisper model is an installed one when none is declared.
 *
 * Synthesis runs offline (no WAVESPEED_API_KEY): the synthesizer writes silent
 * placeholder audio into a scratch cache, and the transcriber is a fake.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { alignEpisodeCaptions, listInstalledWhisperModels, resolveCaptionModel } from '../scripts/lib/captions-stage.mjs';
import {
  CAPTION_MATCH_MIN,
  alignCaptions,
  groupCaptionSegments,
  matchKeys,
  runTranscribe,
  transcribeArgs,
} from '../scripts/lib/captions.mjs';
import { compileVideo, synthesizeEpisodeAssets } from '../scripts/lib/compile.mjs';
import { buildProject } from '../scripts/scene-project.mjs';

delete process.env.WAVESPEED_API_KEY;

const BAGS = { blueprint: { output_formats: ['1920x1920'], transition: 'none' } };

const SCRIPT = `---
level: 3
title: "E"
---

# NN Video

## NN Video: E
slug:: e
title:: E
captions:: words
language:: es

# NN Scene

## NN Scene: Uno
slug:: uno

Hola a todos.

## NN Scene: Dos
slug:: dos

El catorce por ciento sube hoy.
`;

/** An episode with two narrated scenes whose (offline) narration is already synthesized. */
async function episode() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-captions-pm-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  const ep = path.join(root, 'ep');
  fs.mkdirSync(ep);
  const scriptPath = path.join(ep, 'e_coNNtent_NN.md');
  fs.writeFileSync(scriptPath, SCRIPT, 'utf8');
  const cacheDir = path.join(root, 'cache');
  const warn = console.warn;
  console.warn = () => {};
  try {
    const { audioAssets } = await synthesizeEpisodeAssets({ scriptPath, cacheDir, bags: BAGS });
    return { root, scriptPath, cacheDir, audioAssets };
  } finally {
    console.warn = warn;
  }
}

const words = (tokens, offset = 0) => tokens.map((text, i) => ({ text, start: offset + i * 0.4, end: offset + i * 0.4 + 0.3 }));

/** A transcriber that answers per audio file and records which file each call used. */
function fakeTranscriber(byAudio) {
  const calls = [];
  const run = ({ audioPath }) => {
    calls.push(audioPath);
    const tokens = byAudio[audioPath];
    if (!tokens) return { ok: true, durationSeconds: 5, words: words(['nada']) };
    return { ok: true, durationSeconds: 5, words: words(tokens) };
  };
  return { run, calls };
}

test('each scene aligns against its own narration audio (#607 acceptance)', async () => {
  const ep = await episode();
  try {
    const uno = ep.audioAssets.scene_uno.assetPath;
    const dos = ep.audioAssets.scene_dos.assetPath;
    assert.notEqual(uno, dos);
    const t = fakeTranscriber({ [uno]: ['Hola', 'a', 'todos.'], [dos]: ['El', '14%', 'sube', 'hoy.'] });
    // No audio map is handed over: the stage reads it from the TTS cache itself.
    const res = await alignEpisodeCaptions({
      scriptPath: ep.scriptPath,
      cacheDir: ep.cacheDir,
      bags: BAGS,
      deps: { installedModels: [], runTranscribe: t.run },
    });
    assert.deepEqual(t.calls, [uno, dos], 'scene 2 is aligned against scene 2 audio');
    assert.deepEqual(res.captions.map((c) => c.scene), ['uno', 'dos']);
    assert.equal(res.captions[1].coverage, 1);

    // The synthesis result handed over directly (keyed by scene id) gives the same answer.
    const t2 = fakeTranscriber({ [uno]: ['Hola', 'a', 'todos.'], [dos]: ['El', '14%', 'sube', 'hoy.'] });
    await alignEpisodeCaptions({
      scriptPath: ep.scriptPath,
      cacheDir: path.join(ep.root, 'cache-2'),
      bags: BAGS,
      audioAssets: ep.audioAssets,
      deps: { installedModels: [], runTranscribe: t2.run },
    });
    assert.deepEqual(t2.calls, [uno, dos]);
  } finally {
    fs.rmSync(ep.root, { recursive: true, force: true });
  }
});

test('a scene with no synthesized audio stops with caption-audio-missing, never another file', async () => {
  const ep = await episode();
  try {
    const t = fakeTranscriber({});
    // Only scene "uno" has audio; the TTS cache still holds both files.
    const onlyUno = { scene_uno: ep.audioAssets.scene_uno };
    await assert.rejects(
      alignEpisodeCaptions({
        scriptPath: ep.scriptPath,
        cacheDir: ep.cacheDir,
        bags: BAGS,
        audioAssets: onlyUno,
        deps: { installedModels: [], runTranscribe: fakeTranscriber({ [ep.audioAssets.scene_uno.assetPath]: ['Hola', 'a', 'todos.'] }).run },
      }),
      (err) => {
        assert.equal(err.code, 'caption-audio-missing');
        assert.equal(err.exitCode, 1);
        assert.match(err.message, /scene "dos"/);
        return true;
      },
    );
    assert.deepEqual(t.calls, []);
  } finally {
    fs.rmSync(ep.root, { recursive: true, force: true });
  }
});

test('compile reads what the captions stage wrote and emits caption overlays per segment', async () => {
  const ep = await episode();
  try {
    const uno = ep.audioAssets.scene_uno.assetPath;
    const dos = ep.audioAssets.scene_dos.assetPath;
    await alignEpisodeCaptions({
      scriptPath: ep.scriptPath,
      cacheDir: ep.cacheDir,
      bags: BAGS,
      deps: { installedModels: [], runTranscribe: fakeTranscriber({ [uno]: ['Hola', 'a', 'todos.'], [dos]: ['El', '14%', 'sube', 'hoy.'] }).run },
    });
    const warn = console.warn;
    console.warn = () => {};
    let manifest;
    try {
      ({ manifest } = await compileVideo({ scriptPath: ep.scriptPath, cacheDir: ep.cacheDir, bags: BAGS }));
    } finally {
      console.warn = warn;
    }
    const captions = manifest.tracks.overlays.filter((o) => o.type === 'captions');
    assert.deepEqual(
      captions.map((o) => [o.sceneId, o.config.text]),
      [
        ['scene_uno', 'Hola a todos.'],
        ['scene_dos', 'El catorce por ciento sube hoy.'],
      ],
    );
    for (const o of captions) {
      const scene = manifest.tracks.scenes.find((s) => s.id === o.sceneId);
      assert.ok(o.id && o.durationInFrames > 0, o.id);
      assert.ok(o.fromFrame >= scene.fromFrame && o.fromFrame + o.durationInFrames <= scene.fromFrame + scene.durationInFrames, `${o.id} inside its scene`);
    }
    assert.equal(manifest.metadata.narrationCaptions.length, 9, 'the word timings stay in the manifest');
    // The emitter mounts the caption component per segment and draws no raw word host.
    const { indexHtml } = buildProject(manifest);
    assert.equal((indexHtml.match(/data-composition-src="components\/caption\.html"/g) || []).length, 2);
    assert.match(indexHtml, /"text":"El catorce por ciento sube hoy\."/);
    assert.doesNotMatch(indexHtml, /id="captions"/);

    // A corrupt cache entry is a named error, not a silently caption-less video.
    for (const file of fs.readdirSync(path.join(ep.cacheDir, 'captions'))) {
      fs.writeFileSync(path.join(ep.cacheDir, 'captions', file), '{not json', 'utf8');
    }
    console.warn = () => {};
    try {
      await assert.rejects(compileVideo({ scriptPath: ep.scriptPath, cacheDir: ep.cacheDir, bags: BAGS }), /caption-cache-corrupt/);
    } finally {
      console.warn = warn;
    }
  } finally {
    fs.rmSync(ep.root, { recursive: true, force: true });
  }
});

test('the coverage guard matches spelled-out numbers against digits, both ways', () => {
  const es = alignCaptions({ scriptText: 'El catorce por ciento sube', words: words(['El', '14%', 'sube']), language: 'es' });
  assert.equal(es.ok, true);
  assert.equal(es.coverage, 1);
  assert.deepEqual(es.words.map((w) => w.text), ['El', 'catorce', 'por', 'ciento', 'sube'], 'the script text is displayed');
  const en = alignCaptions({ scriptText: 'Up 14% today', words: words(['up', 'fourteen', 'percent', 'today']), language: 'en' });
  assert.equal(en.coverage, 1);
  assert.equal(en.words[1].text, '14%');
  assert.ok(en.words[1].end > en.words[1].start);
  assert.deepEqual(matchKeys('1.250', 'es'), ['mil', 'doscientos', 'cincuenta']);
  assert.deepEqual(matchKeys('21', 'es-ES'), ['veintiuno']);
  assert.deepEqual(matchKeys('un', 'es'), ['uno']);
  assert.deepEqual(matchKeys('2026', 'en'), ['two', 'thousand', 'twenty', 'six']);
  // Words without digits keep their plain normalisation; the threshold is unchanged.
  assert.deepEqual(matchKeys('Árbol,', 'es'), ['arbol']);
  assert.equal(CAPTION_MATCH_MIN, 0.9);
});

test('captions are grouped into readable segments', () => {
  const timed = (list) => list.map(([text, start, end]) => ({ text, start, end }));
  assert.deepEqual(
    groupCaptionSegments(timed([['Hola', 0, 0.3], ['a', 0.4, 0.5], ['todos.', 0.6, 0.9], ['Hoy', 1.0, 1.2], ['vemos', 1.3, 1.6]])).map((s) => s.text),
    ['Hola a todos.', 'Hoy vemos'],
    'a sentence end closes a segment',
  );
  const eight = timed(Array.from({ length: 8 }, (_, i) => [`w${i}`, i * 0.2, i * 0.2 + 0.1]));
  assert.deepEqual(groupCaptionSegments(eight).map((s) => s.text), ['w0 w1 w2 w3 w4 w5 w6', 'w7'], 'at most 7 words');
  const paused = groupCaptionSegments(timed([['uno', 0, 0.3], ['dos', 1.5, 1.8]]));
  assert.deepEqual(paused.map((s) => [s.text, s.start, s.end]), [['uno', 0, 0.3], ['dos', 1.5, 1.8]], 'a pause splits');
  const slow = groupCaptionSegments(timed([['a', 0, 0.5], ['b', 0.6, 1.5], ['c', 1.6, 2.5], ['d', 2.6, 3.4], ['e', 3.5, 3.8]]));
  assert.deepEqual(slow.map((s) => s.text), ['a b c d', 'e'], 'at most 3.2 s');
  assert.deepEqual(groupCaptionSegments(timed([['uno,', 0, 0.1], ['dos', 0.2, 0.3]])).map((s) => s.text), ['uno, dos'], 'a short clause stays');
});

test('transcription runs the pinned HyperFrames CLI through spawnTool, never npx', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-transcribe-cli-'));
  try {
    const cli = path.join(dir, 'node_modules', '.bin', 'hyperframes.cmd');
    fs.mkdirSync(path.dirname(cli), { recursive: true });
    fs.writeFileSync(cli, '', 'utf8');
    fs.writeFileSync(path.join(dir, 'transcript.json'), JSON.stringify([{ text: 'hola', start: 0, end: 0.4 }]), 'utf8');
    const spawned = [];
    const result = runTranscribe({
      audioPath: 'C:\\My Audio\\a.mp3',
      language: 'es',
      model: 'small',
      deps: {
        cwd: dir,
        cliPath: cli,
        spawnTool: (cmd, args, options) => {
          spawned.push({ cmd, args, options });
          return { status: 0, stdout: JSON.stringify({ ok: true, durationSeconds: 1 }), stderr: '' };
        },
      },
    });
    assert.equal(result.ok, true);
    assert.equal(spawned.length, 1);
    assert.equal(spawned[0].cmd, cli);
    assert.deepEqual(spawned[0].args, ['transcribe', 'C:\\My Audio\\a.mp3', '--json', '--engine', 'auto', '--model', 'small', '--language', 'es']);
    assert.equal(spawned[0].options.cwd, dir);
    assert.ok(!transcribeArgs({ audioPath: 'a.mp3' }).includes('npx') && !transcribeArgs({ audioPath: 'a.mp3' }).includes('-y'));

    // A CLI that is not installed is a named reason, not an npx download.
    const missing = runTranscribe({ audioPath: 'a.mp3', deps: { cwd: dir, cliPath: path.join(dir, 'nope', 'hyperframes.cmd'), spawnTool: () => assert.fail('must not spawn') } });
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'hyperframes-missing');

    // A failing CLI keeps its own words.
    const failed = runTranscribe({ audioPath: 'a.mp3', deps: { cwd: dir, cliPath: cli, spawnTool: () => ({ status: 2, stdout: '', stderr: 'model not found' }) } });
    assert.equal(failed.ok, false);
    assert.match(String(failed.error?.message), /model not found/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the whisper model is an installed one when none is declared', () => {
  // A declared caption_model always wins.
  assert.equal(resolveCaptionModel({ language: 'es', captionModel: 'medium', installedModels: ['base'] }), 'medium');
  // Spanish with only `base` and `tiny.en` installed: `base`, never an English-only model.
  assert.equal(resolveCaptionModel({ language: 'es', installedModels: ['base', 'tiny.en'] }), 'base');
  assert.equal(resolveCaptionModel({ language: 'es', installedModels: ['tiny.en'] }), 'small', 'nothing usable: the default');
  // English prefers its `.en` model of the best installed size.
  assert.equal(resolveCaptionModel({ language: 'en', installedModels: ['base', 'base.en', 'tiny'] }), 'base.en');
  assert.equal(resolveCaptionModel({ language: 'en-GB', installedModels: ['medium'] }), 'medium');
  // Nothing installed: the documented defaults.
  assert.equal(resolveCaptionModel({ language: 'en', installedModels: [] }), 'small.en');
  assert.equal(resolveCaptionModel({ language: 'es', installedModels: [] }), 'small');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-whisper-models-'));
  try {
    for (const f of ['ggml-base.bin', 'ggml-small.en.bin', 'README.txt']) fs.writeFileSync(path.join(dir, f), '', 'utf8');
    assert.deepEqual(listInstalledWhisperModels(dir), ['base', 'small.en']);
    assert.deepEqual(listInstalledWhisperModels(path.join(dir, 'missing')), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
