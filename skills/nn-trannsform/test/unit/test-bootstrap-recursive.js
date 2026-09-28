const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { bootstrapProject } = require('../../scripts/lib/bootstrap');

/**
 * Regression test for the bootstrap copy: files in subfolders of the source
 * directory must land under sources/original/ with their structure preserved.
 * The old implementation did a flat readdirSync + isFile() and silently
 * dropped everything below the top level.
 */
function run() {
  let passed = 0;
  let failed = 0;

  function check(cond, msg) {
    if (cond) {
      console.log(`  PASS: ${msg}`);
      passed++;
    } else {
      console.log(`  FAIL: ${msg}`);
      failed++;
    }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-bootstrap-'));
  try {
    const srcDir = path.join(tmp, 'incoming');
    const destParent = path.join(tmp, 'workspaces');
    fs.mkdirSync(path.join(srcDir, 'clientA', 'deep'), { recursive: true });
    fs.mkdirSync(path.join(srcDir, 'clientB'), { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'top.txt'), 'top');
    fs.writeFileSync(path.join(srcDir, 'clientA', 'report.md'), 'a');
    fs.writeFileSync(path.join(srcDir, 'clientA', 'deep', 'notes.txt'), 'deep');
    fs.writeFileSync(path.join(srcDir, 'clientB', 'memo.md'), 'b');
    // Ignored by walkOriginal — must not be copied.
    fs.writeFileSync(path.join(srcDir, '.DS_Store'), 'x');
    fs.mkdirSync(path.join(srcDir, 'staging'));
    fs.writeFileSync(path.join(srcDir, 'staging', 'scratch.txt'), 'x');

    const result = bootstrapProject(srcDir, destParent, 'Proj');
    const importDir = path.join(destParent, 'Proj', 'sources', 'import');

    check(result.copiedCount === 4, `copiedCount is 4 (got ${result.copiedCount})`);
    check(fs.existsSync(path.join(importDir, 'top.txt')), 'top-level file copied');
    check(
      fs.existsSync(path.join(importDir, 'clientA', 'report.md')),
      'subfolder file copied with structure preserved',
    );
    check(
      fs.existsSync(path.join(importDir, 'clientA', 'deep', 'notes.txt')),
      'nested subfolder file copied',
    );
    check(fs.existsSync(path.join(importDir, 'clientB', 'memo.md')), 'sibling subfolder file copied');
    check(!fs.existsSync(path.join(importDir, '.DS_Store')), 'dotfile not copied');
    check(!fs.existsSync(path.join(importDir, 'staging')), 'staging/ not copied');

    // Standard workspace layout created with updated conventions
    for (const d of [
      'models',
      'procedures',
      'export',
      'conversations',
      path.join('sources', 'import'),
      path.join('sources', 'conversations'),
      path.join('sources', 'export'),
      path.join('sources', 'nn'),
    ]) {
      check(
        fs.existsSync(path.join(destParent, 'Proj', d)),
        `workspace dir ${d} created`,
      );
    }
    check(!fs.existsSync(path.join(destParent, 'Proj', 'artifacts')), 'deprecated artifacts/ not created');
    check(!fs.existsSync(path.join(destParent, 'Proj', 'sources', 'original')), 'deprecated sources/original/ not created');
    check(fs.existsSync(result.provModelPath), 'provenance model initialized');

    // AGENTS.md default scaffolding
    check(Boolean(result.agentsMdPath), 'result.agentsMdPath is returned');
    check(fs.existsSync(result.agentsMdPath), 'AGENTS.md exists at project root');
    const agentsContent = fs.readFileSync(result.agentsMdPath, 'utf8');
    check(
      agentsContent.includes('## Session Start: Load nn-start (MANDATORY)'),
      'AGENTS.md has Session Start nn-start directive',
    );
    check(
      agentsContent.includes('nn-preflight'),
      'AGENTS.md references nn-preflight check',
    );

    // Preservation of pre-existing AGENTS.md
    const existingProjDir = path.join(destParent, 'ProjExisting');
    fs.mkdirSync(existingProjDir, { recursive: true });
    const customAgentsPath = path.join(existingProjDir, 'AGENTS.md');
    fs.writeFileSync(customAgentsPath, '# Custom Pre-existing AGENTS Config\n', 'utf8');

    const preservedResult = bootstrapProject(undefined, destParent, 'ProjExisting');
    check(preservedResult.agentsMdPath === customAgentsPath, 'preservedResult points to existing AGENTS.md');
    const preservedContent = fs.readFileSync(customAgentsPath, 'utf8');
    check(
      preservedContent === '# Custom Pre-existing AGENTS Config\n',
      'existing custom AGENTS.md is preserved intact without overwrite',
    );

    // Overwrite pre-existing AGENTS.md when overwriteAgents: true
    const overwrittenResult = bootstrapProject(undefined, destParent, 'ProjExisting', { overwriteAgents: true });
    const overwrittenContent = fs.readFileSync(overwrittenResult.agentsMdPath, 'utf8');
    check(
      overwrittenContent.includes('## Session Start: Load nn-start (MANDATORY)'),
      'AGENTS.md is overwritten when options.overwriteAgents is true',
    );

    // No source dir → no crash, zero copied.
    const empty = bootstrapProject(undefined, destParent, 'Proj2');
    check(empty.copiedCount === 0, 'no srcDir → copiedCount 0');
    check(fs.existsSync(empty.agentsMdPath), 'empty src bootstrap still scaffolds AGENTS.md');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const r = run();
  process.exit(r.failed > 0 ? 1 : 0);
}
