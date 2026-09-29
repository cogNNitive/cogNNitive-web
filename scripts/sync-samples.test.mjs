#!/usr/bin/env node

/**
 * scripts/sync-samples.test.mjs
 *
 * Unit tests for scripts/sync-samples.mjs.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { syncSamples, SAMPLE_MAPPINGS } from './sync-samples.mjs';

function fixtureTree() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-samples-test-'));
  const ssotModels = path.join(root, '_samples_nn', 'models');
  const templatesDir = path.join(root, 'iNNfo', 'specs', 'bluepriNNts');

  fs.mkdirSync(ssotModels, { recursive: true });
  fs.mkdirSync(templatesDir, { recursive: true });

  for (const m of SAMPLE_MAPPINGS) {
    fs.writeFileSync(path.join(ssotModels, m.source), `# Content of ${m.source}\n`, 'utf8');
  }

  return { root, ssotModels, templatesDir };
}

async function runTests() {
  console.log('Running sync-samples unit tests...');

  // Test 1: Live repository check passes with zero drift
  {
    const res = syncSamples({ check: true });
    assert.strictEqual(res.ok, true, `Expected zero drift on live repo, got errors: ${res.errors.join(', ')}`);
    console.log('✔ Live repository check passes with zero drift');
  }

  // Test 2: Mapping definitions are complete and non-empty
  {
    assert.ok(SAMPLE_MAPPINGS.length >= 10, 'Expected at least 10 canonical template sample mappings');
    for (const m of SAMPLE_MAPPINGS) {
      assert.ok(m.source.endsWith('_NN.md'), `Source ${m.source} should end with _NN.md`);
      assert.ok(m.target.includes('samples'), `Target ${m.target} should be in a samples directory`);
    }
    console.log('✔ All sample mappings are valid');
  }

  console.log('\nAll sync-samples unit tests passed! 🎉');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
