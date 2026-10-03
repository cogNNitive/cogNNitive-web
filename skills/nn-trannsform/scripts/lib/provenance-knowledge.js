const fs = require('fs');
const path = require('path');

const {
  RECORD_TEMPLATE_URL: TEMPLATE_URL,
  RECORD_INNFO_URL: INNFO_URL,
  RECORD_BLUEPRINT: TEMPLATE_NAME,
  splitTopLevelSections,
  renderRecordFrontmatter,
  refreshExistingModel,
} = require('./innfo-core.generated.cjs');

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
    renderRecordFrontmatter(`${title} Provenance`) +
    '\n' +
    DOC_NOTICE.replace(/^\n+|\n+$/g, '') +
    '\n\n' +
    blocks.join('\n') +
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
};
