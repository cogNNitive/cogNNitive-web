const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const TEST_TEMP = fs.mkdtempSync(
  path.join(os.tmpdir(), "conv-lifecycle-test-"),
);

async function run() {
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

  function assertFalse(actual, msg) {
    assertEqual(actual, false, msg);
  }

  try {
    const conv = require("../../scripts/lib/conversations");

    console.log("--- Test 1: Silent Session Transcript Reservation ---");
    const timestamp = new Date("2026-09-06T12:00:00.000Z");
    const session = conv.reserveConversationSession(TEST_TEMP, timestamp);

    const expectedRelPath = path.join("conversations", "2026-09-06_120000.md");
    const expectedAbsPath = path.join(TEST_TEMP, expectedRelPath);
    assertEqual(
      session.filePath,
      expectedAbsPath,
      "session file path matches YYYY-MM-DD_HHmmss.md pattern",
    );
    assertTrue(fs.existsSync(expectedAbsPath), "session file exists on disk");

    const content = fs.readFileSync(expectedAbsPath, "utf8");
    assertTrue(
      content.includes("status: in_progress"),
      "frontmatter status is in_progress",
    );
    assertTrue(
      content.includes("started_at:"),
      "frontmatter contains started_at",
    );
    assertTrue(content.includes("turns: 0"), "frontmatter initial turns is 0");
    assertTrue(
      content.includes("mutations: false"),
      "frontmatter initial mutations is false",
    );
    assertTrue(Boolean(session.sessionId), "session has unique sessionId");

    console.log("--- Test 2: Guaranteed All-Session Retention (Zero Discard) ---");
    const eval1 = conv.evaluateSessionDiscard({
      turns: 0,
      modelMutations: false,
    });
    assertFalse(eval1.discard, "0 turns, 0 mutations -> retain (zero discard policy)");

    const eval2 = conv.evaluateSessionDiscard({
      turns: 1,
      modelMutations: false,
    });
    assertFalse(eval2.discard, "1 turn, 0 mutations -> retain");

    const eval3 = conv.evaluateSessionDiscard({
      turns: 1,
      modelMutations: true,
    });
    assertFalse(eval3.discard, "1 turn with mutations -> retain");

    const eval4 = conv.evaluateSessionDiscard({
      turns: 2,
      modelMutations: false,
    });
    assertFalse(eval4.discard, "2 turns without mutations -> retain");

    const retainTempFile = path.join(
      TEST_TEMP,
      "conversations",
      "keep_zero_turns.md",
    );
    fs.writeFileSync(retainTempFile, "Short session draft", "utf8");
    assertTrue(
      fs.existsSync(retainTempFile),
      "temp file created before evaluation",
    );
    const evalWithFile = conv.evaluateSessionDiscard({
      turns: 1,
      modelMutations: false,
      sessionFile: retainTempFile,
    });
    assertFalse(evalWithFile.discard, "evaluated as retain");
    assertTrue(
      fs.existsSync(retainTempFile),
      "session file is preserved on disk and never unlinked",
    );

    console.log("--- Test 3: Post-Session Title Suggestions ---");
    const suggestions = conv.generateTitleSuggestions(
      "Refactor API Gateway and implement JWT authentication endpoints",
    );
    assertEqual(suggestions.length, 3, "generates exactly 3 title suggestions");
    assertTrue(
      suggestions[0].recommended,
      "first suggestion is marked recommended",
    );
    assertTrue(
      Boolean(suggestions[0].slug && suggestions[0].slug.length > 0),
      "first suggestion has non-empty slug",
    );
    assertTrue(
      Boolean(suggestions[1].slug && suggestions[1].slug.length > 0),
      "second suggestion has non-empty slug",
    );
    assertTrue(
      Boolean(suggestions[2].slug && suggestions[2].slug.length > 0),
      "third suggestion has non-empty slug",
    );

    const fallbackSuggestions = conv.generateTitleSuggestions("");
    assertEqual(
      fallbackSuggestions.length,
      3,
      "fallback produces 3 suggestions",
    );
    assertTrue(
      fallbackSuggestions[0].recommended,
      "fallback first suggestion is recommended",
    );

    console.log("--- Test 4: Interactive Promotion Prompt Contract ---");
    assertTrue(
      Array.isArray(conv.PROMOTION_OPTIONS),
      "PROMOTION_OPTIONS is an array",
    );
    assertEqual(
      conv.PROMOTION_OPTIONS.length,
      2,
      "PROMOTION_OPTIONS has 2 choices ([full], [none])",
    );
    const optionValues = conv.PROMOTION_OPTIONS.map((o) => o.value);
    assertEqual(
      optionValues.join(","),
      "full,none",
      "options are exactly [full, none] in order",
    );
    assertFalse(optionValues.includes("summary"), "summary option removed");
    assertFalse(optionValues.includes("both"), "both option removed");
    assertTrue(
      conv.PROMOTION_OPTIONS[0].title.includes("(Recommended)"),
      "first option has (Recommended) label",
    );

    console.log("--- Test 5: Finalizing Session Title and Renaming ---");
    const finalSession = conv.finalizeConversationSession({
      sessionFile: session.filePath,
      titleSlug: "api-gateway-refactor",
      title: "API Gateway Refactor",
      endedAt: "2026-09-06T12:30:00.000Z",
    });
    assertTrue(
      fs.existsSync(finalSession.filePath),
      "finalized renamed file exists",
    );
    assertFalse(
      fs.existsSync(session.filePath),
      "old reserved file no longer exists",
    );
    const finalContent = fs.readFileSync(finalSession.filePath, "utf8");
    assertTrue(
      finalContent.includes("status: completed"),
      "frontmatter status is completed",
    );
    assertTrue(
      finalContent.includes('title: "API Gateway Refactor"'),
      "frontmatter title is updated",
    );
    assertTrue(
      finalContent.includes('ended_at: "2026-09-06T12:30:00.000Z"'),
      "frontmatter ended_at is updated",
    );

    console.log("--- Test 6: Promote Conversation to Sources ---");
    // `_summary.md` is retired: `summary`/`both` promote nothing.
    const summaryPromo = await conv.promoteConversation({
      workspaceRoot: TEST_TEMP,
      sessionFile: finalSession.filePath,
      titleSlug: "2026-09-06_api-gateway-refactor",
      format: "summary",
      summaryContent: "## Executive Summary\nKey decisions: use JWT.",
    });
    assertEqual(
      summaryPromo.promotedFiles.length,
      0,
      "summary format promotes nothing (retired)",
    );
    assertFalse(
      fs.existsSync(
        path.join(
          TEST_TEMP,
          "sources",
          "conversations",
          "2026-09-06_api-gateway-refactor_summary.md",
        ),
      ),
      "no _summary.md is written",
    );

    const bothPromo = await conv.promoteConversation({
      workspaceRoot: TEST_TEMP,
      sessionFile: finalSession.filePath,
      titleSlug: "2026-09-06_api-gateway-refactor",
      format: "both",
    });
    assertEqual(
      bothPromo.promotedFiles.length,
      0,
      "both format promotes nothing (retired)",
    );

    const fullPromo = await conv.promoteConversation({
      workspaceRoot: TEST_TEMP,
      sessionFile: finalSession.filePath,
      titleSlug: "2026-09-06_api-gateway-refactor",
      format: "full",
    });
    assertEqual(fullPromo.format, "full", "promoted format is full");
    assertEqual(
      fullPromo.promotedFiles.length,
      1,
      "full promotes exactly the _source.md transcript",
    );
    const sourceFullFile = path.join(
      TEST_TEMP,
      "sources",
      "conversations",
      "2026-09-06_api-gateway-refactor_source.md",
    );
    assertTrue(
      fs.existsSync(sourceFullFile),
      "source full transcript created in sources/conversations/",
    );
    const nnFullFile = path.join(
      TEST_TEMP,
      "sources",
      "nn",
      "conversations",
      "2026-09-06_api-gateway-refactor_source.md",
    );
    assertTrue(
      fs.existsSync(nnFullFile),
      "normalized full file created in sources/nn/conversations/",
    );
    const nnFullContent = fs.readFileSync(nnFullFile, "utf8");
    assertTrue(
      nnFullContent.includes('conversation_format: "full"'),
      "normalized frontmatter has conversation_format full",
    );

    const nonePromo = await conv.promoteConversation({
      workspaceRoot: TEST_TEMP,
      sessionFile: finalSession.filePath,
      titleSlug: "2026-09-06_api-gateway-refactor",
      format: "none",
    });
    assertEqual(nonePromo.format, "none", "format none returns none");
    assertEqual(nonePromo.promotedFiles.length, 0, "no files promoted on none");

    assertTrue(
      fs.existsSync(finalSession.filePath),
      "original session file remains intact in conversations/",
    );

    console.log(
      "--- Test 6b: resolveTurnHeading (author-attributed turn headings) ---",
    );
    const turn = (seq, authorId) => {
      try {
        return conv.resolveTurnHeading(seq, authorId);
      } catch (e) {
        return `THREW: ${e.message}`;
      }
    };
    assertEqual(
      turn(1, "Architect"),
      "## NN Turn 01: Architect",
      "resolveTurnHeading(1, Architect) pads the number to 01",
    );
    assertEqual(
      turn(10, "OpenCode"),
      "## NN Turn 10: OpenCode",
      "resolveTurnHeading(10, OpenCode) pads the number to 10",
    );
    assertEqual(
      turn(2, undefined),
      "## NN Turn 02: unnamed",
      "resolveTurnHeading(2, undefined) falls back to unnamed",
    );
    assertEqual(
      turn(2, "   "),
      "## NN Turn 02: unnamed",
      "resolveTurnHeading(2, whitespace) falls back to unnamed",
    );
    assertEqual(
      turn(0, "Architect"),
      "## NN Turn 01: Architect",
      "resolveTurnHeading(0, Architect) clamps sub-1 sequences to 01",
    );
    assertEqual(
      turn(100, "X"),
      "## NN Turn 100: X",
      "resolveTurnHeading(100, X) leaves 100 unpadded but unclamped",
    );
    const pad = (seq) => {
      try {
        return conv.padTurn(seq);
      } catch (e) {
        return `THREW: ${e.message}`;
      }
    };
    assertEqual(pad(1), "01", "padTurn(1) pads to 01");
    assertEqual(pad(100), "100", "padTurn(100) stays unpadded");

    console.log(
      "--- Test 6b2: turn-heading slug parity under the vendored slug mirror ---",
    );
    const markdownUtils = require("../../scripts/markdown-utils");
    const turnHeading = "NN Turn 01: Architect";
    const parts = markdownUtils.headingSlugParts(turnHeading);
    assertEqual(
      parts.slug,
      "nn-turn-01--architect",
      "headingSlugParts(NN Turn 01: Architect) exposes the -- boundary slug",
    );
    assertEqual(
      parts.concept,
      "NN Turn 01",
      "headingSlugParts keeps the Concept side of the -- boundary",
    );
    assertEqual(
      parts.element,
      "Architect",
      "headingSlugParts keeps the Element (author) side of the -- boundary",
    );
    assertEqual(
      markdownUtils.slugifyUnitHeading(2, turnHeading).slug,
      "nn-turn-01--architect",
      "the @## NN Turn 01: Architect pointer resolves to slug nn-turn-01--architect",
    );

    console.log(
      "--- Test 6c: Turn-structured fullText Promotion Verbatim + [none] unchanged ---",
    );
    const turnStructuredBody = [
      "## NN Turn 01: Architect",
      "Human turn content: clarify the budget field.",
      "",
      "## NN Turn 02: OpenCode",
      "Agent turn content: adding the budget field.",
      "",
    ].join("\n");
    const turnFullPromo = await conv.promoteConversation({
      workspaceRoot: TEST_TEMP,
      sessionFile: finalSession.filePath,
      titleSlug: "2026-09-06_api-gateway-refactor",
      format: "full",
      fullContent: turnStructuredBody,
    });
    assertEqual(
      turnFullPromo.promotedFiles.length,
      1,
      "turn-structured fullContent promotes exactly one _source.md",
    );
    const turnSourcePath = path.join(
      TEST_TEMP,
      "sources",
      "conversations",
      "2026-09-06_api-gateway-refactor_source.md",
    );
    const turnSourceContent = fs.readFileSync(turnSourcePath, "utf8");
    assertTrue(
      turnSourceContent.includes("## NN Turn 01: Architect"),
      "turn heading 01 written verbatim",
    );
    assertTrue(
      turnSourceContent.includes("## NN Turn 02: OpenCode"),
      "turn heading 02 written verbatim",
    );
    assertTrue(
      turnSourceContent.includes(
        "Human turn content: clarify the budget field.",
      ),
      "turn 01 body written verbatim",
    );
    assertTrue(
      turnSourceContent.includes(
        "origin_transcript: conversations/2026-09-06_api-gateway-refactor.md",
      ),
      "promoted file links the raw transcript via origin_transcript frontmatter",
    );

    const noneWithContent = await conv.promoteConversation({
      workspaceRoot: TEST_TEMP,
      sessionFile: finalSession.filePath,
      titleSlug: "2026-09-06_api-gateway-refactor",
      format: "none",
      fullContent: turnStructuredBody,
    });
    assertEqual(
      noneWithContent.promotedFiles.length,
      0,
      "[none] writes nothing even when fullContent is ready",
    );

    console.log("--- Test 7: CLI --promote-conv Integration ---");
    const cliTestDir = fs.mkdtempSync(path.join(os.tmpdir(), "conv-cli-test-"));
    const cliConvDir = path.join(cliTestDir, "conversations");
    fs.mkdirSync(cliConvDir, { recursive: true });
    const cliSessionPath = path.join(cliConvDir, "2026-09-06_cli-test.md");
    fs.writeFileSync(
      cliSessionPath,
      "# CLI Session\nDialogue turns here.",
      "utf8",
    );

    const indexScript = path.resolve(
      __dirname,
      "..",
      "..",
      "scripts",
      "index.js",
    );
    const cliRun = spawnSync(
      process.execPath,
      [
        indexScript,
        "--src",
        cliTestDir,
        "--promote-conv",
        "conversations/2026-09-06_cli-test.md",
        "--format",
        "full",
        "--slug",
        "cli-full-slug",
      ],
      { encoding: "utf8" },
    );

    assertEqual(
      cliRun.status,
      0,
      `CLI --promote-conv exits with code 0${
        cliRun.status === 0 ? "" : ` (stderr: ${String(cliRun.stderr).trim()})`
      }`,
    );
    assertTrue(
      fs.existsSync(
        path.join(
          cliTestDir,
          "sources",
          "conversations",
          "cli-full-slug_source.md",
        ),
      ),
      "CLI promoted _source.md file created",
    );
    fs.rmSync(cliTestDir, { recursive: true, force: true });

    fs.rmSync(TEST_TEMP, { recursive: true, force: true });
    console.log(
      `\nConversation lifecycle tests: ${passed} passed, ${failed} failed`,
    );
    return { passed, failed };
  } catch (err) {
    fs.rmSync(TEST_TEMP, { recursive: true, force: true });
    console.error(`  ERROR: ${err.message}`);
    console.error(err.stack);
    failed++;
    return { passed, failed };
  }
}

module.exports = { run };

if (require.main === module) {
  Promise.resolve(run()).then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}
