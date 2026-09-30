const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  digestKey,
  statePath,
  loadState,
  saveState,
  serializeState,
  decide,
  buildDigest,
  findItemByKey,
} = require('../../scripts/lib/watch-digest-store');

function scanItem(overrides = {}) {
  return {
    root: 'D:/External_Drops/Client_Inputs',
    relPath: 'q3_report.xlsx',
    baseName: 'q3_report.xlsx',
    fullPath: 'D:/External_Drops/Client_Inputs/q3_report.xlsx',
    cadence: 'dynamic',
    sha256: 'hash-a',
    deltaStatus: 'NEW',
    sizeBytes: 1234,
    ...overrides,
  };
}

function scanResult(newItems = [], evolved = [], alerts = [], disconnected = []) {
  return {
    roots: [{ root: 'D:/External_Drops/Client_Inputs', cadence: 'dynamic', status: 'CONNECTED' }],
    classified: {
      new: newItems,
      evolved,
      alerts,
      disconnected,
      unchanged: [],
    },
  };
}

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

  console.log('\n--- test-watch-digest-store ---');

  it('digest key is stable and normalizes backslashes', () => {
    const key = digestKey('D:/External\\Drops', 'sub\\file.xlsx', 'abc');
    assert.strictEqual(key, 'D:/External/Drops::sub/file.xlsx::abc');
    assert.strictEqual(key, digestKey('D:/External\\Drops', 'sub\\file.xlsx', 'abc'));
  });

  it('missing state file loads as empty', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-empty-'));
    try {
      const state = loadState(dir);
      assert.deepStrictEqual(state.items, {});
      assert.strictEqual(fs.existsSync(statePath(dir)), false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('ignore suppresses the same hash but not a new hash', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-ignore-'));
    try {
      const item = scanItem();
      const key = digestKey(item.root, item.relPath, item.sha256);
      decide(dir, key, 'ignore');

      const afterIgnore = buildDigest(scanResult([item]), loadState(dir));
      assert.strictEqual(afterIgnore.items.length, 0, 'ignored hash is suppressed');

      const edited = scanItem({ sha256: 'hash-b' });
      const afterEdit = buildDigest(scanResult([edited]), loadState(dir));
      assert.strictEqual(afterEdit.items.length, 1, 'edited content is re-offered');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('postpone re-offers the item on the next digest', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-postpone-'));
    try {
      const item = scanItem();
      const key = digestKey(item.root, item.relPath, item.sha256);
      decide(dir, key, 'postpone');

      const digest = buildDigest(scanResult([item]), loadState(dir));
      assert.strictEqual(digest.items.length, 1);
      assert.strictEqual(digest.items[0].key, key);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('import suppresses the item', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-import-'));
    try {
      const item = scanItem();
      const key = digestKey(item.root, item.relPath, item.sha256);
      decide(dir, key, 'import');

      const digest = buildDigest(scanResult([item]), loadState(dir));
      assert.strictEqual(digest.items.length, 0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('writing the same decision twice is byte-idempotent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-idem-'));
    try {
      const state = {
        items: {
          'b::x::2': { status: 'postpone', decidedAt: '2026-09-30T12:00:00Z', note: '' },
          'a::x::1': { status: 'ignore', decidedAt: '2026-09-30T12:00:00Z', note: '' },
        },
      };
      saveState(dir, state);
      const first = fs.readFileSync(statePath(dir), 'utf8');
      saveState(dir, { items: { ...state.items } });
      const second = fs.readFileSync(statePath(dir), 'utf8');
      assert.strictEqual(first, second);
      assert.strictEqual(first, serializeState(state));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('decide rejects an unknown status', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-status-'));
    try {
      assert.throws(() => decide(dir, 'k', 'maybe'), /Unknown digest decision/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('buildDigest keeps evolved and alert items and reports disconnected roots', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-mixed-'));
    try {
      const evolved = scanItem({ relPath: 'rates.csv', sha256: 'h1', deltaStatus: 'EVOLVED_DYNAMIC' });
      const alert = scanItem({ relPath: 'locked.pdf', sha256: 'h2', deltaStatus: 'STATIC_ALERT', cadence: 'static' });
      const digest = buildDigest(
        scanResult([scanItem()], [evolved], [alert], ['Z:/Vault/Legal']),
        loadState(dir),
      );
      assert.strictEqual(digest.items.length, 3);
      assert.deepStrictEqual(digest.disconnected, ['Z:/Vault/Legal']);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('findItemByKey resolves across buckets', () => {
    const item = scanItem({ relPath: 'late.csv', sha256: 'hx', deltaStatus: 'EVOLVED_DYNAMIC' });
    const key = digestKey(item.root, item.relPath, item.sha256);
    const found = findItemByKey(scanResult([], [item]), key);
    assert.ok(found);
    assert.strictEqual(found.relPath, 'late.csv');
    assert.strictEqual(findItemByKey(scanResult([], [item]), 'missing'), null);
  });

  it('digest with no roots declared is empty', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-none-'));
    try {
      const digest = buildDigest({ roots: [], classified: { new: [], evolved: [], alerts: [], disconnected: [] } }, loadState(dir));
      assert.deepStrictEqual(digest.items, []);
      assert.deepStrictEqual(digest.roots, []);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loading and building a digest writes nothing to the workspace', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'digest-nowrite-'));
    try {
      buildDigest(scanResult([scanItem()]), loadState(dir));
      const entries = fs.readdirSync(dir);
      assert.deepStrictEqual(entries, [], 'no state file or sources/ dir is created by a read-only digest');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  return { passed, failed };
}

if (require.main === module) {
  run().then((res) => {
    process.exit(res.failed > 0 ? 1 : 0);
  });
}

module.exports = { run };
