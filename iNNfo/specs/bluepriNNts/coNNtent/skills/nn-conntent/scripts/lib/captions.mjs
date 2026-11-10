/**
 * nn-conntent/scripts/lib/captions.mjs
 *
 * Caption alignment (capability conntent-captions; design D-P3; tasks 3b-3.1..3b-3.6).
 * The on-device ASR engine only supplies timings: the displayed text is always the
 * script. Alignment is a normalised LCS; unmatched script words interpolate between
 * their matched neighbours, and a coverage below CAPTION_MATCH_MIN stops the run.
 *
 * Zero external dependencies. ESM module.
 */

import { canonicalJson, sha256Hex } from './canonical.mjs';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** The minimum share of script words that must match a transcript word. */
export const CAPTION_MATCH_MIN = 0.9;

/** Words that start this close to the end of the audio are a silent tail, not speech. */
export const SILENT_TAIL_SECONDS = 0.5;

/** Languages whose script cannot be split into words reliably (no spaces). */
export const UNSPACED_LANGUAGES = new Set(['zh', 'zh-hans', 'zh-hant', 'ja']);

/**
 * Normalize one token for matching only: NFC -> NFD, strip accents, casefold, strip
 * punctuation. The displayed text is never normalised.
 */
export function normaliseToken(token) {
  return String(token == null ? '' : token)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

/** The script split into display tokens (whitespace), keeping their text. */
export function scriptTokens(text) {
  return String(text == null ? '' : text)
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** One timing per word in a segment, spread evenly over its span. */
export function wordsFromSegment(segment) {
  const tokens = scriptTokens(segment.text);
  if (tokens.length === 0) return [];
  const start = Number(segment.start) || 0;
  const end = Number(segment.end) === undefined || Number.isNaN(Number(segment.end)) ? start : Number(segment.end);
  const span = Math.max(0, end - start);
  const step = span / tokens.length;
  return tokens.map((text, index) => ({
    text,
    start: start + step * index,
    end: start + step * (index + 1),
  }));
}

/** Flatten a transcript (word entries or segments) into word timings. */
export function transcriptWords(entries = []) {
  const words = [];
  for (const entry of entries) {
    if (!entry) continue;
    if (entry.word !== undefined || entry.start !== undefined) {
      // A word entry may be `{text|word, start, end}`.
      const text = String(entry.word !== undefined ? entry.word : entry.text || '').trim();
      if (!text) continue;
      words.push({ text, start: Number(entry.start) || 0, end: Number(entry.end) || Number(entry.start) || 0 });
    }
  }
  return words;
}

/**
 * The longest common subsequence of two token arrays, as pairs `[scriptIndex, transcriptIndex]`.
 * Case/normalisation is the caller's job.
 */
export function lcsPairs(script, transcript) {
  const n = script.length;
  const m = transcript.length;
  const table = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = script[i] === transcript[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (script[i] === transcript[j] && table[i][j] === table[i + 1][j + 1] + 1) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/** Drop transcript words that start inside the silent tail of the audio. */
export function dropSilentTail(words, audioDurationSeconds) {
  const duration = Number(audioDurationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) return words;
  const floor = duration - SILENT_TAIL_SECONDS;
  return words.filter((word) => Number(word.start) < floor);
}

/**
 * Align the script to the transcript timings.
 *
 * @param {{ scriptText: string, words?: Array<{text: string, start: number, end: number}>,
 *   segments?: Array<{text: string, start: number, end: number}>,
 *   audioDurationSeconds?: number }} input
 * @returns {{ ok: boolean, reason?: string, coverage: number,
 *   words: Array<{ text: string, start: number, end: number }> }}
 */
export function alignCaptions({ scriptText, words = [], segments = [], audioDurationSeconds }) {
  const script = scriptTokens(scriptText);
  const normalisedScript = script.map(normaliseToken);
  const transcript = dropSilentTail(words.length > 0 ? words : segments.flatMap(wordsFromSegment), audioDurationSeconds)
    .map((word) => ({ ...word, norm: normaliseToken(word.text) }))
    .filter((word) => word.norm !== '');

  if (script.length === 0) return { ok: true, coverage: 1, words: [] };
  if (transcript.length === 0) return { ok: false, reason: 'caption-match-low', coverage: 0, words: [] };

  const pairs = lcsPairs(
    normalisedScript,
    transcript.map((word) => word.norm),
  );
  const coverage = pairs.length / script.length;
  if (coverage < CAPTION_MATCH_MIN) {
    return { ok: false, reason: 'caption-match-low', coverage, words: [] };
  }

  // Timings for every script token: matched ones from the transcript, the rest
  // interpolated between their nearest matched neighbours.
  const timed = new Array(script.length).fill(null);
  for (const [scriptIndex, transcriptIndex] of pairs) {
    timed[scriptIndex] = { start: transcript[transcriptIndex].start, end: transcript[transcriptIndex].end };
  }
  let firstStart = transcript[0].start;
  let lastEnd = transcript[transcript.length - 1].end;
  for (let index = 0; index < timed.length; index++) {
    if (timed[index]) continue;
    let prev = index - 1;
    while (prev >= 0 && !timed[prev]) prev--;
    let next = index + 1;
    while (next < timed.length && !timed[next]) next++;
    const startBoundary = prev >= 0 ? timed[prev].end : firstStart;
    const endBoundary = next < timed.length ? timed[next].start : lastEnd;
    const gapCount = Math.max(1, next - prev - 1);
    const slot = index - prev;
    const step = Math.max(0, endBoundary - startBoundary) / gapCount;
    timed[index] = {
      start: startBoundary + step * (slot - 1),
      end: startBoundary + step * slot,
    };
  }
  return {
    ok: true,
    coverage,
    words: script.map((text, index) => ({ text, start: timed[index].start, end: timed[index].end })),
  };
}

/**
 * Lines mode from segment timings: the script words of each segment, split by the
 * segment's share of the transcript text.
 */
export function alignCaptionLines({ scriptText, segments = [] }) {
  const script = scriptTokens(scriptText);
  const usable = (segments || []).filter((segment) => segment && String(segment.text || '').trim() !== '');
  if (usable.length === 0) return { ok: false, reason: 'caption-match-low', coverage: 0, lines: [] };
  const counts = usable.map((segment) => scriptTokens(segment.text).length || 1);
  const total = counts.reduce((sum, value) => sum + value, 0);
  const lines = [];
  let cursor = 0;
  usable.forEach((segment, index) => {
    const share = index === usable.length - 1 ? script.length - cursor : Math.round((counts[index] / total) * script.length);
    const text = script.slice(cursor, cursor + share).join(' ');
    cursor += share;
    lines.push({ text, start: Number(segment.start) || 0, end: Number(segment.end) || Number(segment.start) || 0 });
  });
  return { ok: true, coverage: 1, lines };
}

/** True when `captions: words` cannot work for the language (no spaces). */
export function wordsUnsupported(language) {
  return UNSPACED_LANGUAGES.has(String(language || '').toLowerCase());
}

/** The engine/version identity that makes a caption cache key change. */
export function captionsCacheKey({ audioSha, text, engine = 'auto', engineVersion = '' }) {
  return sha256Hex(canonicalJson({ audio_sha: audioSha, text: String(text || ''), engine, engine_version: String(engineVersion || '') }));
}

/** The `hyperframes transcribe` argv (explicit model when provided). */
export function transcribeArgs({ audioPath, language, model }) {
  const args = ['-y', 'hyperframes', 'transcribe', String(audioPath), '--json', '--engine', 'auto'];
  if (model) args.push('--model', String(model));
  if (language) args.push('--language', String(language));
  return args;
}

/**
 * Transcribe one audio file in a throwaway cwd. The CLI prints a summary on stdout and
 * writes the word list to `transcript.json`. `deps.run` is the seam for tests.
 *
 * @param {{ audioPath: string, language?: string, model?: string, deps?: { run?: Function, cwd?: string } }} input
 */
export function runTranscribe({ audioPath, language, model, deps = {} }) {
  const run = deps.run || ((args, options) => execFileSync('npx', args, options));
  const cwd = deps.cwd || fs.mkdtempSync(path.join(os.tmpdir(), 'nn-transcribe-'));
  let summary
  try {
    summary = JSON.parse(String(run(transcribeArgs({ audioPath, language, model }), { cwd, encoding: 'utf8' })));
  } catch (err) {
    return { ok: false, reason: 'transcribe-failed', error: err };
  }
  if (!summary || summary.ok !== true) {
    return { ok: false, reason: (summary && summary.reason) || 'transcribe-failed' };
  }
  const transcriptPath = summary.transcriptPath || path.join(cwd, 'transcript.json');
  let words
  try {
    words = JSON.parse(fs.readFileSync(transcriptPath, 'utf8'));
  } catch (err) {
    return { ok: false, reason: 'transcribe-failed', error: err };
  }
  return {
    ok: true,
    engine: summary.engine || 'auto',
    model: summary.model || '',
    durationSeconds: summary.durationSeconds,
    words: Array.isArray(words) ? words : [],
  };
}
