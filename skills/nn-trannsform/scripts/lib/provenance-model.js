const fs = require('fs');
const path = require('path');

const TEMPLATE_URL =
  'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/cogNNitive/spec_NN.md';
const INNFO_URL =
  'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-1_NN.md';
const TEMPLATE_NAME = 'cogNNitive';

const DOC_NOTICE =
  '> [!NOTE]\n> This is an **iNNfo document** — a plain-text Markdown file. ' +
  'Open it with any text editor or view and edit it with ' +
  '[cogNNitive](https://cognnitive.com/innfo/app/).';

/**
 * Allowed `source_format` values, mirroring the cogNNitive template's
 * `source_format` Field Definition (type:: select). Values outside this set
 * (html, htm, srt, vtt, xls, doc) are not declared and fail template
 * conformance — map them to `md` since normalized artifacts are always
 * Markdown.
 */
const SOURCE_FORMAT_OPTIONS = ['txt', 'md', 'csv', 'json', 'docx', 'pdf', 'xlsx'];

/**
 * Maps a raw source file extension to a declared `source_format` value.
 * @param {string} ext Lowercased extension without the leading dot.
 * @returns {string}
 */
function mapSourceFormat(ext) {
  return SOURCE_FORMAT_OPTIONS.includes(ext) ? ext : 'md';
}

/**
 * Converts a filename or title into a URL/filesystem slug.
 * @param {string} name
 * @returns {string}
 */
function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parses flat frontmatter from normalized markdown source.
 * @param {string} content
 * @returns {{ file: string, media_file?: string | null, media_sha256?: string | null, hash: string | null, size: string | null, normalized_at: string | null, normalized_by: string | null, is_synthetic?: boolean, derived_from?: string[] | null } | null}
 */
function parseSourceFrontmatter(content) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const block = fm[1];
  const get = (key) => {
    const m = block.match(new RegExp('^\\s*' + key + ':\\s*"?([^"\\n\\r]+)"?\\s*$', 'm'));
    return m ? m[1].trim() : null;
  };
  const file = get('source_file');
  if (!file) return null;

  const isSyntheticMatch = block.match(/^\s*is_synthetic:\s*(true|false)\s*$/m);
  const isSynthetic = isSyntheticMatch ? isSyntheticMatch[1] === 'true' : false;

  const derivedFromMatch = block.match(/^\s*derived_from:\s*\[(.*)\]\s*$/m);
  let derivedFrom = null;
  if (derivedFromMatch) {
    derivedFrom = derivedFromMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }

  return {
    file,
    media_file: get('media_file'),
    media_sha256: get('media_sha256'),
    hash: get('sha256'),
    size: get('size_bytes'),
    normalized_at: get('normalized_at'),
    normalized_by: get('normalized_by'),
    is_synthetic: isSynthetic,
    derived_from: derivedFrom,
  };
}

/**
 * Recursively collect *.md files under sources/nn/, preserving subfolder paths.
 * @param {string} mdDir
 * @returns {string[]}
 */
function walkMarkdown(mdDir) {
  const results = [];
  const walk = (dir, rel) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name.toLowerCase() === 'staging' ||
        entry.name.toLowerCase() === 'archive'
      ) {
        continue;
      }
      const abs = path.join(dir, entry.name);
      const relPath = rel ? path.join(rel, entry.name) : entry.name;
      if (entry.isDirectory()) {
        walk(abs, relPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        if (relPath === 'index.md') continue;
        results.push(relPath);
      }
    }
  };
  walk(mdDir, '');
  return results.sort();
}

/**
 * Collects normalized sources from sources/nn/.
 * @param {string} mdDir
 * @returns {Array<{ name: string, raw_filename: string, media_filename?: string | null, raw_hash: string | null, size: string | null, source_format: string, normalized_at: string | null, normalized_by: string | null, normalized_content: string, mdFile: string, is_synthetic: boolean, derived_from: string[] | null, version: string, archive_path: string | null }>}
 */
