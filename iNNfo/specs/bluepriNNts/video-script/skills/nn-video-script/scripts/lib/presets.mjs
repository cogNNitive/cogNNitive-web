/**
 * nn-video-script/scripts/lib/presets.mjs
 *
 * Preset loading, lookup and list parsing for the video-script bluepriNNt
 * (design D1-D4 of change 2026-11-01-video-presets).
 *
 * A `Preset` is a named bundle of cascade parameters with no fields of its own.
 * A level references Presets with an ordered list of bare names,
 * `presets:: [Lucas, Studio Warm]`; the cascade then expands each level's list
 * into scope nodes placed directly under that level's explicit fields, which
 * gives: last Preset of a list wins, an element's explicit fields beat its own
 * Presets, and a nearer level beats every outer level.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import { parseKnowledgeDocument } from './knowledge-model.mjs';

/**
 * The only keys a Preset element may carry: the Fields whose `concept::`
 * lists `Preset`. A drift test compares this set against `spec_NN.md`.
 */
export const PRESET_PARAMETERS = new Set([
  'avatar',
  'avatar_model',
  'background_audio',
  'background_audio_volume',
  'components',
  'fit',
  'frame',
  'image_model',
  'intro',
  'sounds',
  'transition',
  'voice',
  'voice_emotion',
  'voice_model',
  'voice_speed',
  'voice_tone',
]);

/** Reserved iNNfo identity keys: never preset parameters, never a preset-field error. */
export const RESERVED_PRESET_KEYS = new Set(['slug']);

/**
 * Global Fields that any element may carry (`concept:: *`). They are not preset
 * parameters and never alter a resolved value; `tags` characterises a Preset.
 */
export const GLOBAL_PRESET_KEYS = new Set(['tags']);

/** A Preset error carries a stable `code` so callers can aggregate it before spend. */
export class PresetError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PresetError';
    this.code = code;
  }
}

/**
 * Parses a `presets` value into an ordered list of names.
 *
 * Accepts the array shape `read_knowledge` returns and the raw string shape the
 * skill's markdown reader returns (`[A, B]` or a single bare `A`).
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export function parsePresetList(value) {
  if (value === undefined || value === null) return [];
  let tokens;
  if (Array.isArray(value)) {
    tokens = value.map((v) => String(v));
  } else {
    const raw = String(value).trim();
    if (raw === '') return [];
    if (raw.startsWith('[[') || raw.endsWith(']]') || raw.includes('::')) {
      throw new PresetError(
        'preset-syntax',
        `Invalid preset reference "${raw}": write the list with bare names, e.g. presets:: [Lucas, Studio Warm]`,
      );
    }
    if (raw.startsWith('[') && raw.endsWith(']')) {
      const inner = raw.slice(1, -1).trim();
      tokens = inner === '' ? [] : inner.split(',');
    } else {
      tokens = [raw];
    }
  }
  const names = [];
  const seen = new Set();
  for (const token of tokens) {
    const name = token.trim().replace(/^["']|["']$/g, '').trim();
    if (name === '') continue;
    if (name.includes('[[') || name.includes(']]') || name.includes('::')) {
      throw new PresetError(
        'preset-syntax',
        `Invalid preset reference "${name}": write the list with bare names, e.g. presets:: [Lucas, Studio Warm]`,
      );
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new PresetError('preset-duplicate', `Preset "${name}" is listed twice in one presets list`);
    }
    seen.add(key);
    names.push(name);
  }
  return names;
}

/** Raises `preset-field` for any key that is neither a preset parameter nor reserved. */
export function assertPresetFields(element) {
  const name = element?.name || '(unnamed)';
  for (const key of Object.keys(element?.fields || {})) {
    if (PRESET_PARAMETERS.has(key)) continue;
    if (GLOBAL_PRESET_KEYS.has(String(key).toLowerCase())) continue;
    if (RESERVED_PRESET_KEYS.has(String(key).toLowerCase())) continue;
    throw new PresetError(
      'preset-field',
      `Preset "${name}" declares "${key}", which is not a preset parameter; a Preset carries cascade parameters only (no presets, type, asset, title or Layers)`,
    );
  }
}

/**
 * Builds the preset index from documents in priority order (nearest first).
 * The first definition of a name (by name or by slug, case-insensitive) wins.
 *
 * @param {Array<{ doc: string|null, elements: Record<string, any[]> }>} sources
 */
export function loadPresetIndex(sources = []) {
  const byKey = new Map();
  const documents = [];
  for (const source of sources) {
    const doc = source?.doc || null;
    if (doc && !documents.includes(doc)) documents.push(doc);
    const seen = new Map();
    for (const element of source?.elements?.Preset || []) {
      assertPresetFields(element);
      const values = { ...(element.fields || {}) };
      const keys = [
        ...new Set(
          [element.name, element.slug]
            .filter((k) => k !== undefined && k !== null && String(k).trim() !== '')
            .map((k) => String(k).trim().toLowerCase()),
        ),
      ];
      if (keys.length === 0) {
        throw new PresetError('preset-duplicate', `A Preset in ${doc || 'an unnamed document'} has neither a name nor a slug`);
      }
      for (const lower of keys) {
        const owner = seen.get(lower);
        if (owner) {
          throw new PresetError(
            'preset-duplicate',
            `Preset "${element.name}" duplicates "${owner}" in ${doc || 'one document'} (same name or slug)`,
          );
        }
      }
      for (const lower of keys) {
        seen.set(lower, element.name || lower);
        if (!byKey.has(lower)) byKey.set(lower, { name: element.name || lower, doc, values });
      }
    }
  }
  return {
    documents,
    sources: sources.slice(),
    find(name) {
      const key = String(name ?? '').trim().toLowerCase();
      return byKey.get(key) || null;
    },
  };
}

/** Resolves a name against the index, or raises `unknown-preset` naming every document searched. */
export function lookupPreset(index, name) {
  const found = index ? index.find(name) : null;
  if (!found) {
    const searched = index?.documents?.length ? index.documents.join(', ') : 'the script, the Series chain and the domain Video Defaults';
    throw new PresetError(
      'unknown-preset',
      `Unknown preset "${name}": no Preset of that name or slug in: ${searched}`,
    );
  }
  return found;
}

/** Reads the Preset elements of one document (absolute path), or `[]` when it has none. */
export function presetSourceFromFile(file) {
  if (!file || !fs.existsSync(file)) return { doc: file || null, elements: {} };
  const elements = parseKnowledgeDocument(fs.readFileSync(file, 'utf8')).elements || {};
  return { doc: file, elements };
}
