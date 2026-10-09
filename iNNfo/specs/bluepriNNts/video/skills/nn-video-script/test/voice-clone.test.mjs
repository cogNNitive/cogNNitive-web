import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cloneVoice, createWaveSpeedVoiceClient, VOICE_CLONE_EST_USD } from '../scripts/voice-clone.mjs';
import { BudgetExceededError, GUARD_FILENAME, readLedger } from '../scripts/lib/video-guard.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'scripts', 'voice-clone.mjs');

function workspace(guard, sampleBytes = 'fake audio') {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'voice-clone-')));
  if (guard) fs.writeFileSync(path.join(root, GUARD_FILENAME), JSON.stringify(guard));
  else fs.mkdirSync(path.join(root, '.git'));
  const sample = path.join(root, 'sample.mp3');
  fs.writeFileSync(sample, Buffer.from(sampleBytes));
  return { root, sample, guardFile: path.join(root, GUARD_FILENAME) };
}

function fakeClient(voiceId = 'voice-123', onCall) {
  const calls = [];
  return {
    calls,
    async cloneVoice(args) {
      calls.push(args);
      if (onCall) await onCall(args);
      return { voiceId };
    },
  };
}

const readGuard = (ws) => JSON.parse(fs.readFileSync(ws.guardFile, 'utf8'));

describe('cloneVoice', () => {
  it('records the voice (with sample hash) and ledgers the attempt with its outcome', async () => {
    const ws = workspace({ version: 1, budgetPerRunUsd: 5, voices: { Other: { voice_id: 'o1', series: 'x' } } });
    const client = fakeClient();
    const res = await cloneVoice({ name: 'Ana', samplePath: ws.sample, series: 'my-series', startDir: ws.root, client });
    assert.equal(res.voiceId, 'voice-123');
    const saved = readGuard(ws);
    assert.equal(saved.voices.Ana.voice_id, 'voice-123');
    assert.equal(saved.voices.Ana.series, 'my-series');
    assert.match(saved.voices.Ana.sample_sha256, /^[0-9a-f]{64}$/);
    assert.ok(!saved.voices.Ana.pending);
    assert.equal(saved.voices.Other.voice_id, 'o1');
    assert.equal(saved.budgetPerRunUsd, 5);
    const ledger = readLedger(ws.root);
    assert.deepEqual(ledger.map((e) => e.outcome), ['started', 'ok']);
    assert.equal(ledger[0].model, 'minimax/voice-clone');
    assert.equal(ledger[0].estUsd, VOICE_CLONE_EST_USD);
    assert.equal(ledger[0].ref, 'Ana');
    assert.deepEqual(fs.readdirSync(ws.root).filter((f) => f.endsWith('.tmp')), []);
  });

  it('creates video-guard.json with safe defaults when none exists', async () => {
    const ws = workspace(null);
    await cloneVoice({ name: 'Ana', samplePath: ws.sample, startDir: ws.root, client: fakeClient() });
    const saved = readGuard(ws);
    assert.equal(saved.budgetPerRunUsd, 2.0);
    assert.equal(saved.dailyCapUsd, 5.0);
    assert.equal(saved.voices.Ana.voice_id, 'voice-123');
  });

  it('reserves a pending entry BEFORE the provider call, so a concurrent clone is refused', async () => {
    const ws = workspace({ version: 1 });
    let during;
    let second;
    const client = fakeClient('v1', async () => {
      during = readGuard(ws).voices.Ana;
      second = await cloneVoice({ name: 'ANA', samplePath: ws.sample, startDir: ws.root, client: fakeClient() }).catch((e) => e);
    });
    await cloneVoice({ name: 'Ana', samplePath: ws.sample, startDir: ws.root, client });
    assert.equal(during.pending, true);
    assert.ok(second instanceof Error && /already exists|pending/.test(second.message));
    assert.equal(readGuard(ws).voices.Ana.voice_id, 'v1');
  });

  it('removes the pending reservation and ledgers the failure when the provider fails', async () => {
    const ws = workspace({ version: 1 });
    const client = { async cloneVoice() { throw new Error('provider down'); } };
    await assert.rejects(cloneVoice({ name: 'Ana', samplePath: ws.sample, startDir: ws.root, client }), /provider down/);
    assert.equal(readGuard(ws).voices.Ana, undefined);
    assert.deepEqual(readLedger(ws.root).map((e) => e.outcome), ['started', 'failed']);
  });

  it('uses the voice id returned by the provider', async () => {
    const ws = workspace({ version: 1 });
    const fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: { voice_id: 'real_id_9' } }) });
    const client = createWaveSpeedVoiceClient({ env: { WAVESPEED_API_KEY: 'fake' }, fetch });
    const res = await cloneVoice({ name: 'Ana', samplePath: ws.sample, startDir: ws.root, client });
    assert.equal(res.voiceId, 'real_id_9');
    assert.equal(readGuard(ws).voices.Ana.voice_id, 'real_id_9');
  });
});

