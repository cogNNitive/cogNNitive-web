#!/usr/bin/env node

/**
 * nn-conntent/test/plan-and-facts.test.mjs
 *
 * The plan hash includes resolved prices (capability video-run-facts "Prices Are Part Of The
 * Plan Hash") and the facts module writes the v2 ledger row with the machine fingerprint and
 * a v1 timing row, with the timing failure only warning (capability video-run-facts).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { computePlanHash } from '../scripts/lib/plan.mjs';
import {
  appendLedgerRow,
  appendTimingRow,
  canonicalJson,
  fingerprintOf,
  ledgerRow,
  machineInfo,
  readLedgerRows,
  readTimingRows,
  timingRow,
  verifyFingerprint,
} from '../scripts/lib/facts.mjs';

const SCRIPT = '# NN Video\n\n## NN Video: X\nslug:: x\n';

/** A stand-in for the pinned GSAP build: emission vendors it into `vendor/`. */
const gsapPath = path.join(os.tmpdir(), `nn-gsap-facts-${process.pid}.js`);
fs.writeFileSync(gsapPath, '/* gsap */');
test('a price change invalidates the plan hash', () => {
  const models = { tts: 'minimax/speech-2.8-hd' };
  const a = computePlanHash(SCRIPT, models, { tts: 0.02 });
  const b = computePlanHash(SCRIPT, models, { tts: 0.03 });
  assert.notEqual(a, b);
  assert.equal(a, computePlanHash(SCRIPT, models, { tts: 0.02 }), 'same inputs, same hash');
  assert.equal(computePlanHash(SCRIPT, models), computePlanHash(SCRIPT, models), 'no prices is stable');
});

test('canonical JSON is key-order independent', () => {
  assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
});

test('the machine fingerprint is the first 12 hex of the canonical machine object', () => {
  const machine = machineInfo();
  assert.match(machine.fp, /^[0-9a-f]{12}$/);
  assert.equal(machine.fp, fingerprintOf(machine));
  assert.equal(verifyFingerprint(machine), true);
  assert.ok(machine.cores >= 1);
});

test('a ledger row is v2 and carries every required key plus the fingerprint', () => {
  const row = ledgerRow({
    runId: 'run-1',
    episode: 'ep',
    planHash: 'h',
    stage: 'tts',
    kind: 'tts',
    model: 'minimax/speech-2.8-hd',
    units: 120,
    unitPrice: 0.02,
    priceDate: '2026-11-02',
    priceSource: 'blueprint',
    estUsd: 0.0024,
    actualUsd: 0.0024,
    processingMs: 900,
    queueMs: 40,
  });
  for (const key of ['v', 'ts', 'run_id', 'episode', 'plan_hash', 'stage', 'kind', 'model', 'cache_key', 'units', 'unit_price', 'price_date', 'price_source', 'est_usd', 'actual_usd', 'cache_hit', 'outcome', 'queue_ms', 'processing_ms', 'machine']) {
    assert.ok(key in row, `ledger row carries ${key}`);
  }
  assert.equal(row.v, 2);
  assert.equal(verifyFingerprint(row.machine), true);
  assert.equal(row.queue_ms, 40);
  assert.equal(row.processing_ms, 900);
});

