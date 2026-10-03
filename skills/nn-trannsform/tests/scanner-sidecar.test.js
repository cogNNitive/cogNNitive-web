const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const scanner = require('../scripts/scanner');
const { curateCsvFile } = require('../scripts/lib/curate-csv');

test('scanner and curate-csv: co-located sidecars, no mirror, curated CSV is a write-once artifact', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-sidecar-'));

  try {
    const projDir = path.join(tmp, 'TestProj');
    const importDir = path.join(projDir, 'sources', 'import');
    fs.mkdirSync(importDir, { recursive: true });
    fs.writeFileSync(path.join(importDir, 'dummy.txt'), 'hello world', 'utf8');

    await scanner.scanAndProcess(projDir, { autoAcceptPrompt: true });
    const sidecar = fs.readFileSync(path.join(importDir, 'dummy.txt_sidecar_NN.md'), 'utf8');
    assert.ok(sidecar.includes('source_file: sources/import/dummy.txt'));
    assert.ok(!/is_synthetic|derived_from|staging_file/.test(sidecar));
    assert.ok(!fs.existsSync(path.join(projDir, 'sources', 'nn')));

    const before = fs.readFileSync(path.join(importDir, 'dummy.txt_sidecar_NN.md'), 'utf8');
    await scanner.scanAndProcess(projDir, { autoAcceptPrompt: true });
    assert.equal(fs.readFileSync(path.join(importDir, 'dummy.txt_sidecar_NN.md'), 'utf8'), before);

    const rawCsv = path.join(importDir, 'metrics.csv');
    fs.writeFileSync(rawCsv, 'id,count\na,10\nb,20\n', 'utf8');
    const curated = await curateCsvFile(rawCsv, { key: 'id', projectDir: projDir });
    assert.match(curated.relOutput, /^artifacts\/curated\/metrics_\d{8}T\d{6}Z\.csv$/);
    assert.ok(fs.existsSync(`${curated.outputPath}_sidecar_NN.md`));
    const again = await curateCsvFile(rawCsv, { key: 'id', projectDir: projDir });
    assert.equal(again.outputPath, curated.outputPath);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
