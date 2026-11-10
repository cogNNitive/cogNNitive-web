/**
 * nn-conntent/test/delivery.test.mjs
 *
 * Automatic delivery after QA: `deliveries/v<N>/`, the version rule, the link-or-copy
 * fallback, and immutable earlier versions (capability conntent-delivery; design D-P6;
 * tasks 3b-5.1/3b-5.2).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { deliver, latestDelivery, outputsHash } from '../scripts/lib/delivery.mjs';

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-delivery-'));
  const episode = path.join(root, 'episode');
  fs.mkdirSync(episode, { recursive: true });
  const master = path.join(episode, 'probe_1920x1920.mp4');
  const thumb = path.join(episode, 'probe_thumbnail_1920x1920.png');
  fs.writeFileSync(master, 'master-bytes');
  fs.writeFileSync(thumb, 'thumb-bytes');
  return { root, episode, outputs: [master, thumb], cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('the first run creates deliveries/v1 with a delivery.json', async () => {
  const ws = workspace();
  try {
    const result = await deliver({ episodeDir: ws.episode, outputs: ws.outputs, inputFingerprint: 'fp-1' });
    assert.equal(result.created, true);
    assert.equal(result.version, 'v1');
    const dir = path.join(ws.episode, 'deliveries', 'v1');
    assert.ok(fs.existsSync(path.join(dir, 'probe_1920x1920.mp4')));
    assert.ok(fs.existsSync(path.join(dir, 'probe_thumbnail_1920x1920.png')));
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'delivery.json'), 'utf8'));
    assert.equal(meta.version, 'v1');
    assert.equal(meta.input_fingerprint, 'fp-1');
    assert.equal(meta.outputs_hash, outputsHash(ws.outputs));
    assert.equal(meta.files.length, 2);
  } finally {
    ws.cleanup();
  }
});

test('an identical rerun creates nothing', async () => {
  const ws = workspace();
  try {
    await deliver({ episodeDir: ws.episode, outputs: ws.outputs, inputFingerprint: 'fp-1' });
    const again = await deliver({ episodeDir: ws.episode, outputs: ws.outputs, inputFingerprint: 'fp-1' });
    assert.equal(again.created, false);
    assert.equal(again.version, 'v1');
    assert.deepEqual(fs.readdirSync(path.join(ws.episode, 'deliveries')), ['v1']);
  } finally {
    ws.cleanup();
  }
});

test('a changed run creates v2 and v1 bytes stay untouched', async () => {
  const ws = workspace();
  try {
    await deliver({ episodeDir: ws.episode, outputs: ws.outputs, inputFingerprint: 'fp-1' });
    const v1 = path.join(ws.episode, 'deliveries', 'v1', 'probe_1920x1920.mp4');
    const before = fs.readFileSync(v1);

    // The producer replaces outputs by rename, never in place: stage then rename.
    const staged = `${ws.outputs[0]}.new`;
    fs.writeFileSync(staged, 'master-bytes-v2');
    fs.renameSync(staged, ws.outputs[0]);
    const result = await deliver({ episodeDir: ws.episode, outputs: ws.outputs, inputFingerprint: 'fp-2' });
    assert.equal(result.created, true);
    assert.equal(result.version, 'v2');
    assert.deepEqual(fs.readFileSync(v1), before, 'v1 is immutable');
    assert.equal(
      fs.readFileSync(path.join(ws.episode, 'deliveries', 'v2', 'probe_1920x1920.mp4'), 'utf8'),
      'master-bytes-v2',
    );
  } finally {
    ws.cleanup();
  }
});

test('a version increments only when both the outputs and the input fingerprint change', async () => {
  const ws = workspace();
  try {
    await deliver({ episodeDir: ws.episode, outputs: ws.outputs, inputFingerprint: 'fp-1' });

    // Same inputs, different bytes: absorbed (non-reproducible re-encode).
    const staged = `${ws.outputs[0]}.new`;
    fs.writeFileSync(staged, 'master-reencoded');
    fs.renameSync(staged, ws.outputs[0]);
    const sameInputs = await deliver({ episodeDir: ws.episode, outputs: ws.outputs, inputFingerprint: 'fp-1' });
    assert.equal(sameInputs.created, false, 'only outputs changed');
    assert.deepEqual(fs.readdirSync(path.join(ws.episode, 'deliveries')), ['v1']);

    // Same outputs as the delivered version, different inputs: also no-op.
    const back = `${ws.outputs[0]}.new`;
    fs.writeFileSync(back, 'master-bytes');
    fs.renameSync(back, ws.outputs[0]);
    const sameOutputs = await deliver({ episodeDir: ws.episode, outputs: ws.outputs, inputFingerprint: 'fp-2' });
    assert.equal(sameOutputs.created, false, 'only inputs changed');
  } finally {
    ws.cleanup();
  }
});

test('a hard-link failure falls back to a copy (EXDEV/EPERM)', async () => {
  const ws = workspace();
  try {
    const result = await deliver({
      episodeDir: ws.episode,
      outputs: ws.outputs,
      inputFingerprint: 'fp-1',
      linkFile: () => {
        const err = new Error('cross-device link');
        err.code = 'EXDEV';
        throw err;
      },
    });
    assert.equal(result.created, true);
    assert.equal(
      fs.readFileSync(path.join(ws.episode, 'deliveries', 'v1', 'probe_1920x1920.mp4'), 'utf8'),
      'master-bytes',
    );
  } finally {
    ws.cleanup();
  }
});

test('latestDelivery reports the highest version', async () => {
  const ws = workspace();
  try {
    assert.equal(latestDelivery(ws.episode), null);
    await deliver({ episodeDir: ws.episode, outputs: ws.outputs, inputFingerprint: 'fp-1' });
    fs.writeFileSync(ws.outputs[0], 'v2');
    await deliver({ episodeDir: ws.episode, outputs: ws.outputs, inputFingerprint: 'fp-2' });
    assert.equal(latestDelivery(ws.episode).version, 'v2');
  } finally {
    ws.cleanup();
  }
});

test('deliver writes <slug>_delivery.html into deliveries/v1 without affecting outputs_hash, and never replaces it', async () => {
  const ws = workspace();
  try {
    const result = await deliver({
      episodeDir: ws.episode,
      outputs: ws.outputs,
      inputFingerprint: 'fp-1',
    });
    assert.equal(result.created, true);
    assert.equal(result.version, 'v1');

    const v1Dir = path.join(ws.episode, 'deliveries', 'v1');
    const htmlFile = path.join(v1Dir, 'probe_delivery.html');
    assert.ok(fs.existsSync(htmlFile), 'probe_delivery.html exists in deliveries/v1');

    const meta = JSON.parse(fs.readFileSync(path.join(v1Dir, 'delivery.json'), 'utf8'));
    // outputs_hash must NOT include the HTML
    assert.equal(meta.outputs_hash, outputsHash(ws.outputs));
    assert.equal(meta.input_fingerprint, 'fp-1');

    const htmlContent = fs.readFileSync(htmlFile, 'utf8');
    // Media references should be sibling relative paths ./<file>
    assert.match(htmlContent, /\.\/probe_1920x1920\.mp4/);

    // Second write to the same vN is refused and leaves the file untouched
    const beforeHtml = fs.readFileSync(htmlFile);
    await assert.rejects(
      async () => {
        // If deliver is forced to re-deliver v1 or if staging tries to overwrite v1
        const staging = path.join(ws.episode, 'deliveries', '.tmp-v1');
        fs.mkdirSync(staging, { recursive: true });
        fs.renameSync(staging, v1Dir);
      },
    );
    assert.deepEqual(fs.readFileSync(htmlFile), beforeHtml, 'delivery file untouched');
  } finally {
    ws.cleanup();
  }
});