function collectSources(mdDir) {
  const sources = [];
  if (!fs.existsSync(mdDir)) return sources;

  const files = walkMarkdown(mdDir);

  for (const relFile of files) {
    const content = fs.readFileSync(path.join(mdDir, relFile), 'utf8');
    const fmData = parseSourceFrontmatter(content);
    if (!fmData) continue;

    const rawBase = path.basename(fmData.file);
    const ext = path.extname(rawBase).replace(/^\./, '').toLowerCase();
    const relFilePosix = relFile.replace(/\\/g, '/');

    sources.push({
      name: rawBase,
      raw_filename: fmData.file,
      media_filename: fmData.media_file || null,
      raw_hash: fmData.hash,
      size: fmData.size,
      source_format: mapSourceFormat(ext),
      normalized_at: fmData.normalized_at,
      normalized_by: fmData.normalized_by,
      normalized_content: `sources/nn/${relFilePosix}`,
      mdFile: relFile,
      is_synthetic: fmData.is_synthetic,
      derived_from: fmData.derived_from,
      version: 'V1',
      archive_path: null,
    });
  }

  // Curated CSVs under sources/nn/ are the citable form of a source. When a
  // profile .md exists for the same stem, surface the CSV on that entry
  // (`curated_csv::`); otherwise register the CSV on its own.
  const sourcesDir = path.dirname(mdDir);
  for (const relCsv of walkFiles(mdDir, (n) => n.endsWith('.csv'))) {
    const relCsvPosix = relCsv.replace(/\\/g, '/');
    const stemMd = relCsvPosix.replace(/\.csv$/i, '.md');
    const owner = sources.find((s) => s.mdFile.replace(/\\/g, '/') === stemMd);
    if (owner) {
      owner.curated_csv = `sources/nn/${relCsvPosix}`;
      continue;
    }
    const rawCandidate = path.join(sourcesDir, 'import', relCsvPosix);
    sources.push({
      name: path.basename(relCsv),
      raw_filename: fs.existsSync(rawCandidate) ? `sources/import/${relCsvPosix}` : `sources/nn/${relCsvPosix}`,
      media_filename: null,
      raw_hash: null,
      size: null,
      source_format: 'csv',
      normalized_at: null,
      normalized_by: null,
      normalized_content: `sources/nn/${relCsvPosix}`,
      mdFile: relCsv,
      is_synthetic: false,
      derived_from: null,
      curated_csv: `sources/nn/${relCsvPosix}`,
      version: 'V1',
      archive_path: null,
    });
  }

  // Disambiguate duplicate source names by prepending parent directory
  const nameCounts = {};
  for (const s of sources) {
    nameCounts[s.name] = (nameCounts[s.name] || 0) + 1;
  }
  for (const s of sources) {
    if (nameCounts[s.name] > 1) {
      const parentDir = path.dirname(s.mdFile);
      if (parentDir && parentDir !== '.') {
        s.name = `${parentDir.replace(/\\/g, '/')} ${s.name}`;
      }
    }
  }

  // Populate version and archive_path from sources/archive/
  const parentSources = path.resolve(mdDir, '..');
  const archiveDir = path.join(parentSources, 'archive');

  for (const s of sources) {
    const base = path.basename(s.mdFile, '.md');
    const baseArchiveDir = path.join(archiveDir, base);
    if (fs.existsSync(baseArchiveDir)) {
      const vDirs = fs.readdirSync(baseArchiveDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && /^V\d+$/.test(d.name));
      const vNums = vDirs.map(d => parseInt(d.name.replace(/^V/, ''), 10)).filter(n => !isNaN(n));
      if (vNums.length > 0) {
        const maxN = Math.max(...vNums);
        s.version = `V${maxN + 1}`;
        s.archive_path = `sources/archive/${base}/V${maxN}/${base}.md`;
        continue;
      }
    }
    s.version = 'V1';
    s.archive_path = null;
  }

  return sources;
}