describe('cloneVoice refusals', () => {
  const existing = { version: 1, voices: { Ana: { voice_id: 'v-old', series: 's', sample_sha256: 'a'.repeat(64) } } };

  it('refuses an existing name (exact or different case) before calling the provider', async () => {
    for (const name of ['Ana', 'ana', 'ANA']) {
      const ws = workspace(existing);
      const client = fakeClient();
      await assert.rejects(cloneVoice({ name, samplePath: ws.sample, startDir: ws.root, client }), /already exists.*--force/s);
      assert.equal(client.calls.length, 0);
      assert.deepEqual(readLedger(ws.root), []);
      assert.equal(readGuard(ws).voices.Ana.voice_id, 'v-old');
    }
  });

  it('refuses a sample that was already cloned under another name', async () => {
    const ws = workspace({ version: 1 });
    await cloneVoice({ name: 'Ana', samplePath: ws.sample, startDir: ws.root, client: fakeClient('v1') });
    const client = fakeClient('v2');
    await assert.rejects(cloneVoice({ name: 'Bea', samplePath: ws.sample, startDir: ws.root, client }), /already cloned as "Ana"/);
    assert.equal(client.calls.length, 0);
  });

  it('re-clones with force, keeps the series, and restores the old voice if the provider fails', async () => {
    const ws = workspace(existing);
    await cloneVoice({ name: 'Ana', samplePath: ws.sample, startDir: ws.root, client: fakeClient('v-new'), force: true });
    assert.equal(readGuard(ws).voices.Ana.voice_id, 'v-new');
    assert.equal(readGuard(ws).voices.Ana.series, 's');

    const ws2 = workspace(existing);
    const bad = { async cloneVoice() { throw new Error('nope'); } };
    await assert.rejects(cloneVoice({ name: 'Ana', samplePath: ws2.sample, startDir: ws2.root, client: bad, force: true }), /nope/);
    assert.equal(readGuard(ws2).voices.Ana.voice_id, 'v-old');
  });

  it('rejects reserved and unsafe names without polluting prototypes', async () => {
    const ws = workspace({ version: 1 });
    const client = fakeClient();
    for (const name of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'prototype', '', '  ', 'a/b', 'x'.repeat(80)]) {
      await assert.rejects(cloneVoice({ name, samplePath: ws.sample, startDir: ws.root, client }), /name/i, JSON.stringify(name));
    }
    assert.equal(client.calls.length, 0);
    assert.equal({}.voice_id, undefined);
  });

  it('fails on a missing sample and on a clone that would pass the per-run budget', async () => {
    const ws = workspace({ version: 1, budgetPerRunUsd: 1.0 });
    const client = fakeClient();
    await assert.rejects(cloneVoice({ name: 'Ana', samplePath: path.join(ws.root, 'nope.mp3'), startDir: ws.root, client }), /sample/i);
    await assert.rejects(cloneVoice({ name: 'Ana', samplePath: ws.sample, startDir: ws.root, client }), BudgetExceededError);
    assert.equal(client.calls.length, 0);
    assert.equal(readGuard(ws).voices?.Ana, undefined);
  });

  it('counts toward the rolling daily cap', async () => {
    const ws = workspace({ version: 1, budgetPerRunUsd: 10, dailyCapUsd: 2 });
    await cloneVoice({ name: 'Ana', samplePath: ws.sample, startDir: ws.root, client: fakeClient('v1') });
    fs.writeFileSync(path.join(ws.root, 'other.mp3'), 'different audio');
    await assert.rejects(
      cloneVoice({ name: 'Bea', samplePath: path.join(ws.root, 'other.mp3'), startDir: ws.root, client: fakeClient('v2') }),
      /Daily cap/,
    );
  });
});

describe('voice-clone CLI', () => {
  const env = () => {
    const e = { ...process.env, WAVESPEED_API_KEY: '', REPLICATE_API_TOKEN: '', ELEVENLABS_API_KEY: '' };
    return e;
  };

  it('exits non-zero for an existing voice without --force (no provider call)', () => {
    const ws = workspace({ version: 1, voices: { Ana: { voice_id: 'v-old', series: 's' } } });
    const res = spawnSync(process.execPath, [CLI, 'Ana', ws.sample], { encoding: 'utf8', cwd: ws.root, env: env() });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /already exists/);
  });

  it('prints usage with every flag, and errors on a missing flag value', () => {
    const usage = spawnSync(process.execPath, [CLI], { encoding: 'utf8', env: env() });
    assert.notEqual(usage.status, 0);
    for (const flag of ['--series', '--force']) assert.ok(usage.stderr.includes(flag), flag);
    const bad = spawnSync(process.execPath, [CLI, 'Ana', 'x.mp3', '--series'], { encoding: 'utf8', env: env() });
    assert.match(bad.stderr, /requires a value/);
  });
});
