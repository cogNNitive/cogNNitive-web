const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TEST_TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'trannsform-test-'));

/** Every file under `dir` mapped to its bytes (hex), keyed by posix relative path. */
function snapshotTree(dir) {
  const out = {};
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else out[path.relative(dir, full).replace(/\\/g, '/')] = fs.readFileSync(full).toString('hex');
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

async function run() {
  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, msg) {
    try {
      assert.deepStrictEqual(actual, expected);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg}`);
      console.log(`    Expected: ${JSON.stringify(expected)}`);
      console.log(`    Actual:   ${JSON.stringify(actual)}`);
      failed++;
    }
  }

  function assertTrue(actual, msg) {
    assertEqual(Boolean(actual), true, msg);
  }

  function assertMatch(actual, regex, msg) {
    try {
      assert.ok(regex.test(actual), msg);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg}`);
      console.log(`    Expected match: ${regex}`);
      console.log(`    Actual:        ${actual}`);
      failed++;
    }
  }

  try {
    delete require.cache[require.resolve('../../scripts/scanner')];
    const scanner = require('../../scripts/scanner');
    const converters = require('../../scripts/lib/scanner-converters');
    const sidecarOf = (rawFile) => `${rawFile}_sidecar_NN.md`;

    // EXT_LABELS contains expected formats
    for (const [ext, label] of Object.entries({
      '.txt': 'txt', '.md': 'md', '.csv': 'csv', '.json': 'json', '.html': 'html',
      '.docx': 'docx', '.pdf': 'pdf', '.xlsx': 'xlsx', '.srt': 'srt', '.vtt': 'vtt',
    })) {
      assertEqual(scanner.EXT_LABELS[ext], label, `EXT_LABELS ${ext}`);
    }

    // detectFormats
    assertEqual(Object.keys(scanner.detectFormats(path.join(TEST_TEMP, 'nonexistent'))).length, 0, 'detectFormats returns empty for missing dir');
    const srcDir = path.join(TEST_TEMP, 'source');
    write(path.join(srcDir, 'doc.txt'), 'hello');
    write(path.join(srcDir, 'data.csv'), 'a,b');
    write(path.join(srcDir, 'notes.md'), '# Notes');
    write(path.join(srcDir, 'image.png'), 'fake-png');
    const detected = scanner.detectFormats(srcDir);
    assertEqual(detected['.txt'], 1, 'detectFormats finds .txt');
    assertEqual(detected['.csv'], 1, 'detectFormats finds .csv');
    assertEqual(detected['.md'], 1, 'detectFormats finds .md');
    assertEqual(detected['.png'], undefined, 'detectFormats ignores .png');

    const formats = scanner.getSupportedFormats();
    assertTrue(formats.includes('txt') && formats.includes('docx'), 'getSupportedFormats lists txt and docx');
    assertTrue(scanner.isDepInstalled('fs') && scanner.isDepInstalled('path'), 'isDepInstalled finds built-in modules');

    const testFile = path.join(TEST_TEMP, 'hash-test.txt');
    write(testFile, 'hello world');
    const hash1 = scanner.computeFileHash(testFile);
    assertEqual(hash1, scanner.computeFileHash(testFile), 'computeFileHash is consistent');
    assertEqual(hash1.length, 64, 'computeFileHash returns 64-char hex');

    // Removed surface: no archive, no mirror frontmatter writer, no registry
    for (const removed of [
      'generateSourceFrontmatter', 'archiveSourceSnapshot', 'findOrphanSources',
      'generateSourceRegistry', 'flattenOriginalToRaw', 'convertChatJson',
    ]) {
      assertEqual(typeof scanner[removed], 'undefined', `${removed} no longer exists`);
    }
    const core = require('../../scripts/lib/scanner-core');
    for (const removed of ['processOkFile', 'processPromptFile', 'archiveSourceSnapshot', 'generateSourceFrontmatter']) {
      assertEqual(typeof core[removed], 'undefined', `scanner-core no longer exports ${removed}`);
    }

    // --- Scan: sidecars are co-located, no mirror tree ---------------------
    const projDir = path.join(TEST_TEMP, 'colocated-project');
    const importDir = path.join(projDir, 'sources', 'import');
    write(path.join(importDir, 'root.txt'), 'Root level document.');
    write(path.join(importDir, 'clientA', 'report.txt'), 'Client A report.');
    write(path.join(importDir, 'clientA', 'nested', 'deep.txt'), 'Deeply nested document.');
    write(path.join(importDir, 'notes.md'), '# Notes\n\nSome text.\n');
    write(path.join(importDir, 'prices.csv'), 'id,price\na,1\nb,2\n');
    write(path.join(importDir, 'staging', 'scratch.txt'), 'transient data');

    const result = await scanner.scanAndProcess(projDir, { autoAcceptPrompt: true });
    assertEqual(result.totalDiscovered, 5, 'scan discovers the five raw files and skips staging');
    assertEqual(result.processedCount, 5, 'scan cognitivizes all five');

    for (const rel of ['root.txt', 'clientA/report.txt', 'clientA/nested/deep.txt', 'notes.md', 'prices.csv']) {
      assertTrue(fs.existsSync(path.join(importDir, sidecarOf(rel))), `sidecar sits next to sources/import/${rel}`);
    }
    assertTrue(!fs.existsSync(path.join(projDir, 'sources', 'nn')), 'no sources/nn mirror is created');
    assertTrue(!fs.existsSync(path.join(projDir, 'sources', 'archive')), 'no sources/archive is created');
    assertTrue(!fs.existsSync(path.join(importDir, 'staging', sidecarOf('scratch.txt'))), 'staging is not cognitivized');

    const deepSidecar = read(path.join(importDir, sidecarOf('clientA/nested/deep.txt')));
    assertTrue(deepSidecar.includes('source_file: sources/import/clientA/nested/deep.txt'), 'sidecar records the workspace-relative subject path');
    assertMatch(deepSidecar, /\nsha256: [a-f0-9]{64}\n/, 'sidecar records the raw sha256');
    assertMatch(deepSidecar, /\nsize_bytes: \d+\n/, 'sidecar records size_bytes');
    assertMatch(deepSidecar, /\nnormalized_at: /, 'sidecar records normalized_at');
    assertMatch(deepSidecar, /\nnormalized_by: .*traNNsform v/, 'sidecar records normalized_by');
    assertTrue(deepSidecar.includes('Deeply nested document.'), 'a txt sidecar carries the normalized body');
    assertTrue(!/staging_file/.test(deepSidecar), 'sidecar has no staging_file');
    assertTrue(!/is_synthetic|derived_from/.test(deepSidecar), 'sidecar has no is_synthetic or derived_from');

    const mdSidecar = read(path.join(importDir, sidecarOf('notes.md')));
    assertTrue(!mdSidecar.includes('Some text.'), 'a markdown sidecar has no body');
    assertTrue(read(path.join(importDir, 'notes.md')) === '# Notes\n\nSome text.\n', 'the raw markdown is byte-unchanged');
    const csvSidecar = read(path.join(importDir, sidecarOf('prices.csv')));
    assertTrue(!/Dataset Schema/.test(csvSidecar), 'a CSV sidecar has no body');

    // --- Scan twice on unchanged input writes nothing ----------------------
    const before = snapshotTree(projDir);
    const again = await scanner.scanAndProcess(projDir, { autoAcceptPrompt: true });
    assertEqual(snapshotTree(projDir), before, 'a second scan on unchanged input changes no file and writes no new one');
    assertEqual(again.totalDiscovered, 5, 'sidecars are not rescanned as raw files');

    // --- A changed raw refreshes its sidecar in place, no archive ----------
    write(path.join(importDir, 'root.txt'), 'Root level document, edited.');
    const refreshed = await scanner.scanAndProcess(projDir, { autoAcceptPrompt: true });
    const rootSidecar = read(path.join(importDir, sidecarOf('root.txt')));
    assertTrue(rootSidecar.includes('Root level document, edited.'), 'the sidecar body follows the edited raw');
    assertTrue(rootSidecar.includes(`sha256: ${scanner.computeFileHash(path.join(importDir, 'root.txt'))}`), 'the sidecar sha256 follows the edited raw');
    assertTrue(!fs.existsSync(path.join(projDir, 'sources', 'archive')), 'refreshing creates no archive snapshot');
    assertEqual(Object.keys(snapshotTree(projDir)).length, Object.keys(before).length, 'refreshing adds no new file');
    assertEqual(refreshed.refreshed, ['sources/import/root.txt'], 'the result lists the refreshed subject');

    // --- Same file name in two folders: no destination collision -----------
    const collisionProj = path.join(TEST_TEMP, 'collision-project');
    write(path.join(collisionProj, 'sources', 'import', 'MAD-11', 'Tutorias.txt'), 'MAD-11 Tutoring Session Data');
    write(path.join(collisionProj, 'sources', 'import', 'VIR-3', 'Tutorias.txt'), 'VIR-3 Tutoring Session Data');
    const collision = await scanner.scanAndProcess(collisionProj, { autoAcceptPrompt: true });
    assertEqual(collision.processedCount, 2, 'both same-named files are cognitivized');
    assertTrue(read(path.join(collisionProj, 'sources', 'import', 'MAD-11', sidecarOf('Tutorias.txt'))).includes('MAD-11'), 'MAD-11 keeps its own sidecar');
    assertTrue(read(path.join(collisionProj, 'sources', 'import', 'VIR-3', sidecarOf('Tutorias.txt'))).includes('VIR-3'), 'VIR-3 keeps its own sidecar');

    // --- Conversations: sidecar records source_type, raw untouched ---------
    const convProj = path.join(TEST_TEMP, 'conversation-project');
    const transcript = '---\nsession_id: "sess-123"\norigin_transcript: "conversations/2026-09-06_arch.md"\n---\n\n**User**: How should we structure sources?\n';
    const transcriptRel = 'sources/conversations/2026-09-06_arch_20260906T120000Z.md';
    write(path.join(convProj, transcriptRel), transcript);
    await scanner.scanAndProcess(convProj, { autoAcceptPrompt: true });
    const convSidecar = read(path.join(convProj, sidecarOf(transcriptRel)));
    assertTrue(/source_type: conversation_transcript/.test(convSidecar), 'transcript sidecar records source_type: conversation_transcript');
    assertTrue(/session_id: sess-123/.test(convSidecar), 'transcript sidecar preserves session_id');
    assertTrue(!convSidecar.includes('How should we structure sources?'), 'transcript sidecar has no body');
    assertEqual(read(path.join(convProj, transcriptRel)), transcript, 'the raw transcript is byte-unchanged');

    // --- Retired folders are never scanned ---------------------------------
    const retiredProj = path.join(TEST_TEMP, 'retired-project');
    write(path.join(retiredProj, 'sources', 'original', 'legacy_note.txt'), 'Legacy content.');
    write(path.join(retiredProj, 'sources', 'export', 'roadmap.md'), '# Roadmap\n');
    const retired = await scanner.scanAndProcess(retiredProj, { autoAcceptPrompt: true });
    assertEqual(retired.totalDiscovered, 0, 'sources/original and sources/export are not scanned');
    assertTrue(!fs.existsSync(path.join(retiredProj, 'sources', 'export', sidecarOf('roadmap.md'))), 'no sidecar is written for a retired folder');

    // --- Orphan sidecars are reported, never deleted -----------------------
    const orphanProj = path.join(TEST_TEMP, 'orphan-project');
    const orphanRaw = path.join(orphanProj, 'sources', 'import', 'orphan_item.txt');
    write(orphanRaw, 'To be deleted later.');
    await scanner.scanAndProcess(orphanProj, { autoAcceptPrompt: true });
    fs.unlinkSync(orphanRaw);
    const orphanRun = await scanner.scanAndProcess(orphanProj, { autoAcceptPrompt: true });
    const orphanSidecar = path.join(orphanProj, 'sources', 'import', sidecarOf('orphan_item.txt'));
    assertTrue(fs.existsSync(orphanSidecar), 'an orphaned sidecar is preserved');
    assertEqual(orphanRun.orphans.map((o) => o.sidecar), ['sources/import/orphan_item.txt_sidecar_NN.md'], 'the scan reports the orphaned sidecar');
    assertEqual(orphanRun.orphans.map((o) => o.sourceFile), ['sources/import/orphan_item.txt'], 'the orphan names its missing raw file');
    assertTrue(!fs.existsSync(path.join(orphanProj, 'sources', 'archive')), 'orphan handling never archives');

    // --- Feedback JSON ----------------------------------------------------
    const feedbackProj = path.join(TEST_TEMP, 'feedback-project');
    const feedbackDir = path.join(feedbackProj, 'sources', 'import', 'feedback');
    const validFeedbackDoc = {
      meta: {
        source_knowledge: 'Ghostbusters',
        source_knowledge_version: 'V_0-2-1',
        artifact: 'Ghostbusters_V_0-2-1_console.html',
        artifact_version: '0.1.0',
        exported_at: '2026-09-09T12:00:00Z',
        author: 'Reviewer',
        feedback_slug: 'round-2',
        viewer: 'innfo-console/0.1.0',
      },
      items: [
        { id: 'fb-001', kind: 'correction', target: { concept: 'Problems', element: 'Paranormal Infestation', field: 'severity' }, original: 'low', proposed: 'high' },
      ],
    };
    const feedbackFile = path.join(feedbackDir, 'Ghostbusters_V_0-2-1_round-2_feedback_20260909T120000Z.json');
    write(feedbackFile, JSON.stringify(validFeedbackDoc));
    write(path.join(feedbackDir, 'Broken_V_0-2-1_x_feedback_20260909T120000Z.json'), JSON.stringify({ meta: {}, items: [{ id: 'bad', kind: 'rewrite', target: {}, status: 'pending' }] }));
    write(path.join(feedbackProj, 'sources', 'import', 'config.json'), JSON.stringify({ key: 'value' }));

    assertEqual(typeof scanner.convertFeedbackJson, 'function', 'convertFeedbackJson is exported from scanner');
    const fbRun = await scanner.scanAndProcess(feedbackProj, { autoAcceptPrompt: true });
    const fbSidecar = read(path.join(feedbackDir, sidecarOf('Ghostbusters_V_0-2-1_round-2_feedback_20260909T120000Z.json')));
    assertTrue(/source_type: feedback/.test(fbSidecar), 'feedback sidecar carries source_type: feedback');
    assertTrue(!/is_synthetic/.test(fbSidecar), 'feedback sidecar does not carry is_synthetic');
    assertTrue(!fbSidecar.includes('fb-001'), 'feedback sidecar has no body: the raw JSON is the citation target');
    const invalidEntry = fbRun.registry.find((e) => e.name.includes('Broken_V_0-2-1'));
    assertTrue(Boolean(invalidEntry), 'invalid feedback appears in the registry report');
    assertTrue(!/Processed/.test(invalidEntry ? invalidEntry.status : ''), 'invalid feedback is skipped, not processed');
    assertTrue(!fs.existsSync(path.join(feedbackDir, sidecarOf('Broken_V_0-2-1_x_feedback_20260909T120000Z.json'))), 'invalid feedback gets no sidecar');
    const genericSidecar = read(path.join(feedbackProj, 'sources', 'import', sidecarOf('config.json')));
    assertTrue(!/source_type: feedback/.test(genericSidecar), 'generic JSON is not tagged as feedback');
    assertEqual(fbRun.processedCount, 2, 'the valid feedback and the generic JSON are processed; the invalid one does not abort the run');

    // --- singleFile filter -------------------------------------------------
    write(path.join(importDir, 'Other.txt'), 'Other file');
    const singleRes = await scanner.scanAndProcess(projDir, { autoAcceptPrompt: true, singleFile: 'Other.txt' });
    assertEqual(singleRes.totalDiscovered, 1, 'singleFile limits the scan to one file');
    assertTrue(fs.existsSync(path.join(importDir, sidecarOf('Other.txt'))), 'singleFile cognitivizes the chosen file in place');

    // --- Web import metadata flows into the sidecar -------------------------
    const webProj = path.join(TEST_TEMP, 'web-project');
    write(path.join(webProj, 'sources', 'import', 'page_20260910T101500Z.html'), '<html><body><h1>Title</h1><p>Body text.</p></body></html>');
    await scanner.scanAndProcess(webProj, {
      autoAcceptPrompt: true,
      webImportMeta: {
        'sources/import/page_20260910T101500Z.html': {
          source_url: 'https://example.com/page',
          downloaded_at: '2026-09-10T10:15:00.000Z',
          title: 'Example Page',
          author: 'Jane Doe',
        },
      },
    });
    const webSidecar = read(path.join(webProj, 'sources', 'import', sidecarOf('page_20260910T101500Z.html')));
    assertTrue(webSidecar.includes('source_url: https://example.com/page'), 'web import source_url lands in the sidecar');
    assertTrue(webSidecar.includes('title: Example Page'), 'web import title lands in the sidecar');
    assertTrue(webSidecar.includes('Body text.'), 'the html sidecar carries the extracted text');

    // --- Converters (unchanged behaviour) -------------------------------------
    const srtSample = path.join(TEST_TEMP, 'sample.srt');
    write(srtSample, '1\n00:00:01,000 --> 00:00:04,000\nHello team.\n\n2\n00:00:05,000 --> 00:00:09,000\nWelcome to Q3 review.\n');
    const srtMd = converters.convertOkFormat('.srt', srtSample, 'interview_transcript');
    assertTrue(srtMd.includes('## NN Section: [00:00:01]'), 'SRT converter generates ## NN Section with timestamp');
    assertTrue(srtMd.includes('Hello team. Welcome to Q3 review.'), 'SRT converter groups subtitle lines into fluid paragraph');

    const csvSample = path.join(TEST_TEMP, 'sample.csv');
    write(csvSample, 'id,name,amount\n1,Alice,100\n2,Bob,200\n');
    const csvMd = converters.convertOkFormat('.csv', csvSample, 'user_metrics');
    assertTrue(csvMd.includes('# NN Dataset Schema: user_metrics'), 'CSV converter generates NN Dataset Schema');

    const csvMultiline = path.join(TEST_TEMP, 'multiline.csv');
    write(csvMultiline, 'id,note\n1,"line a\nline b, still one field"\n2,plain\n');
    const csvMultilineMd = converters.convertOkFormat('.csv', csvMultiline, 'multiline');
    assertTrue(csvMultilineMd.includes('- **Total Rows**: 2'), 'multiline quoted CSV parses 2 logical rows, not 3+');

    assertEqual(typeof converters.convertChatJson, 'undefined', 'convertChatJson is removed from converters');
    const jsonArraySample = path.join(TEST_TEMP, 'customers.json');
    write(jsonArraySample, JSON.stringify([{ id: 1, name: 'Alice', active: true, score: 95.5 }, { id: 2, name: 'Bob', active: false, score: 80.0 }], null, 2));
    const jsonArrayMd = converters.convertOkFormat('.json', jsonArraySample, 'customers');
    assertTrue(jsonArrayMd.includes('| Column | Inferred Type | Null Count | Summary Metrics |'), 'JSON array converter includes data dictionary table');
    const jsonObjSample = path.join(TEST_TEMP, 'config.json');
    write(jsonObjSample, JSON.stringify({ service: 'auth', port: 8080 }, null, 2));
    assertTrue(converters.convertOkFormat('.json', jsonObjSample, 'config').includes('"service": "auth"'), 'Generic JSON object preserves payload content');

    // --- CSV curation ------------------------------------------------------
    const curate = require('../../scripts/lib/curate-csv');
    const curated = curate.curateCsvContent('url,id\nz,2\nx,1\nz,2\n', { key: 'id', dedup: true });
    assertEqual(curated.rows[0][0], 'id', 'curate promotes the key column to first position');
    assertEqual(curated.rows.length, 3, 'curate collapses duplicate keys (header + 2 rows)');
    assertEqual(curated.collapsed, 1, 'curate reports the collapsed duplicate count');
    const curatedDrop = curate.curateCsvContent('id,url\n,1\nb,2\n', { key: 'id', dedup: true });
    assertEqual(curatedDrop.droppedEmptyKey, 1, 'curate reports dropped empty-key rows');
    assertTrue(
      (() => { try { curate.curateCsvContent('id,url\na,1\na,2\n', { key: 'id' }); return false; } catch { return true; } })(),
      'curate refuses duplicate keys without --dedup',
    );

    fs.rmSync(TEST_TEMP, { recursive: true, force: true });
  } catch (e) {
    fs.rmSync(TEST_TEMP, { recursive: true, force: true });
    console.error(`  ERROR: ${e.message}`);
    console.error(e.stack);
    failed++;
  }

  console.log(`\n  Scanner tests: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => {
    process.exit(result.failed > 0 ? 1 : 0);
  });
}
