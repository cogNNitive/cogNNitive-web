#!/usr/bin/env node

/**
 * scripts/generate-about-twin.mjs
 *
 * Derives docs/innfo/about.md as a whole-file generated Markdown twin of
 * docs/innfo/about.html (design D6, superseding the original "delete
 * about.md" decision). `about.html` stays the single canonical About page;
 * this generator mechanically extracts its `<main>` content — dropping any
 * `<nav>`, `<footer>`, or `<script>` — and converts headings, paragraphs,
 * links, and inline code to Markdown, prefixed by a frontmatter block
 * derived from the page's own `<head>` metadata. This matches the
 * nn-site-generator ai-readiness convention that every published HTML page
 * carries a Markdown twin with the same content and no chrome.
 *
 * Unlike scripts/generate-docs-facts.mjs, this generator owns the *entire*
 * target file, not a marker-delimited region: about.md is never hand-edited
 * again, so there is no hand-authored surrounding content to preserve.
 *
 * CLI contract:
 *   node scripts/generate-about-twin.mjs [--check] [--against <git-ref>]
 *     (no flags)            write mode: regenerate and write docs/innfo/about.md
 *     --check               compare the render against the on-disk file, do not write
 *     --check --against X   compare against `git show X:<path>` instead of the
 *                            working tree (used by CI, which runs write mode in
 *                            build:docs first — see design D5)
 *
 *     exit 0  write succeeded, or --check: the target is up to date
 *     exit 1  --check: the target differs from the generated render
 *     exit 2  input failure: missing about.html, no <main> element, missing
 *             required <head> metadata, or a bad --against ref
 *
 * The render is a pure function of about.html's own content: no timestamp,
 * no generator version, no run id. Regeneration with no upstream change is
 * byte-identical (design "Regeneration is deterministic").
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { normalizeOutput } from './lib/docs-facts.mjs';

const SOURCE_RELATIVE_PATH = path.join('docs', 'innfo', 'about.html');
const TARGET_RELATIVE_PATH = path.join('docs', 'innfo', 'about.md');

const FRONTMATTER_FIELDS = ['title', 'description', 'html_url', 'generator'];

// --- Pure extraction / render functions ---------------------------------

/**
 * Extracts the frontmatter fields for the Markdown twin from the source
 * page's own `<head>`: `<title>`, `<meta name="description">`,
 * `<link rel="canonical">` (as `html_url`), and `<meta name="generator">`.
 * @param {string} html - Full HTML document source.
 * @returns {{ title: string, description: string, html_url: string, generator: string }}
 * @throws {Error} When any required field is missing.
 */
export function extractHeadMetadata(html) {
  const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim();
  const description = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(html)?.[1]?.trim();
  const htmlUrl = /<link\s+rel="canonical"\s+href="([^"]*)"/i.exec(html)?.[1]?.trim();
  const generator = /<meta\s+name="generator"\s+content="([^"]*)"/i.exec(html)?.[1]?.trim();

  const missing = [];
  if (!title) missing.push('<title>');
  if (!description) missing.push('<meta name="description">');
  if (!htmlUrl) missing.push('<link rel="canonical">');
  if (!generator) missing.push('<meta name="generator">');
  if (missing.length > 0) {
    throw new Error(`missing required <head> metadata: ${missing.join(', ')}`);
  }

  return { title, description, html_url: htmlUrl, generator };
}

/**
 * Strips every occurrence of the named tags (with their content) from a
 * fragment of HTML.
 * @param {string} html
 * @param {string[]} tagNames
 * @returns {string}
 */
function stripTags(html, tagNames) {
  let out = html;
  for (const tag of tagNames) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), '');
  }
  return out;
}

/**
 * Extracts the `<main>...</main>` content of the page — the twin's entire
 * scope, so header/nav chrome and the footer (both outside `<main>` in every
 * page this generator targets) never reach it — then defensively strips any
 * `<nav>`, `<footer>`, or `<script>` left inside that fragment.
 * @param {string} html - Full HTML document source.
 * @returns {string} The raw (still-HTML) main content fragment.
 * @throws {Error} When no `<main>` element is found.
 */
