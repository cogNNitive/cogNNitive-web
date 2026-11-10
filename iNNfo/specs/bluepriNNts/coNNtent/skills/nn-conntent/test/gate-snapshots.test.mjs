/**
 * nn-conntent/test/gate-snapshots.test.mjs
 *
 * The re-open cause record (capability conntent-review-gates "Re-open causes are
 * recorded"; design D-P2; tasks 3b-1.5).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  readReviewSnapshot,
  reviewSnapshotPath,
  reopenCause,
  writeReviewSnapshot,
} from '../scripts/lib/gates.mjs';

const subject = (overrides = {}) => ({
  scene: 's1',
  language: 'es',
  narration: 'Hola mundo',
  layers: [{ type: 'image', prompt: 'hero' }],
  params: { voice: 'ana', captions: 'words' },
  ...overrides,
});

test('a missing snapshot degrades the cause to unknown, never guesses', () => {
  assert.deepEqual(reopenCause({ previous: null, current: subject() }), { kind: 'unknown' });
});

test('an unchanged subject has no cause', () => {
  assert.equal(reopenCause({ previous: subject(), current: subject() }), null);
});

test('causes name the changed component', () => {
  const cases = [
    [
      'narration',
      { narration: 'Hola mundo!' },
      {},
      { kind: 'narration-changed' },
    ],
    [
      'layer',
      { layers: [{ type: 'image', prompt: 'other' }] },
      {},
      { kind: 'layer-changed', detail: 'layer 1' },
    ],
    [
      'param',
      { params: { voice: 'bea', captions: 'words' } },
      { voice: 'series' },
      { kind: 'param-changed', detail: 'series voice' },
    ],
  ];
  for (const [name, change, sources, expected] of cases) {
    assert.deepEqual(reopenCause({ previous: subject(), current: subject(change), sources }), expected, name);
  }
});

test('an unnamed parameter change still names the field', () => {
  assert.deepEqual(
    reopenCause({ previous: subject(), current: subject({ params: { voice: 'bea', captions: 'words' } }) }),
    { kind: 'param-changed', detail: 'voice' },
  );
});

test('the snapshot is stored per episode under .cognnitive/video/reviews', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-gate-snap-'));
  try {
    const file = reviewSnapshotPath(root, 'serie', 'ep');
    assert.equal(file, path.join(root, '.cognnitive', 'video', 'reviews', 'serie__ep.json'));
    assert.deepEqual(readReviewSnapshot(root, 'serie', 'ep'), { scenes: {} });

    writeReviewSnapshot(root, 'serie', 'ep', { s1: { script: { subject: subject(), sources: { voice: 'series' } } } });
    const back = readReviewSnapshot(root, 'serie', 'ep');
    assert.deepEqual(back.scenes.s1.script.subject, subject());
    assert.deepEqual(back.scenes.s1.script.sources, { voice: 'series' });

    // Overwritten in place, not appended.
    writeReviewSnapshot(root, 'serie', 'ep', { s1: { script: { subject: subject({ narration: 'x' }) } } });
    assert.equal(readReviewSnapshot(root, 'serie', 'ep').scenes.s1.script.subject.narration, 'x');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
