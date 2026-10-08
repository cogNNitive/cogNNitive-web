const fs = require('fs');
const path = require('path');
const core = require('./scanner-core');
const provenance = require('../provenance');

/**
 * Standard workspace subdirectories created under a new project.
 * @type {string[]}
 */
const WORKSPACE_DIRS = [
  path.join('sources', 'import'),
  path.join('sources', 'conversations'),
  'conversations',
  'artifacts',
  'kNNowledge',
  'procedures',
  'traNNsformations',
];

/** Text policy: no EOL conversion, so raw-byte hashes survive a checkout on any platform. */
const TEXT_POLICY_LINE = '* -text';

/**
 * Ensure the domaiNN root `.gitattributes` carries the `* -text` policy,
 * preserving every existing line. Idempotent.
 *
 * @param {string} projectDir
 */
function ensureTextPolicy(projectDir) {
  const file = path.join(projectDir, '.gitattributes');
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (existing.split(/\r?\n/).includes(TEXT_POLICY_LINE)) return;
  const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
  fs.writeFileSync(file, `${existing}${separator}${TEXT_POLICY_LINE}\n`, 'utf8');
}

const TRANNSFORM_README = `# Transform

Transform (traNNsform) is a tool to structure and process unstructured documents:
1. Place files in \`sources/import/\`.
2. Scan to cognitivize them in place (a co-located \`_sidecar_NN.md\` next to each file).
3. Track lineage with \`<Project>_cogNNitive_NN.md\`.
`;

/**
 * Generate AGENTS.md instructions content for session start in a workspace.
 *
 * @param {string} projectName Project folder or workspace name.
 * @returns {string} Formatted Markdown content for AGENTS.md.
 */
function generateAgentsMd(projectName) {
  return `# AGENTS.md — ${projectName}

## Session Start: Load nn (MANDATORY)

At the beginning of every interactive session in this workspace, AI coding agents (Cursor, Claude Code, OpenCode, Codex, Antigravity) **MUST** immediately load and execute **\`nn\`** (\`skills/nn/SKILL.md\` or \`/nn\`).

### Session Start Protocol
1. **Activation Gate & Environment Readiness**: Trigger \`nn\` to run the domain state probe (\`domain-probe.js\`) and inspect workspace layout and readiness.
2. **Session Transcript Allocation**: Silently allocate or attach turn logging under \`conversations/YYYY-MM-DD_HHmmss.md\` to preserve context.
3. **Job Navigation**: Present the Job Loop Navigation Menu (\`[s] Sources\`, \`[m] Model\`, \`[r] Review/Deliverables\`, \`[p] Procedures\`).

### System & UX Governance (Mandatory)
- **Zero Unilateral Mutation (Consent First)**: NEVER move, rename, or delete user files (including raw files in \`sources/import/\`) without explicit confirmation.
- **Recommended Option First**: In all menus or option lists, present the \`(Recommended)\` option first based on domain state.
- **Optimistic Execution & Informative Grace**: Proceed immediately on safe, standard, non-destructive actions while clearly announcing intent and providing an easy interruption path.
- **Conversations as Reference & Source**: Continuously log session turns and auto-promote to \`sources/conversations/\` at session completion (the user can opt out).
`;
}

/**
 * Bootstrap a new traNNsform project workspace.
 *
 * Copies every file under \`srcDir\` into \`sources/import/\` **recursively,
 * preserving the subfolder structure** (previously a flat \`readdirSync\` that
 * silently skipped anything below the top level). Reuses
 * \`scanner-core.walkOriginal\`, so the same ignore rules apply (dotfiles,
 * Office lock files, \`desktop.ini\`, and any \`staging/\` directory).
 *
 * @param {string} srcDir Directory of files to import (copied, never moved).
 * @param {string} destParentDir Parent directory the project folder is created in.
 * @param {string} projectName Project folder name.
 * @param {object} [options={}] Optional configuration options.
 * @param {boolean} [options.overwriteAgents=false] Whether to overwrite existing AGENTS.md.
 * @returns {{ projectDir: string, importDir: string, copiedCount: number, provModelPath: string, agentsMdPath: string }}
 */
function bootstrapProject(srcDir, destParentDir, projectName, options = {}) {
  const projectDir = path.join(destParentDir, projectName);
  const importDir = path.join(projectDir, 'sources', 'import');
  const overwriteAgents = Boolean(options.overwriteAgents);

  fs.mkdirSync(projectDir, { recursive: true });
  for (const d of WORKSPACE_DIRS) fs.mkdirSync(path.join(projectDir, d), { recursive: true });

  if (projectName.toLowerCase() === 'trannsform') {
    fs.writeFileSync(path.join(projectDir, 'README.md'), TRANNSFORM_README, 'utf8');
  }

  ensureTextPolicy(projectDir);

  const agentsMdPath = path.join(projectDir, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath) || overwriteAgents) {
    fs.writeFileSync(agentsMdPath, generateAgentsMd(projectName), 'utf8');
  }

  const domainnPath = path.join(projectDir, 'domaiNN_NN.md');
  if (!fs.existsSync(domainnPath)) {
    const domainnContent =
      `---\n` +
      `level: 3\n` +
      `parent_spec:\n` +
      `  name: "domaiNN"\n` +
      `  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md"\n` +
      `knowledge_version: "V_0-1-0"\n` +
      `title: "${projectName} Workspace"\n` +
      `---\n\n` +
      `> [!NOTE]\n` +
      `> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).\n\n` +
      `# NN index\n\n` +
      `* [[Workspace]]\n` +
      `* [[Models]]\n` +
      `* [[Sources]]\n` +
      `* [[Procedures]]\n` +
      `* [[Artifacts]]\n\n` +
      `# NN Workspace\n\n` +
      `## NN Workspace: ${projectName} Workspace\n` +
      `knowledge_dir:: kNNowledge/\n` +
      `sources_dir:: sources/\n` +
      `Operational workspace for ${projectName}.\n`;
    fs.writeFileSync(domainnPath, domainnContent, 'utf8');
  }

  let copiedCount = 0;
  if (
    srcDir &&
    fs.existsSync(srcDir) &&
    path.resolve(srcDir) !== path.resolve(importDir)
  ) {
    for (const { absPath, relPath } of core.walkOriginal(srcDir)) {
      const destPath = path.join(importDir, relPath);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(absPath, destPath);
      copiedCount++;
    }
  }

  const prov = provenance.buildProvenanceKnowledge(projectDir, { projectName });

  return { projectDir, importDir, copiedCount, provModelPath: prov.modelPath, agentsMdPath };
}

module.exports = { bootstrapProject, generateAgentsMd, WORKSPACE_DIRS };
