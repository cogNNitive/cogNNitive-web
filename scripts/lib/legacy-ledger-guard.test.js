#!/usr/bin/env node
/**
 * scripts/lib/legacy-ledger-guard.test.js
 *
 * Unit tests for scripts/lib/legacy-ledger-guard.js (legacy quarantine guard).
 * Uses Node.js test runner / assert. Zero external dependencies.
 *
 * IMPORTANT: Marker strings are constructed dynamically via concatenation
 * (never as live literals) to ensure this test file carries no live marker.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateLegacyLedger } = require('./legacy-ledger-guard.js');

const MARKER_PREFIX = 'legacy' + ':';
const makeMarker = (namespace, id) => `${MARKER_PREFIX}${namespace}/${id}`;

function createTempRepo() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-guard-test-'));
  return {
    dir: tmpDir,
    writeFile: (relPath, content) => {
      const full = path.join(tmpDir, relPath);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
      return full;
    },
    cleanup: () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (_) {}
    },
  };
}

// 1. Empty ledger with zero markers passes
function testEmptyLedgerPasses() {
  const repo = createTempRepo();
  try {
    repo.writeFile('legacy-ledger.yaml', 'version: 1\nentries: []\n');
    repo.writeFile('src/clean.js', 'console.log("clean code");\n');

    const res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: ['legacy-ledger.yaml', 'src/clean.js'],
    });

    assert.strictEqual(res.ok, true, `Expected ok=true, got errors: ${res.errors.join(', ')}`);
    assert.strictEqual(res.errors.length, 0);
    assert.strictEqual(res.markers.length, 0);
    assert.strictEqual(res.entries.length, 0);
    console.log('✔ Test 1: Empty ledger with zero markers passes');
  } finally {
    repo.cleanup();
  }
}

// 2. Excluded paths (openspec/**, legacy-ledger.yaml, test file, docs) are ignored
function testExclusionsIgnored() {
  const repo = createTempRepo();
  try {
    repo.writeFile('legacy-ledger.yaml', 'version: 1\nentries: []\n');
    repo.writeFile('openspec/changes/foo/spec.md', `Some text with ${makeMarker('nn-rename', 'x1')}\n`);
    repo.writeFile('scripts/lib/legacy-ledger-guard.test.js', `Test with ${makeMarker('nn-rename', 'x2')}\n`);
    repo.writeFile('docs/contributor/guide.md', 'Placeholder marker: legacy:<namespace>/<id>\n');

    const res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: [
        'legacy-ledger.yaml',
        'openspec/changes/foo/spec.md',
        'scripts/lib/legacy-ledger-guard.test.js',
        'docs/contributor/guide.md',
      ],
    });

    assert.strictEqual(res.ok, true, `Expected ok=true, got errors: ${res.errors.join(', ')}`);
    assert.strictEqual(res.markers.length, 0);
    console.log('✔ Test 2: Excluded paths are ignored');
  } finally {
    repo.cleanup();
  }
}

// 3. Marker without entry fails and names marker and file
function testMarkerWithoutEntryFails() {
  const repo = createTempRepo();
  try {
    repo.writeFile('legacy-ledger.yaml', 'version: 1\nentries: []\n');
    repo.writeFile('src/legacy-stuff.js', `// ${makeMarker('nn-rename', 'orphan-marker')}\n`);

    const res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: ['legacy-ledger.yaml', 'src/legacy-stuff.js'],
    });

    assert.strictEqual(res.ok, false);
    assert.ok(
      res.errors.some((e) => e.includes('orphan-marker') && e.includes('src/legacy-stuff.js')),
      `Expected error naming orphan-marker and src/legacy-stuff.js, got: ${res.errors.join('; ')}`,
    );
    console.log('✔ Test 3: Marker without entry fails and names marker and file');
  } finally {
    repo.cleanup();
  }
}

// 4. Entry without marker fails and names entry id
function testEntryWithoutMarkerFails() {
  const repo = createTempRepo();
  try {
    const ledger = `version: 1
entries:
  - id: ghost-entry
    what: Ghost legacy item
    paths:
      - src/ghost.js
    why: Migration pending
    removal: all-known-domains-migrated + maintainer-sign-off
    owner: 2026-09-29-nn-level-nomenclature-rename
`;
    repo.writeFile('legacy-ledger.yaml', ledger);
    repo.writeFile('src/ghost.js', '// Clean code without marker\n');

    const res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: ['legacy-ledger.yaml', 'src/ghost.js'],
    });

    assert.strictEqual(res.ok, false);
    assert.ok(
      res.errors.some((e) => e.includes('ghost-entry')),
      `Expected error naming ghost-entry, got: ${res.errors.join('; ')}`,
    );
    console.log('✔ Test 4: Entry without marker fails and names entry id');
  } finally {
    repo.cleanup();
  }
}

// 5. Marked file outside paths fails and names file and entry id
function testMarkedFileOutsidePathsFails() {
  const repo = createTempRepo();
  try {
    const ledger = `version: 1
entries:
  - id: quarantined-item
    what: Quarantined legacy item
    paths:
      - src/quarantine/allowed.js
    why: Migration pending
    removal: all-known-domains-migrated + maintainer-sign-off
    owner: 2026-09-29-nn-level-nomenclature-rename
`;
    repo.writeFile('legacy-ledger.yaml', ledger);
    repo.writeFile('src/other/unauthorized.js', `// ${makeMarker('nn-rename', 'quarantined-item')}\n`);

    const res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: ['legacy-ledger.yaml', 'src/other/unauthorized.js'],
    });

    assert.strictEqual(res.ok, false);
    assert.ok(
      res.errors.some((e) => e.includes('quarantined-item') && e.includes('src/other/unauthorized.js')),
      `Expected error naming quarantined-item and file, got: ${res.errors.join('; ')}`,
    );
    console.log('✔ Test 5: Marked file outside paths fails and names file and entry id');
  } finally {
    repo.cleanup();
  }
}

// 6. Paths item with no marker file fails and names entry id and path
function testPathsItemWithNoMarkerFileFails() {
  const repo = createTempRepo();
  try {
    const ledger = `version: 1
entries:
  - id: multi-path-item
    what: Multi path item
    paths:
      - src/quarantine/one.js
      - src/quarantine/two.js
    why: Migration pending
    removal: all-known-domains-migrated + maintainer-sign-off
    owner: 2026-09-29-nn-level-nomenclature-rename
`;
    repo.writeFile('legacy-ledger.yaml', ledger);
    repo.writeFile('src/quarantine/one.js', `// ${makeMarker('nn-rename', 'multi-path-item')}\n`);
    repo.writeFile('src/quarantine/two.js', '// forgot to put marker here\n');

    const res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: ['legacy-ledger.yaml', 'src/quarantine/one.js', 'src/quarantine/two.js'],
    });

    assert.strictEqual(res.ok, false);
    assert.ok(
      res.errors.some((e) => e.includes('multi-path-item') && e.includes('src/quarantine/two.js')),
      `Expected error naming multi-path-item and src/quarantine/two.js, got: ${res.errors.join('; ')}`,
    );
    console.log('✔ Test 6: Paths item with no marker file fails');
  } finally {
    repo.cleanup();
  }
}

// 7. Duplicate or malformed id fails and names the id
function testDuplicateOrMalformedIdFails() {
  const repo = createTempRepo();
  try {
    // Malformed ID (uppercase / underscore)
    const malformedLedger = `version: 1
entries:
  - id: Invalid_Id_Name
    what: Item
    paths:
      - src/a.js
    why: Why
    removal: all-known-domains-migrated + maintainer-sign-off
    owner: 2026-09-29-nn-level-nomenclature-rename
`;
    repo.writeFile('legacy-ledger.yaml', malformedLedger);
    repo.writeFile('src/a.js', `// ${makeMarker('nn-rename', 'Invalid_Id_Name')}\n`);

    let res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: ['legacy-ledger.yaml', 'src/a.js'],
    });
    assert.strictEqual(res.ok, false);
    assert.ok(
      res.errors.some((e) => e.includes('Invalid_Id_Name')),
      `Expected error naming Invalid_Id_Name, got: ${res.errors.join('; ')}`,
    );

    // Duplicate ID
    const dupLedger = `version: 1
entries:
  - id: dup-id
    what: Item 1
    paths:
      - src/a.js
    why: Why 1
    removal: all-known-domains-migrated + maintainer-sign-off
    owner: 2026-09-29-nn-level-nomenclature-rename
  - id: dup-id
    what: Item 2
    paths:
      - src/b.js
    why: Why 2
    removal: all-known-domains-migrated + maintainer-sign-off
    owner: 2026-09-29-nn-level-nomenclature-rename
`;
    repo.writeFile('legacy-ledger.yaml', dupLedger);
    repo.writeFile('src/a.js', `// ${makeMarker('nn-rename', 'dup-id')}\n`);
    repo.writeFile('src/b.js', `// ${makeMarker('nn-rename', 'dup-id')}\n`);

    res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: ['legacy-ledger.yaml', 'src/a.js', 'src/b.js'],
    });
    assert.strictEqual(res.ok, false);
    assert.ok(
      res.errors.some((e) => e.includes('dup-id') && e.toLowerCase().includes('duplicate')),
      `Expected duplicate error for dup-id, got: ${res.errors.join('; ')}`,
    );

    console.log('✔ Test 7: Duplicate or malformed id fails and names id');
  } finally {
    repo.cleanup();
  }
}

// 8. Missing required fields or version != 1 fails
function testMissingFieldsAndVersionFails() {
  const repo = createTempRepo();
  try {
    // Bad version
    repo.writeFile('legacy-ledger.yaml', 'version: 2\nentries: []\n');
    let res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: ['legacy-ledger.yaml'],
    });
    assert.strictEqual(res.ok, false);
    assert.ok(
      res.errors.some((e) => e.toLowerCase().includes('version')),
      `Expected error about version != 1, got: ${res.errors.join('; ')}`,
    );

    // Missing required field 'removal'
    const missingFieldLedger = `version: 1
entries:
  - id: test-missing-field
    what: Item without removal
    paths:
      - src/missing.js
    why: Just because
    owner: 2026-09-29-nn-level-nomenclature-rename
`;
    repo.writeFile('legacy-ledger.yaml', missingFieldLedger);
    repo.writeFile('src/missing.js', `// ${makeMarker('nn-rename', 'test-missing-field')}\n`);

    res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: ['legacy-ledger.yaml', 'src/missing.js'],
    });
    assert.strictEqual(res.ok, false);
    assert.ok(
      res.errors.some((e) => e.includes('test-missing-field') && e.includes('removal')),
      `Expected error naming test-missing-field and removal, got: ${res.errors.join('; ')}`,
    );

    console.log('✔ Test 8: Missing required fields or invalid version fails');
  } finally {
    repo.cleanup();
  }
}

// 9. Permanent history in paths fails
function testPermanentHistoryInPathsFails() {
  const repo = createTempRepo();
  try {
    const badPaths = [
      'iNNfo/specs/iNNfo_V_0-1-0_NN.md',
      'docs/innfo/cdn/innfo-mcp-v0.10.0.bundle.js',
      'openspec/changes/archive/old-change/spec.md',
    ];

    for (const badPath of badPaths) {
      const ledger = `version: 1
entries:
  - id: perm-item
    what: Permanent item
    paths:
      - ${badPath}
    why: Why
    removal: all-known-domains-migrated + maintainer-sign-off
    owner: 2026-09-29-nn-level-nomenclature-rename
`;
      repo.writeFile('legacy-ledger.yaml', ledger);
      repo.writeFile(badPath, `// ${makeMarker('nn-rename', 'perm-item')}\n`);

      const res = validateLegacyLedger({
        repoRoot: repo.dir,
        lsFiles: ['legacy-ledger.yaml', badPath],
      });

      assert.strictEqual(res.ok, false);
      assert.ok(
        res.errors.some((e) => e.includes('perm-item') && (e.includes('permanent') || e.includes(badPath))),
        `Expected error rejecting permanent history path ${badPath}, got: ${res.errors.join('; ')}`,
      );
    }

    console.log('✔ Test 9: Permanent history in paths fails');
  } finally {
    repo.cleanup();
  }
}

// 10. Valid matching entries and markers pass
function testValidMatchingEntriesPass() {
  const repo = createTempRepo();
  try {
    const ledger = `version: 1
entries:
  - id: quarantine-module
    what: Legacy quarantine module
    paths:
      - iNNfo/packages/innfo-core/src/legacy/index.ts
      - iNNfo/packages/innfo-core/src/legacy/detect.ts
    why: Isolates legacy parsers and detectors
    removal: all-known-domains-migrated + maintainer-sign-off
    owner: 2026-09-29-nn-level-nomenclature-rename
`;
    repo.writeFile('legacy-ledger.yaml', ledger);
    repo.writeFile('iNNfo/packages/innfo-core/src/legacy/index.ts', `/* ${makeMarker('nn-rename', 'quarantine-module')} */\n`);
    repo.writeFile('iNNfo/packages/innfo-core/src/legacy/detect.ts', `// ${makeMarker('nn-rename', 'quarantine-module')}\n`);

    const res = validateLegacyLedger({
      repoRoot: repo.dir,
      lsFiles: [
        'legacy-ledger.yaml',
        'iNNfo/packages/innfo-core/src/legacy/index.ts',
        'iNNfo/packages/innfo-core/src/legacy/detect.ts',
      ],
    });

    assert.strictEqual(res.ok, true, `Expected ok=true, got errors: ${res.errors.join(', ')}`);
    assert.strictEqual(res.errors.length, 0);
    assert.strictEqual(res.entries.length, 1);
    assert.strictEqual(res.markers.length, 2);
    console.log('✔ Test 10: Valid matching entries and markers pass');
  } finally {
    repo.cleanup();
  }
}

function runAll() {
  testEmptyLedgerPasses();
  testExclusionsIgnored();
  testMarkerWithoutEntryFails();
  testEntryWithoutMarkerFails();
  testMarkedFileOutsidePathsFails();
  testPathsItemWithNoMarkerFileFails();
  testDuplicateOrMalformedIdFails();
  testMissingFieldsAndVersionFails();
  testPermanentHistoryInPathsFails();
  testValidMatchingEntriesPass();
  console.log('\nAll legacy ledger guard tests passed successfully.');
}

runAll();