/**
 * Recursively collects archived sources from sources/archive/.
 * Each archived snapshot gets status:: archived, version:: V<N>, and superseded_by:: if applicable.
 * @param {string} projectDir
 * @param {Array<any>} [activeSources]
 * @returns {Array<any>}
 */
function collectArchivedSources(projectDir, activeSources = []) {
  const sourcesDir = path.basename(projectDir) === 'sources' ? projectDir : path.join(projectDir, 'sources');
  const archiveDir = path.join(sourcesDir, 'archive');
  const archived = [];
  if (!fs.existsSync(archiveDir)) return archived;

  const baseDirs = fs.readdirSync(archiveDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'));

  for (const bDir of baseDirs) {
    const base = bDir.name;
    const baseDirPath = path.join(archiveDir, base);
    const vDirs = fs.readdirSync(baseDirPath, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^V\d+$/.test(d.name));

    const vInfos = [];
    for (const vd of vDirs) {
      const vNum = parseInt(vd.name.replace(/^V/, ''), 10);
      const snapFile = path.join(baseDirPath, vd.name, `${base}.md`);
      if (!fs.existsSync(snapFile)) continue;
      const content = fs.readFileSync(snapFile, 'utf8');
      const fmData = parseSourceFrontmatter(content);
      if (!fmData) continue;
      vInfos.push({ vNum, vName: vd.name, snapFile, fmData });
    }

    vInfos.sort((a, b) => a.vNum - b.vNum);
    const maxArchived = vInfos.length > 0 ? Math.max(...vInfos.map(v => v.vNum)) : 0;
    const hasActive = (activeSources || []).some(s => path.basename(s.mdFile, '.md') === base);

    for (const vi of vInfos) {
      const rawBase = path.basename(vi.fmData.file);
      const ext = path.extname(rawBase).replace(/^\./, '').toLowerCase();
      let supersededBy = null;
      if (hasActive) {
        supersededBy = `${rawBase} V${vi.vNum + 1}`;
      } else {
        if (vi.vNum < maxArchived) {
          supersededBy = `${rawBase} V${vi.vNum + 1}`;
        }
      }

      archived.push({
        name: `${rawBase} ${vi.vName}`,
        raw_filename: vi.fmData.file,
        raw_hash: vi.fmData.hash,
        size: vi.fmData.size,
        source_format: mapSourceFormat(ext),
        normalized_at: vi.fmData.normalized_at,
        normalized_by: vi.fmData.normalized_by,
        normalized_content: `sources/archive/${base}/${vi.vName}/${base}.md`,
        status: 'archived',
        version: vi.vName,
        superseded_by: supersededBy,
        base,
        versionNum: vi.vNum,
      });
    }
  }

  return archived;
}

/**
 * Recursively collect files with a given extension test under a directory,
 * returning POSIX-style paths relative to that directory.
 * @param {string} dir
 * @param {(name: string) => boolean} matches
 * @returns {string[]}
 */
function walkFiles(dir, matches) {
  const results = [];
  const walk = (d, rel) => {
    if (!fs.existsSync(d)) return;
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const abs = path.join(d, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, relPath);
      else if (entry.isFile() && matches(entry.name)) results.push(relPath);
    }
  };
  walk(dir, '');
  return results.sort();
}

/**
 * Reads `title`, `knowledge_version`, and `parent_spec.name` from a Level 3 model's
 * YAML frontmatter (regex — these scripts carry no YAML dependency).
 * @param {string} content
 * @returns {{ title: string | null, knowledge_version: string | null, template: string | null }}
 */
function parseModelHeader(content) {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const block = fm ? fm[1] : '';
  const flat = (key) => {
    const m = block.match(new RegExp('^' + key + ':\\s*"?([^"\\n\\r]+)"?\\s*$', 'm'));
    return m ? m[1].trim() : null;
  };
  const nested = block.match(/^parent_spec:\r?\n(?:\s+.*\r?\n?)*/m);
  const templateName = nested ? (nested[0].match(/^\s+name:\s*"?([^"\n\r]+)"?/m) || [])[1] : null;
  return {
    title: flat('title'),
    knowledge_version: flat('knowledge_version') || flat('model'),
    template: templateName ? templateName.trim() : null,
  };
}

