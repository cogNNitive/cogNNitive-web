const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const scanner = require('../../scripts/scanner');
const guards = require('../../scripts/lib/duplicate-guards');

const TEST_TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'import-guards-test-'));

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function sidecarOf(rel) {
  return `${rel.split('/').pop()}_sidecar_NN.md`;
}

async function run() {
  let passed = 0;
  let failed = 0;

  function equal(actual, expected, msg) {
    try {
      assert.deepStrictEqual(actual, expected);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg}`);
      console.log(`    Expected: ${JSON.stringify(expected)}`);
      console.log(`    Actual:   ${JSON.stringify(actual)}`);
      failed++;
    }
  }

  function ok(actual, msg) {
    equal(Boolean(actual), true, msg);
  }

  try {
    // ── guardIncomingSource (pure) ───────────────────────────────────
    console.log('guardIncomingSource');
    {
      const ws = path.join(TEST_TEMP, 'guard-workspace');
      const body = 'Quarterly revenue report for Q3: growth 20%, new customers 15, churn 3%.';
      write(path.join(ws, 'sources', 'import', 'report_q3.md'), body);
      await scanner.scanAndProcess(ws, { autoAcceptPrompt: true });

      const exactCopy = path.join(ws, 'sources', 'import', 'report_q3_copy.md');
      write(exactCopy, body);
      const exactVerdict = guards.guardIncomingSource(ws, {
        absPath: exactCopy,
        relPath: 'sources/import/report_q3_copy.md',
      });
      ok(exactVerdict.flagged, 'an identical incoming source is flagged');
      equal(exactVerdict.duplicate.exact, ['sources/import/report_q3.md'], 'the exact hit names the existing source');
      equal(guards.defaultDuplicateDecision(exactVerdict), 'reuse', 'an exact duplicate defaults to reuse');

      const nearCopy = path.join(ws, 'sources', 'import', 'report_q3_summary.md');
      write(
        nearCopy,
        'Report: quarterly revenue for Q3. Growth was 20 percent. We added 15 customers. Churn 3 percent. Summary of the quarterly revenue report for Q3 with growth 20, new customers 15, churn 3.',
      );
      const nearVerdict = guards.guardIncomingSource(ws, {
        absPath: nearCopy,
        relPath: 'sources/import/report_q3_summary.md',
      });
      ok(nearVerdict.flagged, 'a near duplicate is flagged');
      equal(nearVerdict.duplicate.exact, [], 'a near duplicate is not an exact duplicate');
      equal(nearVerdict.duplicate.near[0].path, 'sources/import/report_q3.md', 'the near hit names the existing source');
      ok(nearVerdict.duplicate.near[0].score > 0.5, 'the near hit carries its score');
      equal(guards.defaultDuplicateDecision(nearVerdict), 'adjust', 'a near duplicate defaults to adjust');

      const fresh = path.join(ws, 'sources', 'import', 'unrelated.md');
      write(fresh, 'A completely unrelated note about the office plant watering schedule.');
      const freshVerdict = guards.guardIncomingSource(ws, {
        absPath: fresh,
        relPath: 'sources/import/unrelated.md',
      });
      equal(freshVerdict.flagged, false, 'an unrelated incoming source is not flagged');

      // A source is never its own duplicate, even after its bytes change.
      const editedPath = path.join(ws, 'sources', 'import', 'report_q3.md');
      write(editedPath, `${body} Revised draft.`);
      const editedVerdict = guards.guardIncomingSource(ws, {
        absPath: editedPath,
        relPath: 'sources/import/report_q3.md',
      });
      ok(!editedVerdict.duplicate.exact.includes('sources/import/report_q3.md'), 'a source never matches its own sidecar');
    }

    // ── history guard ────────────────────────────────────────────────
    console.log('guardIncomingSource — conversation history');
    {
      const ws = path.join(TEST_TEMP, 'guard-history');
      write(
        path.join(ws, 'conversations', '2026-09-01_120000.md'),
        '# Q3 Revenue Report\n\nWe decided to reuse the normalized report_q3_notes source.\n',
      );
      write(
        path.join(ws, 'sources', 'conversations', '2026-09-02_090000.md'),
        '# Board Notes\n\nThe report_q3_notes file was already handled last week.\n',
      );
      const incoming = path.join(ws, 'sources', 'import', 'report_q3_notes.md');
      write(incoming, '# Notes\n\nSome fresh content nobody wrote before.\n');
      const verdict = guards.guardIncomingSource(ws, {
        absPath: incoming,
        relPath: 'sources/import/report_q3_notes.md',
      });
      ok(verdict.flagged, 'a prior handling flags the incoming source');
      equal(verdict.history.length, 2, 'both transcript roots are searched');
      ok(
        verdict.history.every((h) => h.file.startsWith('conversations/') || h.file.startsWith('sources/conversations/')),
        'history hits carry workspace-relative paths',
      );
      ok(verdict.history.some((h) => h.title === 'Q3 Revenue Report'), 'history hits carry the transcript title');
    }

    // ── scanner wiring ──────────────────────────────────────────────
    console.log('scanner — import guard wiring');
    {
      const proj = path.join(TEST_TEMP, 'scan-project');
      const importDir = path.join(proj, 'sources', 'import');
      const body = 'Quarterly revenue report for Q3: growth 20%, new customers 15, churn 3%.';
      write(path.join(importDir, 'report_q3.md'), body);

      const first = await scanner.scanAndProcess(proj, { autoAcceptPrompt: true });
      equal(first.processedCount, 1, 'the first source is cognitivized');

      // Exact duplicate: reused, no second sidecar, no prompt needed.
      write(path.join(importDir, 'report_q3_copy.md'), body);
      const reuseRun = await scanner.scanAndProcess(proj, { autoAcceptPrompt: true });
      const copyEntry = reuseRun.registry.find((r) => r.name === 'sources/import/report_q3_copy.md');
      equal(copyEntry.status, '↩️ Reused', 'an identical incoming source is reused');
      equal(copyEntry.importGuard.decision, 'reuse', 'the registry records the reuse decision');
      equal(reuseRun.processedCount, 1, 'only the already up-to-date source counts as processed');
      ok(!fs.existsSync(path.join(importDir, sidecarOf('report_q3_copy.md'))), 'no sidecar is written for a reused source');

      // Adjust: the incoming source is normalised and says so.
      const decisions = [];
      const adjustRun = await scanner.scanAndProcess(proj, {
        autoAcceptPrompt: true,
        duplicatePrompt: async (sourceFile, verdict, choices) => {
          decisions.push({ sourceFile, exact: verdict.duplicate.exact, recommended: choices.recommended });
          return 'adjust';
        },
      });
      equal(decisions.length, 1, 'the guard asks about the flagged source only');
      equal(decisions[0].sourceFile, 'sources/import/report_q3_copy.md', 'the prompt names the incoming source');
      equal(decisions[0].recommended, 'reuse', 'the prompt reports reuse as the recommended answer for a duplicate');
      const adjustedEntry = adjustRun.registry.find((r) => r.name === 'sources/import/report_q3_copy.md');
      equal(adjustedEntry.importGuard.decision, 'adjust', 'the adjust answer is recorded');
      ok(/Import guard: adjusted/.test(adjustedEntry.action), 'the adjust note reaches the registry line');
      ok(fs.existsSync(path.join(importDir, sidecarOf('report_q3_copy.md'))), 'adjusting normalises the incoming source');

      // From scratch: the incoming source is normalised without the adjust note.
      const ws = path.join(TEST_TEMP, 'scratch-project');
      const scratchImport = path.join(ws, 'sources', 'import');
      write(path.join(scratchImport, 'report_q3.md'), body);
      await scanner.scanAndProcess(ws, { autoAcceptPrompt: true });
      write(path.join(scratchImport, 'report_q3_again.md'), body);
      const scratchRun = await scanner.scanAndProcess(ws, {
        autoAcceptPrompt: true,
        duplicatePrompt: async () => 'scratch',
      });
      const scratchEntry = scratchRun.registry.find((r) => r.name === 'sources/import/report_q3_again.md');
      equal(scratchEntry.importGuard.decision, 'scratch', 'the from-scratch answer is recorded');
      ok(/Import guard: from scratch/.test(scratchEntry.action), 'the from-scratch note reaches the registry line');
      ok(fs.existsSync(path.join(scratchImport, sidecarOf('report_q3_again.md'))), 'from scratch normalises the incoming source');

      // An up-to-date source never reaches the guard.
      let asked = 0;
      const stableRun = await scanner.scanAndProcess(ws, {
        autoAcceptPrompt: true,
        duplicatePrompt: async () => {
          asked++;
          return 'reuse';
        },
      });
      equal(asked, 0, 'a rescan of up-to-date sources asks nothing');
      equal(stableRun.refreshed, [], 'a rescan of up-to-date sources refreshes nothing');
      ok(!stableRun.registry.some((r) => r.importGuard), 'no guard verdict is recorded for an up-to-date source');
      ok(stableRun.registry.every((r) => r.status === '✅ Processed'), 'up-to-date sources still report as processed');

      // A changed source is incoming, so it is guarded and its own previous
      // sidecar is still not a duplicate of itself.
      write(path.join(scratchImport, 'report_q3.md'), `${body} Revised draft.`);
      const refreshRun = await scanner.scanAndProcess(ws, { autoAcceptPrompt: true });
      const refreshed = refreshRun.registry.find((r) => r.name === 'sources/import/report_q3.md');
      equal(refreshed.status, '✅ Processed', 'a changed source is still refreshed');
      ok(refreshRun.refreshed.includes('sources/import/report_q3.md'), 'the refresh is reported');

      // Opt-out: no guard runs at all.
      const optOutProj = path.join(TEST_TEMP, 'optout-project');
      const optOutImport = path.join(optOutProj, 'sources', 'import');
      write(path.join(optOutImport, 'a.md'), body);
      await scanner.scanAndProcess(optOutProj, { autoAcceptPrompt: true });
      write(path.join(optOutImport, 'b.md'), body);
      let optOutAsked = 0;
      const optOutRun = await scanner.scanAndProcess(optOutProj, {
        autoAcceptPrompt: true,
        duplicateGuard: false,
        duplicatePrompt: async () => {
          optOutAsked++;
          return 'reuse';
        },
      });
      equal(optOutAsked, 0, 'duplicateGuard:false never asks');
      ok(
        fs.existsSync(path.join(optOutImport, sidecarOf('b.md'))),
        'duplicateGuard:false normalises the duplicate as before',
      );
      const optOutB = optOutRun.registry.find((r) => r.name === 'sources/import/b.md');
      equal(optOutB.status, '✅ Processed', 'the duplicate is processed when the guard is disabled');
    }

    // ── prompt fallback ─────────────────────────────────────────────
    console.log('scanner — import guard prompt answers');
    {
      const proj = path.join(TEST_TEMP, 'fallback-project');
      const importDir = path.join(proj, 'sources', 'import');
      const body = 'Shared content that appears twice in the same import batch.';
      write(path.join(importDir, 'first.md'), body);
      write(path.join(importDir, 'second.md'), body);

      // The batch itself is guarded: the second file reuses the first one's source.
      const run = await scanner.scanAndProcess(proj, { autoAcceptPrompt: true });
      equal(run.processedCount, 1, 'only the first of two identical files is normalised');      const second = run.registry.find((r) => r.name === 'sources/import/second.md');
      equal(second.importGuard.exact, ['sources/import/first.md'], 'the batch duplicate is detected');

      // An unknown prompt answer falls back to the deterministic default.
      write(path.join(importDir, 'third.md'), body);
      const unknownRun = await scanner.scanAndProcess(proj, {
        autoAcceptPrompt: true,
        duplicatePrompt: async () => 'maybe',
      });
      const third = unknownRun.registry.find((r) => r.name === 'sources/import/third.md');
      equal(third.importGuard.decision, 'reuse', 'an unusable prompt answer falls back to the default');
      ok(!fs.existsSync(path.join(importDir, sidecarOf('third.md'))), 'the fallback default still writes no duplicate sidecar');
    }
  } catch (err) {
    console.log(`  FAIL: import guards test threw: ${err.stack}`);
    failed++;
  } finally {
    fs.rmSync(TEST_TEMP, { recursive: true, force: true });
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  run().then((result) => process.exit(result.failed > 0 ? 1 : 0));
}
