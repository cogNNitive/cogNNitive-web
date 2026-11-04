/**
 * nn-conntent/scripts/lib/kinds.mjs
 *
 * The series grammar: `Scene Kind` and `Chrome` elements declared by the Series document,
 * and the two rules the engine derives from them (capability video-scene-kinds):
 *   - a scene states a kind declared by its Series, or the reserved `Libre`;
 *   - a kind's `presets` are its only cascade contribution, and its `chrome` list resolves
 *     against the `Chrome` element for the cascaded language.
 */

import fs from 'node:fs';
import path from 'node:path';

import { findSeriesRoot } from './video-scope.mjs';
import { parseKnowledgeDocument } from './knowledge-model.mjs';

export const LIBRE = 'Libre';

/** Frontmatter `scope: true`, recognised by the marker and never by file name. */
function isScopeDoc(file) {
  if (!file.endsWith('_NN.md')) return false;
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const fm = /^---\n([\s\S]*?)\n---/.exec(text);
  return Boolean(fm) && /^scope:\s*true\s*$/m.test(fm[1]);
}

/** The Series document of a series folder (at most one; the first `scope: true` wins). */
export function findSeriesDocument(seriesRoot) {
  if (!seriesRoot) return null;
  let entries;
  try {
    entries = fs.readdirSync(seriesRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries.filter((e) => e.isFile()).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(seriesRoot, entry.name);
    if (isScopeDoc(file)) return file;
  }
  return null;
}

/**
 * Reads the grammar from the Series document above `scriptDir`.
 * @returns {{ kinds: Record<string, any>, chrome: Record<string, any>, doc: string|null }}
 */
export function loadSeriesGrammar(scriptDir) {
  const seriesRoot = findSeriesRoot(scriptDir);
  const doc = findSeriesDocument(seriesRoot);
  if (!doc) return { kinds: {}, chrome: {}, doc: null };
  const model = parseKnowledgeDocument(fs.readFileSync(doc, 'utf8'));
  const kinds = {};
  for (const element of model.elements['Scene Kind'] || []) {
    kinds[element.name] = { name: element.name, slug: element.slug, fields: element.fields || {} };
  }
  const chrome = {};
  for (const element of model.elements.Chrome || []) {
    const language = String((element.fields || {}).language || '').trim();
    if (language) chrome[language] = { name: element.name, slug: element.slug, fields: element.fields || {} };
  }
  return { kinds, chrome, doc };
}

/** A kind's only cascade contribution: its expanded `presets` list. `Libre` contributes nothing. */
export function kindBagOf(grammar, kindName) {
  const name = String(kindName ?? '').trim();
  if (!name || name === LIBRE) return null;
  const kind = (grammar?.kinds || {})[name];
  if (!kind) return null;
  return { presets: kind.fields.presets };
}

/** The chrome items a kind lists, in declaration order. */
export function chromeItemsOf(grammar, kindName) {
  const kind = (grammar?.kinds || {})[String(kindName ?? '').trim()];
  const list = kind?.fields?.chrome;
  if (!list) return [];
  return Array.isArray(list) ? list.map(String) : [String(list)];
}

/**
 * Resolves a kind's chrome for one language.
 * @returns {{ fields: Record<string, string>, missing: string[] }}
 */
export function chromeFieldsFor(grammar, kindName, language) {
  const items = chromeItemsOf(grammar, kindName);
  const element = (grammar?.chrome || {})[String(language ?? '').trim()];
  const fields = element?.fields || {};
  const out = {};
  const missing = [];
  for (const item of items) {
    const value = fields[item];
    if (value === undefined || value === null || String(value).trim() === '') missing.push(item);
    else out[item] = value;
  }
  return { fields: out, missing };
}

/**
 * Validates every scene's `kind` against the Series grammar.
 * A V_0-15-0 document MUST state a kind on every scene; a legacy document (no
 * `blueprint_version`) is exempt so pre-V_0-15-0 corpora keep compiling.
 * @returns {Array<{ code: string, message: string }>}
 */
export function validateSceneKinds(model, grammar) {
  const errors = [];
  const pinned = String(model?.frontmatter?.blueprint_version || '').trim();
  const requiresKind = pinned === 'V_0-15-0';
  const names = Object.keys(grammar?.kinds || {}).sort();
  for (const scene of model?.elements?.Scene || []) {
    const fields = scene.fields || {};
    const kind = String(fields.kind ?? '').trim();
    if (!kind) {
      if (requiresKind) {
        errors.push({ code: 'missing-kind', message: `Scene "${scene.name}" states no kind::; declare one of ${[...names, LIBRE].join(', ')}.` });
      }
      continue;
    }
    if (kind === LIBRE) continue;
    if (!names.includes(kind)) {
      errors.push({
        code: 'unknown-kind',
        message: `Scene "${scene.name}" states kind:: ${kind}, which the Series does not declare (available: ${[...names, LIBRE].join(', ')}).`,
      });
    }
  }
  return errors;
}

/** A V_0-15-0 document MUST resolve a language: the blueprint ships no default. */
export function validateLanguage(model, resolvedLanguage) {
  const pinned = String(model?.frontmatter?.blueprint_version || '').trim();
  if (pinned !== 'V_0-15-0') return null;
  const value = String(resolvedLanguage ?? '').trim();
  if (value) return null;
  return {
    code: 'missing-language',
    message: 'No level declares language::; the blueprint ships no default, so a V_0-15-0 document must set one.',
  };
}