/**
 * Every distinct `sources::` value declared in a model body, in document order.
 * Handles both the scalar form and the bracketed `[a, b]` list form.
 * @param {string} content
 * @returns {string[]}
 */
function scrapeSourceRefs(content) {
  const refs = [];
  const seen = new Set();
  const re = /^\s*sources::\s*(.+?)\s*$/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    let raw = m[1].trim();
    const bracket = raw.match(/^\[(.*)\]$/s);
    const parts = bracket ? bracket[1].split(',') : [raw];
    for (const p of parts) {
      const v = p.trim();
      if (v && !seen.has(v)) {
        seen.add(v);
        refs.push(v);
      }
    }
  }
  return refs;
}

/**
 * Enumerate `models/*_NN.md` and describe each for the lineage record's
 * `# NN ModelRecords` section: title, ref, version, template, and the source
 * Citations it derives from (scraped from its `sources::` fields).
 * @param {string} projectDir
 * @returns {Array<{ name: string, model_ref: string, knowledge_version: string | null, model_template: string | null, derived_from: string[] }>}
 */
function collectModels(projectDir) {
  const modelsDir = path.join(projectDir, 'models');
  return walkFiles(modelsDir, (n) => n.endsWith('_NN.md')).map((rel) => {
    const content = fs.readFileSync(path.join(modelsDir, rel), 'utf8');
    const header = parseModelHeader(content);
    const base = path.basename(rel).replace(/_NN\.md$/, '');
    return {
      name: header.title || base,
      model_ref: `models/${rel}`,
      knowledge_version: header.knowledge_version,
      model_template: header.template,
      derived_from: scrapeSourceRefs(content),
    };
  });
}

/**
 * Every `sources:` value declared in an artifact's YAML frontmatter block, in
 * document order. Accepts both the flow-list form (`sources: [a, b]`) and the
 * block-list form (`sources:\n  - a\n  - b`). Same pointer-array grammar as
 * an element's `sources::` field, reusing the same split/trim conventions as
 * `scrapeSourceRefs`.
 * @param {string} fmBlock
 * @returns {string[]}
 */
