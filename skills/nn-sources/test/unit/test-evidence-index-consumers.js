'use strict';

/**
 * Evidence-index consumers (change-provenance: consumers read the log).
 *
 * gc protects a source cited by ANY applied change (all-time evidence), the
 * impact checker compares the stamped evidence_sha256 with the current bytes, and
 * the uncited-source audit counts evidence citations as citations.
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const gc = require('../../scripts/lib/gc');
const impact = require('../../scripts/lib/impact-checker');
const guards = require('../../scripts/lib/duplicate-guards');

let passed = 0;
let failed = 0;

function ok(cond, label) {
  if (cond) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label}`);
  }
}

function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.log(`  FAIL: ${label} (expected ${e}, got ${a})`);
  }
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function write(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

/**
 * A minimal domaiNN: one model, one source family (two members), a sidecar for
 * the older member and one applied change whose evidence cites that member.
 */
function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-evidence-consumers-'));
  const older = 'sources/import/brief_20261001T000000Z.md';
  const newer = 'sources/import/brief_20261002T000000Z.md';
  const olderAbs = write(root, older, '# Brief\n\nOld bytes.\n');
  write(root, newer, '# Brief\n\nNew bytes.\n');
  write(
    root,
    `${older}_sidecar_NN.md`,
    `---
level: 3
parent_spec:
  name: sidecar
  url: "https://example.test/sidecar.md"
source_file: ${older}
sha256: ${sha256(fs.readFileSync(olderAbs))}
size_bytes: 20
source_format: md
normalized_at: 2026-10-01T00:00:00Z
---

# Brief
`,
  );
  write(
    root,
    'kNNowledge/plan_NN.md',
    `---
level: 3
parent_spec:
  name: plan_V_0-1-0
  url: "specs/plan_NN.md"
knowledge_version: "V_0-1-0"
title: "Plan"
---

# NN Concept 1
## NN Concept 1: Goal 1
slug:: goal-1
owner:: Ana
`,
  );
  write(
    root,
    'changes/dom_agent_20261010T120000Z_changes_NN.md',
    `---
spec_version: "V_0-4-0"
level: 3
parent_spec:
  name: changes
  url: "https://example.test/changes/spec_NN.md"
blueprint_version: "V_0-6-0"
status: applied
applied_at: "2026-10-10T12:00:00.000Z"
---

# NN Change

## NN Change: c-01
op:: update_field
target:: plan@goal-1&owner
to:: Ana
evidence:: ${older}
evidence_sha256:: [${sha256(fs.readFileSync(olderAbs))}]
`,
  );
  return { root, older, olderAbs };
}

async function run() {
  console.log('\n\t-- Evidence-index consumers --');

  // (1) gc: all-time evidence protects a superseded family member.
  const ws = makeWorkspace();
  try {
    const plan = await gc.planProjectGc(ws.root);
    ok(!plan.candidates.includes(ws.older), 'gc keeps a member cited only by applied-change evidence');
    ok(plan.candidates.every((p) => !p.replace(/\\/g, '/').startsWith('changes/')), 'gc never proposes a changeset');

    // (2) impact: the stamped sha no longer matches the bytes.
    const before = impact.auditModelCitations(ws.root);
    eq(before.evidenceImpacts, [], 'impact: matching evidence bytes report nothing');
    write(ws.root, ws.older, '# Brief\n\nEdited bytes.\n');
    const after = impact.auditModelCitations(ws.root);
    ok(after.evidenceImpacts.length === 1, 'impact: a changed source reports one evidence impact');
    eq(after.evidenceImpacts[0] && after.evidenceImpacts[0].unit, 'plan@goal-1&owner', 'impact: names the unit');
    ok(
      after.warnings.some((w) => w.includes('[IMPACT WARNING]') && w.includes('c-01')),
      'impact: warns with [IMPACT WARNING] and the change id',
    );

    // (3) duplicate guards: evidence counts as a citation.
    const audit = guards.auditUncitedSources(ws.root);
    ok(audit.citedCount >= 1, 'duplicate-guards: evidence-cited source counts as cited');
    ok(!audit.uncitedSources.some((s) => s.path.replace(/\\/g, '/') === ws.older), 'duplicate-guards: it is not uncited');
  } finally {
    fs.rmSync(ws.root, { recursive: true, force: true });
  }

  return { passed, failed };
}

module.exports = { run };
