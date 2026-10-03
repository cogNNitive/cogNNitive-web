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

  // ── indexWorkspaceSources & auditUncitedSources (co-located sidecars) ──
  console.log("indexWorkspaceSources & auditUncitedSources");
  {
    const crypto = require("crypto");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "src-dedup-"));
    try {
      const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
      // A raw file plus its co-located sidecar; `body` is only present for binary subjects.
      const seed = (rel, bytes, body = "") => {
        const raw = path.join(dir, rel);
        fs.mkdirSync(path.dirname(raw), { recursive: true });
        fs.writeFileSync(raw, bytes);
        fs.writeFileSync(
          `${raw}_sidecar_NN.md`,
          `---\nlevel: 3\nparent_spec:\n  name: sidecar\nsource_file: ${rel}\nsha256: ${sha(bytes)}\nsize_bytes: ${bytes.length}\nnormalized_at: 2026-10-02T10:15:00Z\n---\n${body ? `\n${body}\n` : ""}`,
        );
      };
      seed("sources/import/sessions/recording_1.md", "# Recording 1\nContent of recording 1");
      seed("sources/import/sessions/copy_of_recording_1.md", "# Recording 1\nContent of recording 1");
      seed("sources/import/sessions/recording_2.md", "# Recording 2\nContent of recording 2");
      seed("sources/import/recording_1_diff.md", "# Old Recording 1\nDifferent content");
      fs.mkdirSync(path.join(dir, "kNNowledge"), { recursive: true });

      // 1. Indexing groups sources by the sidecar sha256 of the raw bytes
      const index = guards.indexWorkspaceSources(dir);
      eq(index.sources.length, 4, "the 4 raw files with sidecars are indexed");
      ok(!index.sources.some((s) => /_sidecar_NN\.md$/.test(s.relativePath)), "sidecars are not indexed as sources");
      eq(index.canonicalSources.length, 3, "3 canonical sources (identical raw bytes grouped)");
      eq(index.aliases.length, 1, "1 alias discovered");
      const primary = index.canonicalSources.find((s) => s.relativePath === "sources/import/sessions/recording_1.md");
      ok(primary, "the shortest path is the canonical one");
      eq(primary.aliases[0], "sources/import/sessions/copy_of_recording_1.md", "the longer path is recorded as alias");
      eq(primary.sidecarPath, "sources/import/sessions/recording_1.md_sidecar_NN.md", "the entry names its co-located sidecar");

      // 2. Audit with no citations yet
      const auditNoCite = guards.auditUncitedSources(dir);
      eq(auditNoCite.totalSources, 4, "total sources count is 4");
      eq(auditNoCite.uncitedCount, 3, "uncited count reports 3 canonicals (duplicate suppressed)");
      ok(!auditNoCite.uncitedSources.some((s) => s.path === "sources/import/sessions/copy_of_recording_1.md"), "the alias is suppressed from the backlog");

      // 3. A model cites the canonical source by its plain domaiNN-relative path
      fs.writeFileSync(
        path.join(dir, "kNNowledge", "Model_business_NN.md"),
        "---\nlevel: 3\n---\n# NN index\n* [[Concept1]]\n\n# NN Concept1\nsources:: [sources/import/sessions/recording_1.md@## Recording 1]\n",
      );
      const auditWithCite = guards.auditUncitedSources(dir);
      eq(auditWithCite.citedCount, 1, "1 canonical source cited");
      eq(auditWithCite.uncitedCount, 2, "2 remaining uncited canonical sources");
      const citedItem = auditWithCite.citedSources[0];
      eq(citedItem.path, "sources/import/sessions/recording_1.md", "the cited source is reported");
      eq(citedItem.aliases[0], "sources/import/sessions/copy_of_recording_1.md", "the cited source includes its alias list");

      // 4. Citing a binary subject goes through its sidecar path
      seed("sources/import/report.pdf", Buffer.from("%PDF-1.7 binary"), "# Summary\nBody of the report");
      fs.writeFileSync(
        path.join(dir, "kNNowledge", "Other_business_NN.md"),
        "---\nlevel: 3\n---\n# NN Concept2\nsources:: [sources/import/report.pdf_sidecar_NN.md@## Summary]\n",
      );
      const auditPdf = guards.auditUncitedSources(dir);
      ok(auditPdf.citedSources.some((s) => s.path === "sources/import/report.pdf"), "a sidecar citation counts for its subject");
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