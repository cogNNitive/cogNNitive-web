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
  path.join('sources', 'export'),
  path.join('sources', 'nn'),
  'conversations',
  'export',
  'models',
  'procedures',
  'traNNsformations',
];

const TRANNSFORM_README = `# Transform

Transform (traNNsform) is a tool to structure and process unstructured documents:
1. Place files in \`sources/import/\`.
2. Scan and normalize to \`sources/nn/\`.
3. Track lineage with \`<Project>_V_0-2-0_workspace_NN.md\`.
`;

/**
 * Generate AGENTS.md instructions content for session start in a workspace.
 *
 * @param {string} projectName Project folder or workspace name.
 * @returns {string} Formatted Markdown content for AGENTS.md.
 */
function generateAgentsMd(projectName) {
  return `# AGENTS.md — ${projectName}

## Session Start: Load nn-router (MANDATORY)

At the beginning of every interactive session in this workspace, AI coding agents (Cursor, Claude Code, OpenCode, Codex, Antigravity) **MUST** immediately load and execute **\`nn-router\`** (\`skills/nn-router/SKILL.md\` or \`/nn-router\`).

### Session Start Protocol
1. **Activation Gate & Environment Readiness**: Trigger \`nn-router\` to run \`nn-preflight\` readiness checks (Node.js runtime, MCP health, and workspace layout verification).
2. **Session Transcript Allocation**: Silently allocate or attach turn logging under \`conversations/YYYY-MM-DD_HHmmss.md\` to preserve context.
3. **Skill Routing**: Match user intent against the 7 core skills in the cogNNitive catalog (\`nn-router\`, \`nn-preflight\`, \`nn-trannsform\`, \`nn-innfo\`, \`nn-site-generator\`, \`nn-design-presets\`, \`nn-skills-lifecycle\`).

### System & UX Governance (Mandatory)
- **Zero Unilateral Mutation (Consent First)**: NEVER move, rename, or delete user files (including raw files in \`sources/import/\`) without explicit confirmation.
- **Recommended Option First**: In all menus or option lists, present option \`[1]\` or \`[a]\` with the \`(Recommended)\` label.
- **Optimistic Execution & Informative Grace**: Proceed immediately on safe, standard, non-destructive actions while clearly announcing intent and providing an easy interruption path.
- **Conversations as Reference & Source**: Continuously log session turns and offer promotion to \`sources/conversations/\` at session completion.
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
 * @returns {{ projectDir: string, importDir: string, originalDir: string, copiedCount: number, provModelPath: string, agentsMdPath: string }}
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

  const agentsMdPath = path.join(projectDir, 'AGENTS.md');
  if (!fs.existsSync(agentsMdPath) || overwriteAgents) {
    fs.writeFileSync(agentsMdPath, generateAgentsMd(projectName), 'utf8');
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

  const prov = provenance.buildProvenanceModel(projectDir, { projectName });

  return { projectDir, importDir, originalDir: importDir, copiedCount, provModelPath: prov.modelPath, agentsMdPath };
}

module.exports = { bootstrapProject, generateAgentsMd, WORKSPACE_DIRS };
