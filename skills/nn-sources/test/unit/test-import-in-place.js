const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
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
