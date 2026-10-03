const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { importExternalFiles } = require('../../scripts/lib/external-scanner');
const webImport = require('../../scripts/webImport');
const processImages = require('../../scripts/process-images');

const SUFFIXED = /^(.+)_\d{8}T\d{6}Z(-\d+)?\.([a-z]+)$/;

function listDir(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
}

function members(dir) {
  return listDir(dir).filter((f) => !f.endsWith('_sidecar_NN.md'));
}

function tmp(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function serve(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function run() {
  let passed = 0;
  let failed = 0;

  async function it(desc, fn) {
    try {
      await fn();
      console.log(`  PASS: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL: ${desc}`);
      console.error(err);
      failed++;
    }
  }

  console.log('\n--- test-import-in-place ---');

  await it('external import suffixes every file whatever the cadence, and cognitivizes the copy', async () => {
    const ext = tmp('imp-ext-');
    const work = tmp('imp-work-');
    try {
      fs.writeFileSync(path.join(ext, 'rates.csv'), 'a,b\r\n1,2\r\n');
      fs.writeFileSync(path.join(ext, 'notes.md'), '# Notes\n');
      const now = new Date(Date.UTC(2026, 9, 3, 8, 0, 0));
      const imported = await importExternalFiles(
        [
          { fullPath: path.join(ext, 'rates.csv'), baseName: 'rates.csv', cadence: 'static' },
          { fullPath: path.join(ext, 'notes.md'), baseName: 'notes.md', cadence: 'dynamic' },
        ],
        work,
        { timestampDate: now },
      );
      assert.deepStrictEqual(
        imported.map((i) => i.importedAs).sort(),
        ['notes_20261003T080000Z.md', 'rates_20261003T080000Z.csv'],
      );
      const dir = path.join(work, 'sources', 'import');
      assert.ok(fs.existsSync(path.join(dir, 'rates_20261003T080000Z.csv_sidecar_NN.md')), 'csv sidecar co-located');
      assert.ok(fs.existsSync(path.join(dir, 'notes_20261003T080000Z.md_sidecar_NN.md')), 'md sidecar co-located');
      assert.ok(
        fs.readFileSync(path.join(dir, 'rates_20261003T080000Z.csv')).equals(fs.readFileSync(path.join(ext, 'rates.csv'))),
        'verbatim bytes, CRLF included',
      );
    } finally {
      fs.rmSync(ext, { recursive: true, force: true });
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  await it('re-importing identical bytes writes nothing; changed bytes add a member and keep the earlier one', async () => {
    const ext = tmp('imp-ext2-');
    const work = tmp('imp-work2-');
    try {
      const file = path.join(ext, 'budget.csv');
      fs.writeFileSync(file, 'x\n1\n');
      const cand = [{ fullPath: file, baseName: 'budget.csv', cadence: 'dynamic' }];
      const first = await importExternalFiles(cand, work, { timestampDate: new Date(Date.UTC(2026, 9, 3, 8, 0, 0)) });
      const dir = path.join(work, 'sources', 'import');
      const before = listDir(dir);

      const again = await importExternalFiles(cand, work, { timestampDate: new Date(Date.UTC(2026, 9, 3, 9, 0, 0)) });
      assert.strictEqual(again[0].status, 'deduplicated');
      assert.strictEqual(again[0].importedAs, first[0].importedAs);
      assert.deepStrictEqual(listDir(dir), before, 'no new file, no new sidecar');

      fs.writeFileSync(file, 'x\n1\n2\n');
      const changed = await importExternalFiles(cand, work, { timestampDate: new Date(Date.UTC(2026, 9, 3, 10, 0, 0)) });
      assert.strictEqual(changed[0].status, 'imported');
      assert.strictEqual(changed[0].importedAs, 'budget_20261003T100000Z.csv');
      assert.strictEqual(members(dir).length, 2);
      assert.strictEqual(fs.readFileSync(path.join(dir, first[0].importedAs), 'utf8'), 'x\n1\n', 'earlier member untouched');
    } finally {
      fs.rmSync(ext, { recursive: true, force: true });
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  await it('a watch root is only observed: nothing under it is created, changed or deleted', async () => {
    const ext = tmp('imp-ext3-');
    const work = tmp('imp-work3-');
    try {
      const file = path.join(ext, 'drop.csv');
      fs.writeFileSync(file, 'a\n1\n');
      const stat = fs.statSync(file);
      const listing = listDir(ext);
      await importExternalFiles([{ fullPath: file, baseName: 'drop.csv', cadence: 'static' }], work);
      assert.deepStrictEqual(listDir(ext), listing);
      assert.strictEqual(fs.statSync(file).mtimeMs, stat.mtimeMs);
      assert.strictEqual(fs.readFileSync(file, 'utf8'), 'a\n1\n');
    } finally {
      fs.rmSync(ext, { recursive: true, force: true });
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  await it('a binary import is copied and left for the scan to cognitivize (needs its dependency check)', async () => {
    const ext = tmp('imp-ext4-');
    const work = tmp('imp-work4-');
    try {
      fs.writeFileSync(path.join(ext, 'report.pdf'), Buffer.from([0x25, 0x50, 0x44, 0x46, 0x00]));
      const imported = await importExternalFiles(
        [{ fullPath: path.join(ext, 'report.pdf'), baseName: 'report.pdf', cadence: 'static' }],
        work,
        { timestampDate: new Date(Date.UTC(2026, 9, 3, 8, 0, 0)) },
      );
      assert.strictEqual(imported[0].importedAs, 'report_20261003T080000Z.pdf');
      assert.strictEqual(imported[0].cognitivized, false);
      assert.deepStrictEqual(members(path.join(work, 'sources', 'import')), ['report_20261003T080000Z.pdf']);
      assert.strictEqual(listDir(path.join(work, 'sources', 'import')).length, 1, 'no partial sidecar');
    } finally {
      fs.rmSync(ext, { recursive: true, force: true });
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  await it('web import writes a suffixed verbatim member, dedupes identical bytes and adds a member on change', async () => {
    let body = Buffer.from('<html><head><title>T</title></head><body>one</body></html>');
    const server = await serve((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(body);
    });
    const work = tmp('imp-web-');
    try {
      const url = `http://127.0.0.1:${server.address().port}/pages/Annual Report.html`;
      const first = await webImport.downloadToImport(url, work, { now: () => new Date(Date.UTC(2026, 9, 3, 8, 0, 0)) });
      const dir = path.join(work, 'sources', 'import');
      assert.ok(SUFFIXED.test(first.relPath), `suffixed: ${first.relPath}`);
      assert.ok(fs.readFileSync(first.absPath).equals(body), 'verbatim bytes');
      assert.strictEqual(first.deduplicated, false);

      const again = await webImport.downloadToImport(url, work, { now: () => new Date(Date.UTC(2026, 9, 3, 9, 0, 0)) });
      assert.strictEqual(again.deduplicated, true);
      assert.strictEqual(again.relPath, first.relPath);
      assert.strictEqual(members(dir).length, 1);

      body = Buffer.from('<html><head><title>T</title></head><body>two</body></html>');
      const changed = await webImport.downloadToImport(url, work, { now: () => new Date(Date.UTC(2026, 9, 3, 10, 0, 0)) });
      assert.strictEqual(changed.deduplicated, false);
      assert.notStrictEqual(changed.relPath, first.relPath);
      assert.strictEqual(members(dir).length, 2);
      assert.ok(fs.readFileSync(first.absPath).toString().includes('one'), 'earlier member untouched');
    } finally {
      server.close();
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  await it('process-images cognitivizes each image in place and writes optimized copies write-once', async () => {
    const work = tmp('imp-img-');
    try {
      const photos = path.join(work, 'sources', 'import', 'photos');
      fs.mkdirSync(photos, { recursive: true });
      fs.writeFileSync(path.join(photos, 'cat.png'), Buffer.from([1, 2, 3, 4]));
      fs.writeFileSync(path.join(photos, 'notes.txt'), 'not an image');

      const fakeSharp = (input) => {
        const chain = {
          resize: () => chain,
          png: () => chain,
          jpeg: () => chain,
          webp: () => chain,
          gif: () => chain,
          metadata: async () => ({ format: 'png', width: 2, height: 3 }),
          toBuffer: async () => Buffer.concat([Buffer.from('opt:'), Buffer.from(input)]),
        };
        return chain;
      };

      const first = await processImages.processImages(work, { sharp: fakeSharp });
      assert.strictEqual(first.processed, 1);
      const sidecar = fs.readFileSync(path.join(photos, 'cat.png_sidecar_NN.md'), 'utf8');
      assert.ok(/source_format: png/.test(sidecar), 'sidecar next to the raw image');
      assert.ok(/width: 2/.test(sidecar) && /height: 3/.test(sidecar), 'image metadata recorded');
      assert.ok(/# cat\.png/.test(sidecar), 'normalized body keeps the image citable');
      assert.ok(fs.existsSync(path.join(photos, 'cat.png')), 'raw image is not moved');

      const artifacts = path.join(work, 'artifacts', 'photos');
      assert.strictEqual(members(artifacts).length, 1);
      assert.ok(/^cat_\d{8}T\d{6}Z\.png$/.test(members(artifacts)[0]), 'optimized copy is a suffixed member');
      assert.ok(!fs.existsSync(path.join(work, 'sources', 'processed')), 'no sources/processed output');

      const snapshot = [...listDir(photos), ...listDir(artifacts)];
      const second = await processImages.processImages(work, { sharp: fakeSharp });
      assert.strictEqual(second.processed, 1);
      assert.deepStrictEqual([...listDir(photos), ...listDir(artifacts)], snapshot, 'second run writes nothing');
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  });

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then((res) => process.exit(res.failed > 0 ? 1 : 0));
}
