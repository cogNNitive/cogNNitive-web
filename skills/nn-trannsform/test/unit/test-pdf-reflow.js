const assert = require("assert");

const converters = require("../../scripts/lib/scanner-converters");

/**
 * Unit tests for reflowExtractedText — the post-processor applied to raw
 * PDF-extracted text. Covers artifact stripping, word-preserving reflow,
 * heading promotion (the anchors used for knowledge-unit citations), page
 * number removal, and the table-row guard.
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
    const { reflowExtractedText } = converters;
    ok(typeof reflowExtractedText === "function", "reflowExtractedText is exported");

    // --- extraction artifact stripping ---
    eq(reflowExtractedText(""), "", "empty input yields empty output");
    eq(
      reflowExtractedText("Zero\u200BWidth\u00A0and soft\u00ADhyphen"),
      "ZeroWidth and softhyphen",
      "strips zero-width, soft hyphen; converts NBSP to space",
    );
    eq(
      reflowExtractedText("justified    text   with    gaps"),
      "justified text with gaps",
      "collapses runs of spaces from justified text",
    );
    eq(
      reflowExtractedText("partici-\npativo loan"),
      "participativo loan",
      "re-joins a word hyphen-split across a line break",
    );

    // --- heading promotion (citation anchors) ---
    ok(
      reflowExtractedText("1.DEFINITIONS AND INTERPRETATION\nbody").includes(
        "## 1. DEFINITIONS AND INTERPRETATION",
      ),
      "promotes a numbered ALL-CAPS clause title to ## (no space after the dot)",
    );
    ok(
      reflowExtractedText("3.1The Lender shall pay the amount").includes("### 3.1"),
      "promotes an n.m sub-clause to ###",
    );
    ok(
      reflowExtractedText("Schedule 1\nInvestment Slots").includes("## Schedule 1"),
      "promotes Schedule N to ##",
    );
    ok(
      reflowExtractedText("PROFIT PARTICIPATING LOAN AGREEMENT").includes(
        "## PROFIT PARTICIPATING LOAN AGREEMENT",
      ),
      "promotes a multi-word ALL-CAPS line to ##",
    );
    ok(
      reflowExtractedText("WHEREAS").includes("## WHEREAS"),
      "promotes the WHEREAS marker to ##",
    );
    ok(
      !reflowExtractedText("ETWEEN").includes("##"),
      "does not promote an unknown single-word fragment to a heading",
    );

    // --- page-number noise ---
    ok(
      !reflowExtractedText("End of clause.\n\n42\n\nNext clause.").split("\n").includes("42"),
      "drops an isolated page-number line",
    );

    // --- word-preserving reflow ---
    const joined = reflowExtractedText(
      "The Borrower shall repay the Loan together with\nany accrued Interest thereon in full on the Repayment Date.",
    );
    eq(
      joined,
      "The Borrower shall repay the Loan together with any accrued Interest thereon in full on the Repayment Date.",
      "re-joins wrapped lines and preserves the exact word sequence",
    );
    ok(
      reflowExtractedText("This Agreement is made on\nBETWEEN\n(1)Mr. X").includes(
        "made on BETWEEN",
      ),
      "joins a line that does not end a sentence",
    );

    // --- item boundaries are preserved ---
    const definitions = reflowExtractedText(
      "\u201cA\u201d means one;\n\u201cB\u201d means two;",
    );
    const defParagraphs = definitions.split(/\n{2,}/);
    eq(defParagraphs.length, 2, "typographic-quote definitions stay separate paragraphs");
    ok(
      defParagraphs[0].includes("means one") && defParagraphs[1].includes("means two"),
      "each definition keeps its own text",
    );

    // --- table-row guard ---
    const table = reflowExtractedText(
      "Slot range\n855.001,00 \u20ac858.000,00 \u20ac368,228,15 \u20ac5.994.170,13 \u20ac4,66%0,03682%",
    );
    const tableLines = table.split(/\n{2,}/);
    ok(
      tableLines.some((l) => l.includes("855.001,00") && !l.includes("Slot range")),
      "a dense numeric row is never merged into the surrounding prose",
    );

    // --- markdown safety (DOCX/TXT passthrough) ---
    const mdDoc = reflowExtractedText(
      "# Title\n\nIntro paragraph line one\nand line two.\n\n- item a\n- item b\n",
    );
    ok(mdDoc.includes("# Title"), "preserves an existing markdown heading");
    ok(
      mdDoc.includes("Intro paragraph line one and line two."),
      "still reflows wrapped prose around markdown blocks",
    );
    ok(mdDoc.includes("- item a\n- item b"), "keeps list items tight");

    const mdTable = reflowExtractedText("| a | b |\n|---|---|\n| 1 | 2 |");
    eq(
      mdTable,
      "| a | b |\n|---|---|\n| 1 | 2 |",
      "keeps a markdown table contiguous (no blank lines between rows)",
    );

    console.log(`\n  pdf-reflow tests: ${passed} passed, ${failed} failed`);
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
