const fs = require('fs');
const path = require('path');

/**
 * Lists templates in the traNNsformations directory
 */
function listBlueprints(projectDir) {
  const transDir = path.join(projectDir, 'traNNsformations');
  if (!fs.existsSync(transDir)) {
    fs.mkdirSync(transDir, { recursive: true });
    return [];
  }
  return fs.readdirSync(transDir).filter(f => f.endsWith('.md'));
}

/**
 * Recursively collect *.md files under sources/nn/, preserving the path
 * relative to that directory (it mirrors sources/original/'s subfolders).
 * The top-level ingestion manifest (index.md) is excluded.
 */
function collectMarkdownFiles(mdDir) {
  const results = [];
  const walk = (dir, rel) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
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
 * Mechanical fallback transformer — used only when the agent cannot perform
 * the transformation itself (e.g. context too large). It does NOT interpret
 * the template: it concatenates every normalized Source under the template's
 * name so the agent (or user) has a single file to work from. The agent is
 * expected to redo this properly.
 */
async function applyTransformation(projectDir, templateName, options = {}) {
  const transDir = path.join(projectDir, 'traNNsformations');
  const mdDir = path.join(projectDir, 'sources', 'nn');

  const cleanBlueprintName = path.basename(templateName, '.md').replace(/\s+/g, '_');
  const exportDir = path.join(projectDir, 'export');
  const legacyArtDir = path.join(projectDir, 'artifacts');
  const outputDir = fs.existsSync(legacyArtDir) && !fs.existsSync(exportDir) ? legacyArtDir : exportDir;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const templatePath = path.join(transDir, templateName);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateName}`);
  }

  if (!fs.existsSync(mdDir)) {
    throw new Error('Markdown directory sources/nn/ not found. Please run scan first.');
  }

  const mdFiles = collectMarkdownFiles(mdDir);

  if (mdFiles.length === 0) {
    throw new Error('No normalized markdown files found in sources/nn/. Please run scan first.');
  }

  let sourceContent = '';
  for (const f of mdFiles) {
    const content = fs.readFileSync(path.join(mdDir, f), 'utf8');
    sourceContent += `---\n\n# Source File: ${f.replace(/\\/g, '/')}\n\n` + content.trim() + '\n\n';
  }

  const transformedOutput = runHeuristicTransformation(templateName, sourceContent);

  const timestamp = getFormattedTimestamp();
  const outputFileName = `${cleanBlueprintName}_${timestamp}.md`;
  const outputPath = path.join(outputDir, outputFileName);

  fs.writeFileSync(outputPath, transformedOutput, 'utf8');

  return {
    outputFileName,
    outputPath,
    content: transformedOutput
  };
}

/**
 * Concatenate every normalized Source under the template name, unchanged.
 * No structural interpretation — this is a placeholder for the agent to
 * transform properly.
 */
function runHeuristicTransformation(templateName, sourceContent) {
  const name = path.basename(templateName, '.md');
  return (
    `# ${name} — mechanical fallback\n\n` +
    `> Generated without agent interpretation: the normalized Sources below are ` +
    `concatenated verbatim. Rework this into the "${name}" template structure.\n\n` +
    sourceContent.trim() +
    '\n'
  );
}

function getFormattedTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const sec = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${min}${sec}`;
}

module.exports = {
  listBlueprints,
  applyTransformation
};