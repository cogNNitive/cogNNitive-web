const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  formatTimestampedBasename,
  parseSourceStem,
  parseWatchRoots,
  scanExternalDirectory,
  scanAllWatchRoots,
  serializeScanResult,
  importExternalFiles,
} = require('../../scripts/lib/external-scanner');

async function run() {
  let passed = 0;
  let failed = 0;

  async function it(desc, fn) {
    try {
      await fn();
      console.log(`  ✔ ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ ${desc}`);
      console.error(err);
      failed++;
    }
  }

  console.log('\n--- test-external-scanner ---');

  await it('formats the timestamped basename with the UTC contract stamp', () => {
    const fixedDate = new Date(Date.UTC(2026, 8, 12, 18, 55, 36));
    const tsName = formatTimestampedBasename('quarterly_forecast.xlsx', fixedDate);
    assert.strictEqual(tsName, 'quarterly_forecast_20260912T185536Z.xlsx');
  });

  await it('parses source stem and timestamp correctly', () => {
    const parsed1 = parseSourceStem('quarterly_forecast_20260912T185536Z.xlsx');
    assert.strictEqual(parsed1.stem, 'quarterly_forecast');
    assert.strictEqual(parsed1.timestamp, '20260912T185536Z');
    assert.strictEqual(parsed1.ext, '.xlsx');

    const parsed2 = parseSourceStem('simple_doc.md');
    assert.strictEqual(parsed2.stem, 'simple_doc');
    assert.strictEqual(parsed2.timestamp, null);
    assert.strictEqual(parsed2.ext, '.md');
  });

  await it('parses declarative watch roots from markdown model', () => {
    const mockModel = `
# NN Workspace

## NN External Watch Roots:
- Root: "D:/External_Drops/Client_Inputs"
  Cadence: "dynamic"
  Recursive: true
  Filter: ["*.pdf", "*.docx"]
- Root: "Z:/Vault/Legal"
  Cadence: "static"
  Recursive: false
  Filter: ["*.pdf"]
`;
    const roots = parseWatchRoots(mockModel);
    assert.strictEqual(roots.length, 2);
    assert.strictEqual(roots[0].Root, 'D:/External_Drops/Client_Inputs');
    assert.strictEqual(roots[0].Cadence, 'dynamic');
    assert.strictEqual(roots[0].Recursive, true);
    assert.deepStrictEqual(roots[0].Filter, ['*.pdf', '*.docx']);

    assert.strictEqual(roots[1].Root, 'Z:/Vault/Legal');
    assert.strictEqual(roots[1].Cadence, 'static');
    assert.strictEqual(roots[1].Recursive, false);
    assert.deepStrictEqual(roots[1].Filter, ['*.pdf']);
  });

  await it('scans external directory with Fast Path caching and detects delta status', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-scan-test-'));
    try {
      const file1 = path.join(tempDir, 'sales_q3.xlsx');
      const file2 = path.join(tempDir, 'contract.pdf');
      fs.writeFileSync(file1, 'Sales Q3 initial content', 'utf8');
      fs.writeFileSync(file2, 'Legal Contract v1', 'utf8');

      // Initial scan (no cache)
      const res1 = scanExternalDirectory({ Root: tempDir, Cadence: 'dynamic' });
      assert.strictEqual(res1.status, 'CONNECTED');
      assert.strictEqual(res1.items.length, 2);
      assert.strictEqual(res1.items[0].deltaStatus, 'NEW');
      assert.strictEqual(res1.items[0].fastPathHit, false);

      // Build cache map from res1
      const cache = new Map();
      for (const it of res1.items) {
        cache.set(it.fullPath, {
          mtimeMs: it.mtimeMs,
          size: it.sizeBytes,
          sha256: it.sha256,
        });
      }

      // Second scan without modifying files -> should be UNCHANGED & Fast Path HIT
      const res2 = scanExternalDirectory({ Root: tempDir, Cadence: 'dynamic' }, cache);
      assert.strictEqual(res2.items[0].deltaStatus, 'UNCHANGED');
      assert.strictEqual(res2.items[0].fastPathHit, true);

      // Modify file1 content
      fs.writeFileSync(file1, 'Sales Q3 updated content with newer numbers', 'utf8');

      // Third scan -> file1 should be EVOLVED_DYNAMIC
      const res3 = scanExternalDirectory({ Root: tempDir, Cadence: 'dynamic' }, cache);
      const item1 = res3.items.find((i) => i.baseName === 'sales_q3.xlsx');
      const item2 = res3.items.find((i) => i.baseName === 'contract.pdf');

      assert.strictEqual(item1.deltaStatus, 'EVOLVED_DYNAMIC');
      assert.strictEqual(item1.fastPathHit, false);
      assert.strictEqual(item2.deltaStatus, 'UNCHANGED');
      assert.strictEqual(item2.fastPathHit, true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  await it('imports external candidate files into sources/import without modifying source', async () => {
    const tempExtDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-src-'));
    const tempWorkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-work-'));
    try {
      const extFile = path.join(tempExtDir, 'weekly_metrics.csv');
      fs.writeFileSync(extFile, 'week,active_users\n1,1200\n2,1450', 'utf8');

      const fixedDate = new Date(Date.UTC(2026, 8, 12, 12, 0, 0));
      const candidates = [
        {
          fullPath: extFile,
          baseName: 'weekly_metrics.csv',
          cadence: 'dynamic',
        },
      ];

      const imported = await importExternalFiles(candidates, tempWorkDir, { timestampDate: fixedDate });
      assert.strictEqual(imported.length, 1);
      assert.strictEqual(imported[0].importedAs, 'weekly_metrics_20260912T120000Z.csv');

      const importedPath = path.join(tempWorkDir, 'sources', 'import', 'weekly_metrics_20260912T120000Z.csv');
      assert.strictEqual(fs.existsSync(importedPath), true);
      assert.strictEqual(fs.readFileSync(importedPath, 'utf8'), fs.readFileSync(extFile, 'utf8'));

      // Ensure original file is strictly unmodified
      assert.strictEqual(fs.existsSync(extFile), true);
    } finally {
      fs.rmSync(tempExtDir, { recursive: true, force: true });
      fs.rmSync(tempWorkDir, { recursive: true, force: true });
    }
  });

  await it('serializes a scan result as stable JSON with changed items only', () => {
    const result = {
      roots: [
        {
          root: 'D:/Drops',
          cadence: 'dynamic',
          status: 'CONNECTED',
          items: [
            { relPath: 'a.csv', sha256: 'h1', mtimeMs: 1, sizeBytes: 10, deltaStatus: 'NEW' },
            { relPath: 'b.csv', sha256: 'h2', mtimeMs: 2, sizeBytes: 20, deltaStatus: 'UNCHANGED' },
          ],
        },
        { root: 'Z:/Gone', cadence: 'static', status: 'DISCONNECTED', items: [] },
      ],
    };
    const serialized = serializeScanResult(result);
    assert.strictEqual(serialized.roots.length, 2);
    assert.strictEqual(serialized.roots[0].items.length, 1, 'UNCHANGED items are omitted');
    assert.strictEqual(serialized.roots[0].items[0].relPath, 'a.csv');
    assert.strictEqual(serialized.roots[0].items[0].status, 'NEW');
    assert.strictEqual(serialized.roots[1].status, 'DISCONNECTED');
    assert.strictEqual(JSON.parse(JSON.stringify(serialized)).roots.length, 2);
  });

  await it('scanAllWatchRoots finds watch roots in the renamed domaiNN_NN.md entrypoint', () => {
    const tempProj = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-proj-'));
    const tempDrops = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-drops-'));
    try {
      fs.writeFileSync(path.join(tempDrops, 'q3.csv'), 'a,b\n1,2\n', 'utf8');
      const rootPosix = tempDrops.replace(/\\/g, '/');
      fs.writeFileSync(
        path.join(tempProj, 'domaiNN_NN.md'),
        `# NN index\n\n## NN External Watch Roots:\n- Root: "${rootPosix}"\n  Cadence: "dynamic"\n  Filter: ["*.csv"]\n`,
        'utf8',
      );

      const res = scanAllWatchRoots(tempProj);
      assert.strictEqual(res.roots.length, 1);
      assert.strictEqual(res.classified.new.length, 1);
    } finally {
      fs.rmSync(tempProj, { recursive: true, force: true });
      fs.rmSync(tempDrops, { recursive: true, force: true });
    }
  });

  await it('scanAllWatchRoots still finds the legacy cogNNitive lineage record', () => {
    const tempProj = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-proj-legacy-'));
    const tempDrops = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-drops-legacy-'));
    try {
      fs.writeFileSync(path.join(tempDrops, 'rates.csv'), 'a,b\n1,2\n', 'utf8');
      const rootPosix = tempDrops.replace(/\\/g, '/');
      // Seeded with an old versioned name on purpose: existing records are found by role.
      fs.writeFileSync(
        path.join(tempProj, 'Project_V_0-2-0_cogNNitive_NN.md'),
        `# NN index\n\n## NN External Watch Roots:\n- Root: "${rootPosix}"\n  Cadence: "dynamic"\n  Filter: ["*.csv"]\n`,
        'utf8',
      );

      const res = scanAllWatchRoots(tempProj);
      assert.strictEqual(res.roots.length, 1);
      assert.strictEqual(res.classified.new.length, 1);
    } finally {
      fs.rmSync(tempProj, { recursive: true, force: true });
      fs.rmSync(tempDrops, { recursive: true, force: true });
    }
  });

  return { passed, failed };
}

if (require.main === module) {
  run().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = { run };
