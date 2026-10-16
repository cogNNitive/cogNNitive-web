const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { bootstrapProject } = require('../../scripts/lib/bootstrap');

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

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-bootstrap-inplace-'));
  try {
    const targetDir = path.join(tmp, 'my-existing-domain_NN');
    fs.mkdirSync(targetDir, { recursive: true });
    // Pre-existing user file inside targetDir (e.g. desktop.ini or existing note)
    fs.writeFileSync(path.join(targetDir, 'desktop.ini'), '[.ShellClassInfo]\r\n');

    // Run in-place bootstrap
    const result = bootstrapProject(null, targetDir, null, { inPlace: true });

    check(result.projectDir === targetDir, `projectDir matches targetDir exactly (got ${result.projectDir})`);
    check(result.importDir === path.join(targetDir, 'sources', 'import'), 'importDir is targetDir/sources/import');
    check(fs.existsSync(path.join(targetDir, 'AGENTS.md')), 'AGENTS.md created at targetDir root');
    check(fs.existsSync(path.join(targetDir, 'domaiNN_NN.md')), 'domaiNN_NN.md created at targetDir root');
    check(fs.existsSync(path.join(targetDir, 'my-existing-domain_NN_cogNNitive_NN.md')), 'lineage record created at targetDir root');
    check(fs.existsSync(path.join(targetDir, 'kNNowledge')), 'kNNowledge directory created at targetDir root');
    check(fs.existsSync(path.join(targetDir, 'sources', 'import')), 'sources/import created');
    check(fs.existsSync(path.join(targetDir, 'desktop.ini')), 'existing user file preserved');

    // Verify it did NOT create a subfolder with targetDir name
    check(!fs.existsSync(path.join(targetDir, 'my-existing-domain_NN')), 'did not create nested subfolder');

    // Verify AGENTS.md content uses the targetDir basename
    const agentsContent = fs.readFileSync(path.join(targetDir, 'AGENTS.md'), 'utf8');
    check(agentsContent.includes('AGENTS.md — my-existing-domain_NN'), 'AGENTS.md references correct project name');

    // Test with srcDir copied in-place
    const targetDir2 = path.join(tmp, 'another-domain');
    const externalSrc = path.join(tmp, 'external-files');
    fs.mkdirSync(targetDir2, { recursive: true });
    fs.mkdirSync(externalSrc, { recursive: true });
    fs.writeFileSync(path.join(externalSrc, 'sample.txt'), 'hello world');

    const result2 = bootstrapProject(externalSrc, targetDir2, 'CustomName', { inPlace: true });
    check(result2.copiedCount === 1, `copiedCount is 1 (got ${result2.copiedCount})`);
    check(fs.existsSync(path.join(targetDir2, 'sources', 'import', 'sample.txt')), 'external file copied into in-place sources/import');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  runAsync().then(({ passed, failed }) => {
    console.log(`\nIn-place bootstrap test: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
