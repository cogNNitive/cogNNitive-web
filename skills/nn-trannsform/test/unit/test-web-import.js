const assert = require('assert');

const webImport = require('../../scripts/webImport');

const FIXTURE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Fallback Title</title>
  <meta property="og:title" content="Open Graph Title" />
  <meta property="og:description" content="Open Graph description of the page.">
  <meta name="description" content="Meta description fallback.">
  <meta name="author" content="Jane &amp; Doe">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "JSON-LD Headline",
    "author": { "@type": "Person", "name": "JSON-LD Author" }
  }
  </script>
</head>
<body>
  <h1>Hello</h1>
  <p>Some content.</p>
</body>
</html>`;

const MINIMAL_HTML = `<html><head><title>Just a Title</title></head><body>No meta tags here.</body></html>`;

const NO_METADATA_HTML = `<html><body><p>Nothing to see here.</p></body></html>`;

function run() {
  let passed = 0;
  let failed = 0;

  function ok(actual, msg) {
    try {
      assert.ok(actual);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg}`);
      failed++;
    }
  }
  function eq(actual, expected, msg) {
    try {
      assert.strictEqual(actual, expected);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
      failed++;
    }
  }

  try {
    // og:title/og:description take precedence over <title>/meta description when present
    const meta = webImport.extractHtmlMetadata(FIXTURE_HTML);
    eq(meta.title, 'Open Graph Title', 'extractHtmlMetadata prefers og:title over <title>');
    eq(meta.description, 'Open Graph description of the page.', 'extractHtmlMetadata prefers og:description over meta description');
    eq(meta.author, 'Jane & Doe', 'extractHtmlMetadata decodes HTML entities in meta content');

    // Falls back to <title> when no og:title is present
    const minimalMeta = webImport.extractHtmlMetadata(MINIMAL_HTML);
    eq(minimalMeta.title, 'Just a Title', 'extractHtmlMetadata falls back to <title> when no og:title');
    eq(minimalMeta.description, undefined, 'extractHtmlMetadata omits description key when not found');
    eq(minimalMeta.author, undefined, 'extractHtmlMetadata omits author key when not found');

    // Only returns keys it actually found — no empty/null keys
    const noMeta = webImport.extractHtmlMetadata(NO_METADATA_HTML);
    eq(Object.keys(noMeta).length, 0, 'extractHtmlMetadata returns no keys for a page with no discoverable metadata');

    // Never throws on malformed input
    let threw = false;
    try {
      webImport.extractHtmlMetadata('<html><script type="application/ld+json">{not valid json</script></html>');
    } catch (e) {
      threw = true;
    }
    ok(!threw, 'extractHtmlMetadata never throws on malformed JSON-LD');

    let threwOnEmpty = false;
    try {
      webImport.extractHtmlMetadata('');
      webImport.extractHtmlMetadata(null);
      webImport.extractHtmlMetadata(undefined);
    } catch (e) {
      threwOnEmpty = true;
    }
    ok(!threwOnEmpty, 'extractHtmlMetadata never throws on empty/null/undefined input');

    // Content-Type -> extension mapping
    eq(webImport.extFromContentType('text/html; charset=utf-8'), '.html', 'extFromContentType parses text/html with charset');
    eq(webImport.extFromContentType('application/pdf'), '.pdf', 'extFromContentType parses application/pdf');
    eq(webImport.extFromContentType(null), null, 'extFromContentType returns null for missing header');
    eq(webImport.extFromContentType('application/octet-stream'), null, 'extFromContentType returns null for unmapped mime type');

    // URL extension fallback
    eq(webImport.extFromUrl('https://example.com/reports/q1.pdf'), '.pdf', 'extFromUrl extracts extension from URL path');
    eq(webImport.extFromUrl('https://example.com/reports/q1.pdf?download=1'), '.pdf', 'extFromUrl ignores query string');
    eq(webImport.extFromUrl('not a url'), null, 'extFromUrl returns null for an invalid URL');

    // Filename sanitization
    eq(webImport.sanitizeFilenameFromUrl('https://example.com/reports/Q1 Report.pdf', '.pdf'), 'Q1_Report.pdf', 'sanitizeFilenameFromUrl strips unsafe characters and keeps extension');
    eq(webImport.sanitizeFilenameFromUrl('https://example.com/', '.html'), 'download.html', 'sanitizeFilenameFromUrl falls back to download.<ext> for a bare origin');

    // HTML to Markdown conversion test via scanner-converters
    const converters = require('../../scripts/lib/scanner-converters');
    const sampleHtml = '<h1>Title</h1><p>This is <strong>bold</strong> and <em>italic</em> with a <a href="https://example.com">link</a>.</p><ul><li>Item 1</li><li>Item 2</li></ul>';
    const md = converters.htmlToPlainText(sampleHtml);
    ok(md.includes('# Title'), 'htmlToPlainText converts <h1> to # Heading');
    ok(md.includes('**bold**'), 'htmlToPlainText converts <strong> to **bold**');
    ok(md.includes('*italic*'), 'htmlToPlainText converts <em> to *italic*');
    ok(md.includes('[link](https://example.com)'), 'htmlToPlainText converts <a> to markdown link');
    ok(md.includes('* Item 1'), 'htmlToPlainText converts <li> to markdown list');

    console.log(`\n  Web import tests: ${passed} passed, ${failed} failed`);
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    console.error(e.stack);
    failed++;
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const result = run();
  process.exit(result.failed > 0 ? 1 : 0);
}
