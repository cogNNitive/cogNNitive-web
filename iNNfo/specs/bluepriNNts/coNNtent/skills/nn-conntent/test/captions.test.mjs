/**
 * nn-conntent/test/captions.test.mjs
 *
 * Caption alignment over the on-device ASR timings: the displayed text is the script,
 * a coverage below 90% stops the run, accents/case/punctuation are normalised for
 * matching only, and unmatched words interpolate between their neighbours
 * (capability conntent-captions; design D-P3; tasks 3b-3.1..3b-3.6).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CAPTION_MATCH_MIN,
  alignCaptionLines,
  alignCaptions,
  captionsCacheKey,
  dropSilentTail,
  normaliseToken,
  runTranscribe,
  transcribeArgs,
  wordsUnsupported,
} from '../scripts/lib/captions.mjs';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'transcribe-parakeet.json');

const wordsOf = (tokens, gap = 1) =>
  tokens.map((text, index) => ({ text, start: index * gap, end: index * gap + gap * 0.9 }));

test('the match threshold is 90%: 89 stops, 90 passes', () => {
  const script = Array.from({ length: 100 }, (_, i) => 'w' + i).join(' ');
  assert.equal(CAPTION_MATCH_MIN, 0.9);
  const pass = alignCaptions({ scriptText: script, words: wordsOf(script.split(' ').slice(0, 90)) });
  assert.equal(pass.ok, true);
  assert.equal(pass.coverage, 0.9);
  const stop = alignCaptions({ scriptText: script, words: wordsOf(script.split(' ').slice(0, 89)) });
  assert.equal(stop.ok, false);
  assert.equal(stop.reason, 'caption-match-low');
});

test('the displayed text is the script, never the transcript', () => {
  const result = alignCaptions({
    scriptText: 'Café con leche',
    words: wordsOf(['cafe', 'con', 'leche']),
  });
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.words.map((w) => w.text),
    ['Café', 'con', 'leche'],
  );
});

test('normalisation strips accents, case and punctuation for matching only', () => {
  assert.equal(normaliseToken('Café,'), 'cafe');
  assert.equal(normaliseToken('¿Qué?'), 'que');
  assert.equal(normaliseToken('ÉL'), 'el');
  assert.equal(normaliseToken('...'), '');
});

test('unmatched words interpolate between their matched neighbours', () => {
  const script = 'a b c d e f g h i j';
  const words = [
    { text: 'a', start: 0, end: 1 },
    { text: 'c', start: 4, end: 4.5 },
    { text: 'd', start: 4.5, end: 5 },
    { text: 'e', start: 5, end: 5.5 },
    { text: 'f', start: 5.5, end: 6 },
    { text: 'g', start: 6, end: 6.5 },
    { text: 'h', start: 6.5, end: 7 },
    { text: 'i', start: 7, end: 7.5 },
    { text: 'j', start: 7.5, end: 8 },
  ];
  const result = alignCaptions({ scriptText: script, words });
  assert.equal(result.ok, true);
  const b = result.words[1];
  assert.equal(b.text, 'b');
  assert.equal(b.start, 1);
  assert.equal(b.end, 4);
});

test('a hallucinated silent tail is dropped before matching', () => {
  const words = [
    { text: 'a', start: 0, end: 1 },
    { text: 'b', start: 1, end: 2 },
    { text: 'zzz', start: 9.9, end: 10 },
  ];
  const kept = dropSilentTail(words, 10);
  assert.deepEqual(kept.map((w) => w.text), ['a', 'b']);
  // With no duration there is nothing to drop.
  assert.equal(dropSilentTail(words).length, 3);
});

test('lines mode comes from the segment timings and the script text', () => {
  const result = alignCaptionLines({
    scriptText: 'one two three four',
    segments: [
      { text: 'one two', start: 0, end: 2 },
      { text: 'three four', start: 2, end: 4 },
    ],
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines.map((l) => l.text), ['one two', 'three four']);
  assert.equal(result.lines[1].start, 2);
});

test('unspaced languages cannot use words captions', () => {
  assert.equal(wordsUnsupported('ja'), true);
  assert.equal(wordsUnsupported('zh'), true);
  assert.equal(wordsUnsupported('es'), false);
  assert.equal(wordsUnsupported('en'), false);
});

test('the V.3 Parakeet fixture carries word timings and aligns to its own text', () => {
  const entries = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.ok(Array.isArray(entries) && entries.length > 0);
  for (const entry of entries) {
    assert.equal(typeof entry.text, 'string');
    assert.equal(typeof entry.start, 'number');
    assert.equal(typeof entry.end, 'number');
    assert.ok(entry.end >= entry.start);
  }
  const scriptText = entries.map((entry) => entry.text).join(' ');
  const result = alignCaptions({ scriptText, words: entries, audioDurationSeconds: 12.48 });
  assert.equal(result.ok, true, 'the fixture aligns to its own words');
  assert.equal(result.coverage, 1);
  assert.equal(result.words.length, entries.length);
});

test('the transcribe runner uses --engine auto and passes the language', () => {
  const args = transcribeArgs({ audioPath: 'a.wav', language: 'es' });
  assert.deepEqual(args.slice(0, 5), ['transcribe', 'a.wav', '--json', '--engine', 'auto']);
  assert.deepEqual(args.slice(-2), ['--language', 'es']);
  assert.equal(transcribeArgs({ audioPath: 'a.wav' }).includes('--language'), false);
});

test('the runner parses the CLI summary and the transcript file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-captions-run-'));
  try {
    fs.writeFileSync(
      path.join(dir, 'transcript.json'),
      JSON.stringify([{ id: 'w0', text: 'Hola', start: 0, end: 0.5 }]),
      'utf8',
    );
    const result = runTranscribe({
      audioPath: 'a.wav',
      language: 'es',
      deps: {
        cwd: dir,
        run: () =>
          JSON.stringify({
            ok: true,
            engine: 'parakeet',
            model: 'parakeet-tdt-0.6b-v3',
            wordCount: 1,
            durationSeconds: 1,
            transcriptPath: path.join(dir, 'transcript.json'),
          }),
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.engine, 'parakeet');
    assert.equal(result.words[0].text, 'Hola');
    assert.equal(result.words[0].end, 0.5);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an unavailable runtime is reported, not thrown', () => {
  const result = runTranscribe({
    audioPath: 'a.wav',
    deps: { run: () => JSON.stringify({ ok: false, skipped: true, reason: 'whisper_unavailable' }) },
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'whisper_unavailable');
});

test('the cache key covers the audio, the text, the engine and its version', () => {
  const base = captionsCacheKey({ audioSha: 'a', text: 'hola', engine: 'auto', engineVersion: 'v1' });
  assert.match(base, /^[0-9a-f]{64}$/);
  assert.notEqual(base, captionsCacheKey({ audioSha: 'b', text: 'hola', engine: 'auto', engineVersion: 'v1' }));
  assert.notEqual(base, captionsCacheKey({ audioSha: 'a', text: 'adios', engine: 'auto', engineVersion: 'v1' }));
  assert.notEqual(base, captionsCacheKey({ audioSha: 'a', text: 'hola', engine: 'parakeet', engineVersion: 'v1' }));
  assert.notEqual(base, captionsCacheKey({ audioSha: 'a', text: 'hola', engine: 'auto', engineVersion: 'v2' }));
});
