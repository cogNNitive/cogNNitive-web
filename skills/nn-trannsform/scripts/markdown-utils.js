/**
 * markdown-utils.js
 *
 * Pure, zero-dependency helpers for normalizing markdown bodies and computing
 * GitHub-compatible heading slugs. Shared between scanner.js (normalization
 * pipeline) and provenance.js (citation-anchor validation) so both sides of
 * the pipeline agree on exactly the same slugging algorithm.
 *
 * The slug primitives (`slugifyHeading`, `slugifyUnitHeading`, `normalizeName`,
 * `headingSlugParts`) are NOT defined here: they are generated from
 * `@cognnitive/innfo-core`'s `src/sourceRef.ts` by
 * `scripts/build-trannsform-slug-mirror.mjs` and vendored as
 * `./lib/slug-mirror.generated.cjs` (innfo-core is ESM-only and absent where
 * this skill is installed, so a runtime import is impossible). That bundle IS
 * the single shared implementation — do NOT hand-edit the mirror, regenerate it.
 */

/**
 * Shape of the generated slug mirror. esbuild emits the named exports
 * dynamically, so the checker cannot infer them from the `.cjs` — this JSDoc
 * contract is types-only; the implementation stays generated.
 * @typedef {{
 *   slugifyHeading: (text: string) => string,
 *   slugifyUnitHeading: (level: number, text: string) => { level: number, text: string, slug: string },
 *   normalizeName: (name: string) => string,
 *   headingSlugParts: (text: string) => { slug: string, concept?: string, element?: string },
 * }} SlugMirror
 */

const {
  slugifyHeading,
  slugifyUnitHeading,
  normalizeName,
  headingSlugParts,
} = /** @type {SlugMirror} */ (require('./lib/slug-mirror.generated.cjs'));

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * Sanitize a normalized markdown body before it is combined with frontmatter
 * and written to disk:
 *   1. Normalize all line endings to `\n`.
 *   2. Trim trailing whitespace from every line.
 *   3. Collapse runs of 2+ consecutive blank lines down to exactly 1.
 *   4. Trim leading/trailing blank lines from the whole body.
 *   5. Never touches content inside fenced code blocks (``` or ~~~).
 *
 * Pure and idempotent: sanitizeMarkdownBody(sanitizeMarkdownBody(x)) === sanitizeMarkdownBody(x).
 */
function sanitizeMarkdownBody(content) {
  const normalized = String(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;

  const records = [];
  for (const line of lines) {
    const m = line.match(FENCE_RE);
    if (inFence) {
      const isClosing = m && m[1][0] === fenceChar && m[1].length >= fenceLen;
      if (isClosing) {
        inFence = false;
        records.push({ text: line.replace(/[ \t]+$/, ''), locked: false });
      } else {
        // Inside a fence: preserve the line byte-for-byte.
        records.push({ text: line, locked: true });
      }
      continue;
    }

    if (m) {
      inFence = true;
      fenceChar = m[1][0];
      fenceLen = m[1].length;
      records.push({ text: line.replace(/[ \t]+$/, ''), locked: false });
      continue;
    }

    records.push({ text: line.replace(/[ \t]+$/, ''), locked: false });
  }

  // Collapse runs of 2+ consecutive blank *unlocked* lines down to exactly 1.
  const collapsed = [];
  let blankStreak = 0;
  for (const rec of records) {
    const isBlank = !rec.locked && rec.text === '';
    if (isBlank) {
      blankStreak++;
      if (blankStreak <= 1) collapsed.push(rec);
    } else {
      blankStreak = 0;
      collapsed.push(rec);
    }
  }

  // Trim leading/trailing blank *unlocked* lines from the whole body.
  let start = 0;
  let end = collapsed.length;
  while (start < end && !collapsed[start].locked && collapsed[start].text === '') start++;
  while (end > start && !collapsed[end - 1].locked && collapsed[end - 1].text === '') end--;

  return collapsed.slice(start, end).map((r) => r.text).join('\n');
}

/**
 * Extract every markdown heading (# .. ######) from a document, skipping
 * anything inside fenced code blocks, and compute its heading-slug anchor.
 * Duplicate slugs (top-to-bottom order) are disambiguated the same way
 * GitHub does: first occurrence keeps the bare slug, later ones get -1, -2, ...
 *
 * Returns an array of { level, text, slug, lineIndex } (lineIndex is the
 * 0-based line number of the heading within `content`, after CRLF/CR
 * normalization).
 */
function extractHeadingSlugs(content) {
  const normalized = String(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  let inFence = false;
  let fenceChar = '';
  let fenceLen = 0;

  const counts = new Map();
  const headings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(FENCE_RE);
    if (inFence) {
      if (m && m[1][0] === fenceChar && m[1].length >= fenceLen) {
        inFence = false;
      }
      continue;
    }
    if (m) {
      inFence = true;
      fenceChar = m[1][0];
      fenceLen = m[1].length;
      continue;
    }

    const headingMatch = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!headingMatch) continue;

    const rawText = headingMatch[2].trim();
    const parts = headingSlugParts(rawText);
    let slug = parts.slug;
    if (!slug) slug = 'section';

    const seen = counts.get(slug) || 0;
    counts.set(slug, seen + 1);
    const finalSlug = seen === 0 ? slug : `${slug}-${seen}`;

    headings.push({ level: headingMatch[1].length, text: rawText, slug: finalSlug, lineIndex: i, concept: parts.concept, element: parts.element });
  }

  return headings;
}

/**
 * Whether a markdown body contains at least one heading (outside fenced code).
 */
function hasHeading(content) {
  return extractHeadingSlugs(content).length > 0;
}

/**
 * Turn a bare filename (no extension) into a human-readable title, used for
 * the synthetic top-level heading inserted into heading-less sources.
 * e.g. "meeting_notes-v2" -> "Meeting Notes-v2"
 */
function humanizeBaseName(baseName) {
  const spaced = String(baseName).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!spaced) return String(baseName);
  return spaced.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

/**
 * Guarantee a normalized body has at least one citable section: if it has no
 * heading at all, insert a synthetic top-level `# <Human Readable Name>`
 * heading as the very first line.
 */
function ensureHeading(body, baseName) {
  if (hasHeading(body)) return body;
  const title = humanizeBaseName(baseName);
  return `# ${title}\n\n${body}`;
}

module.exports = {
  sanitizeMarkdownBody,
  slugifyHeading,
  slugifyUnitHeading,
  normalizeName,
  headingSlugParts,
  extractHeadingSlugs,
  hasHeading,
  humanizeBaseName,
  ensureHeading,
};
