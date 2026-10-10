const fs = require('fs');
const path = require('path');
const os = require('os');

const { curateCsvFile } = require('../../scripts/lib/curate-csv');
const { createNormalizer } = require('../../scripts/lib/normalizer');

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
    fs.mkdirSync(importDir, { recursive: true });

    // Curated CSV is a derived artifact: write-once under artifacts/curated/, with a sidecar.
    const rawCsv = path.join(importDir, 'metrics.csv');
    fs.writeFileSync(rawCsv, 'count,id\n10,a\n20,b\n', 'utf8');
    const curated = await curateCsvFile(rawCsv, { key: 'id', projectDir: projDir });
    ok(/^artifacts\/curated\/metrics_\d{8}T\d{6}Z\.csv$/.test(curated.relOutput), 'curated CSV is a suffixed artifact under artifacts/curated/');
    ok(fs.existsSync(curated.outputPath), 'curated CSV written');
    ok(fs.readFileSync(curated.outputPath, 'utf8').split('\n')[0] === 'id,count', 'curated CSV has the key column first');
    ok(curated.citationExample === `${curated.relOutput}@a`, 'citation example points at the artifact path');
    ok(!fs.existsSync(path.join(projDir, 'sources', 'nn')), 'curating creates no sources/nn mirror');
    ok(fs.readFileSync(rawCsv, 'utf8') === 'count,id\n10,a\n20,b\n', 'the raw CSV is untouched');

    const sidecar = fs.readFileSync(`${curated.outputPath}_sidecar_NN.md`, 'utf8');
    ok(sidecar.includes(`source_file: ${curated.relOutput}`), 'curated sidecar names the artifact as its subject');
    ok(/\nsha256: [a-f0-9]{64}\n/.test(sidecar), 'curated sidecar has sha256');
    ok(/\nsize_bytes: \d+\n/.test(sidecar), 'curated sidecar has size_bytes');
    ok(/\nnormalized_at: /.test(sidecar), 'curated sidecar has normalized_at');
    ok(!/is_synthetic/.test(sidecar), 'curated sidecar does not contain is_synthetic');

    const again = await curateCsvFile(rawCsv, { key: 'id', projectDir: projDir });
    ok(again.outputPath === curated.outputPath, 'curating identical input again reuses the latest member');
    ok(fs.readdirSync(path.join(projDir, 'artifacts', 'curated')).length === 2, 'no new file is written for identical input');

    // The normalizer adapter: text-native subjects get metadata only; other formats get a body.
    const normalizer = createNormalizer({ projectDir: projDir });
    fs.writeFileSync(path.join(importDir, 'plain.txt'), 'Plain text body.', 'utf8');
    const txt = await normalizer({ path: 'sources/import/plain.txt', ext: 'txt', bytes: Buffer.from('Plain text body.') });
    ok(txt.body.includes('Plain text body.'), 'the adapter converts txt to a body');
    ok(/^traNNsform v/.test(txt.normalizedBy), 'the adapter names itself in normalized_by');
    const md = await normalizer({ path: 'sources/import/notes.md', ext: 'md', bytes: Buffer.from('# N') });
    ok(md.body === '', 'the adapter returns no body for text-native formats');
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    console.error(err.stack);
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
