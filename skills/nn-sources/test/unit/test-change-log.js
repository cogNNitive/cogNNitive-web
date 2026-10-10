const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const changeLog = require("../../scripts/lib/change-log");

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

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "change-log-"));
  try {
    // ── recordChange / readChangeLog ─────────────────────────────
    console.log("recordChange / readChangeLog");
    const e1 = changeLog.recordChange(dir, {
      id: "c1",
      type: "update",
      actor: "alice",
      owner: "alice",
      scope: ["unit-a", "unit-b"],
      summary: "Re-scoped metrics",
      timestamp: "2026-09-05T10:00:00Z",
    });
    ok(e1.id === "c1", "entry returned with explicit id");
    const e2 = changeLog.recordChange(dir, {
      type: "create",
      actor: "bob",
      owner: "bob",
      scope: ["unit-c"],
      summary: "New knowledge unit",
      timestamp: "2026-08-20T12:00:00Z",
    });
    ok(e2.id && typeof e2.id === "string" && e2.id.length > 0, "auto id generated when omitted");
    const all = changeLog.readChangeLog(dir);
    eq(all.length, 2, "both entries read back");
    eq(all[0].type, "update", "oldest first");

    // ── entriesForUnit ───────────────────────────────────────────
    console.log("entriesForUnit");
    const unitA = changeLog.entriesForUnit(all, "unit-a");
    eq(unitA.length, 1, "unit-a has one entry");
    const unitC = changeLog.entriesForUnit(all, "unit-c");
    eq(unitC.length, 1, "unit-c has one entry");
    const missing = changeLog.entriesForUnit(all, "unit-z");
    eq(missing.length, 0, "unknown unit has no entries");

    // ── renderMonthlyReport ──────────────────────────────────────
    console.log("renderMonthlyReport");
    const sep = changeLog.renderMonthlyReport(dir, { owner: "alice", month: "2026-09" });
    ok(sep.includes("Monthly change report — alice"), "report header names the owner");
    ok(sep.includes("unit-a, unit-b"), "report lists scoped units");
    ok(sep.includes("Total: 1 change(s)."), "report totals for the month");
    const empty = changeLog.renderMonthlyReport(dir, { owner: "bob", month: "2026-09" });
    ok(empty.includes("No changes recorded"), "empty month reported clearly");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const result = run();
  process.exit(result.failed > 0 ? 1 : 0);
}