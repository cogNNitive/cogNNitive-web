const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SKILL_DIR = path.resolve(__dirname, '..', '..');
const TEST_TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'trannsform-test-'));

function run() {
  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, msg) {
    try {
      assert.strictEqual(actual, expected);
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
    assertEqual(actual, true, msg);
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

    // Test 1: EXT_LABELS contains expected formats
    assertEqual(scanner.EXT_LABELS['.txt'], 'txt', 'EXT_LABELS .txt');
    assertEqual(scanner.EXT_LABELS['.md'], 'md', 'EXT_LABELS .md');
    assertEqual(scanner.EXT_LABELS['.csv'], 'csv', 'EXT_LABELS .csv');
    assertEqual(scanner.EXT_LABELS['.json'], 'json', 'EXT_LABELS .json');
    assertEqual(scanner.EXT_LABELS['.html'], 'html', 'EXT_LABELS .html');
    assertEqual(scanner.EXT_LABELS['.docx'], 'docx', 'EXT_LABELS .docx');
    assertEqual(scanner.EXT_LABELS['.pdf'], 'pdf', 'EXT_LABELS .pdf');
    assertEqual(scanner.EXT_LABELS['.xlsx'], 'xlsx', 'EXT_LABELS .xlsx');

    // Test 2: detectFormats returns empty for non-existent dir
    const noDir = scanner.detectFormats(path.join(TEST_TEMP, 'nonexistent'));
    assertEqual(Object.keys(noDir).length, 0, 'detectFormats returns empty for missing dir');

    // Test 3: detectFormats detects file formats
    const srcDir = path.join(TEST_TEMP, 'source');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'doc.txt'), 'hello');
    fs.writeFileSync(path.join(srcDir, 'data.csv'), 'a,b');
    fs.writeFileSync(path.join(srcDir, 'notes.md'), '# Notes');
    fs.writeFileSync(path.join(srcDir, 'image.png'), 'fake-png');

    const detected = scanner.detectFormats(srcDir);
    assertEqual(detected['.txt'], 1, 'detectFormats finds .txt');
    assertEqual(detected['.csv'], 1, 'detectFormats finds .csv');
    assertEqual(detected['.md'], 1, 'detectFormats finds .md');
    assertEqual(detected['.png'], undefined, 'detectFormats ignores .png');

    // Test 4: getSupportedFormats returns string
    const formats = scanner.getSupportedFormats();
    assertTrue(formats.includes('txt'), 'getSupportedFormats includes txt');
    assertTrue(formats.includes('docx'), 'getSupportedFormats includes docx');

    // Test 5: isDepInstalled for built-in modules
    assertTrue(scanner.isDepInstalled('fs'), 'isDepInstalled finds built-in fs');
    assertTrue(scanner.isDepInstalled('path'), 'isDepInstalled finds built-in path');

    // Test 6: computeFileHash returns consistent SHA-256
    const testFile = path.join(TEST_TEMP, 'hash-test.txt');
    fs.writeFileSync(testFile, 'hello world', 'utf8');
    const hash1 = scanner.computeFileHash(testFile);
    const hash2 = scanner.computeFileHash(testFile);
    assertEqual(hash1, hash2, 'computeFileHash is consistent');
    assertEqual(hash1.length, 64, 'computeFileHash returns 64-char hex');

    // Test 7: generateSourceFrontmatter produces the canonical flat schema (no nesting, no source_id)
    const fm = scanner.generateSourceFrontmatter(testFile, 'sources/original/hash-test.txt');
    assertTrue(fm.startsWith('---\n'), 'frontmatter starts with ---');
    assertTrue(fm.includes('source_file: "sources/original/hash-test.txt"'), 'frontmatter includes flat source_file');
    assertMatch(fm, /\nsha256: "[a-f0-9]{64}"\n/, 'frontmatter includes flat sha256 (no "sha256:" prefix inside the value)');
    assertMatch(fm, /\nsize_bytes: \d+\n/, 'frontmatter includes flat size_bytes');
    assertMatch(fm, /\nnormalized_at: "[^"]+"\n/, 'frontmatter includes normalized_at');
    assertMatch(fm, /\nnormalized_by: "traNNsform v[^"]+"\n/, 'frontmatter includes normalized_by');
    assertTrue(!fm.includes('source:\n'), 'frontmatter is NOT nested under a "source:" key');
    assertTrue(!/source_id/.test(fm), 'frontmatter does not include source_id');
    assertTrue(!/src-\d{3}/.test(fm), 'frontmatter does not include a src-NNN id');

    const fmKeys = fm.match(/^---\n([\s\S]*?)\n---/)[1]
      .split('\n')
      .map((l) => l.split(':')[0].trim())
      .filter(Boolean);
    assertEqual(
      fmKeys.join(','),
      ['source_file', 'sha256', 'size_bytes', 'normalized_at', 'normalized_by'].join(','),
      'frontmatter has exactly the canonical flat keys, in order, when no web-import extras are given'
    );

    // Test 8: generateSourceFrontmatter merges optional web-import extras
    const fmWeb = scanner.generateSourceFrontmatter(testFile, 'sources/original/page.html', {
      source_url: 'https://example.com/page',
      downloaded_at: '2026-08-02T13:30:00.000Z',
      title: 'Example Page',
      description: 'A description with "quotes"',
      author: 'Jane Doe',
    });
    assertTrue(fmWeb.includes('source_url: "https://example.com/page"'), 'frontmatter includes source_url when provided');
    assertTrue(fmWeb.includes('downloaded_at: "2026-08-02T13:30:00.000Z"'), 'frontmatter includes downloaded_at when provided');
    assertTrue(fmWeb.includes('title: "Example Page"'), 'frontmatter includes title when provided');
    assertTrue(fmWeb.includes('author: "Jane Doe"'), 'frontmatter includes author when provided');
    assertTrue(fmWeb.includes('description: "A description with \\"quotes\\""'), 'frontmatter escapes quotes in optional string values');

    // Test 9: no source registry / no src-NNN assignment exported (system removed)
    assertEqual(typeof scanner.generateSourceRegistry, 'undefined', 'generateSourceRegistry no longer exists');
    assertEqual(typeof scanner.flattenOriginalToRaw, 'undefined', 'flattenOriginalToRaw no longer exists');

    // Test 10: scanAndProcess mirrors sources/original/ subfolders into sources/nn/ (no flattening)
    const projDir = path.join(TEST_TEMP, 'mirror-project');
    const originalDir = path.join(projDir, 'sources', 'original');
    fs.mkdirSync(path.join(originalDir, 'clientA', 'nested'), { recursive: true });
    fs.mkdirSync(path.join(originalDir, 'clientB'), { recursive: true });
    fs.writeFileSync(path.join(originalDir, 'root.txt'), 'Root level document.', 'utf8');
    fs.writeFileSync(path.join(originalDir, 'clientA', 'report.txt'), 'Client A report.', 'utf8');
    fs.writeFileSync(path.join(originalDir, 'clientA', 'nested', 'deep.txt'), 'Deeply nested document.', 'utf8');
    fs.writeFileSync(path.join(originalDir, 'clientB', 'notes.txt'), 'Client B notes.', 'utf8');

    return scanner.scanAndProcess(projDir, { autoAcceptPrompt: true }).then((result) => {
      const nnDir = path.join(projDir, 'sources', 'nn');

      assertEqual(result.totalDiscovered, 4, 'scanAndProcess discovers all files across subfolders');
      assertEqual(result.processedCount, 4, 'scanAndProcess processes all plain-text files');

      assertTrue(fs.existsSync(path.join(nnDir, 'root.txt'.replace('.txt', '.md'))), 'root-level file normalized at sources/nn/root.md');
      assertTrue(fs.existsSync(path.join(nnDir, 'clientA', 'report.md')), 'clientA/report.md mirrors sources/original/clientA/');
      assertTrue(fs.existsSync(path.join(nnDir, 'clientA', 'nested', 'deep.md')), 'clientA/nested/deep.md mirrors nested subfolders');
      assertTrue(fs.existsSync(path.join(nnDir, 'clientB', 'notes.md')), 'clientB/notes.md mirrors sources/original/clientB/');
      assertTrue(!fs.existsSync(path.join(nnDir, 'clientA__report.md')), 'output is not flattened with __ separators');

      const nestedContent = fs.readFileSync(path.join(nnDir, 'clientA', 'nested', 'deep.md'), 'utf8');
      assertTrue(
        nestedContent.includes('source_file: "sources/original/clientA/nested/deep.txt"'),
        'nested file frontmatter records the full sources/original/ relative path'
      );

      assertTrue(!fs.existsSync(path.join(projDir, 'sources', 'raw')), 'sources/raw/ is never created by scanAndProcess');

      // Test 11: EXT_LABELS contains .srt and .vtt
      assertEqual(scanner.EXT_LABELS['.srt'], 'srt', 'EXT_LABELS .srt');
      assertEqual(scanner.EXT_LABELS['.vtt'], 'vtt', 'EXT_LABELS .vtt');

      // Test 12: staging directory is ignored in walkOriginal and detectFormats
      const stagingDir = path.join(originalDir, 'staging');
      fs.mkdirSync(stagingDir, { recursive: true });
      fs.writeFileSync(path.join(stagingDir, 'intermediate.txt'), 'transient data');
      const formatsAfterStaging = scanner.detectFormats(originalDir);
      const walkAfterStaging = scanner.walkOriginal(originalDir);
      assertTrue(!walkAfterStaging.some(f => f.relPath.includes('staging')), 'walkOriginal ignores staging directory');

      // Test 13: generateSourceFrontmatter with extended metadata (canonical, cited_works, staging_file)
      const fmExtended = scanner.generateSourceFrontmatter(testFile, 'sources/original/interview.mp3', {
        staging_file: 'sources/staging/interview.srt',
        canonical: {
          title: 'Strategic Vision 2026',
          author: 'Jane Doe',
          year: 2026,
          doi: '10.1145/3290605.3300233',
          bibtex: '@misc{doe2026,\n  title={Strategic Vision}\n}'
        },
        cited_works: [
          { id: 'porter1985', citation: 'Porter (1985)', is_primary: true }
        ]
      });
      assertTrue(fmExtended.includes('staging_file: "sources/staging/interview.srt"'), 'frontmatter includes staging_file');
      assertTrue(!fmExtended.includes('is_synthetic:'), 'frontmatter does not include is_synthetic');
      assertTrue(fmExtended.includes('canonical:\n  title: "Strategic Vision 2026"'), 'frontmatter includes canonical block');
      assertTrue(fmExtended.includes('cited_works:\n  - id: "porter1985"'), 'frontmatter includes cited_works block');
      assertTrue(fmExtended.includes('is_primary: true'), 'frontmatter cited_works includes is_primary: true');

      // Test 13b: `references` is still accepted as a deprecated input alias.
      const fmAlias = scanner.generateSourceFrontmatter(testFile, 'sources/original/x.mp3', {
        references: [{ id: 'legacy1', citation: 'Legacy (2020)' }]
      });
      assertTrue(fmAlias.includes('cited_works:\n  - id: "legacy1"'), 'deprecated `references` input still emits cited_works');

      // Test 14: semantic normalization converters (SRT & CSV)
      const converters = require('../../scripts/lib/scanner-converters');
      const srtSample = path.join(TEST_TEMP, 'sample.srt');
      fs.writeFileSync(srtSample, '1\n00:00:01,000 --> 00:00:04,000\nHello team.\n\n2\n00:00:05,000 --> 00:00:09,000\nWelcome to Q3 review.\n', 'utf8');
      const srtMd = converters.convertOkFormat('.srt', srtSample, 'interview_transcript');
      assertTrue(srtMd.includes('## NN Section: [00:00:01]'), 'SRT converter generates ## NN Section with timestamp');
      assertTrue(srtMd.includes('Hello team. Welcome to Q3 review.'), 'SRT converter groups subtitle lines into fluid paragraph');

      const csvSample = path.join(TEST_TEMP, 'sample.csv');
      fs.writeFileSync(csvSample, 'id,name,amount\n1,Alice,100\n2,Bob,200\n', 'utf8');
      const csvMd = converters.convertOkFormat('.csv', csvSample, 'user_metrics');
      assertTrue(csvMd.includes('# NN Dataset Schema: user_metrics'), 'CSV converter generates ## NN Dataset Schema');
      assertTrue(csvMd.includes('## NN Summary Statistics'), 'CSV converter generates ## NN Summary Statistics');

      // Test 14b: a quoted field with an embedded newline/comma must stay ONE record.
      // Regression: the naive line split turned it into phantom rows and bogus counts.
      const csvMultiline = path.join(TEST_TEMP, 'multiline.csv');
      fs.writeFileSync(csvMultiline, 'id,note\n1,"line a\nline b, still one field"\n2,plain\n', 'utf8');
      const csvMultilineMd = converters.convertOkFormat('.csv', csvMultiline, 'multiline');
      assertTrue(csvMultilineMd.includes('- **Total Rows**: 2'), 'multiline quoted CSV parses 2 logical rows, not 3+');
      assertTrue(csvMultilineMd.includes('| id | note |'), 'multiline quoted CSV preserves the header row');
      assertTrue(csvMultilineMd.includes('line a<br>line b, still one field'), 'embedded newline is flattened so the sample table stays one row');

      // Test 14c: CSV curation -> citation-ready CSV (key first, unique, non-empty)
      const curate = require('../../scripts/lib/curate-csv');
      const curated = curate.curateCsvContent('url,id\nz,2\nx,1\nz,2\n', { key: 'id', dedup: true });
      assertEqual(curated.rows[0][0], 'id', 'curate promotes the key column to first position');
      assertEqual(curated.rows[1][0], '2', 'curate keeps the key value in the first cell');
      assertEqual(curated.rows.length, 3, 'curate collapses duplicate keys (header + 2 rows)');
      assertEqual(curated.collapsed, 1, 'curate reports the collapsed duplicate count');

      const curatedDrop = curate.curateCsvContent('id,url\n,1\nb,2\n', { key: 'id', dedup: true });
      assertEqual(curatedDrop.rows.length, 2, 'curate drops empty-key rows in --dedup mode (header + 1)');
      assertEqual(curatedDrop.droppedEmptyKey, 1, 'curate reports dropped empty-key rows');

      assertTrue(
        (() => { try { curate.curateCsvContent('id,url\na,1\na,2\n', { key: 'id' }); return false; } catch { return true; } })(),
        'curate refuses duplicate keys without --dedup',
      );

      const curateProj = path.join(TEST_TEMP, 'curate-project');
      fs.mkdirSync(path.join(curateProj, 'sources', 'import'), { recursive: true });
      fs.writeFileSync(path.join(curateProj, 'sources', 'import', 'links.csv'), 'url,id\nz,2\nx,1\n', 'utf8');
      const fileResult = curate.curateCsvFile(
        path.join(curateProj, 'sources', 'import', 'links.csv'),
        { key: 'id', projectDir: curateProj },
      );
      assertTrue(fs.existsSync(fileResult.outputPath), 'curateCsvFile writes the curated CSV under sources/nn/import/');
      assertTrue(fileResult.relOutput.endsWith('sources/nn/import/links.csv'), 'curated CSV mirrors the import/ subtree');
      assertEqual(fs.readFileSync(fileResult.outputPath, 'utf8').split('\n')[0], 'id,url', 'written curated CSV has the key column first');

      // Test 15: JSON converter without Slack heuristics & removal of convertChatJson
      assertEqual(typeof converters.convertChatJson, 'undefined', 'convertChatJson is removed from converters');
      const jsonArraySample = path.join(TEST_TEMP, 'customers.json');
      fs.writeFileSync(jsonArraySample, JSON.stringify([
        { id: 1, name: 'Alice', active: true, score: 95.5 },
        { id: 2, name: 'Bob', active: false, score: 80.0 }
      ], null, 2), 'utf8');
      const jsonArrayMd = converters.convertOkFormat('.json', jsonArraySample, 'customers');
      assertTrue(jsonArrayMd.includes('# NN Dataset Schema: customers'), 'JSON array converter outputs ## NN Dataset Schema');
      assertTrue(jsonArrayMd.includes('| Column | Inferred Type | Null Count | Summary Metrics |'), 'JSON array converter includes data dictionary table');
      assertTrue(jsonArrayMd.includes('## NN Summary Statistics'), 'JSON array converter includes summary statistics');
      assertTrue(!jsonArrayMd.includes('## NN Thread'), 'JSON array does not output Slack thread headers');

      const jsonObjSample = path.join(TEST_TEMP, 'config.json');
      fs.writeFileSync(jsonObjSample, JSON.stringify({ service: 'auth', port: 8080 }, null, 2), 'utf8');
      const jsonObjMd = converters.convertOkFormat('.json', jsonObjSample, 'config');
      assertTrue(jsonObjMd.includes('```json'), 'Generic JSON object converter renders fenced json block');
      assertTrue(jsonObjMd.includes('"service": "auth"'), 'Generic JSON object preserves payload content');
      assertTrue(!jsonObjMd.includes('## NN Thread'), 'Generic JSON does not output Slack thread headers');

      // Test 16: Multi-source walking and normalization in scanAndProcess
      const multiProj = path.join(TEST_TEMP, 'multi-source-project');
      const importDir = path.join(multiProj, 'sources', 'import');
      const convDir = path.join(multiProj, 'sources', 'conversations');
      const expDir = path.join(multiProj, 'sources', 'export');
      fs.mkdirSync(path.join(importDir, 'docs'), { recursive: true });
      fs.mkdirSync(convDir, { recursive: true });
      fs.mkdirSync(expDir, { recursive: true });

      fs.writeFileSync(path.join(importDir, 'docs', 'guide.txt'), 'User guide content.', 'utf8');
      fs.writeFileSync(path.join(convDir, '2026-09-06_arch_source.md'), '---\nsession_id: "sess-123"\norigin_transcript: "conversations/2026-09-06_arch.md"\n---\n\n**User**: How should we structure sources?\n\n**Assistant**: Use import, conversations, export.', 'utf8');
      fs.writeFileSync(path.join(convDir, '2026-09-06_arch_summary.md'), '---\nsession_id: "sess-123"\norigin_transcript: "conversations/2026-09-06_arch.md"\n---\n\n# Executive Summary\n\n## Key Topics\nSources restructuring.\n\n## Decisions\nUse import, conversations, export.\n', 'utf8');
      fs.writeFileSync(path.join(expDir, 'roadmap.md'), '---\nderived_from: ["Strategy_V_1-0-0_NN.md"]\n---\n\n# Strategic Roadmap\n', 'utf8');

      return scanner.scanAndProcess(multiProj, { autoAcceptPrompt: true }).then((multiResult) => {
        const nnDir = path.join(multiProj, 'sources', 'nn');
        assertEqual(multiResult.totalDiscovered, 4, 'scanAndProcess discovers all files across import, conversations, and export');
        assertEqual(multiResult.processedCount, 4, 'scanAndProcess processes all 4 files across subtrees');

        // Verify mirrored paths
        assertTrue(fs.existsSync(path.join(nnDir, 'import', 'docs', 'guide.md')), 'sources/import/docs/guide.txt normalized to sources/nn/import/docs/guide.md');
        assertTrue(fs.existsSync(path.join(nnDir, 'conversations', '2026-09-06_arch_source.md')), 'conversation transcript normalized under sources/nn/conversations/');
        assertTrue(fs.existsSync(path.join(nnDir, 'conversations', '2026-09-06_arch_summary.md')), 'conversation summary normalized under sources/nn/conversations/');
        assertTrue(fs.existsSync(path.join(nnDir, 'export', 'roadmap.md')), 'promoted export normalized under sources/nn/export/');

        // Verify import frontmatter
        const guideFm = fs.readFileSync(path.join(nnDir, 'import', 'docs', 'guide.md'), 'utf8');
        assertTrue(guideFm.includes('source_file: "sources/import/docs/guide.txt"'), 'import file records source_file');
        assertTrue(!guideFm.includes('is_synthetic:'), 'import file does not contain is_synthetic');

        // Verify conversation transcript frontmatter & body
        const sourceFm = fs.readFileSync(path.join(nnDir, 'conversations', '2026-09-06_arch_source.md'), 'utf8');
        assertTrue(sourceFm.includes('source_file: "sources/conversations/2026-09-06_arch_source.md"'), 'transcript records source_file');
        assertTrue(sourceFm.includes('conversation_format: "full"'), 'transcript records conversation_format: "full"');
        assertTrue(sourceFm.includes('source_type: "conversation_transcript"'), 'transcript records source_type: "conversation_transcript"');
        assertTrue(sourceFm.includes('session_id: "sess-123"'), 'transcript preserves session_id');
        assertTrue(sourceFm.includes('**User**: How should we structure sources?'), 'transcript preserves dialogue structure');

        // Verify conversation summary frontmatter
        const summaryFm = fs.readFileSync(path.join(nnDir, 'conversations', '2026-09-06_arch_summary.md'), 'utf8');
        assertTrue(summaryFm.includes('source_file: "sources/conversations/2026-09-06_arch_summary.md"'), 'summary records source_file');
        assertTrue(summaryFm.includes('conversation_format: "summary"'), 'summary records conversation_format: "summary"');
        assertTrue(summaryFm.includes('source_type: "conversation_summary"'), 'summary records source_type: "conversation_summary"');
        assertTrue(summaryFm.includes('session_id: "sess-123"'), 'summary preserves session_id');

        // Verify promoted export frontmatter
        const expFm = fs.readFileSync(path.join(nnDir, 'export', 'roadmap.md'), 'utf8');
        assertTrue(expFm.includes('source_file: "sources/export/roadmap.md"'), 'export records source_file');
        assertTrue(!expFm.includes('is_synthetic:'), 'promoted deliverable has no is_synthetic');
        assertTrue(!expFm.includes('derived_from:'), 'promoted deliverable has no derived_from');

        // Test 17: Legacy fallback resolution (sources/original/ when sources/import/ does not exist)
        const legacyProj = path.join(TEST_TEMP, 'legacy-project');
        const legacyOrigDir = path.join(legacyProj, 'sources', 'original');
        fs.mkdirSync(legacyOrigDir, { recursive: true });
        fs.writeFileSync(path.join(legacyOrigDir, 'legacy_note.txt'), 'Legacy content.', 'utf8');

        return scanner.scanAndProcess(legacyProj, { autoAcceptPrompt: true }).then((legacyResult) => {
          assertEqual(legacyResult.totalDiscovered, 1, 'legacy scan discovers file in sources/original');
          const legacyNnFile = path.join(legacyProj, 'sources', 'nn', 'legacy_note.md');
          assertTrue(fs.existsSync(legacyNnFile), 'legacy file normalized to sources/nn/legacy_note.md');
          const legacyContent = fs.readFileSync(legacyNnFile, 'utf8');
          assertTrue(legacyContent.includes('source_file: "sources/original/legacy_note.txt"'), 'legacy source_file preserved');

          // Test 18: Snapshot-on-change, hash-idempotency, version counter, and walk exclusion
          const snapProj = path.join(TEST_TEMP, 'snap-project');
          const snapImportDir = path.join(snapProj, 'sources', 'import');
          fs.mkdirSync(snapImportDir, { recursive: true });
          const snapTxtFile = path.join(snapImportDir, 'doc.txt');
          fs.writeFileSync(snapTxtFile, 'Initial content v1.', 'utf8');

          return scanner.scanAndProcess(snapProj, { autoAcceptPrompt: true }).then((r1) => {
            const nnDoc = path.join(snapProj, 'sources', 'nn', 'import', 'doc.md');
            assertTrue(fs.existsSync(nnDoc), 'initial scan created sources/nn/import/doc.md');
            const v1Fm = fs.readFileSync(nnDoc, 'utf8');
            const hashMatch1 = v1Fm.match(/sha256: "([a-f0-9]+)"/);
            assertTrue(Boolean(hashMatch1), 'v1 has sha256 in frontmatter');
            const hash1 = hashMatch1 ? hashMatch1[1] : '';
            const archiveDocV1 = path.join(snapProj, 'sources', 'archive', 'doc', 'V1', 'doc.md');
            assertTrue(!fs.existsSync(archiveDocV1), 'no archive created on initial scan');

            // Mutate source file to trigger snapshot-on-change
            fs.writeFileSync(snapTxtFile, 'Modified content v2 with more details.', 'utf8');
            return scanner.scanAndProcess(snapProj, { autoAcceptPrompt: true }).then((r2) => {
              assertTrue(fs.existsSync(archiveDocV1), 'snapshot-on-change created sources/archive/doc/V1/doc.md');
              const archivedContent = fs.readFileSync(archiveDocV1, 'utf8');
              assertTrue(archivedContent.includes(`sha256: "${hash1}"`), 'archived snapshot preserves old sha256 in frontmatter');
              assertTrue(archivedContent.includes('Initial content v1.'), 'archived snapshot preserves old content');

              const v2Fm = fs.readFileSync(nnDoc, 'utf8');
              const hashMatch2 = v2Fm.match(/sha256: "([a-f0-9]+)"/);
              const hash2 = hashMatch2 ? hashMatch2[1] : '';
              assertTrue(hash2 !== hash1, 'active file reflects new sha256');
              assertTrue(v2Fm.includes('Modified content v2 with more details.'), 'active file has new content');

              // Registry entry reports archive action
              const regEntry = r2.registry.find((e) => e.name.includes('doc.txt'));
              assertTrue(Boolean(regEntry && regEntry.action.includes('Archived V1 then converted')), 'registry action reports Archived V1 then converted');

              // Re-scan with no change: hash-idempotency, creates no V2
              return scanner.scanAndProcess(snapProj, { autoAcceptPrompt: true }).then((r3) => {
                const archiveDocV2 = path.join(snapProj, 'sources', 'archive', 'doc', 'V2', 'doc.md');
                assertTrue(!fs.existsSync(archiveDocV2), 're-scan with no change creates no duplicate V2');

                // Mutate again -> version counter increments to V2
                fs.writeFileSync(snapTxtFile, 'Modified content v3 even more changes.', 'utf8');
                return scanner.scanAndProcess(snapProj, { autoAcceptPrompt: true }).then((r4) => {
                  assertTrue(fs.existsSync(archiveDocV2), 'second modification increments version counter to V2');
                  const archivedV2Content = fs.readFileSync(archiveDocV2, 'utf8');
                  assertTrue(archivedV2Content.includes(`sha256: "${hash2}"`), 'V2 snapshot preserves v2 sha256');

                  // Walk exclusion: sources/archive/ is ignored by detectFormats and walkOriginal
                  const detectedDirectArchive = scanner.detectFormats(path.join(snapProj, 'sources', 'archive'));
                  assertEqual(Object.keys(detectedDirectArchive).length, 0, 'detectFormats on archive dir returns empty');

                  const walkDirectArchive = scanner.walkOriginal(path.join(snapProj, 'sources', 'archive'));
                  assertEqual(walkDirectArchive.length, 0, 'walkOriginal on archive dir returns empty');

                  const testDirWithArchive = path.join(TEST_TEMP, 'archive-walk-test');
                  fs.mkdirSync(path.join(testDirWithArchive, 'archive', 'doc', 'V1'), { recursive: true });
                  fs.writeFileSync(path.join(testDirWithArchive, 'archive', 'doc', 'V1', 'doc.md'), 'archived');
                  fs.writeFileSync(path.join(testDirWithArchive, 'active.txt'), 'active');

                  const detectedWithArchive = scanner.detectFormats(testDirWithArchive);
                  assertEqual(detectedWithArchive['.txt'], 1, 'detectFormats finds active.txt');
                  assertEqual(detectedWithArchive['.md'], undefined, 'detectFormats ignores archive/ subtree');

                  const walkedWithArchive = scanner.walkOriginal(testDirWithArchive);
                  assertEqual(walkedWithArchive.length, 1, 'walkOriginal returns only 1 file');
                  assertEqual(walkedWithArchive[0].relPath, 'active.txt', 'walkOriginal ignores archive/ subtree');

                  // Test 19: Orphan detection and consent
                  const orphanProj = path.join(TEST_TEMP, 'orphan-project');
                  const orphanImportDir = path.join(orphanProj, 'sources', 'import');
                  fs.mkdirSync(orphanImportDir, { recursive: true });
                  const orphanItemFile = path.join(orphanImportDir, 'orphan_item.txt');
                  fs.writeFileSync(orphanItemFile, 'To be deleted later.', 'utf8');

                  return scanner.scanAndProcess(orphanProj, { autoAcceptPrompt: true }).then(() => {
                    const orphanNnFile = path.join(orphanProj, 'sources', 'nn', 'import', 'orphan_item.md');
                    assertTrue(fs.existsSync(orphanNnFile), 'initial orphan file normalized in sources/nn/');

                    // Delete the original source file
                    fs.unlinkSync(orphanItemFile);

                    // Subtest 19A: Non-interactive CLI mode (--scan, autoAcceptPrompt: true)
                    // Orphaned source MUST NOT be unilaterally deleted or archived
                    return scanner.scanAndProcess(orphanProj, { autoAcceptPrompt: true }).then((nonIntResult) => {
                      assertTrue(fs.existsSync(orphanNnFile), 'non-interactive scan does not unilaterally remove orphaned source');
                      const orphanArchive = path.join(orphanProj, 'sources', 'archive', 'orphan_item');
                      assertTrue(!fs.existsSync(orphanArchive), 'non-interactive scan does not automatically archive orphaned source');
                      assertTrue(Boolean(nonIntResult.orphans && nonIntResult.orphans.length > 0), 'non-interactive scan reports orphaned sources');

                      // Subtest 19B: Orphan consent 'b' (Keep as active)
                      return scanner.scanAndProcess(orphanProj, { orphanConsent: async () => 'b' }).then(() => {
                        assertTrue(fs.existsSync(orphanNnFile), 'consent "b" (keep) retains file in sources/nn/');
                        assertTrue(!fs.existsSync(orphanArchive), 'consent "b" creates no archive');

                        // Subtest 19C: Orphan consent 'a' (Archive & remove)
                        return scanner.scanAndProcess(orphanProj, { orphanConsent: async () => 'a' }).then(() => {
                          const archivedOrphanV1 = path.join(orphanProj, 'sources', 'archive', 'orphan_item', 'V1', 'orphan_item.md');
                          assertTrue(fs.existsSync(archivedOrphanV1), 'consent "a" archives the deleted source to V1');
                          assertTrue(!fs.existsSync(orphanNnFile), 'consent "a" removes orphaned file from sources/nn/');

                          // Test 20: Feedback JSON ingestion branch (innfo-console feedback loop)
                          const feedbackProj = path.join(TEST_TEMP, 'feedback-project');
                          const feedbackDir = path.join(feedbackProj, 'sources', 'import', 'feedback');
                          fs.mkdirSync(feedbackDir, { recursive: true });
                          const validFeedbackDoc = {
                            meta: {
                              source_knowledge: 'Ghostbusters',
                              source_knowledge_version: 'V_0-2-1',
                              artifact: 'Ghostbusters_V_0-2-1_console.html',
                              artifact_version: '0.1.0',
                              exported_at: '2026-09-09T12:00:00Z',
                              author: 'Reviewer',
                              feedback_slug: 'round-2',
                              viewer: 'innfo-console/0.1.0'
                            },
                            items: [
                              { id: 'fb-001', kind: 'correction', target: { concept: 'Problems', element: 'Paranormal Infestation', field: 'severity' }, original: 'low', proposed: 'high' }
                            ]
                          };
                          const feedbackFile = path.join(feedbackDir, 'Ghostbusters_V_0-2-1_round-2_feedback_20260909-120000.json');
                          fs.writeFileSync(feedbackFile, JSON.stringify(validFeedbackDoc), 'utf8');
                          const invalidFeedbackFile = path.join(feedbackDir, 'Broken_V_0-2-1_x_feedback_20260909-120000.json');
                          fs.writeFileSync(invalidFeedbackFile, JSON.stringify({ meta: {}, items: [{ id: 'bad', kind: 'rewrite', target: {}, status: 'pending' }] }), 'utf8');
                          const genericJsonFile = path.join(feedbackProj, 'sources', 'import', 'config.json');
                          fs.writeFileSync(genericJsonFile, JSON.stringify({ key: 'value' }), 'utf8');

                          assertEqual(typeof scanner.convertFeedbackJson, 'function', 'convertFeedbackJson is exported from scanner');
                          assertEqual(typeof scanner.convertChatJson, 'undefined', 'legacy convertChatJson stays removed');
                          if (typeof scanner.convertFeedbackJson === 'function') {
                            const fbBody = scanner.convertOkFormat('.json', feedbackFile, 'Ghostbusters_V_0-2-1_round-2_feedback_20260909-120000');
                            assertTrue(fbBody.includes('fb-001'), 'import/feedback JSON routes to the feedback branch');
                            let threw = false;
                            try {
                              scanner.convertOkFormat('.json', invalidFeedbackFile, 'Broken_V_0-2-1_x_feedback_20260909-120000');
                            } catch (err) {
                              threw = true;
                              assertTrue(String((err && err.message) || err).includes('feedback'), 'invalid feedback error names the feedback contract');
                            }
                            assertTrue(threw, 'invalid feedback JSON throws so the scan skips-and-reports');
                            const genericBody = scanner.convertOkFormat('.json', genericJsonFile, 'config');
                            assertTrue(!genericBody.includes('fb-001'), 'non-feedback JSON bypasses the feedback branch');
                          } else {
                            assertTrue(false, 'feedback branch missing — convertFeedbackJson not exported (RED)');
                          }

                          return scanner.scanAndProcess(feedbackProj, { autoAcceptPrompt: true }).then((fbResult) => {
                            const normalizedFeedback = path.join(feedbackProj, 'sources', 'nn', 'import', 'feedback', 'Ghostbusters_V_0-2-1_round-2_feedback_20260909-120000.md');
                            assertTrue(fs.existsSync(normalizedFeedback), 'valid feedback normalizes into sources/nn/import/feedback/');
                            const fbContent = fs.readFileSync(normalizedFeedback, 'utf8');
                            assertTrue(fbContent.includes('source_type: "feedback"'), 'feedback frontmatter carries source_type: feedback');
                            assertTrue(!fbContent.includes('is_synthetic:'), 'feedback frontmatter does not carry is_synthetic');
                            assertTrue(fbContent.includes('### fb-001\n'), 'normalized feedback uses ### fb-001 heading');
                            assertTrue(fbContent.includes('- **Kind**: correction'), 'normalized feedback carries Kind bullet');
                            assertTrue(!fbContent.includes('### fb-001 ('), 'normalized feedback omits kind and status from heading');
                            const { slugifyHeading } = require('../../scripts/markdown-utils');
                            assertEqual(slugifyHeading('fb-001'), 'fb-001', 'slug mirror heading slug equals fb-001');
                            const invalidEntry = fbResult.registry.find((e) => e.name.includes('Broken_V_0-2-1'));
                            assertTrue(Boolean(invalidEntry), 'invalid feedback appears in the registry report');
                            assertTrue(!/Processed/.test(invalidEntry ? invalidEntry.status : ''), 'invalid feedback is skipped, not processed');
                            const genericNn = path.join(feedbackProj, 'sources', 'nn', 'import', 'config.md');
                            assertTrue(fs.existsSync(genericNn), 'generic JSON still normalizes');
                            assertTrue(!fs.readFileSync(genericNn, 'utf8').includes('source_type: "feedback"'), 'generic JSON is not tagged as feedback');
                          }).then(() => {
                            // Test: Flat layout preservation & snapshotting
                            const flatProj = path.join(TEST_TEMP, 'flat-proj');
                            const flatImport = path.join(flatProj, 'sources', 'import');
                            const flatNn = path.join(flatProj, 'sources', 'nn');
                            fs.mkdirSync(flatImport, { recursive: true });
                            fs.mkdirSync(flatNn, { recursive: true });

                            // Seed existing flat normalized file
                            fs.writeFileSync(path.join(flatImport, 'Tutorias.txt'), 'V1 content', 'utf8');
                            fs.writeFileSync(
                              path.join(flatNn, 'Tutorias.md'),
                              '---\nsource_file: "sources/import/Tutorias.txt"\nsha256: "oldhash"\n---\n# Tutorias\nV1 content',
                              'utf8'
                            );

                            // Update import file with V2 content
                            fs.writeFileSync(path.join(flatImport, 'Tutorias.txt'), 'V2 new content extra rows', 'utf8');

                            return scanner.scanAndProcess(flatProj, { autoAcceptPrompt: true }).then((flatRes) => {
                              const updatedFlat = path.join(flatNn, 'Tutorias.md');
                              const duplicateMirrored = path.join(flatNn, 'import', 'Tutorias.md');
                              assertTrue(fs.existsSync(updatedFlat), 'flat destination preserved when already existing in sources/nn/');
                              assertTrue(!fs.existsSync(duplicateMirrored), 'no duplicate created in sources/nn/import/');
                              assertTrue(flatRes.changedSnapshots.length > 0, 'snapshot recorded for updated flat source');
                              const snapFile = path.join(flatProj, 'sources', 'archive', 'Tutorias', 'V1', 'Tutorias.md');
                              assertTrue(fs.existsSync(snapFile), 'snapshot created in sources/archive/Tutorias/V1/');

                              // Test: singleFile normalization filter
                              fs.writeFileSync(path.join(flatImport, 'Other.txt'), 'Other file', 'utf8');
                              return scanner.scanAndProcess(flatProj, { autoAcceptPrompt: true, singleFile: 'Other.txt', flat: true }).then((singleRes) => {
                                assertEqual(singleRes.processedCount, 1, 'singleFile option normalizes only 1 file');
                                assertTrue(fs.existsSync(path.join(flatNn, 'Other.md')), 'singleFile with flat: true normalizes directly to sources/nn/Other.md');
                              });
                            });
                          }).then(() => {
                            // Cleanup
                            fs.rmSync(TEST_TEMP, { recursive: true, force: true });
                            console.log(`\n  Scanner tests: ${passed} passed, ${failed} failed`);
                            return { passed, failed };
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  } catch (e) {
    fs.rmSync(TEST_TEMP, { recursive: true, force: true });
    console.error(`  ERROR: ${e.message}`);
    console.error(e.stack);
    failed++;
    return Promise.resolve({ passed, failed });
  }
}

module.exports = { run };

if (require.main === module) {
  Promise.resolve(run()).then((result) => {
    process.exit(result.failed > 0 ? 1 : 0);
  });
}
