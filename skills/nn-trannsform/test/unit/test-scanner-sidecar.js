const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const scanner = require('../../scripts/scanner');
const { generateSourceFrontmatter } = require('../../scripts/lib/scanner-core');
const { curateCsvFile } = require('../../scripts/lib/curate-csv');

async function run() {
  let passed = 0;
  let failed = 0;

  function ok(cond, msg) {
    if (cond) {
      console.log(`  PASS: ${msg}`);
      passed++;
    } else {
      console.log(`  FAIL: ${msg}`);
      failed++;
    }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-sidecar-unit-'));
  try {
    const projDir = path.join(tmp, 'TestProj');
    const importDir = path.join(projDir, 'sources', 'import');
    const exportDir = path.join(projDir, 'sources', 'export');
    const feedbackDir = path.join(importDir, 'feedback');
    const nnDir = path.join(projDir, 'sources', 'nn');
    fs.mkdirSync(feedbackDir, { recursive: true });
    fs.mkdirSync(exportDir, { recursive: true });
    fs.mkdirSync(nnDir, { recursive: true });

    // 1. generateSourceFrontmatter should NOT contain is_synthetic or derived_from
    const dummyFile = path.join(importDir, 'dummy.txt');
    fs.writeFileSync(dummyFile, 'hello world', 'utf8');
    const fm = generateSourceFrontmatter(dummyFile, 'sources/import/dummy.txt', {
      is_synthetic: true,
      derived_from: ['kNNowledge/Plan_NN.md'],
    });
    ok(!fm.includes('is_synthetic:'), 'generateSourceFrontmatter drops is_synthetic');
    ok(!fm.includes('derived_from:'), 'generateSourceFrontmatter drops derived_from');

    // 2. Feedback JSON ingestion produces source_type: feedback but NO is_synthetic
    const feedbackJson = path.join(feedbackDir, 'review1.json');
    fs.writeFileSync(
      feedbackJson,
      JSON.stringify({
        meta: {
          source_knowledge: 'Ghostbusters',
          source_knowledge_version: 'V_0-2-1',
          artifact: 'Ghostbusters_V_0-2-1_console.html',
          artifact_version: '0.1.0',
          exported_at: '2026-09-09T12:00:00Z',
          author: 'Reviewer',
          feedback_slug: 'round-1',
          viewer: 'innfo-console/0.1.0',
        },
        items: [
          {
            id: 'fb-001',
            kind: 'comment',
            target: { unit: 'overview' },
            text: 'Looks great',
          },
        ],
      }),
      'utf8',
    );

    // 3. Promoted deliverable in sources/export/ gets normalized sidecar without is_synthetic or derived_from
    const promotedFile = path.join(exportDir, 'summary.md');
    fs.writeFileSync(
      promotedFile,
      '---\ntype: "report"\nsources: ["kNNowledge/Plan_NN.md@## Section"]\n---\n# Summary\n',
      'utf8',
    );

    await scanner.scanAndProcess(projDir, { autoAcceptPrompt: true });

    const normFeedback = path.join(nnDir, 'import', 'feedback', 'review1.md');
    ok(fs.existsSync(normFeedback), 'feedback document is normalized');
    const fbContent = fs.readFileSync(normFeedback, 'utf8');
    ok(fbContent.includes('source_type: "feedback"'), 'feedback document retains source_type: feedback');
    ok(!fbContent.includes('is_synthetic:'), 'feedback document frontmatter does NOT contain is_synthetic');

    const normExport = path.join(nnDir, 'export', 'summary.md');
    ok(fs.existsSync(normExport), 'promoted export document is normalized');
    const expContent = fs.readFileSync(normExport, 'utf8');
    ok(!expContent.includes('is_synthetic:'), 'promoted export does NOT contain is_synthetic');
    ok(!expContent.includes('derived_from:'), 'promoted export frontmatter does NOT contain derived_from');

    // 4. Curated CSV without a profile .md gets a normalized sidecar
    const rawCsv = path.join(importDir, 'metrics.csv');
    fs.writeFileSync(rawCsv, 'id,count\na,10\nb,20\n', 'utf8');
    const curateResult = curateCsvFile(rawCsv, { key: 'id', projectDir: projDir });
    ok(fs.existsSync(curateResult.outputPath), 'curated CSV written');
    const sidecarMd = curateResult.outputPath.replace(/\.csv$/i, '.md');
    ok(fs.existsSync(sidecarMd), 'curateCsvFile generates sidecar .md when none exists');
    const sidecarContent = fs.readFileSync(sidecarMd, 'utf8');
    ok(sidecarContent.includes('source_file: "sources/import/metrics.csv"'), 'sidecar contains source_file');
    ok(sidecarContent.includes('sha256:'), 'sidecar contains sha256');
    ok(sidecarContent.includes('size_bytes:'), 'sidecar contains size_bytes');
    ok(sidecarContent.includes('normalized_at:'), 'sidecar contains normalized_at');
    ok(!sidecarContent.includes('is_synthetic:'), 'sidecar does not contain is_synthetic');
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    failed++;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then(({ passed, failed }) => {
    console.log(`\nScanner-sidecar tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
