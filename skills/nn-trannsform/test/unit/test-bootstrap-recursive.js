const assert = require('assert');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const path = require('path');

const { bootstrapProject } = require('../../scripts/lib/bootstrap');

/**
 * Regression test for the bootstrap copy: files in subfolders of the source
 * directory must land under sources/import/ with their structure preserved.
 * The old implementation did a flat readdirSync + isFile() and silently
 * dropped everything below the top level.
 */
function run() {
  return runAsync();
}

async function runAsync() {
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
    fs.writeFileSync(path.join(srcDir, 'crlf.csv'), Buffer.from('a,b\r\n1,2\r\n', 'utf8'));
    fs.writeFileSync(path.join(srcDir, 'clientA', 'report.md'), 'a');
    fs.writeFileSync(path.join(srcDir, 'clientA', 'deep', 'notes.txt'), 'deep');
    fs.writeFileSync(path.join(srcDir, 'clientB', 'memo.md'), 'b');
    // Ignored by walkOriginal — must not be copied.
    fs.writeFileSync(path.join(srcDir, '.DS_Store'), 'x');
    fs.mkdirSync(path.join(srcDir, 'staging'));
    fs.writeFileSync(path.join(srcDir, 'staging', 'scratch.txt'), 'x');

    const result = bootstrapProject(srcDir, destParent, 'Proj');
    const importDir = path.join(destParent, 'Proj', 'sources', 'import');

    check(result.copiedCount === 5, `copiedCount is 5 (got ${result.copiedCount})`);
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
      'kNNowledge',
      'procedures',
      'artifacts',
      'conversations',
      path.join('sources', 'import'),
      path.join('sources', 'conversations'),
    ]) {
      check(
        fs.existsSync(path.join(destParent, 'Proj', d)),
        `workspace dir ${d} created`,
      );
    }
    check(!fs.existsSync(path.join(destParent, 'Proj', 'export')), 'retired export/ not created');
    for (const retired of ['nn', 'export', 'original', 'archive']) {
      check(!fs.existsSync(path.join(destParent, 'Proj', 'sources', retired)), 'retired sources/' + retired + '/ not created');
    }
    const entrypoint = fs.readFileSync(path.join(destParent, 'Proj', 'domaiNN_NN.md'), 'utf8');
    check(/sources_dir:: sources\/\n/.test(entrypoint), 'entrypoint sources_dir:: names sources/');
    check(
      !/sources\/nn/.test(entrypoint) && !/sources\/nn/.test(require('../../scripts/lib/bootstrap').generateAgentsMd('Proj')),
      'no sources/nn reference is written',
    );
    // The README of a project named "trannsform" is the only other text bootstrap writes.
    const readmeDest = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-bootstrap-readme-'));
    try {
      require('../../scripts/lib/bootstrap').bootstrapProject(null, readmeDest, 'trannsform');
      const readme = fs.readFileSync(path.join(readmeDest, 'trannsform', 'README.md'), 'utf8');
      check(!/sources\/nn/.test(readme) && /cognitivize/.test(readme), 'README describes in-place cognitivizing, not a sources/nn mirror');
    } finally {
      fs.rmSync(readmeDest, { recursive: true, force: true });
    }
    check(!fs.existsSync(path.join(destParent, 'Proj', 'sources', 'original')), 'deprecated sources/original/ not created');
    check(fs.existsSync(result.provModelPath), 'provenance model initialized');
    check(fs.existsSync(path.join(destParent, 'Proj', 'domaiNN_NN.md')), 'domaiNN_NN.md entrypoint created');

    const { detectLegacy } = require('../../../nn-preflight/scripts/lib/legacy-detect.generated.cjs');
    const projDir = path.join(destParent, 'Proj');
    const fsReader = {
      list: async (rel) => {
        const full = path.join(projDir, rel);
        return fs.existsSync(full) ? fs.readdirSync(full) : [];
      },
      read: async (rel) => fs.readFileSync(path.join(projDir, rel), 'utf8'),
    };
    const layoutDetection = await detectLegacy(fsReader);
    check(layoutDetection.kind === 'current', `bootstrapped project detected as current (got ${layoutDetection.kind})`);

    // Text policy: bootstrap writes `* -text` so raw-byte hashes survive checkout.
    const gitattributesPath = path.join(projDir, '.gitattributes');
    check(fs.existsSync(gitattributesPath), '.gitattributes is written');
    check(
      fs.readFileSync(gitattributesPath, 'utf8').split(/\r?\n/).includes('* -text'),
      '.gitattributes contains `* -text`',
    );

    // Existing .gitattributes lines are preserved and the policy is appended once.
    const gaProjDir = path.join(destParent, 'ProjAttrs');
    fs.mkdirSync(gaProjDir, { recursive: true });
    fs.writeFileSync(path.join(gaProjDir, '.gitattributes'), '*.png binary\n', 'utf8');
    bootstrapProject(undefined, destParent, 'ProjAttrs');
    bootstrapProject(undefined, destParent, 'ProjAttrs');
    const gaLines = fs.readFileSync(path.join(gaProjDir, '.gitattributes'), 'utf8').split(/\r?\n/).filter(Boolean);
    check(gaLines[0] === '*.png binary', 'existing .gitattributes lines are preserved');
    check(gaLines.filter((l) => l === '* -text').length === 1, '`* -text` is added exactly once across reruns');

    // CRLF bytes copied into sources/import/ keep their SHA-256.
    const crlfBytes = Buffer.from('a,b\r\n1,2\r\n', 'utf8');
    check(
      crypto.createHash('sha256').update(fs.readFileSync(path.join(importDir, 'crlf.csv'))).digest('hex') ===
        crypto.createHash('sha256').update(crlfBytes).digest('hex'),
      'CRLF fixture keeps its SHA-256 through bootstrap',
    );

    // AGENTS.md default scaffolding
    check(Boolean(result.agentsMdPath), 'result.agentsMdPath is returned');
    check(fs.existsSync(result.agentsMdPath), 'AGENTS.md exists at project root');
    const agentsContent = fs.readFileSync(result.agentsMdPath, 'utf8');
    check(
      agentsContent.includes('## Session Start: Load nn (MANDATORY)'),
      'AGENTS.md has Session Start nn directive',
    );
    check(
      agentsContent.includes('domain-probe.js'),
      'AGENTS.md references domain probe check',
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
      overwrittenContent.includes('## Session Start: Load nn (MANDATORY)'),
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
