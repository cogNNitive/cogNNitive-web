const fs = require('fs');
const path = require('path');
const { writeOnce, isSidecarName, isExcludedPath, rawPathOfSidecar } = require('./lib/innfo-core.generated.cjs');

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
 * Collect the cognitivized sources of the domaiNN: one entry per sidecar under
 * `sources/`, in path order. A binary subject contributes the normalized body
 * of its sidecar; a text-native subject (no sidecar body) contributes its own
 * text. Staging and sidecar metadata are never included.
 *
 * @returns {Array<{ path: string, text: string }>} workspace-relative subject path and its text
 */
function collectCognitivizedSources(projectDir) {
  const sourcesDir = path.join(projectDir, 'sources');
  const results = [];
  if (!fs.existsSync(sourcesDir)) return results;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(projectDir, abs).replace(/\\/g, '/');
      if (isExcludedPath(rel)) continue;
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile() && isSidecarName(entry.name)) {
        const subject = rawPathOfSidecar(rel);
        if (!subject) continue;
        const sidecar = fs.readFileSync(abs, 'utf8');
        let text = sidecar.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
        if (!text) {
          const rawAbs = path.join(projectDir, subject);
          if (!fs.existsSync(rawAbs)) continue;
          text = fs.readFileSync(rawAbs, 'utf8').trim();
        }
        results.push({ path: subject, text });
      }
    }
  };
  walk(sourcesDir);
  return results.sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
}

/**
 * Mechanical fallback transformer — used only when the agent cannot perform
 * the transformation itself (e.g. context too large). It does NOT interpret
 * the template: it concatenates every cognitivized Source under the template's
 * name so the agent (or user) has a single file to work from. The agent is
 * expected to redo this properly.
 */
async function applyTransformation(projectDir, templateName, options = {}) {
  const transDir = path.join(projectDir, 'traNNsformations');

  const cleanBlueprintName = path.basename(templateName, '.md').replace(/\s+/g, '_');

  const templatePath = path.join(transDir, templateName);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templateName}`);
  }

  const sources = collectCognitivizedSources(projectDir);
  if (sources.length === 0) {
    throw new Error('No cognitivized sources found under sources/. Please run --scan (or --cognitivize) first.');
  }

  let sourceContent = '';
  for (const src of sources) {
    sourceContent += `---\n\n# Source File: ${src.path}\n\n` + src.text + '\n\n';
  }

  const transformedOutput = runHeuristicTransformation(templateName, sourceContent);

  // Write-once: identical output deduplicates against the latest member, and a
  // cognitivized source edited since its sidecar was written blocks the write.
  const written = await writeOnce(
    projectDir,
    { dir: 'artifacts', key: cleanBlueprintName, ext: 'md' },
    transformedOutput,
    { inputs: sources.map((s) => s.path) },
  );

  return {
    outputFileName: path.posix.basename(written.path),
    outputPath: path.join(projectDir, written.path),
    content: transformedOutput,
    status: written.status
  };
}

/**
 * Concatenate every cognitivized Source under the template name, unchanged.
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

module.exports = {
  listBlueprints,
  applyTransformation
};