export function extractMainFragment(html) {
  const match = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  if (!match) {
    throw new Error('no <main> element found in source HTML');
  }
  return stripTags(match[1], ['script', 'nav', 'footer']);
}

/**
 * Decodes the small set of named HTML entities this page uses.
 * @param {string} text
 * @returns {string}
 */
function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Converts an HTML fragment (already scoped to `<main>`, chrome-free) to
 * Markdown: headings (`h1`-`h3`), paragraphs, links, inline code, bold, and
 * italic become their Markdown equivalents; every other tag is transparent
 * (unwrapped, keeping its text). `<br>` becomes a line break within the
 * current block. Whitespace is then collapsed and blank lines normalized so
 * the result is stable regardless of the source's indentation.
 * @param {string} fragment
 * @returns {string}
 */
export function htmlFragmentToMarkdown(fragment) {
  let text = fragment;

  /** @param {string} inner */
  const squeeze = (inner) => inner.replace(/\s+/g, ' ').trim();

  // Line breaks first, so they survive as newlines through the later
  // whitespace collapse instead of being swallowed as inter-tag padding.
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Inline elements: link, then code/strong/em, then unwrap decorative
  // spans. Closing tags tolerate whitespace before `>` (this codebase's
  // Prettier-formatted HTML sometimes wraps a closing tag across a line,
  // e.g. `</a\n>`), and every inner capture is squeezed to one line so a
  // source line-wrap never breaks the resulting Markdown syntax.
  text = text.replace(
    /<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a\s*>/gi,
    (_full, href, inner) => `[${squeeze(inner)}](${href})`,
  );
  text = text.replace(/<code>([\s\S]*?)<\/code\s*>/gi, (_full, inner) => `\`${squeeze(inner)}\``);
  text = text.replace(/<(?:strong|b)>([\s\S]*?)<\/(?:strong|b)\s*>/gi, (_full, inner) => `**${squeeze(inner)}**`);
  text = text.replace(/<(?:em|i)>([\s\S]*?)<\/(?:em|i)\s*>/gi, (_full, inner) => `*${squeeze(inner)}*`);
  text = text.replace(/<\/?span[^>]*>/gi, '');

  // Headings: captured and squeezed to one line, since a multi-line opening
  // tag (a wrapped `style="..."` attribute) would otherwise leave the
  // heading text on its own line, detached from the `#` marker.
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1\s*>/gi, (_full, inner) => `\n\n# ${squeeze(inner)}\n\n`);
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2\s*>/gi, (_full, inner) => `\n\n## ${squeeze(inner)}\n\n`);
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3\s*>/gi, (_full, inner) => `\n\n### ${squeeze(inner)}\n\n`);

  // Paragraphs and lists keep their internal line-wrapping (Markdown treats
  // soft-wrapped lines within a block as the same paragraph).
  text = text.replace(/<p[^>]*>/gi, '\n\n').replace(/<\/p\s*>/gi, '\n\n');
  text = text.replace(/<li[^>]*>/gi, '\n- ').replace(/<\/li\s*>/gi, '');
  text = text.replace(/<\/?ul[^>]*>/gi, '\n\n');

  // Every remaining tag (div, section, header ornaments, etc.) is a
  // transparent container: drop the tag, keep its text content.
  text = text.replace(/<[^>]+>/g, '');

  text = decodeEntities(text);

  const collapsedLines = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim());

  const blocks = [];
  let blank = true;
  for (const line of collapsedLines) {
    if (line === '') {
      if (!blank) blocks.push('');
      blank = true;
    } else {
      blocks.push(line);
      blank = false;
    }
  }
  while (blocks.length > 0 && blocks[0] === '') blocks.shift();
  while (blocks.length > 0 && blocks[blocks.length - 1] === '') blocks.pop();

  return blocks.join('\n');
}

/**
 * Renders the frontmatter block from extracted `<head>` metadata, in a fixed
 * field order, matching the plain (unquoted) YAML style already used by the
 * site's other pages.
 * @param {{ title: string, description: string, html_url: string, generator: string }} meta
 * @returns {string}
 */
export function renderFrontmatter(meta) {
  const lines = ['---', ...FRONTMATTER_FIELDS.map((field) => `${field}: ${meta[field]}`), '---'];
  return lines.join('\n');
}

