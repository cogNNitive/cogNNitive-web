const assert = require("assert");

const matcher = require("../../scripts/lib/score-matcher");

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
    // Spec scenario "Confident pairs link automatically": near-identical pair scores high and links.
    const sources = [
      { id: "src-ghost", text: "paranormal infestation removal ghost trap" },
      { id: "src-revenue", text: "quarterly revenue forecast" },
    ];
    const elements = [
      {
        id: "el-ghost",
        text: "paranormal infestation removal ghost trap containment",
      },
      { id: "el-severity", text: "severity classification scale" },
    ];
    const result = matcher.scorePairs(sources, elements, { threshold: 0.7 });
    const ghostLink = result.links.find((l) => l.sourceId === "src-ghost");
    ok(Boolean(ghostLink), "confident pair links automatically");
    eq(
      ghostLink.elementId,
      "el-ghost",
      "confident pair links to the best element",
    );
    ok(
      ghostLink.score >= 0.7,
      "each linked pair carries a recorded score at or above threshold",
    );
    ok(typeof ghostLink.score === "number", "link score is a recorded number");

    // Spec scenario "Unmatched source is queued, never dropped".
    const queued = result.queue.find((q) => q.sourceId === "src-revenue");
    ok(
      Boolean(queued),
      "source below threshold for every element is queued for review",
    );
    eq(queued.status, "pending", "queued pair waits with pending status");
    const accounted = new Set([
      ...result.links.map((l) => l.sourceId),
      ...result.queue.map((q) => q.sourceId),
    ]);
    ok(
      sources.every((s) => accounted.has(s.id)),
      "every source is either linked or queued — none silently excluded",
    );
    ok(
      result.links.every((l) => l.sourceId !== "src-revenue"),
      "unmatched source never appears as a link",
    );

    // Triangulation: boundary, custom threshold, degenerate inputs, determinism.
    eq(
      matcher.scorePair("ghost trap", "ghost trap"),
      1,
      "identical texts score 1",
    );
    eq(
      matcher.scorePair("quarterly revenue", "ghost trap"),
      0,
      "disjoint texts score 0",
    );
    eq(
      matcher.scorePair("", ""),
      0,
      "vacuous empty pair scores 0 and never links",
    );

    const boundary = matcher.scorePairs(
      [{ id: "src-b", text: "alpha beta gamma delta epsilon zeta eta" }],
      [
        {
          id: "el-b",
          text: "alpha beta gamma delta epsilon zeta eta theta iota kappa",
        },
      ],
      { threshold: 0.7 },
    );
    eq(
      boundary.links.length,
      1,
      "a pair scoring exactly 0.7 links on the >= boundary",
    );
    eq(boundary.links[0].score, 0.7, "boundary score is recorded exactly");

    const strict = matcher.scorePairs(sources, elements, { threshold: 0.95 });
    ok(
      strict.queue.some((q) => q.sourceId === "src-ghost"),
      "a confident pair queues under a stricter custom threshold",
    );
    const loose = matcher.scorePairs(sources, elements, { threshold: 0.1 });
    ok(
      loose.links.some((l) => l.sourceId === "src-ghost"),
      "the same pair still links under a looser custom threshold",
    );

    const noElements = matcher.scorePairs(
      [{ id: "src-lonely", text: "ghost trap" }],
      [],
    );
    eq(noElements.links.length, 0, "no elements yields no links");
    eq(
      noElements.queue.length,
      1,
      "a source with no elements is queued, never dropped",
    );
    eq(
      noElements.queue[0].reason,
      "no-elements",
      "empty element set records its reason",
    );

    const again = matcher.scorePairs(sources, elements, { threshold: 0.7 });
    eq(
      JSON.stringify(again),
      JSON.stringify(result),
      "scoring is deterministic across runs",
    );

    // Reviewer workflow tests (robustness-coda 1.5)
    const reviewResult = matcher.scorePairs(
      [{ id: "src-doubtful", text: "ghost removal" }],
      [{ id: "el-ghost", text: "paranormal ghost containment" }],
      { threshold: 0.9 }, // forces into queue
    );
    eq(reviewResult.queue.length, 1, "doubtful pair queues under strict threshold");
    
    // Undecided path
    const undecided = matcher.applyReviewDecision(reviewResult, "src-doubtful", "undecided");
    eq(undecided.queue.length, 1, "undecided pairs stay queued");
    eq(undecided.queue[0].status, "pending", "undecided queue item retains pending status");
    eq(undecided.links.length, 0, "undecided pair produces no links");

    // Reject path
    const rejected = matcher.applyReviewDecision(reviewResult, "src-doubtful", "reject");
    eq(rejected.queue.length, 0, "rejected pair is removed from queue");
    eq(rejected.links.length, 0, "rejected pair produces no links");

    // Confirm path
    const confirmed = matcher.applyReviewDecision(reviewResult, "src-doubtful", "confirm", { elementId: "el-ghost" });
    eq(confirmed.queue.length, 0, "confirmed pair is removed from queue");
    eq(confirmed.links.length, 1, "confirmed pair produces a link");
    eq(confirmed.links[0].sourceId, "src-doubtful", "confirmed link has correct sourceId");
    eq(confirmed.links[0].elementId, "el-ghost", "confirmed link has correct elementId");

    console.log(`\n  Score-matcher tests: ${passed} passed, ${failed} failed`);
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