function parseFrontmatterSources(fmBlock) {
  if (!fmBlock) return [];
  const flow = fmBlock.match(/^sources:\s*\[(.*)\]\s*$/m);
  if (flow) {
    return flow[1]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  const block = fmBlock.match(/^sources:\s*\r?\n((?:[ \t]+-\s+.*\r?\n?)+)/m);
  if (block) {
    return block[1]
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-'))
      .map((line) => line.replace(/^-\s*/, '').trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return [];
}

/**
 * Read a source-model reference out of an artifact: from Markdown frontmatter
 * (`model` / `model_name` + `knowledge_version`, or an optional `sources:`
 * pointer-array field) or from an HTML
 * `<script id="export-meta" type="application/json">` block (which may carry
 * an equivalent `sources` JSON array).
 * @param {string} content
 * @param {string} fileName
 * @returns {{ model: string | null, knowledge_version: string | null, sources: string[], format: string }}
 */
function parseArtifactMeta(content, fileName) {
  const isHtml = /\.html?$/i.test(fileName);
  if (isHtml) {
    const block = content.match(
      /<script[^>]+id=["']export-meta["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (block) {
      try {
        const j = JSON.parse(block[1].trim());
        return {
          model: j.modelName || j.model || null,
          knowledge_version: j.modelVersion || j.knowledge_version || null,
          sources: Array.isArray(j.sources) ? j.sources.map((s) => String(s).trim()).filter(Boolean) : [],
          format: 'board',
        };
      } catch {
        /* fall through */
      }
    }
    return { model: null, knowledge_version: null, sources: [], format: 'board' };
  }
  const header = parseModelHeader(content);
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const typeField = fm ? (fm[1].match(/^type:\s*"?([^"\n\r]+)"?/m) || [])[1] : null;
  const modelName =
    header.title ||
    (fm ? (fm[1].match(/^model(?:_name)?:\s*"?([^"\n\r]+)"?/m) || [])[1] : null) ||
    null;
  return {
    model: modelName ? modelName.trim() : null,
    knowledge_version: header.knowledge_version,
    sources: parseFrontmatterSources(fm ? fm[1] : ''),
    format: (typeField && typeField.trim()) || 'document',
  };
}

/**
 * Enumerate files under `export/` (with fallback to deprecated `artifacts/`) and describe each for the lineage
 * record's `# NN Artifacts` section.
 * @param {string} projectDir
 * @returns {Array<{ name: string, artifact_ref: string, artifact_format: string, derived_from: string[], note: string | null }>}
 */
function collectArtifacts(projectDir) {
  const exportDir = path.join(projectDir, 'export');
  const legacyArtDir = path.join(projectDir, 'artifacts');

  let artDir = exportDir;
  let dirPrefix = 'export';

  if (!fs.existsSync(exportDir) && fs.existsSync(legacyArtDir)) {
    console.warn("[DEPRECATION] 'artifacts/' is deprecated; migrate folder to 'export/'");
    artDir = legacyArtDir;
    dirPrefix = 'artifacts';
  }

  return walkFiles(artDir, (n) => /\.(md|html?|csv|json)$/i.test(n)).map((rel) => {
    const content = fs.readFileSync(path.join(artDir, rel), 'utf8');
    const meta = parseArtifactMeta(content, rel);
    // A frontmatter `sources:` pointer array takes precedence over the
    // model/knowledge_version reference when both are present (design.md D-
    // "the lineage builder reads artifact `sources:` frontmatter").
    const derived =
      meta.sources && meta.sources.length > 0
        ? meta.sources
        : meta.model
          ? [meta.knowledge_version ? `${meta.model} ${meta.knowledge_version}` : meta.model]
          : [];
    return {
      name: path.basename(rel).replace(/\.[^.]+$/, ''),
      artifact_ref: `${dirPrefix}/${rel}`,
      artifact_format: meta.format,
      derived_from: derived,
      note: derived.length > 0 ? null : 'no Source kNNowledge reference found in this artifact',
    };
  });
}

/**
 * Formats NN Sources markdown section.
 * @param {Array<any>} sources
 * @returns {string}
 */
function renderSourcesSection(sources) {
  let out = '# NN Sources\n';
  if (sources.length === 0) {
    out += '\n<!-- No sources ingested yet. Place files in sources/import and run a scan. -->\n';
    return out;
  }
  for (const s of sources) {
    out += `\n## NN Sources: ${s.name}\n`;
    out += `raw_filename:: ${s.raw_filename}\n`;
    if (s.media_filename) out += `media_filename:: ${s.media_filename}\n`;
    if (s.raw_hash) out += `raw_hash:: ${s.raw_hash}\n`;
    if (s.size) out += `size:: ${s.size}\n`;
    if (s.source_format) out += `source_format:: ${s.source_format}\n`;
    if (s.is_synthetic) out += `is_synthetic:: true\n`;
    if (s.derived_from && s.derived_from.length > 0) {
      out += `derived_from:: [${s.derived_from.join(', ')}]\n`;
    }
    if (s.normalized_at) out += `normalized_at:: ${s.normalized_at}\n`;
    if (s.normalized_by) out += `normalized_by:: ${s.normalized_by}\n`;
    out += `normalized_content:: ${s.normalized_content}\n`;
    if (s.curated_csv) out += `curated_csv:: ${s.curated_csv}\n`;
    if (s.status) out += `status:: ${s.status}\n`;
    if (s.version) out += `version:: ${s.version}\n`;
    if (s.archive_path) out += `archive_path:: ${s.archive_path}\n`;
    if (s.superseded_by) out += `superseded_by:: ${s.superseded_by}\n`;
  }
  return out;
}

/**
 * Renders an empty placeholder section with guidance comment.
 * @param {string} concept
 * @param {string} guidance
 * @returns {string}
 */
function emptySection(concept, guidance) {
  return `# NN ${concept}\n\n<!-- ${guidance} -->\n`;
}

const MODELS_GUIDANCE =
  'Auto-synced from models/ on every --scan/--import-url/--lineage. One ModelRecords element per Level 3 model.';
const ARTIFACTS_GUIDANCE =
  'Auto-synced from export/ on every --scan/--import-url/--lineage. One element per generated deliverable.';
const PROCEDURES_GUIDANCE =
  'Append-only. One entry per pipeline run (--scan, --import-url, --apply). Never regenerated.';

/**
 * Formats the NN ModelRecords section from the models discovered under models/.
 * @param {Array<any>} models
 * @returns {string}
 */
function renderModelsSection(models) {
  if (models.length === 0) return emptySection('ModelRecords', MODELS_GUIDANCE).replace(/\n$/, '');
  let out = '# NN ModelRecords\n';
  for (const m of models) {
    out += `\n## NN ModelRecords: ${m.name}\n`;
    out += `model_ref:: ${m.model_ref}\n`;
    if (m.knowledge_version) out += `knowledge_version:: ${m.knowledge_version}\n`;
    if (m.model_template) out += `model_template:: ${m.model_template}\n`;
    if (m.derived_from && m.derived_from.length > 0) {
      out += `derived_from:: [${m.derived_from.join(', ')}]\n`;
    }
  }
  return out;
}

/**
 * Formats the NN Artifacts section from the files discovered under artifacts/.
 * @param {Array<any>} artifacts
 * @returns {string}
 */
function renderArtifactsSection(artifacts) {
  if (artifacts.length === 0) {
    return emptySection('Artifacts', ARTIFACTS_GUIDANCE).replace(/\n$/, '');
  }
  let out = '# NN Artifacts\n';
  for (const a of artifacts) {
    out += `\n## NN Artifacts: ${a.name}\n`;
    out += `artifact_ref:: ${a.artifact_ref}\n`;
    out += `artifact_format:: ${a.artifact_format}\n`;
    if (a.derived_from && a.derived_from.length > 0) {
      out += `derived_from:: [${a.derived_from.join(', ')}]\n`;
    }
    if (a.note) out += `note:: ${a.note}\n`;
  }
  return out;
}

/**
 * Splits document body into preamble and top-level # sections.
 * @param {string} body
 * @returns {{ preamble: string, blocks: Array<{ heading: string, lines: string[] }> }}
 */
function splitTopLevelSections(body) {
  const lines = body.split('\n');
  const blocks = [];
  let current = null;
  const preamble = [];
  for (const line of lines) {
    if (/^# (?!#)/.test(line)) {
      if (current) blocks.push(current);
      current = { heading: line, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) blocks.push(current);
  return { preamble: preamble.join('\n'), blocks };
}

/**
 * @typedef {{ sources: Array<any>, models: Array<any>, artifacts: Array<any> }} LineageData
 */

/** Normalises the argument that used to be a bare `sources` array. */
function toLineageData(data) {
  if (Array.isArray(data)) return { sources: data, models: [], artifacts: [] };
  return { sources: data.sources ?? [], models: data.models ?? [], artifacts: data.artifacts ?? [] };
}

/** The three filesystem-synced sections, in document order, keyed by heading. */
function managedSections(data) {
  const d = toLineageData(data);
  return [
    { re: /^# NN Sources\b/, render: () => renderSourcesSection(d.sources) },
    { re: /^# NN Model(?:Records|s)\b/, render: () => renderModelsSection(d.models) },
    { re: /^# NN Artifacts\b/, render: () => renderArtifactsSection(d.artifacts) },
  ];
}

/**
 * Generates the initial Level 3 lineage-record markdown document.
 * @param {string} title
 * @param {LineageData | Array<any>} data
 * @returns {string}
 */
function renderFrontmatter(title, modelVersion = 'V_0-2-0') {
  return (
    '---\n' +
    'specification_version: "V_0-2-1"\n' +
    `specification_url: "${INNFO_URL}"\n` +
    'level: 3\n' +
    'parent_spec:\n' +
    `  name: "${TEMPLATE_NAME}"\n` +
    `  url: "${TEMPLATE_URL}"\n` +
    `knowledge_version: "${modelVersion}"\n` +
    `title: "${title}"\n` +
    '---\n'
  );
}

function buildFreshModel(title, data) {
  const d = toLineageData(data);
  const index =
    '# NN index\n\n' +
    '* [[Sources]]\n' +
    '* [[ModelRecords]]\n' +
    '* [[Artifacts]]\n' +
    '* [[Procedures]]\n';

  const blocks = [
    index,
    renderSourcesSection(d.sources),
    renderModelsSection(d.models),
    renderArtifactsSection(d.artifacts),
    emptySection('Procedures', PROCEDURES_GUIDANCE),
  ].map((s) => s.replace(/\n+$/, '') + '\n');

  return (
    renderFrontmatter(`${title} Provenance`) +
    '\n' +
    DOC_NOTICE.replace(/^\n+|\n+$/g, '') +
    '\n\n' +
    blocks.join('\n') +
    '\n'
  );
}

/**
 * Re-synchronises the three filesystem-owned sections (`# NN Sources`,
 * `# NN ModelRecords`, `# NN Artifacts`) of an existing lineage record from the
 * current workspace state. Every other section — `# NN index`, the append-only
 * `# NN Procedures` log, any hand-authored block — is passed through untouched.
 *
 * The frontmatter is regenerated from the canonical `cogNNitive` parent spec, so
 * a legacy record adopted from a previous `workspace`-templated file is migrated
 * on the first refresh. A legacy `# NN Models` heading is treated as the managed
 * ModelRecords section and replaced.
 * @param {string} existing
 * @param {LineageData | Array<any>} data
 * @returns {string}
 */
function refreshExistingModel(existing, data) {
  const fmMatch = existing.match(/^(---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?)/);
  const body = fmMatch ? existing.slice(fmMatch[1].length) : existing;

  const titleMatch = existing.match(/^title:\s*"?(.*?)"?\s*$/m);
  const versionMatch = existing.match(/^knowledge_version:\s*"?(.*?)"?\s*$/m);

  const { preamble, blocks } = splitTopLevelSections(body);
  const managed = managedSections(data);
  const rendered = managed.map((m) => m.render().replace(/\n+$/, '') + '\n');
  const present = new Array(managed.length).fill(false);

  const rebuilt = blocks.map((b) => {
    const idx = managed.findIndex((m) => m.re.test(b.heading));
    if (idx !== -1) {
      present[idx] = true;
      return rendered[idx];
    }
    let text = (b.heading + '\n' + b.lines.join('\n')).replace(/\n+$/, '') + '\n';
    // Migrate a pre-ModelRecords index link when adopting a legacy record.
    if (/^# NN index\b/.test(b.heading)) {
      text = text.replace(/\* \[\[Models\]\]/g, '* [[ModelRecords]]');
    }
    return text;
  });

  // Insert any missing managed section just after `# NN index` (or at the top),
  // keeping Sources → ModelRecords → Artifacts order.
  const anchor = rebuilt.findIndex((s) => /^# NN index\b/.test(s));
  let insertAt = anchor >= 0 ? anchor + 1 : 0;
  for (let i = 0; i < managed.length; i++) {
    if (present[i]) {
      insertAt = rebuilt.findIndex((s) => managed[i].re.test(s)) + 1;
      continue;
    }
    rebuilt.splice(insertAt, 0, rendered[i]);
    insertAt++;
  }

  const notice = preamble.replace(/^\n+|\n+$/g, '');
  return (
    renderFrontmatter(
      titleMatch ? titleMatch[1] : 'Provenance',
      versionMatch ? versionMatch[1] : 'V_0-2-0',
    ) +
    '\n' +
    notice +
    '\n\n' +
    rebuilt.join('\n') +
    '\n'
  );
}

/**
 * Append one `## NN Procedures:` entry to the lineage record's append-only
 * `# NN Procedures` section. Creates the section if the record predates it.
 * @param {string} existing full lineage-record content
 * @param {{ command: string, flags?: string, runAt?: string, inputs?: string[], outputs?: string[] }} run
 * @returns {string}
 */
function appendProcedureRun(existing, run) {
  const runAt = run.runAt || new Date().toISOString();
  const entry =
    `\n## NN Procedures: ${run.command} @ ${runAt}\n` +
    `command:: ${run.command}\n` +
    (run.flags ? `flags:: ${run.flags}\n` : '') +
    `run_at:: ${runAt}\n` +
    (run.inputs && run.inputs.length ? `inputs:: [${run.inputs.join(', ')}]\n` : '') +
    (run.outputs && run.outputs.length ? `outputs:: [${run.outputs.join(', ')}]\n` : '');

  const fmMatch = existing.match(/^(---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?)/);
  const frontmatter = fmMatch ? fmMatch[1] : '';
  const body = fmMatch ? existing.slice(frontmatter.length) : existing;
  const { preamble, blocks } = splitTopLevelSections(body);

  let found = false;
  const rebuilt = blocks.map((b) => {
    if (/^# NN Procedures\b/.test(b.heading)) {
      found = true;
      return (b.heading + '\n' + b.lines.join('\n')).replace(/\n+$/, '') + '\n' + entry;
    }
    return (b.heading + '\n' + b.lines.join('\n')).replace(/\n+$/, '') + '\n';
  });
  if (!found) {
    rebuilt.push(emptySection('Procedures', PROCEDURES_GUIDANCE).replace(/\n$/, '') + entry);
  }

  const notice = preamble.replace(/^\n+|\n+$/g, '');
  return frontmatter + '\n' + notice + '\n\n' + rebuilt.join('\n') + '\n';
}

/**
 * Resolves the latest versioned provenance model file in projectDir, or null.
 * The default suffix matches the canonical `cogNNitive` lineage record; pass
 * `_workspace_NN.md` to detect a legacy record for one-time migration.
 * @param {string} projectDir
 * @param {string} projectName
 * @param {(v1: number[], v2: number[]) => number} compareVersions
 * @param {string} [suffix]
 * @returns {string | null}
 */
function resolveLatestModelFile(projectDir, projectName, compareVersions, suffix = '_cogNNitive_NN.md') {
  const files = fs.existsSync(projectDir) ? fs.readdirSync(projectDir) : [];
  const prefix = `${projectName}_V_`;

  let bestFile = null;
  let bestVersion = [-1, -1, -1];

  for (const f of files) {
    if (f.startsWith(prefix) && f.endsWith(suffix)) {
      const verStr = f.substring(prefix.length, f.length - suffix.length);
      const parts = verStr.split('-');
      if (parts.length === 3) {
        const ver = parts.map(Number);
        if (ver.every((n) => !isNaN(n))) {
          if (compareVersions(ver, bestVersion) > 0) {
            bestVersion = ver;
            bestFile = f;
          }
        }
      }
    }
  }

  return bestFile;
}

module.exports = {
  TEMPLATE_URL,
  INNFO_URL,
  TEMPLATE_NAME,
  DOC_NOTICE,
  SOURCE_FORMAT_OPTIONS,
  mapSourceFormat,
  slugify,
  parseSourceFrontmatter,
  parseModelHeader,
  scrapeSourceRefs,
  walkMarkdown,
  walkFiles,
  collectSources,
  collectArchivedSources,
  collectModels,
  collectArtifacts,
  renderSourcesSection,
  renderModelsSection,
  renderArtifactsSection,
  emptySection,
  splitTopLevelSections,
  buildFreshModel,
  refreshExistingModel,
  appendProcedureRun,
  resolveLatestModelFile,
};
