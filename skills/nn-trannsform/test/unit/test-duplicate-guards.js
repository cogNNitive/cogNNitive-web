const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const guards = require("../../scripts/lib/duplicate-guards");

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

  function gt(actual, bound, msg) {
    try {
      assert.ok(actual > bound);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg} (expected > ${bound}, got ${actual})`);
      failed++;
    }
  }

  // ── structuralSimilarity ─────────────────────────────────────────
  console.log("structuralSimilarity");
  {
    const a = "Revenue grew by 20 percent this quarter thanks to new customers";
    const b = "Revenue grew by 20 percent this quarter thanks to new customers";
    eq(guards.structuralSimilarity(a, b), 1, "identical text scores 1.0");
    const c = "This quarter revenue grew by 20 percent, thanks to new customers who joined";
    gt(guards.structuralSimilarity(a, c), 0.6, "same-substance restructured text scores high");
    eq(
      guards.structuralSimilarity("totally different topic about fishing rods", a) < 0.2,
      true,
      "unrelated text scores low",
    );
    eq(guards.structuralSimilarity("", "x"), 0, "empty input scores 0");
  }

  // ── detectDuplicates ─────────────────────────────────────────────
  console.log("detectDuplicates");
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dup-guard-"));
    try {
      const incoming = path.join(dir, "incoming.md");
      const exactCopy = path.join(dir, "existing-exact.md");
      const nearCopy = path.join(dir, "existing-near.md");
      const different = path.join(dir, "different.md");
      const body = "Quarterly revenue report for Q3: growth 20%, new customers 15, churn 3%.";
      fs.writeFileSync(incoming, body);
      fs.writeFileSync(exactCopy, body);
      fs.writeFileSync(
        nearCopy,
        "Report: quarterly revenue for Q3. Growth was 20 percent. We added 15 customers. Churn 3 percent. Summary of the quarterly revenue report for Q3 with growth 20, new customers 15, churn 3.",
      );
      fs.writeFileSync(different, "A completely unrelated note about the office plant watering schedule.");

      const corpus = [
        { path: exactCopy, sha256: guards.computeFileHash(exactCopy) },
        { path: nearCopy },
        { path: different },
      ];
      const res = guards.detectDuplicates(incoming, corpus, { contentLoader: (p) => fs.readFileSync(p, "utf8") });
      eq(res.exact.length, 1, "exact duplicate detected");
      eq(res.exact[0], exactCopy, "exact path reported");
      ok(res.near.some((n) => n.path === nearCopy), "near duplicate detected");
      ok(!res.near.some((n) => n.path === different), "different file not flagged");
      gt(res.near[0].score, 0.4, "near score above threshold");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── searchConversationHistory ────────────────────────────────────
  console.log("searchConversationHistory");
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "conv-guard-"));
    try {
      const convDir = path.join(dir, "conversations");
      fs.mkdirSync(convDir, { recursive: true });
      fs.writeFileSync(
        path.join(convDir, "2026-09-01_120000.md"),
        "# Q3 Revenue Report\n\nWe decided to archive the previous Q3 revenue report and reuse the normalized source.\n",
      );
      fs.writeFileSync(path.join(convDir, "2026-09-02_090000.md"), "# Board Notes\n\nUnrelated.\n");
      const hits = guards.searchConversationHistory(dir, { topic: "revenue report" });
      eq(hits.length, 1, "one conversation matches topic");
      eq(hits[0].title, "Q3 Revenue Report", "match title returned");
      ok(hits[0].excerpt && hits[0].excerpt.length > 0, "match excerpt returned");
      const miss = guards.searchConversationHistory(dir, { topic: "zebra migration" });
      eq(miss.length, 0, "no match for unrelated topic");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // ── indexWorkspaceSources & auditUncitedSources ──────────────────
  console.log("indexWorkspaceSources & auditUncitedSources");
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "src-dedup-"));
    try {
      const nnDir = path.join(dir, "sources", "nn");
      const sessionsDir = path.join(nnDir, "sessions");
      const importSessionsDir = path.join(nnDir, "import", "sessions");
      const modelsDir = path.join(dir, "models");

      fs.mkdirSync(sessionsDir, { recursive: true });
      fs.mkdirSync(importSessionsDir, { recursive: true });
      fs.mkdirSync(modelsDir, { recursive: true });

      const contentA = "---\nsource_file: \"sources/import/sessions/recording_1.txt\"\nsha256: \"abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789\"\n---\n# Recording 1\nContent of recording 1";
      const contentADup = "---\nsource_file: \"sources/import/sessions/recording_1.txt\"\nsha256: \"abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789\"\n---\n# Recording 1\nContent of recording 1";
      const contentB = "---\nsource_file: \"sources/import/sessions/recording_2.txt\"\nsha256: \"1111111111111111111111111111111111111111111111111111111111111111\"\n---\n# Recording 2\nContent of recording 2";
      const contentC_SameNameDiffHash = "---\nsource_file: \"sources/import/archive/recording_1.txt\"\nsha256: \"2222222222222222222222222222222222222222222222222222222222222222\"\n---\n# Old Recording 1\nDifferent content";

      fs.writeFileSync(path.join(sessionsDir, "recording_1.md"), contentA);
      fs.writeFileSync(path.join(importSessionsDir, "recording_1.md"), contentADup);
      fs.writeFileSync(path.join(sessionsDir, "recording_2.md"), contentB);
      fs.writeFileSync(path.join(nnDir, "recording_1_diff.md"), contentC_SameNameDiffHash);

      // 1. Indexing
      const index = guards.indexWorkspaceSources(dir);
      eq(index.sources.length, 4, "all 4 files discovered in sources/nn/");
      eq(index.canonicalSources.length, 3, "3 canonical sources (1 duplicate deduplicated)");
      eq(index.aliases.length, 1, "1 alias discovered");

      const primaryA = index.canonicalSources.find(s => s.rawSha256 === "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789" || s.relativePath === "sources/nn/sessions/recording_1.md");
      ok(primaryA, "primary canonical source found for hash A");
      eq(primaryA.relativePath, "sources/nn/sessions/recording_1.md", "non-import path wins as primary canonical");
      eq(primaryA.aliases.length, 1, "primary records 1 alias");
      eq(primaryA.aliases[0], "sources/nn/import/sessions/recording_1.md", "import path recorded as alias");

      // 2. Audit Uncited Sources - no citations yet
      const auditNoCite = guards.auditUncitedSources(dir);
      eq(auditNoCite.totalSources, 4, "total sources count is 4");
      eq(auditNoCite.canonicalCount, 3, "canonical count is 3");
      eq(auditNoCite.aliasCount, 1, "alias count is 1");
      eq(auditNoCite.uncitedCount, 3, "uncited count reports 3 canonicals (duplicate suppressed from backlog)");
      ok(auditNoCite.uncitedSources.some(s => s.path === "sources/nn/sessions/recording_1.md"), "canonical recording_1 in uncited backlog");
      ok(!auditNoCite.uncitedSources.some(s => s.path === "sources/nn/import/sessions/recording_1.md"), "alias import recording_1 suppressed from uncited backlog");

      // 3. Model cites canonical source
      const modelContent = "---\nlevel: 3\n---\n# NN index\n* [[Concept1]]\n\n# NN Concept1\nsources:: [sources/nn/sessions/recording_1.md]\n";
      fs.writeFileSync(path.join(modelsDir, "Model_V_0-1-0_NN.md"), modelContent);

      const auditWithCite = guards.auditUncitedSources(dir);
      eq(auditWithCite.citedCount, 1, "1 canonical source cited");
      eq(auditWithCite.uncitedCount, 2, "2 remaining uncited canonical sources");
      ok(!auditWithCite.uncitedSources.some(s => (s.rawSha256 || s.sha256) === "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789" || s.path === "sources/nn/sessions/recording_1.md"), "cited source and its alias suppressed from uncited");
      const citedItem = auditWithCite.citedSources.find(s => (s.rawSha256 || s.sha256) === "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789" || s.path === "sources/nn/sessions/recording_1.md");
      ok(citedItem, "cited source reported in citedSources");
      eq(citedItem.aliases[0], "sources/nn/import/sessions/recording_1.md", "cited source includes its alias list");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const result = run();
  process.exit(result.failed > 0 ? 1 : 0);
}