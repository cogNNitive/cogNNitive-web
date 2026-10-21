/**
 * skills/nn/skill-menu.test.js
 *
 * Guards the discoverability contract added by the `watch-roots-discoverability`
 * change: the entry menu must surface external watch roots contextually, list the
 * capability in Help, and invoke the read-only session-start digest — all without
 * changing the `[s][m][r][p][h][x]` shape.
 *
 * Zero external test framework dependencies (runs with plain node).
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SKILL = fs.readFileSync(path.join(__dirname, 'SKILL.md'), 'utf8');

/** Matches for a pattern, so a planted case can prove the guard goes red. */
function hits(text, re) {
  return text.match(re) || [];
}

async function runTests() {
  console.log('Running nn skill-menu tests...');
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✔ ${name}`);
      passed++;
    } catch (err) {
      console.error(`✖ ${name}`);
      console.error(err);
      failed++;
    }
  };

  await test('branches on the probe signal watch_roots.declared', async () => {
    assert.ok(hits(SKILL, /watch_roots\.declared/).length > 0, 'SKILL.md must branch on watch_roots.declared');
  });

  await test('Sources offers a contextual scan sub-option', async () => {
    assert.ok(hits(SKILL, /[Ss]can external watch roots/).length > 0, 'SKILL.md must offer scanning external watch roots');
  });

  await test('Sources offers to declare a root when none exist', async () => {
    assert.ok(hits(SKILL, /[Dd]eclare a watch root/).length > 0, 'SKILL.md must offer declaring a watch root');
  });

  await test('Help lists the watched-folders capability', async () => {
    assert.ok(hits(SKILL, /[Ww]atched folders/).length > 0, 'Help must list the watched-folders capability');
  });

  await test('session start invokes the read-only digest', async () => {
    assert.ok(hits(SKILL, /--watch-digest/).length > 0, 'SKILL.md must invoke --watch-digest at session start');
  });

  await test('the top-level menu shape is preserved', async () => {
    assert.ok(hits(SKILL, /\[s\]\[m\]\[r\]\[p\]\[h\]\[x\]/).length > 0, 'the [s][m][r][p][h][x] shape must be documented');
  });

  await test('the guard can go red: a planted marker is flagged', async () => {
    const planted = 'this text has no watch-root surfacing at all';
    assert.strictEqual(hits(planted, /[Ss]can external watch roots/).length, 0, 'the scanner must flag a text without the sub-option');
    assert.strictEqual(hits(planted, /--watch-digest/).length, 0, 'the scanner must flag a text without the digest');
  });

  console.log(`\nAll nn skill-menu tests finished: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
