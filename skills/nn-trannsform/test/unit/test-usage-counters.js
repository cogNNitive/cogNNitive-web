const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const counters = require("../../scripts/lib/usage-counters");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "trannsform-counters-"));

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
    // Measurement gate: append one call, read it back.
    const file = path.join(TMP, "session.jsonl");
    const entry = counters.recordUsage(file, {
      intent: "surgical",
      inputTokens: 800,
      outputTokens: 200,
    });
    eq(entry.intent, "surgical", "recordUsage echoes the declared intent");
    eq(
      entry.inputTokens + entry.outputTokens,
      1000,
      "recordUsage preserves token counts",
    );
    const lines = fs.readFileSync(file, "utf8").trim().split("\n");
    eq(lines.length, 1, "recordUsage appends exactly one JSONL line");
    eq(
      JSON.parse(lines[0]).intent,
      "surgical",
      "appended JSONL line carries the intent",
    );

    // Spec scenario "Budget concentrated in few coach calls": mixed session tallies.
    const mixed = path.join(TMP, "mixed.jsonl");
    counters.recordUsage(mixed, {
      intent: "coach",
      inputTokens: 9000,
      outputTokens: 3000,
    });
    counters.recordUsage(mixed, {
      intent: "coach",
      inputTokens: 6000,
      outputTokens: 2000,
    });
    for (let i = 0; i < 8; i++) {
      counters.recordUsage(mixed, {
        intent: "surgical",
        inputTokens: 800,
        outputTokens: 200,
      });
    }
    for (let i = 0; i < 6; i++) {
      counters.recordUsage(mixed, {
        intent: "verify",
        inputTokens: 150,
        outputTokens: 50,
      });
    }
    const tally = counters.tallyByIntent(mixed);
    eq(tally.coach.calls, 2, "tally counts few coach calls");
    eq(tally.surgical.calls, 8, "tally counts majority surgical calls");
    eq(tally.coach.totalTokens, 20000, "tally sums coach tokens");
    eq(tally.surgical.totalTokens, 8000, "tally sums surgical tokens");
    ok(
      tally.coach.calls < tally.surgical.calls,
      "coach calls are fewer than surgical calls",
    );
    ok(
      tally.coach.totalTokens >
        tally.surgical.totalTokens + tally.verify.totalTokens,
      "costly context concentrates in few coach calls while surgical/verify stay cheap",
    );

    // Spec scenario "Before-vs-after benchmark recorded": reduction across runs.
    const before = path.join(TMP, "before.jsonl");
    const after = path.join(TMP, "after.jsonl");
    counters.recordUsage(before, {
      intent: "surgical",
      inputTokens: 4000,
      outputTokens: 1000,
    });
    counters.recordUsage(after, {
      intent: "surgical",
      inputTokens: 800,
      outputTokens: 200,
    });
    const summary = counters.summarizeReduction(
      counters.tallyByIntent(before),
      counters.tallyByIntent(after),
    );
    eq(
      summary.perIntent.surgical.tokensBefore,
      5000,
      "benchmark records before tokens per intent",
    );
    eq(
      summary.perIntent.surgical.tokensAfter,
      1000,
      "benchmark records after tokens per intent",
    );
    eq(
      summary.perIntent.surgical.tokenReduction,
      0.8,
      "benchmark records the measured reduction",
    );
    ok(
      summary.totalReduction > 0,
      "benchmark records a positive total reduction",
    );

    // Triangulation: different paths — empty file, invalid input, location decision.
    const missing = counters.tallyByIntent(
      path.join(TMP, "does-not-exist.jsonl"),
    );
    eq(
      missing.coach.calls,
      0,
      "tally of a missing file yields zero coach calls",
    );
    eq(
      missing.surgical.totalTokens,
      0,
      "tally of a missing file yields zero surgical tokens",
    );

    let threwIntent = false;
    try {
      counters.recordUsage(path.join(TMP, "bad.jsonl"), {
        intent: "reason",
        inputTokens: 1,
        outputTokens: 1,
      });
    } catch (e) {
      threwIntent = true;
    }
    eq(threwIntent, true, "recordUsage rejects an unknown intent");

    let threwTokens = false;
    try {
      counters.recordUsage(path.join(TMP, "bad.jsonl"), {
        intent: "verify",
        inputTokens: -5,
        outputTokens: 0,
      });
    } catch (e) {
      threwTokens = true;
    }
    eq(threwTokens, true, "recordUsage rejects negative token counts");

    const defPath = counters.defaultUsagePath("promo-1");
    eq(
      path.dirname(defPath),
      os.tmpdir(),
      "default counters file lives under the OS temp dir, never the repo tree",
    );
    ok(
      defPath.endsWith(".jsonl"),
      "default counters file is a JSONL session file",
    );
    eq(
      counters.resolveUsagePath(".cogNNitive/usage.jsonl", "promo-1"),
      ".cogNNitive/usage.jsonl",
      "an explicit workspace path is honored only when the caller opts in",
    );

    fs.rmSync(TMP, { recursive: true, force: true });
    console.log(`\n  Usage-counters tests: ${passed} passed, ${failed} failed`);
  } catch (e) {
    fs.rmSync(TMP, { recursive: true, force: true });
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
