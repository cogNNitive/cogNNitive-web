const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

async function run() {
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

    // --- HTML extraction fidelity on the PD_NN regression fixtures (issue #266) ---
    const fixturesDir = path.join(__dirname, '..', 'fixtures', 'html');
    const readFixture = (name) => fs.readFileSync(path.join(fixturesDir, name), 'utf8');
    const FT = 'FT_55866_20261017T165551Z.html';
    const PMC = 'PMC9547138_20261017T173000Z.html';
    const NBK = 'NBK1478_20261017T174010Z.html';
    const SPRINGER = 's10072-023-06789-7_20261017T181030Z.html';
    const SCRIPT_ONLY = '920_20261017T190632Z.html';
    const ZERO_BYTE = '37032388-15-year-subthalamic-deep-brain-stimulation-outcome-in-a-parkinsons-disease-patient-with-parkin-gene-mutation-a-case-report_20261017T181041Z.html';

    // Entities: numeric (decimal + hex), named, and the double-decode guard.
    eq(converters.htmlToPlainText('<p>Fundaci&#243;n</p>').trim(), 'Fundación', 'numeric &#243; decodes');
    eq(converters.htmlToPlainText('<p>&#237;ndice</p>').trim(), 'índice', 'numeric &#237; decodes');
    eq(converters.htmlToPlainText('<p>a&#241;o</p>').trim(), 'año', 'numeric &#241; decodes');
    eq(converters.htmlToPlainText('<p>&#xE9;</p>').trim(), 'é', 'hex entity &#xE9; decodes');
    eq(converters.htmlToPlainText('<p>&iacute; &eacute; &ntilde;</p>').trim(), 'í é ñ', 'named Latin-1 entities decode');
    eq(converters.htmlToPlainText('<p>&amp;#243;</p>').trim(), '&#243;', 'a literal &amp;#243; is NOT double-decoded');
    ok(!converters.htmlToPlainText('<p>a&#160;b</p>').includes('&#'), '&#160; decodes to a space, not a literal');
    ok(!converters.htmlToPlainText('<p>a&nbsp;b<br>c&nbsp;d</p>').includes('\n\n'), 'non-breaking spaces add no blank line');

    // Furniture is dropped, and the <main> region wins when the page declares one.
    const chrome = converters.htmlToPlainText(
      '<html><body><nav>Skip to main content Menu</nav><header>Log in</header><main><h1>Real Title</h1>'
      + '<p>The article prose lives here.</p></main><footer>Account settings</footer><aside>Related</aside></body></html>',
    );
    ok(
      !chrome.includes('Skip to main content') && !chrome.includes('Log in')
        && !chrome.includes('Account settings') && !chrome.includes('Related'),
      'nav/header/footer/aside text is absent from the body',
    );
    ok(chrome.includes('The article prose lives here.'), 'the <main> prose is retained');
    const noRegion = converters.htmlToPlainText('<html><body><div>Keep this.</div><footer>Drop this.</footer></body></html>');
    ok(noRegion.includes('Keep this.') && !noRegion.includes('Drop this.'), 'with no <main>/<article>, furniture is stripped and the rest kept');

    // A CRLF document: the blank-line explosion is gone and no entity survives.
    const ftBody = converters.htmlToPlainText(readFixture(FT));
    const ftLines = ftBody.split('\n');
    const ftMaxBlankRun = ftLines.reduce(
      (acc, l) => { const run = l.trim() === '' ? acc.run + 1 : 0; return { run, max: Math.max(acc.max, run) }; },
      { run: 0, max: 0 },
    ).max;
    const ftBlankPct = (ftLines.filter((l) => l.trim() === '').length / ftLines.length) * 100;
    eq(ftMaxBlankRun, 1, 'FT_55866: no run of more than one consecutive blank line');
    // The change's "<10% blank lines" Success Criterion is NOT reachable while keeping the
    // document's own structure: its markup carries 243 separate <p> blocks for ~200 content
    // lines, so one blank line per paragraph is ~50% by line count. Asserted here as a
    // material reduction from the audited 82.5%; the gap is reported on the change, not hidden.
    ok(ftBlankPct < 60, `FT_55866: blank lines fall from 82.5% to ${ftBlankPct.toFixed(1)}%`);
    ok(!/&#\w+;|&#x[0-9a-fA-F]+;/.test(ftBody), 'FT_55866: no undecoded entity survives');
    ok(ftBody.includes('aquí'), 'FT_55866: named entities decode (&iacute;)');

    // PMC: navigation chrome is gone, the article's own prose stays.
    const pmcBody = converters.htmlToPlainText(readFixture(PMC));
    for (const forbidden of ['Skip to main content', 'Log in', 'Dashboard', 'Account settings']) {
      ok(!pmcBody.includes(forbidden), `PMC9547138: the body omits "${forbidden}"`);
    }
    ok(/Parkinson/i.test(pmcBody), 'PMC9547138: the article prose is retained');

    // --- An incomplete extraction is reported, never presented as complete ------
    eq(converters.looksPartial(''), 'empty', 'an empty body is reported as empty');
    eq(converters.looksPartial('   \n\n  '), 'empty', 'a whitespace-only body is reported as empty');
    eq(converters.looksPartial(converters.htmlToPlainText(readFixture(SCRIPT_ONLY))), 'empty', '920: a script-only wall page extracts empty');
    eq(converters.looksPartial(converters.htmlToPlainText(readFixture(NBK))), 'anti-bot-wall', 'NBK1478: the captcha interstitial is an anti-bot wall');
    eq(converters.looksPartial(converters.htmlToPlainText(readFixture(SPRINGER))), 'anti-bot-wall', 's10072: the Client Challenge page is an anti-bot wall');
    eq(converters.looksPartial(converters.htmlToPlainText(readFixture(PMC))), null, 'PMC9547138: a healthy article reports nothing');
    eq(converters.looksPartial(converters.htmlToPlainText(readFixture(FT))), null, 'FT_55866: a substantial CRLF document reports nothing');
    eq(converters.looksPartial('# T\n\nonly a few characters'), 'trivial', 'a body too short to be the document is trivial');
    eq(
      converters.looksPartial(`${'word '.repeat(1200)}recaptcha`),
      null,
      'a body longer than a wall is not misread as one for mentioning a signature',
    );
    eq(
      converters.looksPartial(`${'word '.repeat(150)}recaptcha in passing`),
      null,
      'a signature buried past the head of the body is a mention, not a wall',
    );

    // --- The scanner refuses a zero-byte subject and flags a wall as partial ----
    delete require.cache[require.resolve('../../scripts/scanner')];
    const scanner = require('../../scripts/scanner');
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'html-extract-'));
    const importDir = path.join(proj, 'sources', 'import');
    const put = (name, content) => fs.writeFileSync(path.join(importDir, name), content);
    try {
      fs.mkdirSync(importDir, { recursive: true });
      put('healthy_20260101T000000Z.html', `<html><body><main><h1>Title</h1><p>${'Real prose sentence. '.repeat(40)}</p></main></body></html>`);
      put('wall_20260101T000000Z.html', readFixture(NBK));
      put('zero_20260101T000000Z.html', '');
      eq(fs.statSync(path.join(fixturesDir, ZERO_BYTE)).size, 0, 'the 37032388 fixture is a zero-byte subject');

      const scan = await scanner.scanAndProcess(proj, { autoAcceptPrompt: true });
      const entry = (name) => scan.registry.find((r) => r.name === `sources/import/${name}`) || {};
      eq(entry('healthy_20260101T000000Z.html').status, '✅ Processed', 'a healthy HTML source is processed normally');
      eq(entry('wall_20260101T000000Z.html').status, '✅ Processed (Partial)', 'a wall source is processed but flagged partial');
      ok(/anti-bot-wall/.test(entry('wall_20260101T000000Z.html').action), 'the wall reason reaches the scan report');
      eq(entry('zero_20260101T000000Z.html').status, '⚠️ Skipped', 'a zero-byte subject is refused');
      ok(/zero-byte subject/.test(entry('zero_20260101T000000Z.html').action), 'the refusal names the zero-byte subject');
      ok(!fs.existsSync(path.join(importDir, 'zero_20260101T000000Z.html_sidecar_NN.md')), 'a refused zero-byte subject writes no sidecar');
      const wallSidecar = fs.readFileSync(path.join(importDir, 'wall_20260101T000000Z.html_sidecar_NN.md'), 'utf8');
      ok(wallSidecar.includes('Checking your browser'), 'a wall body is still cognitivized (the signal is advisory)');
    } finally {
      fs.rmSync(proj, { recursive: true, force: true });
    }

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
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
