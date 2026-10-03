const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const transformer = require('../../scripts/transformer');
const { put, cognitivizeAll } = require('./_fixtures');

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

  console.log('\n--- test-transformer ---');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nnt-transformer-'));
  try {
    const proj = path.join(tmp, 'Proj');
    put(proj, 'traNNsformations/Summary.md', '# Transformation: Summary\n');

    await it('fails clearly when no source has been cognitivized yet', async () => {
      put(proj, 'sources/import/uncognitivized.md', '# Not yet\n');
      await assert.rejects(() => transformer.applyTransformation(proj, 'Summary.md'), /cognitivized/i);
      assert.ok(!fs.existsSync(path.join(proj, 'sources', 'nn')), 'no retired folder is created or required');
    });

    await it('concatenates cognitivized sources: raw text for text-native, sidecar body for binaries', async () => {
      put(proj, 'sources/import/notes.md', '# Notes\n\nPlain markdown body.\n');
      put(proj, 'sources/import/report.pdf', '%PDF-1.4 fake');
      put(proj, 'sources/conversations/talk_20261003T080000Z.md', '# Talk\n\nTranscript body.\n');
      put(proj, 'sources/import/staging/draft.md', '# Draft scratch\n');
      await cognitivizeAll(proj, [
        'sources/import/notes.md',
        'sources/import/report.pdf',
        'sources/conversations/talk_20261003T080000Z.md',
      ]);

      const result = await transformer.applyTransformation(proj, 'Summary.md');
      const out = fs.readFileSync(result.outputPath, 'utf8');
      assert.ok(/Source File: sources\/import\/notes\.md/.test(out), 'raw text-native source is listed under its real path');
      assert.ok(out.includes('Plain markdown body.'), 'raw markdown text is included');
      assert.ok(/Source File: sources\/import\/report\.pdf/.test(out), 'the binary is listed by its raw path');
      assert.ok(out.includes('Normalized body.'), 'the binary contributes its sidecar body');
      assert.ok(out.includes('Transcript body.'), 'promoted conversations are included');
      assert.ok(!out.includes('Draft scratch'), 'staging is scratch and never concatenated');
      assert.ok(!out.includes('_sidecar_NN'), 'sidecar frontmatter is never concatenated as a source');
      assert.ok(!out.includes('sha256'), 'no sidecar metadata leaks into the output');
      assert.ok(/^Summary_\d{8}T\d{6}Z\.md$/.test(result.outputFileName), 'output is a UTC-suffixed artifact');
      assert.ok(result.outputPath.replace(/\\/g, '/').includes('/artifacts/'), 'output lands in artifacts/');
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then((res) => process.exit(res.failed > 0 ? 1 : 0));
}
