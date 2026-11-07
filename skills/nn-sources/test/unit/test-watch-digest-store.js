const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  statePath,
  loadState,
  saveState,
  serializeState,
  getConvergence,
  recordConvergence,
  ignoredShas,
} = require('../../scripts/lib/watch-digest-store');

/**
 * The state file now only holds convergence records and the hashes a user has
 * ignored; the watch digest that used to share it is gone.
 */
async function run() {
  let passed = 0;
  let failed = 0;

  function it(desc, fn) {
    try {
      fn();
      console.log(`  ✔ ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ ${desc}`);
      console.error(err);
      failed++;
    }
  }

  function withDir(prefix, fn) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    try {
      fn(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log('\n--- test-watch-digest-store ---');

  it('missing state file loads as empty and is not created by a read', () => {
    withDir('state-empty-', (dir) => {
      const state = loadState(dir);
      assert.deepStrictEqual(state.items, {});
      assert.deepStrictEqual(state.convergence, {});
      assert.strictEqual(fs.existsSync(statePath(dir)), false);
      assert.deepStrictEqual(fs.readdirSync(dir), [], 'a read writes nothing to the workspace');
    });
  });

  it('writing the same state twice is byte-idempotent', () => {
    withDir('state-idem-', (dir) => {
      const state = {
        items: {
          'b::x::2': { status: 'postpone', decidedAt: '2026-09-30T12:00:00Z', note: '' },
          'a::x::1': { status: 'ignore', decidedAt: '2026-09-30T12:00:00Z', note: '' },
        },
      };
      saveState(dir, state);
      const first = fs.readFileSync(statePath(dir), 'utf8');
      saveState(dir, { items: { ...state.items } });
      assert.strictEqual(first, fs.readFileSync(statePath(dir), 'utf8'));
      assert.strictEqual(first, serializeState(state));
    });
  });

  it('records a convergence once per family and reads it back', () => {
    withDir('state-conv-', (dir) => {
      assert.strictEqual(getConvergence(dir, 'fam'), null);
      recordConvergence(dir, 'fam', { appliedToSha: 'sha-1', appliedVersion: 'V_0-2-0' });
      const recorded = getConvergence(dir, 'fam');
      assert.strictEqual(recorded.appliedToSha, 'sha-1');
      assert.strictEqual(recorded.appliedVersion, 'V_0-2-0');
      assert.ok(recorded.appliedAt);
      assert.strictEqual(getConvergence(dir, 'other'), null);
    });
  });

  it('ignoredShas returns the trailing hash of every ignored key and nothing else', () => {
    withDir('state-ignored-', (dir) => {
      saveState(dir, {
        items: {
          'root::a.csv::hash-a': { status: 'ignore', decidedAt: '2026-09-30T12:00:00Z', note: '' },
          'root::b.csv::hash-b': { status: 'postpone', decidedAt: '2026-09-30T12:00:00Z', note: '' },
        },
      });
      assert.deepStrictEqual([...ignoredShas(dir)], ['hash-a']);
    });
  });

  return { passed, failed };
}

if (require.main === module) {
  run().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = { run };