/**
 * Renders the full about.md twin from about.html's source: frontmatter block
 * followed by the converted `<main>` content, deterministically normalized
 * (design "Regeneration is deterministic", matching normalizeOutput in
 * scripts/lib/docs-facts.mjs).
 * @param {string} html - Full about.html document source.
 * @returns {string}
 */
export function renderAboutTwin(html) {
  const meta = extractHeadMetadata(html);
  const fragment = extractMainFragment(html);
  const body = htmlFragmentToMarkdown(fragment);
  return normalizeOutput(`${renderFrontmatter(meta)}\n\n${body}`);
}

// --- CLI ------------------------------------------------------------------

/**
 * @param {string[]} argv
 * @returns {{ check: boolean, against: string | null }}
 */
function parseArgs(argv) {
  let check = false;
  let against = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') check = true;
    else if (arg === '--against') against = argv[++i] ?? null;
    else if (arg.startsWith('--against=')) against = arg.slice('--against='.length);
  }
  return { check, against };
}

/**
 * Reads the current content of the target doc, either from the working tree
 * or from a committed git ref (design D5's `--against` seam).
 * @param {string} cwd
 * @param {string} targetPath
 * @param {string | null} against
 * @param {(cmd: string, args: string[], opts: object) => string} execFile - injectable for tests
 * @returns {{ content: string } | { error: string }}
 */
function readCurrentContent(cwd, targetPath, against, execFile) {
  if (against) {
    try {
      const relPosix = path.relative(cwd, targetPath).split(path.sep).join('/');
      const content = execFile('git', ['show', `${against}:${relPosix}`], { cwd, encoding: 'utf-8' });
      return { content };
    } catch (err) {
      return { error: `could not read ${targetPath} at git ref '${against}': ${err.message}` };
    }
  }

  if (!fs.existsSync(targetPath)) {
    return { error: `target file not found: ${targetPath}` };
  }
  return { content: fs.readFileSync(targetPath, 'utf-8') };
}

/**
 * @param {string[]} argv
 * @param {{ cwd?: string, log?: (msg: string) => void, logError?: (msg: string) => void, execFile?: Function }} [options]
 * @returns {Promise<number>} 0 ok, 1 drift, 2 input failure
 */
export async function run(argv, options = {}) {
  const {
    cwd = process.cwd(),
    log = console.log,
    logError = console.error,
    execFile = execFileSync,
  } = options;

  const { check, against } = parseArgs(argv);

  if (against && !check) {
    logError('FAIL: --against requires --check');
    return 2;
  }

  const sourcePath = path.join(cwd, SOURCE_RELATIVE_PATH);
  if (!fs.existsSync(sourcePath)) {
    logError(`FAIL: about-twin source not found at: ${sourcePath}`);
    return 2;
  }

  const sourceHtml = fs.readFileSync(sourcePath, 'utf-8');

  let rendered;
  try {
    rendered = renderAboutTwin(sourceHtml);
  } catch (err) {
    logError(`FAIL: could not render ${sourcePath}: ${err.message}`);
    return 2;
  }

  const targetPath = path.join(cwd, TARGET_RELATIVE_PATH);

  if (!check) {
    // Write mode owns the whole target file (unlike the marker-region
    // generators in docs-facts.mjs): it never needs to read the file it is
    // about to overwrite.
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, rendered, 'utf-8');
    log(`OK: wrote ${targetPath} (from ${sourcePath})`);
    return 0;
  }

  if (!against && !fs.existsSync(targetPath)) {
    // A target that was never generated yet is drift, not an input failure.
    logError(`FAIL: --check: ${targetPath} does not exist yet (expected the generated render of ${sourcePath})`);
    return 1;
  }

  const current = readCurrentContent(cwd, targetPath, against, execFile);
  if ('error' in current) {
    logError(`FAIL: ${current.error}`);
    return 2;
  }

  if (rendered === normalizeOutput(current.content)) {
    log(`OK: ${targetPath} is up to date`);
    return 0;
  }
  logError(`FAIL: --check: ${targetPath} differs from the generated render of ${sourcePath}`);
  return 1;
}

async function main() {
  const exitCode = await run(process.argv.slice(2));
  process.exit(exitCode);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
