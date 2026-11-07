/**
 * skills/nn/skill-menu.test.js
 *
 * Guards the entry menu contract of the `domain-synchronizations` change: no watch
 * root or session-start digest surfacing remains, Help lists the explicit
 * Synchronizations capability, and the `[s][m][r][p][h][x]` shape is unchanged.
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

  await test('the menu no longer surfaces watch roots or the session-start digest', async () => {
    assert.strictEqual(hits(SKILL, /watch_roots/).length, 0, 'SKILL.md must not branch on watch_roots');
    assert.strictEqual(hits(SKILL, /--watch-digest|--scan-external|--digest-decide/).length, 0, 'SKILL.md must not invoke removed flags');
    assert.strictEqual(hits(SKILL, /[Ww]atch(ed)? (roots?|folders)/).length, 0, 'SKILL.md must not mention watch roots or watched folders');
  });

  await test('Help lists the Synchronizations capability and its explicit command', async () => {
    assert.ok(hits(SKILL, /\*\*Synchronizations\*\*/).length > 0, 'Help must list the Synchronizations capability');
    assert.ok(hits(SKILL, /--sync \[alias\]/).length > 0, 'Help must name the explicit --sync [alias] command');
  });

  await test('the top-level menu shape is preserved', async () => {
    assert.ok(['s', 'm', 'r', 'p', 'h', 'x'].every((k) => hits(SKILL, new RegExp('^\\[' + k + '\\] ', 'm')).length > 0), 'the [s][m][r][p][h][x] menu lines must be documented');
  });

  await test('the guard can go red: a planted marker is flagged', async () => {
    const planted = 'Scan external watch roots with --watch-digest';
    assert.strictEqual(hits(planted, /--watch-digest/).length, 1, 'the scanner must flag a text that still invokes a removed flag');
    assert.strictEqual(hits(planted, /[Ww]atch(?:ed)? (?:roots?|folders)/).length, 1, 'the scanner must flag leftover watch-root wording');
    assert.strictEqual(hits('no synchronization here', /--sync \[alias\]/).length, 0, 'the scanner must flag a Help without --sync');
  });

  console.log(`\nAll nn skill-menu tests finished: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