test('the ledger is append-only JSONL under .cognnitive/video and keeps earlier bytes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facts-'));
  try {
    const base = { runId: 'r', episode: 'e', planHash: 'h', stage: 'tts', kind: 'tts', model: 'm' };
    appendLedgerRow(root, ledgerRow({ ...base, estUsd: 1 }));
    const first = fs.readFileSync(path.join(root, '.cognnitive', 'video', 'ledger.jsonl'), 'utf8');
    appendLedgerRow(root, ledgerRow({ ...base, estUsd: 2 }));
    const all = fs.readFileSync(path.join(root, '.cognnitive', 'video', 'ledger.jsonl'), 'utf8');
    assert.ok(all.startsWith(first), 'earlier lines are byte-identical');
    assert.equal(readLedgerRows(root).length, 2);
    assert.equal(readLedgerRows(root)[1].est_usd, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a timing row carries the stage schema and a write failure only warns', () => {
  const start = Date.parse('2026-11-02T10:00:00Z');
  const row = timingRow({
    runId: 'r',
    episode: 'e',
    planHash: 'h',
    stage: 'render',
    start,
    end: start + 1500,
    render: { frames: 204, fps_effective: 30, width: 1920, height: 1920 },
    cache: { hits: 3, misses: 1 },
  });
  assert.equal(row.v, 1);
  assert.equal(row.duration_ms, 1500);
  assert.equal(row.link_mode, 'link');
  assert.equal(row.render.frames, 204);
  assert.equal(verifyFingerprint(row.machine), true);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facts-'));
  const warned = [];
  try {
    const ok = appendTimingRow(root, row);
    assert.equal(ok.ok, true);
    assert.equal(readTimingRows(root).length, 1);
    // Make the facts directory a file so the append fails: no throw, one warning.
    fs.rmSync(path.join(root, '.cognnitive'), { recursive: true, force: true });
    fs.mkdirSync(path.join(root, '.cognnitive'));
    fs.writeFileSync(path.join(root, '.cognnitive', 'video'), 'not a directory');
    const failed = appendTimingRow(root, row, (msg) => warned.push(msg));
    assert.equal(failed.ok, false);
    assert.equal(warned.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a render records one timing row per stage in the fixed order', async () => {
  const { renderVideo } = await import('../scripts/lib/render.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facts-stages-'));
  try {
    for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) delete process.env[k];
    fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
    const scriptPath = path.join(root, 'staged_NN.md');
    fs.writeFileSync(
      scriptPath,
      '---\nlevel: 3\ntitle: "Staged"\n---\n\n# NN Video\n\n## NN Video: Staged\nslug:: staged\ntitle:: Staged\n\n' +
        '# NN Scene\n\n## NN Scene: One\nslug:: one\n\nOne two three four five.\n\n' +
        '### NN Layer: Barn\nslug:: barn\ntype:: media\nprompt:: a red barn at dawn\n',
      'utf8',
    );
    await renderVideo({
      scriptPath,
      cacheDir: path.join(root, 'cache'),
      gsapPath,
      facts: { rootDir: root, runId: 'run-2', episode: 'staged', planHash: 'def' },
      hyperframesRun: async (cmd, args) => {
        fs.writeFileSync(args[args.indexOf('--output') + 1], 'fake-mp4');
        return { status: 0 };
      },
    });
    const rows = readTimingRows(root);
    assert.deepEqual(
      rows.map((r) => r.stage),
      ['tts', 'image', 'avatar', 'compile', 'render'],
      `stages: ${rows.map((r) => r.stage).join(',')}`,
    );
    const byStage = Object.fromEntries(rows.map((r) => [r.stage, r]));
    assert.ok(byStage.tts.cache.hits + byStage.tts.cache.misses >= 1, 'the tts stage counts its calls');
    assert.ok(byStage.image.cache.hits + byStage.image.cache.misses >= 1, 'the image stage counts its calls');
    assert.equal(byStage.avatar.cache.misses, 0, 'no avatar layer means no avatar spend');
    for (const row of rows) {
      assert.equal(row.plan_hash, 'def');
      assert.equal(row.episode, 'staged');
      assert.equal(verifyFingerprint(row.machine), true);
      assert.ok(row.duration_ms >= 0);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a render records compile and render timing rows when a facts context is passed', async () => {
  const { renderVideo } = await import('../scripts/lib/render.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'facts-render-'));
  try {
    fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
    const scriptPath = path.join(root, 'timed_NN.md');
    fs.writeFileSync(
      scriptPath,
      '---\nlevel: 3\ntitle: "Timed"\n---\n\n# NN Video\n\n## NN Video: Timed\nslug:: timed\ntitle:: Timed\n\n# NN Scene\n\n## NN Scene: One\nslug:: one\n\nOne two three four five.\n',
      'utf8',
    );
    await renderVideo({
      scriptPath,
      cacheDir: path.join(root, 'cache'),
      synthesizeAssets: false,
      gsapPath,
      facts: { rootDir: root, runId: 'run-1', episode: 'timed', planHash: 'abc' },
      hyperframesRun: async (cmd, args) => {
        fs.writeFileSync(args[args.indexOf('--output') + 1], 'fake-mp4');
        return { status: 0 };
      },
    });
    const rows = readTimingRows(root);
    const stages = rows.map((r) => r.stage);
    assert.ok(stages.includes('compile'), `stages: ${stages.join(',')}`);
    assert.ok(stages.includes('render'), `stages: ${stages.join(',')}`);
    const render = rows.find((r) => r.stage === 'render');
    assert.equal(render.plan_hash, 'abc');
    assert.equal(render.episode, 'timed');
    assert.equal(render.link_mode, 'link');
    assert.ok(render.render.frames > 0);
    assert.equal(verifyFingerprint(render.machine), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
