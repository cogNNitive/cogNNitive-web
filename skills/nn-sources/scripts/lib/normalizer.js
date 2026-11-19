/**
 * normalizer.js: the converter adapter nn-sources injects into nn-core's
 * `cognitivize`. Core never imports a converter; this module turns a raw file
 * into the `{ body, normalizedBy, metadata }` shape the sidecar writer expects.
 *
 *  - text-native subjects (md, csv, json) are their own text: the adapter
 *    returns an empty body and only the metadata worth recording;
 *  - every other format gets the normalized markdown body of its converter.
 */

const fs = require('fs');
const path = require('path');
const converters = require('./scanner-converters');
const { parseFrontmatterFields } = require('./scanner-core');
const { TEXT_NATIVE_FORMATS } = require('./nn-core.generated.cjs');

const TRANNNSFORM_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '../..', 'package.json'), 'utf8')).version || '1.0.0';
  } catch {
    return '1.0.0';
  }
})();

const CONVERSATIONS_PREFIX = 'sources/conversations/';

/** Origin and descriptive keys carried from a web import or a raw markdown file into the sidecar. */
const METADATA_KEYS = [
  'source_type', 'session_id', 'origin_transcript',
  'origin_uri', 'retrieved_at', 'synchronization',
  'title', 'description', 'author', 'tags',
];

/**
 * @param {Record<string, any>} from
 * @returns {Record<string, any>}
 */
function pickMetadata(from) {
  const out = {};
  for (const key of METADATA_KEYS) {
    if (from[key] !== undefined && from[key] !== '') out[key] = from[key];
  }
  if (from.canonical && typeof from.canonical === 'object') out.canonical = from.canonical;
  // `references` is accepted as a deprecated input alias; the emitted key is `cited_works`.
  const cited = Array.isArray(from.cited_works) ? from.cited_works : Array.isArray(from.references) ? from.references : null;
  if (cited && cited.length > 0) out.cited_works = cited;
  return out;
}

/**
 * The converter that actually produced the body, per extension. `.md` has none
 * (it is its own text), and the text-native formats excluded by
 * `TEXT_NATIVE_FORMATS` have none either: their sidecar carries no body, so no
 * converter ran and there is nothing to attribute.
 */
const BACKEND_BY_EXT = {
  '.pdf': 'pdf-parse',
  '.docx': 'mammoth',
  '.xlsx': 'xlsx',
  '.xls': 'xlsx',
  '.html': 'html-to-text',
  '.htm': 'html-to-text',
  '.srt': 'subtitles-to-markdown',
  '.vtt': 'subtitles-to-markdown',
  '.txt': 'text-reflow',
};

/** Why a backend is limited, when it is. Absent when the extractor is not lossy. */
const BACKEND_REASON_BY_EXT = {
  '.pdf': 'text layer only; scanned pages produce no text',
  '.html': 'structural tags stripped; no layout or reading order',
};

/**
 * Conversion keys written into the sidecar frontmatter. `backend` and
 * `backend_reason` say what produced the body; `quality` and `quality_reason`
 * say how well it went. `quality` is the producer's claim about its own output,
 * never a consumer's inference: an extractor that could only partially read the
 * subject marks it `fair` and records why. Formats with no converter write none
 * of these keys, so nothing is asserted about text that was never converted.
 *
 * @param {string} ext
 * @param {{ partial?: boolean, note?: string }} [result]
 * @returns {Record<string, string>}
 */
function conversionMetadata(ext, { partial = false, note } = {}) {
  const key = ext.startsWith('.') ? ext : `.${ext}`;
  const backend = BACKEND_BY_EXT[key];
  if (!backend) return {};
  const out = { backend };
  if (BACKEND_REASON_BY_EXT[key]) out.backend_reason = BACKEND_REASON_BY_EXT[key];
  out.quality = partial ? 'fair' : 'good';
  if (partial && note) out.quality_reason = note;
  return out;
}

/**
 * @param {{ projectDir: string, webImportMeta?: Record<string, Record<string, any>>, options?: Record<string, any>, notes?: Map<string, { partial: boolean, note?: string }> }} config
 *   `webImportMeta` is keyed by workspace-relative path; `notes` collects per-file remarks (partial PDF parses).
 * @returns {(input: { path: string, ext: string, bytes: Uint8Array }) => Promise<{ body: string, normalizedBy: string, metadata?: Record<string, any> }>}
 */
function createNormalizer({ projectDir, webImportMeta = {}, notes = new Map() }) {
  return async function normalize({ path: rel, ext, bytes }) {
    const dotExt = `.${ext}`;
    const abs = path.join(projectDir, rel);
    const baseName = path.basename(rel, path.extname(rel));
    const normalizedBy = `traNNsform v${TRANNNSFORM_VERSION}`;

    // Metadata: the import's own, over what the raw markdown frontmatter declares.
    const incoming = ext === 'md' ? pickMetadata(parseFrontmatterFields(Buffer.from(bytes).toString('utf8'))) : {};
    // Import metadata is keyed by the workspace-relative path or by the path inside its source tree.
    const imported = webImportMeta[rel] || webImportMeta[rel.replace(/^sources\/(?:import|conversations)\//, '')] || {};
    const metadata = { ...incoming, ...pickMetadata(imported) };

    if (rel.startsWith(CONVERSATIONS_PREFIX) && ext === 'md' && !metadata.source_type) {
      metadata.source_type = 'conversation_transcript';
    }

    if (TEXT_NATIVE_FORMATS.has(ext)) return { body: '', normalizedBy, metadata };

    if (dotExt in converters.PROMPT_CONVERTERS) {
      const result = await converters.PROMPT_CONVERTERS[dotExt](abs, baseName);
      if (dotExt === '.pdf' && result.info) {
        if (result.info.Title && !metadata.title) metadata.title = result.info.Title;
        if (result.info.Author && !metadata.author) metadata.author = result.info.Author;
      }
      if (result.partial) notes.set(rel, { partial: true, note: result.note });
      const conversion = conversionMetadata(dotExt, result);
      return { body: result.body, normalizedBy, metadata: { ...metadata, ...conversion } };
    }

    const body = converters.convertOkFormat(dotExt, abs, baseName);
    // The HTML branch returns a bare string (D1), so the incomplete-extraction signal is
    // derived here, next to the `notes` map the PDF branch already writes to.
    let partial = false;
    let note;
    if (dotExt === '.html' || dotExt === '.htm') {
      const reason = converters.looksPartial(body);
      if (reason) {
        partial = true;
        note = reason;
        notes.set(rel, { partial: true, note: reason });
      }
    }
    const conversion = conversionMetadata(dotExt, { partial, note });
    return { body, normalizedBy, metadata: { ...metadata, ...conversion } };
  };
}

module.exports = { createNormalizer, TRANNNSFORM_VERSION, conversionMetadata };
