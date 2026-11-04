/**
 * nn-conntent/scripts/lib/knowledge-model.mjs
 *
 * Resolves the structured iNNfo model the scene compiler consumes.
 *
 * The parser is NOT owned here: it is nn-core's `parseKnowledge`, reached through the
 * generated, drift-guarded core mirror (`lib/nn-core.generated.cjs`, target
 * `coNNtent`). This module only adapts its result to the `read_knowledge` shape the
 * lowering step already consumes, so the skill keeps no private markdown reader
 * (design A10).
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';

import { parseKnowledge, slugify as coreSlugify } from './nn-core.generated.cjs';

/** True when `value` is already a structured iNNfo model (read_knowledge shape). */
export function isKnowledgeModel(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && value.elements && typeof value.elements === 'object';
}

/**
 * iNNfo L3 markdown → read_knowledge-shaped model, through the nn-core parser.
 * @param {string} content
 * @returns {{ version: string, frontmatter: object, taxonomy: any[], elements: Record<string, any[]>, rawContent: string }}
 */
export function parseKnowledgeDocument(content) {
  const text = String(content ?? '');
  const parsed = parseKnowledge(text);
  const elements = {};
  for (const [concept, nodes] of parsed.elements.entries()) {
    elements[concept] = nodes;
  }
  return {
    version: 'innfo-read-knowledge@1',
    frontmatter: parsed.frontmatter || {},
    taxonomy: parsed.taxonomy || [],
    elements,
    rawContent: text,
  };
}

/** Kebab-case slug from a display name (nn-core's derivation). */
export function slugify(name) {
  return coreSlugify(String(name || ''));
}

/**
 * Loads the structured model for a script.
 * Precedence: an explicit model object > `<scriptPath>.json` (canonical
 * read_knowledge output) > an explicit `modelPath` > the nn-core parser.
 * @param {string} scriptPath
 * @param {{ model?: object, modelPath?: string }} [options]
 * @returns {object}
 */
export function loadKnowledgeModel(scriptPath, options = {}) {
  if (isKnowledgeModel(options.model)) return options.model;
  const candidates = [];
  if (options.modelPath) candidates.push(options.modelPath);
  if (scriptPath) candidates.push(scriptPath + '.json');
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, 'utf8'));
    }
  }
  if (!scriptPath || !fs.existsSync(scriptPath)) {
    throw new Error(`Knowledge model not found: ${scriptPath || '(no path)'}`);
  }
  return parseKnowledgeDocument(fs.readFileSync(scriptPath, 'utf8'));
}
