const assert = require("assert");

const converters = require("../../scripts/lib/scanner-converters");

/** Minimal pdf.js text item. */
function item(str, x, y, width) {
  return { str, width: width === undefined ? str.length * 5 : width, transform: [1, 0, 0, 1, x, y] };
}

/** A table row: cells laid out with a horizontal gap larger than PDF_COL_GAP. */
function row(y, cells) {
  const items = [];
  let x = 40;
  for (const cell of cells) {
    const s = `${cell} `;
    items.push(item(s, x, y, s.length * 5));
    x += s.length * 5 + 20;
  }
  return items;
}

/**
 * Unit tests for layoutItemsToText — the positional PDF reconstruction that
 * keeps table columns as pipe-delimited Markdown rows while leaving prose
 * spaced exactly as the document encodes it (`item.str` is verbatim).
 */
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
      console.log(
        `  FAIL: ${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`,
      );
      failed++;
    }
  }

  try {
    const { layoutItemsToText, reflowExtractedText } = converters;

    // Prose: small gaps stay a single line, spacing comes from item.str.
    eq(layoutItemsToText([]), "", "no items yields empty text");
    eq(
      layoutItemsToText([item("Hello ", 10, 700, 30), item("world", 45, 700, 25)]),
      "Hello world",
      "small horizontal gaps are not treated as column boundaries",
    );

    // A numeric row becomes a pipe-delimited row.
    eq(
      layoutItemsToText(row(700, ["1,00 \u20ac", "3.000,00 \u20ac", "3.395,69", "0,88 \u20ac"])),
      "| 1,00 \u20ac | 3.000,00 \u20ac | 3.395,69 | 0,88 \u20ac |",
      "a digit-dense multi-column line becomes a Markdown row",
    );

    // A header-like row (no digits, >=5 cells) also becomes a row.
    eq(
      layoutItemsToText(row(700, ["Slot inicial", "Slot final", "Acciones", "Precio", "Valoracion"])),
      "| Slot inicial | Slot final | Acciones | Precio | Valoracion |",
      "a short header-like line becomes a Markdown row",
    );

    // Different y = different lines.
    eq(
      layoutItemsToText([item("line one", 10, 700, 40), item("line two", 10, 680, 40)]),
      "line one\nline two",
      "items on different baselines are separate lines",
    );

    // reflowExtractedText inserts the table separator after the header row.
    eq(
      reflowExtractedText("| a | b |\n| 1 | 2 |"),
      "| a | b |\n| --- | --- |\n| 1 | 2 |",
      "inserts a Markdown table separator after the first row",
    );
    eq(
      reflowExtractedText("| a | b |\n| --- | --- |\n| 1 | 2 |"),
      "| a | b |\n| --- | --- |\n| 1 | 2 |",
      "does not double an existing table separator",
    );

    console.log(`\n  pdf-layout tests: ${passed} passed, ${failed} failed`);
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
