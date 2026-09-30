#!/usr/bin/env node
/**
 * convergence-delta.test.js — plain-node tests for the keyed delta engine.
 *
 * Zero external dependencies; run directly (`node convergence-delta.test.js`)
 * or via scripts/verify.js (it collects every `*.test.js` under skills/).
 */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  parseSourceFamilies,
  recordsFromContent,
  validateKey,
  computeDelta,
  buildProposal,
  buildApplyPlan,
  resolveFamilySnapshots,
} = require('./convergence-delta.js');

const CSV_FROM = 'video_id,views,title\nabc,100,Alpha\ndef,200,Beta\nghi,300,Gamma\n';
const CSV_TO = 'video_id,views,title\nabc,150,Alpha\ndef,200,Beta\njkl,400,Delta\n';

function testParseSourceFamilies() {
  const manifest = [
    '# NN kNNowledge',
    '',
    '## NN Source Family: youtube_analytics_monthly',
    'strategy:: upsert',
    'key:: video_id',
    'concept:: VideoMetric',
    '',
    '## NN Source Family: brand_prose',
    'strategy:: cite-only',
    '',
  ].join('\n');
  const families = parseSourceFamilies(manifest);
  assert.strictEqual(families.length, 2);
  assert.deepStrictEqual(families[0], {
    family: 'youtube_analytics_monthly',
    strategy: 'upsert',
    key: 'video_id',
    concept: 'VideoMetric',
  });
  assert.deepStrictEqual(families[1], { family: 'brand_prose', strategy: 'cite-only', key: null, concept: null });

  const defaulted = parseSourceFamilies('## NN Source Family: x\nfoo:: bar\n');
  assert.deepStrictEqual(defaulted[0], { family: 'x', strategy: 'cite-only', key: null, concept: null });
  console.log('PASS: parseSourceFamilies');
}

function testRecordsFromContent() {
  const records = recordsFromContent(CSV_FROM, '.csv');
  assert.strictEqual(records.length, 3);
  assert.deepStrictEqual(records[0], { video_id: 'abc', views: '100', title: 'Alpha' });

  const json = recordsFromContent('[{"id":"a","n":"1"},{"id":"b","n":"2"}]', '.json');
  assert.strictEqual(json.length, 2);
  assert.strictEqual(json[1].id, 'b');

  assert.throws(() => recordsFromContent('{"id":"a"}', '.json'), /array of objects/);
  console.log('PASS: recordsFromContent');
}

function testValidateKey() {
  const records = recordsFromContent(CSV_FROM, '.csv');
  assert.strictEqual(validateKey(records, 'video_id').ok, true);
  assert.strictEqual(validateKey(records, 'missing').ok, false);
  assert.strictEqual(validateKey(records, undefined).conflicts[0].reason, 'missing_key');

  const dup = recordsFromContent('id,v\na,1\na,2\n', '.csv');
  const dupResult = validateKey(dup, 'id');
  assert.strictEqual(dupResult.ok, false);
  assert.strictEqual(dupResult.conflicts[0].reason, 'duplicate_key');

  const empty = recordsFromContent('id,v\n,1\n', '.csv');
  assert.strictEqual(validateKey(empty, 'id').conflicts[0].reason, 'empty_key');
  console.log('PASS: validateKey');
}

function testComputeDelta() {
  const from = recordsFromContent(CSV_FROM, '.csv');
  const to = recordsFromContent(CSV_TO, '.csv');
  const delta = computeDelta(from, to, 'video_id');
  assert.deepStrictEqual(delta.added, [{ key: 'jkl', fields: { views: '400', title: 'Delta' } }]);
  assert.deepStrictEqual(delta.changed, [{ key: 'abc', field: 'views', from: '100', to: '150' }]);
  assert.deepStrictEqual(delta.removed, [{ key: 'ghi' }]);

  // Deterministic: reversed input order yields the same sorted output.
  const shuffled = [...to].reverse();
  assert.deepStrictEqual(computeDelta(from, shuffled, 'video_id'), delta);
  console.log('PASS: computeDelta');
}

