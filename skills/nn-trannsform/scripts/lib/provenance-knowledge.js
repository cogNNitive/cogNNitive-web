const fs = require('fs');
const path = require('path');

const TEMPLATE_URL =
  'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/cogNNitive/spec_NN.md';
const INNFO_URL =
  'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md';
const TEMPLATE_NAME = 'cogNNitive';

const DOC_NOTICE =
  '> [!NOTE]\n> This is an **iNNfo document** — a plain-text Markdown file. ' +
  'Open it with any text editor or view and edit it with ' +
  '[cogNNitive](https://cognnitive.com/innfo/app/).';

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
 * Renders an empty placeholder section with guidance comment.
 * @param {string} concept
 * @param {string} guidance
 * @returns {string}
 */
function emptySection(concept, guidance) {
  return `# NN ${concept}\n\n<!-- ${guidance} -->\n`;
}

const PROCEDURES_GUIDANCE =
  'Append-only. One entry per pipeline run (--scan, --import-url, --apply). Never regenerated.';

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

/** The three filesystem-synced sections, in document order, keyed by heading. */
function managedSections(sections) {
  return [
    { re: /^# NN Sources\b/, render: () => sections.sources },
    { re: /^# NN ModelRecords\b/, render: () => sections.modelRecords },
    { re: /^# NN Artifacts\b/, render: () => sections.artifacts },
  ];
}

/**
 * Generates the initial Level 3 lineage-record markdown document.
 * @param {string} title
 * @param {string} [modelVersion]
 * @returns {string}
 */
function renderFrontmatter(title, modelVersion = 'V_0-2-0') {
  return (
    '---\n' +
    'specification_version: "V_0-3-0"\n' +
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

function buildFreshModel(title, sections) {
  const index =
    '# NN index\n\n' +
    '* [[Sources]]\n' +
    '* [[ModelRecords]]\n' +
    '* [[Artifacts]]\n' +
    '* [[Procedures]]\n';

  const blocks = [
    index,
    sections.sources,
    sections.modelRecords,
    sections.artifacts,
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
 * @param {string} existing
 * @param {{ sources: string, modelRecords: string, artifacts: string }} sections
 * @returns {string}
 */
function refreshExistingModel(existing, sections) {
  const fmMatch = existing.match(/^(---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?)/);
  const body = fmMatch ? existing.slice(fmMatch[1].length) : existing;

  const titleMatch = existing.match(/^title:\s*"?(.*?)"?\s*$/m);
  const versionMatch = existing.match(/^knowledge_version:\s*"?(.*?)"?\s*$/m);

  const { preamble, blocks } = splitTopLevelSections(body);
  const managed = managedSections(sections);
  const rendered = managed.map((m) => m.render().replace(/\n+$/, '') + '\n');
  const present = new Array(managed.length).fill(false);

  const rebuilt = blocks.map((b) => {
    const idx = managed.findIndex((m) => m.re.test(b.heading));
    if (idx !== -1) {
      present[idx] = true;
      return rendered[idx];
    }
    return (b.heading + '\n' + b.lines.join('\n')).replace(/\n+$/, '') + '\n';
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
 * Searches `kNNowledge/` first (canonical domaiNN workspace location), then
 * the workspace root (`.`).
 * @param {string} projectDir
 * @param {string} projectName
 * @param {(v1: number[], v2: number[]) => number} compareVersions
 * @param {string} [suffix]
 * @param {string[]} [searchDirs]
 * @returns {string | null} Relative path from projectDir
 */
function resolveLatestModelFile(
  projectDir,
  projectName,
  compareVersions,
  suffix = '_cogNNitive_NN.md',
  searchDirs = ['kNNowledge', '.'],
) {
  const prefix = `${projectName}_V_`;

  let bestFile = null;
  let bestVersion = [-1, -1, -1];

  for (const dirName of searchDirs) {
    const dir = dirName === '.' ? projectDir : path.join(projectDir, dirName);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);

    for (const f of files) {
      if (f.startsWith(prefix) && f.endsWith(suffix)) {
        const verStr = f.substring(prefix.length, f.length - suffix.length);
        const parts = verStr.split('-');
        if (parts.length === 3) {
          const ver = parts.map(Number);
          if (ver.every((n) => !isNaN(n))) {
            if (compareVersions(ver, bestVersion) > 0) {
              bestVersion = ver;
              bestFile = dirName === '.' ? f : path.join(dirName, f).replace(/\\/g, '/');
            }
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
  walkFiles,
  emptySection,
  splitTopLevelSections,
  buildFreshModel,
  refreshExistingModel,
  appendProcedureRun,
  resolveLatestModelFile,
};
