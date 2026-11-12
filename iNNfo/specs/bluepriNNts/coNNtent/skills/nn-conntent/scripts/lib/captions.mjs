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
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnTool } from './spawn-tool.mjs';
import { resolveHyperframesCli } from '../scene-project.mjs';

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

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ES_ONES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve'];
const ES_TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const ES_HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function enWords(n) {
  if (n < 20) return [EN_ONES[n]];
  if (n < 100) return n % 10 ? [EN_TENS[Math.floor(n / 10)], EN_ONES[n % 10]] : [EN_TENS[n / 10]];
  if (n < 1000) return [EN_ONES[Math.floor(n / 100)], 'hundred', ...(n % 100 ? enWords(n % 100) : [])];
  for (const [size, name] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) {
    if (n >= size) return [...enWords(Math.floor(n / size)), name, ...(n % size ? enWords(n % size) : [])];
  }
  return [String(n)];
}

function esWords(n) {
  if (n < 30) return [ES_ONES[n]];
  if (n < 100) return n % 10 ? [ES_TENS[Math.floor(n / 10)], 'y', ES_ONES[n % 10]] : [ES_TENS[n / 10]];
  if (n === 100) return ['cien'];
  if (n < 1000) return [ES_HUNDREDS[Math.floor(n / 100)], ...(n % 100 ? esWords(n % 100) : [])];
  if (n < 1e6) {
    const k = Math.floor(n / 1000);
    return [...(k === 1 ? [] : esWords(k)), 'mil', ...(n % 1000 ? esWords(n % 1000) : [])];
  }
  if (n < 1e12) {
    const m = Math.floor(n / 1e6);
    return [...(m === 1 ? ['uno', 'millon'] : [...esWords(m), 'millon']), ...(n % 1e6 ? esWords(n % 1e6) : [])];
  }
  return [String(n)];
}

/** Spellings that name the same number word (`un`/`una` = `uno`), per language. */
const ALIASES = { es: { un: 'uno', una: 'uno', veintiun: 'veintiuno', veintiuna: 'veintiuno', millones: 'millon' } };
const PERCENT = { en: ['percent'], es: ['por', 'ciento'] };

/** Base language of a tag (`es-ES` -> `es`). */
const baseLanguage = (language) => String(language || 'en').toLowerCase().split(/[-_]/)[0];

/**
 * Matching keys for one display token. A token written with digits (`14%`, `1.000`,
 * `2026`) expands to its spelled-out words in the language, so a script that spells a
 * number out and a transcript that writes it in digits (or the reverse) still match.
 * Languages without a number table keep the digits. The displayed text never changes.
 * @param {string} token
 * @param {string} [language]
 * @returns {string[]}
 */