function testBuildProposal() {
  const common = { family: 'fam', key: 'video_id', fromFile: 'fam_20260101-000000.csv', toFile: 'fam_20260201-000000.csv' };

  const citeOnly = buildProposal({ ...common, strategy: 'cite-only', fromContent: CSV_FROM, toContent: CSV_TO });
  assert.strictEqual(citeOnly.empty, true);

  const proposal = buildProposal({ ...common, strategy: 'upsert', fromContent: CSV_FROM, toContent: CSV_TO });
  assert.strictEqual(proposal.empty, false);
  assert.strictEqual(proposal.added.length, 1);
  assert.strictEqual(proposal.conflicts.length, 0);
  assert.ok(proposal.to.sha256);

  const identical = buildProposal({ ...common, strategy: 'upsert', fromContent: CSV_FROM, toContent: CSV_FROM });
  assert.strictEqual(identical.empty, true);
  assert.strictEqual(identical.reason, 'up-to-date');

  const applied = buildProposal({
    ...common,
    strategy: 'upsert',
    fromContent: CSV_FROM,
    toContent: CSV_TO,
    appliedToSha: proposal.to.sha256,
  });
  assert.strictEqual(applied.empty, true);

  assert.throws(
    () => buildProposal({ ...common, strategy: 'upsert', key: 'nope', fromContent: CSV_FROM, toContent: CSV_TO }),
    /Invalid convergence key/,
  );
  console.log('PASS: buildProposal');
}

function testBuildApplyPlan() {
  const common = { family: 'fam', key: 'video_id', fromFile: 'a.csv', toFile: 'b.csv' };

  const replaceProposal = buildProposal({ ...common, strategy: 'replace-values', fromContent: CSV_FROM, toContent: CSV_TO });
  const replacePlan = buildApplyPlan(replaceProposal, 'VideoMetric');
  assert.deepStrictEqual(replacePlan.ops[0], {
    op: 'add_element',
    args: { conceptName: 'VideoMetric', elementName: 'jkl', fields: { views: '400', title: 'Delta' } },
  });
  assert.deepStrictEqual(replacePlan.ops[1], {
    op: 'update_field',
    args: { conceptName: 'VideoMetric', elementName: 'abc', fieldName: 'views', value: '150' },
  });
  assert.deepStrictEqual(replacePlan.ops[2], { op: 'bump_version', args: { bump: 'patch' } });
  assert.strictEqual(replacePlan.review.length, 0);

  const upsertProposal = buildProposal({ ...common, strategy: 'upsert', fromContent: CSV_FROM, toContent: CSV_TO });
  const upsertPlan = buildApplyPlan(upsertProposal, 'VideoMetric');
  assert.strictEqual(upsertPlan.ops.filter((o) => o.op === 'update_field').length, 0);
  assert.strictEqual(upsertPlan.review.length, 1);
  assert.deepStrictEqual(upsertPlan.removed, [{ key: 'ghi' }]);

  assert.throws(() => buildApplyPlan(replaceProposal, null), /concept:: is required/);
  console.log('PASS: buildApplyPlan');
}

function testResolveFamilySnapshots() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conv-snap-'));
  try {
    const nnDir = path.join(dir, 'sources', 'nn', 'import');
    fs.mkdirSync(nnDir, { recursive: true });
    fs.writeFileSync(path.join(nnDir, 'fam_20260101-000000.csv'), CSV_FROM);
    fs.writeFileSync(path.join(nnDir, 'fam_20260201-000000.csv'), CSV_TO);
    fs.writeFileSync(path.join(nnDir, 'other_20260201-000000.csv'), CSV_FROM);
    fs.writeFileSync(path.join(nnDir, 'fam_20260301-000000.md'), 'profile, not citable\n');

    const snaps = resolveFamilySnapshots(dir, 'fam');
    assert.strictEqual(snaps.length, 2);
    assert.strictEqual(snaps[0].timestamp, '20260101-000000');
    assert.strictEqual(snaps[1].timestamp, '20260201-000000');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log('PASS: resolveFamilySnapshots');
}

function runAll() {
  try {
    testParseSourceFamilies();
    testRecordsFromContent();
    testValidateKey();
    testComputeDelta();
    testBuildProposal();
    testBuildApplyPlan();
    testResolveFamilySnapshots();
    console.log('\nAll convergence-delta tests passed.');
  } catch (err) {
    console.error(`\nconvergence-delta tests FAILED: ${err.message}`);
    process.exit(1);
  }
}

runAll();
