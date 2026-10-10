/**
 * normalizer.js: the converter adapter nn-sources injects into innfo-core's
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
const { TEXT_NATIVE_FORMATS } = require('./innfo-core.generated.cjs');

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
  'source_url', 'origin_uri', 'downloaded_at',
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

    if (ext === 'json' && converters.isFeedbackJsonPath(rel)) {
      // Throws on an invalid payload, so the scan skips and reports the file.
      converters.validateFeedbackJson(JSON.parse(Buffer.from(bytes).toString('utf8')));
      metadata.source_type = 'feedback';
    }

    if (TEXT_NATIVE_FORMATS.has(ext)) return { body: '', normalizedBy, metadata };

    if (dotExt in converters.PROMPT_CONVERTERS) {
      const result = await converters.PROMPT_CONVERTERS[dotExt](abs, baseName);
      if (dotExt === '.pdf' && result.info) {
        if (result.info.Title && !metadata.title) metadata.title = result.info.Title;
        if (result.info.Author && !metadata.author) metadata.author = result.info.Author;
      }
      if (result.partial) notes.set(rel, { partial: true, note: result.note });
      return { body: result.body, normalizedBy, metadata };
    }

    return { body: converters.convertOkFormat(dotExt, abs, baseName), normalizedBy, metadata };
  };
}

module.exports = { createNormalizer, TRANNNSFORM_VERSION };