export function matchKeys(token, language = 'en') {
  const lang = baseLanguage(language);
  const aliases = ALIASES[lang] || {};
  const raw = String(token == null ? '' : token);
  const number = /^[^\p{L}\p{N}]*(\d{1,3}(?:[.,]\d{3})+|\d+)(%?)[^\p{L}\p{N}]*$/u.exec(raw);
  const toWords = lang === 'es' ? esWords : lang === 'en' ? enWords : null;
  if (number && toWords) {
    const value = Number(number[1].replace(/[.,]/g, ''));
    if (Number.isSafeInteger(value)) {
      return [...toWords(value), ...(number[2] ? PERCENT[lang] : [])].map((w) => aliases[w] || w);
    }
  }
  const norm = normaliseToken(raw);
  if (!norm) return [];
  return [aliases[norm] || norm];
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
export function alignCaptions({ scriptText, words = [], segments = [], audioDurationSeconds, language = 'en' }) {
  const script = scriptTokens(scriptText);
  // Both sides become matching keys (numbers spelled out in the language), so
  // "catorce por ciento" in the script matches "14%" in the transcript, and the reverse.
  const scriptKeys = [];
  const keyOwner = [];
  script.forEach((token, index) => {
    for (const key of matchKeys(token, language)) {
      scriptKeys.push(key);
      keyOwner.push(index);
    }
  });
  const transcript = [];
  for (const word of dropSilentTail(words.length > 0 ? words : segments.flatMap(wordsFromSegment), audioDurationSeconds)) {
    const keys = matchKeys(word.text, language);
    const start = Number(word.start) || 0;
    const step = Math.max(0, (Number(word.end) || start) - start) / Math.max(1, keys.length);
    keys.forEach((norm, k) => transcript.push({ norm, start: start + step * k, end: start + step * (k + 1) }));
  }

  if (script.length === 0) return { ok: true, coverage: 1, words: [] };
  if (transcript.length === 0) return { ok: false, reason: 'caption-match-low', coverage: 0, words: [] };

  const pairs = lcsPairs(
    scriptKeys,
    transcript.map((word) => word.norm),
  );
  // A display token is matched when any of its keys matched; its timing spans them.
  const timed = new Array(script.length).fill(null);
  for (const [keyIndex, transcriptIndex] of pairs) {
    const owner = keyOwner[keyIndex];
    const hit = transcript[transcriptIndex];
    timed[owner] = timed[owner]
      ? { start: Math.min(timed[owner].start, hit.start), end: Math.max(timed[owner].end, hit.end) }
      : { start: hit.start, end: hit.end };
  }
  const coverage = timed.filter(Boolean).length / script.length;
  if (coverage < CAPTION_MATCH_MIN) {
    return { ok: false, reason: 'caption-match-low', coverage, words: [] };
  }

  // Timings for every script token: matched ones from the transcript, the rest
  // interpolated between their nearest matched neighbours.
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

/**
 * The one cache key for a scene's aligned captions, shared by the writer (the
 * captions stage) and the reader (compile): the audio FILE bytes, the narration text
 * and the model/language. Throws when the audio file cannot be read.
 * @param {{ audioPath: string, text: string, modelName: string, language: string }} input
 */
export function sceneCaptionsCacheKey({ audioPath, text, modelName, language }) {
  const audioSha = crypto.createHash('sha256').update(fs.readFileSync(audioPath)).digest('hex');
  return captionsCacheKey({ audioSha, text: String(text || '').trim(), engine: 'auto', engineVersion: `${modelName}:${language}` });
}

/** Readable caption segments: at most this many words and seconds. */
export const CAPTION_SEGMENT_MAX_WORDS = 7;
export const CAPTION_SEGMENT_MAX_SECONDS = 3.2;
/** A pause at least this long between two words starts a new segment. */
export const CAPTION_SEGMENT_GAP_SECONDS = 0.6;

/**
 * Groups timed words into readable caption segments. A segment ends at a sentence
 * end, at a clause break once it holds 4 words, at CAPTION_SEGMENT_MAX_WORDS words or
 * CAPTION_SEGMENT_MAX_SECONDS seconds, and before a pause of CAPTION_SEGMENT_GAP_SECONDS.
 * @param {Array<{ text: string, start: number, end: number }>} words
 * @returns {Array<{ text: string, start: number, end: number }>}
 */
export function groupCaptionSegments(words = []) {
  const segments = [];
  let current = null;
  const close = () => {
    if (current) segments.push({ text: current.words.join(' '), start: current.start, end: current.end });
    current = null;
  };
  for (const word of words) {
    const text = String(word?.text || '').trim();
    if (!text) continue;
    const start = Number(word.start) || 0;
    const end = Math.max(start, Number(word.end) || start);
    if (current && start - current.end >= CAPTION_SEGMENT_GAP_SECONDS) close();
    if (!current) current = { words: [], start, end };
    current.words.push(text);
    current.end = Math.max(current.end, end);
    const endsSentence = /[.!?…]["'”»)]*$/.test(text);
    const endsClause = /[,;:]$/.test(text);
    if (
      endsSentence ||
      (endsClause && current.words.length >= 4) ||
      current.words.length >= CAPTION_SEGMENT_MAX_WORDS ||
      current.end - current.start >= CAPTION_SEGMENT_MAX_SECONDS
    ) {
      close();
    }
  }
  close();
  return segments;
}

/** The `hyperframes transcribe` argv for the pinned CLI (explicit model when provided). */
export function transcribeArgs({ audioPath, language, model }) {
  const args = ['transcribe', String(audioPath), '--json', '--engine', 'auto'];
  if (model) args.push('--model', String(model));
  if (language) args.push('--language', String(language));
  return args;
}

/**
 * Transcribe one audio file in a throwaway cwd. The CLI prints a summary on stdout and
 * writes the word list to `transcript.json`. `deps.run` is the seam for tests.
 *
 * The default runner is the skill's pinned HyperFrames CLI, never `npx` (which needs
 * the registry and may resolve another version), spawned through `spawnTool` so the
 * Windows `.cmd` shim runs.
 *
 * @param {{ audioPath: string, language?: string, model?: string, deps?: { run?: Function, cwd?: string, cliPath?: string, spawnTool?: Function } }} input
 */
export function runTranscribe({ audioPath, language, model, deps = {} }) {
  const run = deps.run || ((args, options) => runPinnedCli(args, options, deps));
  const cwd = deps.cwd || fs.mkdtempSync(path.join(os.tmpdir(), 'nn-transcribe-'));
  let summary
  try {
    summary = JSON.parse(String(run(transcribeArgs({ audioPath, language, model }), { cwd, encoding: 'utf8' })));
  } catch (err) {
    if (err?.code === 'hyperframes-missing') return { ok: false, reason: 'hyperframes-missing', error: err };
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

/**
 * Runs the pinned HyperFrames CLI and returns its stdout. A CLI that is not
 * installed is a `hyperframes-missing` error; a non-zero exit carries the CLI's own
 * words. `deps.cliPath`/`deps.spawnTool` are test seams.
 */
function runPinnedCli(args, options, deps = {}) {
  const cli = deps.cliPath || resolveHyperframesCli();
  if (!fs.existsSync(cli)) {
    throw Object.assign(new Error(`the pinned HyperFrames CLI is not installed at ${cli}`), { code: 'hyperframes-missing' });
  }
  const res = (deps.spawnTool || spawnTool)(cli, args, { ...options, maxBuffer: 64 * 1024 * 1024 });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    throw new Error(`hyperframes transcribe exited ${res.status}: ${String(res.stderr || res.stdout || '').trim().slice(-2000)}`);
  }
  return res.stdout;
}
