/**
 * nn-video-script/scripts/lib/knowledge-model.mjs
 *
 * Resolves the structured iNNfo model the scene compiler consumes.
 *
 * The canonical source is innfo-core `read_knowledge` (the JSON object with
 * `frontmatter`, `taxonomy`, `elements`, `rawContent`). When a machine-MCP
 * produced model is available as `<script>.json` (or passed directly) it is used
 * verbatim. Otherwise a structural reader extracts the same shape from an iNNfo
 * Level-3 document — the generic `# NN <Concept>` / `## NN <Concept>: <Name>` /
 * `key:: value` grammar the L1 meta-bluepriNNt defines. This reader is NOT the
 * scene compiler: the compiler never parses markdown, it only lowers the
 * structured model this module returns.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';

const CONCEPT_HEADING_RE = /^#\s+NN\s+(.+?)\s*$/;
const ELEMENT_HEADING_RE = /^##\s+NN\s+(.+?):\s*(.*)$/;
const PROPERTY_RE = /^([A-Za-z_][A-Za-z0-9_]*)::\s?(.*)$/;

/** True when `value` is already a structured iNNfo model (read_knowledge shape). */
export function isKnowledgeModel(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && value.elements && typeof value.elements === 'object';
}

/** Parses the small YAML subset iNNfo frontmatter uses (scalars + one nesting level). */
function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return {};
  const fm = {};
  let parentKey = null;
  for (const raw of match[1].split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const indent = raw.match(/^\s*/)[0].length;
    const entry = /^\s*([A-Za-z_][A-Za-z0-9_]*|'[^']+'|"[^"]+"):\s*(.*)$/.exec(raw);
    if (!entry) continue;
    const key = entry[1].replace(/^['"]|['"]$/g, '');
    let value = entry[2].trim().replace(/^['"]|['"]$/g, '');
    if (value === '') {
      parentKey = indent === 0 ? key : parentKey;
      if (indent === 0) fm[key] = {};
      continue;
    }
    if (indent > 0 && parentKey) {
      fm[parentKey][key] = value;
    } else {
      parentKey = null;
      fm[key] = value;
    }
  }
  return fm;
}

/** Splits a body into top-level `# NN` sections, ignoring fenced code. */
function splitSections(body) {
  const lines = body.split(/\r?\n/);
  const sections = [];
  let current = null;
  let inFence = false;
  for (const line of lines) {
    if (/^(```|~~~)/.test(line.trim())) inFence = !inFence;
    if (!inFence && /^#\s/.test(line)) {
      current = { heading: line, lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return sections;
}

/**
 * Structural reader: iNNfo L3 markdown → read_knowledge-shaped model.
 * @param {string} content
 * @returns {{ version: string, frontmatter: object, taxonomy: any[], elements: Record<string, any[]>, rawContent: string }}
 */
export function parseKnowledgeDocument(content) {
  const text = String(content ?? '');
  const frontmatter = parseFrontmatter(text);
  const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
  const elements = {};
  const taxonomy = [];

  for (const section of splitSections(body)) {
    const conceptMatch = CONCEPT_HEADING_RE.exec(section.heading.trim());
    if (!conceptMatch) continue;
    const concept = conceptMatch[1].trim();
    if (concept.toLowerCase() === 'index') {
      // Concept-level taxonomy is not needed to lower the model.
      continue;
    }
    // Only element sections carry `## NN <Concept>: <Name>` headings.
    const lines = section.lines;
    let i = 0;
    while (i < lines.length) {
      const em = ELEMENT_HEADING_RE.exec(lines[i].trim());
      if (!em || em[1].trim().toLowerCase() !== concept.toLowerCase()) {
        i++;
        continue;
      }
      const element = { type: concept, name: em[2].trim(), description: '', fields: {}, markers: {}, slug: undefined, slugExplicit: false };
      i++;
      // Property block: consecutive `key:: value` lines.
      for (; i < lines.length; i++) {
        const tm = lines[i].trim();
        if (tm === '') break;
        const pm = PROPERTY_RE.exec(tm);
        if (!pm) break;
        const key = pm[1];
        const value = pm[2].trim();
        if (key === 'slug') {
          element.slug = value;
          element.slugExplicit = true;
        } else {
          element.fields[key] = value;
        }
      }
      // Free-form body after the property block is the description (narration prose).
      const descLines = [];
      for (; i < lines.length; i++) {
        const hm = ELEMENT_HEADING_RE.exec(lines[i].trim());
        if (hm && hm[1].trim().toLowerCase() === concept.toLowerCase()) break;
        descLines.push(lines[i]);
      }
      element.description = descLines.join('\n').trim();
      if (!element.slug) element.slug = slugify(element.name);
      (elements[concept] = elements[concept] || []).push(element);
    }
  }

  return { version: 'innfo-read-knowledge@1', frontmatter, taxonomy, elements, rawContent: text };
}

/** Kebab-case slug from a display name (matches L1 slug derivation closely enough for ids). */
export function slugify(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Loads the structured model for a script.
 * Precedence: an explicit model object > `<scriptPath>.json` (canonical
 * read_knowledge output) > an explicit `modelPath` > the markdown reader.
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

/**
 * Discovers Series L3 Template documents near a script and returns a
 * `name → { tool, voice, model }` map so `template::` references resolve.
 * Scans the script's directory and up to three ancestor levels (their
 * immediate subdirectories included) for `templates_*_NN.md`.
 * @param {string} startDir
 * @returns {Record<string, { tool?: string, voice?: string, model?: string }>}
 */
export function loadTemplateModels(startDir) {
  const templates = {};
  if (!startDir || !fs.existsSync(startDir)) return templates;
  const dirs = new Set();
  let dir = path.resolve(startDir);
  for (let depth = 0; depth < 4; depth++) {
    dirs.add(dir);
    let subdirs = [];
    try {
      subdirs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name));
    } catch {
      subdirs = [];
    }
    for (const sub of subdirs) dirs.add(sub);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const d of dirs) {
    let files = [];
    try {
      files = fs.readdirSync(d).filter((f) => /^templates_.*_NN\.md$/.test(f));
    } catch {
      files = [];
    }
    for (const f of files) {
      const model = parseKnowledgeDocument(fs.readFileSync(path.join(d, f), 'utf8'));
      for (const t of model.elements.Template || []) {
        templates[t.name] = { tool: t.fields.tool, voice: t.fields.voice, model: t.fields.model };
      }
    }
  }
  return templates;
}
