import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  BudgetExceededError,
  BudgetTracker,
  DEFAULT_GUARD,
  GUARD_FILENAME,
  appendLedger,
  findWorkspaceRoot,
  ledgerPath,
  loadGuard,
  readLedger,
  sumLedgerSince,
  validateConfig,
  SpendGuard,
  isSystemVoice,
  assertModelAllowed,
  normalizeModelId,
} from '../scripts/lib/video-guard.mjs';
import { acquireLock, acquireSlot, withFileLock } from '../scripts/lib/file-lock.mjs';
import { computePlanHash } from '../scripts/lib/plan-approval.mjs';
import { parseArgs, CliUsageError } from '../scripts/lib/cli-args.mjs';

function tmp() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'guard-hard-')));
}

describe('config validation (fail loudly)', () => {
  const write = (obj) => {
    const root = tmp();
    fs.writeFileSync(path.join(root, GUARD_FILENAME), typeof obj === 'string' ? obj : JSON.stringify(obj));
    return root;
  };

  it('defaults include dailyCapUsd 5 and the skill default image models', () => {
    assert.equal(DEFAULT_GUARD.dailyCapUsd, 5.0);
    assert.ok(DEFAULT_GUARD.allowedModels.includes('wavespeed-ai/z-image/turbo'));
    assert.ok(DEFAULT_GUARD.allowedModels.includes('black-forest-labs/flux-schnell'));
    assert.ok(!DEFAULT_GUARD.allowedModels.includes('wavespeed-ai/minimax-speech-01'));
  });

  const badConfigs = [
    ['negative budget', { budgetPerRunUsd: -1 }],
    ['string budget', { budgetPerRunUsd: '2' }],
    ['null budget', { budgetPerRunUsd: null }],
    ['negative dailyCap', { dailyCapUsd: -5 }],
    ['zero concurrency', { maxAvatarConcurrency: 0 }],
    ['fractional concurrency', { maxAvatarConcurrency: 1.5 }],
    ['null allowedModels', { allowedModels: null }],
    ['empty allowedModels', { allowedModels: [] }],
    ['non-string allowed entry', { allowedModels: ['ok/model', 3] }],
    ['non-array blockedModels', { blockedModels: 'x' }],
    ['array voices', { voices: [] }],
  ];
  for (const [label, bad] of badConfigs) {
    it('rejects ' + label, () => {
      assert.throws(() => loadGuard(write({ version: 1, ...bad })), /video-guard\.json/);
    });
  }

  it('rejects corrupt JSON and accepts a valid file', () => {
    assert.throws(() => loadGuard(write('{ nope')), /video-guard\.json/);
    assert.doesNotThrow(() => loadGuard(write({ version: 1, budgetPerRunUsd: 0 })));
  });

  it('validateConfig is exported and checks a plain object', () => {
    assert.throws(() => validateConfig({ ...DEFAULT_GUARD, allowedModels: [] }, 'x'), /allowedModels/);
  });

  it('BudgetTracker.charge rejects non-finite or negative estimates', () => {
    const b = new BudgetTracker({ budgetUsd: 5 });
    for (const bad of [NaN, Infinity, -1, undefined, '1']) {
      assert.throws(() => b.charge(bad, 'x'), /estUsd/);
    }
    assert.equal(b.totalUsd, 0);
  });
});

describe('single root resolver', () => {
  it('prefers video-guard.json over a nearer .git, and ignores .cognnitive as a marker', () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, GUARD_FILENAME), '{"version":1}');
    const series = path.join(root, 'series', 's');
    fs.mkdirSync(path.join(series, '.cognnitive'), { recursive: true });
    fs.mkdirSync(path.join(series, '.git'));
    assert.equal(findWorkspaceRoot(series), root);
    assert.equal(loadGuard(series).root, root);
  });

  it('falls back to the nearest .git, never to a stray .cognnitive', () => {
    const root = tmp();
    fs.mkdirSync(path.join(root, '.git'));
    const series = path.join(root, 'series', 's');
    fs.mkdirSync(path.join(series, '.cognnitive'), { recursive: true });
    assert.equal(findWorkspaceRoot(series), root);
    assert.equal(loadGuard(series).root, root);
  });
});

describe('ledger reader and daily sum', () => {
  it('skips corrupt and partial lines and sums only the last 24h of spend', () => {
    const root = tmp();
    const file = ledgerPath(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const now = Date.now();
    const old = new Date(now - 25 * 3600 * 1000).toISOString();
    const fresh = new Date(now - 3600 * 1000).toISOString();
    const partial = '{"ts":"' + fresh + '","estUsd":9';
    fs.writeFileSync(
      file,
      [
        JSON.stringify({ ts: old, estUsd: 100, cacheHit: false }),
        'garbage line',
        JSON.stringify({ ts: fresh, estUsd: 1.5, cacheHit: false, outcome: 'started' }),
        JSON.stringify({ ts: fresh, estUsd: 0, cacheHit: true }),
        JSON.stringify({ ts: fresh, estUsd: 'NaN' }),
        partial,
      ].join('\n'),
    );
    assert.equal(readLedger(root).length, 4);
    assert.equal(sumLedgerSince(root, now - 24 * 3600 * 1000), 1.5);
  });

  it('appends on a fresh line after a partial trailing line', () => {
    const root = tmp();
    const file = ledgerPath(root);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{"partial":');
    appendLedger(root, { kind: 'tts', model: 'm', estUsd: 0.1 });
    assert.equal(readLedger(root).length, 1);
  });

  it('records outcome and cache hits', () => {
    const root = tmp();
    appendLedger(root, { kind: 'tts', model: 'm', estUsd: 0.1, outcome: 'started' });
    appendLedger(root, { kind: 'tts', ref: 's1', estUsd: 0, cacheHit: true, outcome: 'cache-hit' });
    const lines = readLedger(root);
    assert.equal(lines[0].cacheHit, false);
    assert.equal(lines[1].cacheHit, true);
  });
});

describe('daily cap in SpendGuard', () => {
  it('refuses a call that would push the last 24h over dailyCapUsd, across runs', async () => {
    const root = tmp();
    const config = { ...structuredClone(DEFAULT_GUARD), budgetPerRunUsd: 10, dailyCapUsd: 1 };
    const approved = { totalUsd: 100, allowedModels: ['minimax/speech-2.8-hd'], allowModels: [] };
    const approval = () => ({ ok: true, approval: approved });
    const a = new SpendGuard({ config, root, approval });
    const t = await a.authorize({ kind: 'tts', model: 'minimax/speech-2.8-hd', estUsd: 0.8, ref: 'x' });
    assert.ok(t);
    const b = new SpendGuard({ config, root, approval });
    await assert.rejects(
      b.authorize({ kind: 'tts', model: 'minimax/speech-2.8-hd', estUsd: 0.3, ref: 'y' }),
      (err) => err instanceof BudgetExceededError && /daily/i.test(err.message),
    );
  });
});

describe('file locks', () => {
  it('provides mutual exclusion', async () => {
    const dir = tmp();
    let active = 0;
    let peak = 0;
    const job = () =>
      withFileLock(path.join(dir, 'x.lock'), async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 15));
        active--;
      });
    await Promise.all([job(), job(), job(), job()]);
    assert.equal(peak, 1);
    assert.ok(!fs.existsSync(path.join(dir, 'x.lock')));
  });

  it('breaks a stale lock and times out on a live one', async () => {
    const dir = tmp();
    const lock = path.join(dir, 'y.lock');
    fs.writeFileSync(lock, 'dead');
    const past = new Date(Date.now() - 60000);
    fs.utimesSync(lock, past, past);
    let ran = false;
    await withFileLock(lock, async () => {
      ran = true;
    }, { staleMs: 1000 });
    assert.equal(ran, true);

    fs.writeFileSync(lock, 'alive');
    const noop = async () => {};
    await assert.rejects(withFileLock(lock, noop, { staleMs: 60000, timeoutMs: 80, retryMs: 10 }), /Timed out/);
  });

  it('acquireSlot bounds simultaneous holders across callers', async () => {
    const dir = tmp();
    const r1 = await acquireSlot(dir, 'avatar', 2);
    const r2 = await acquireSlot(dir, 'avatar', 2);
    await assert.rejects(acquireSlot(dir, 'avatar', 2, { timeoutMs: 80, retryMs: 10 }), /Timed out/);
    r1();
    const r3 = await acquireSlot(dir, 'avatar', 2, { timeoutMs: 500, retryMs: 10 });
    r2();
    r3();
  });
});

describe('cli arg parser', () => {
  const spec = { boolean: ['dry-run'], value: ['approval', 'out'], repeatable: ['allow-model'] };

  it('supports --flag value and --flag=value, repeatables and positionals after booleans', () => {
    const argv = ['compile', '--dry-run', 'script.md', '--approval=a.json', '--allow-model', 'a/b', '--allow-model=c/d'];
    const r = parseArgs(argv, spec);
    assert.deepEqual(r._, ['compile', 'script.md']);
    assert.equal(r.flags['dry-run'], true);
    assert.equal(r.flags.approval, 'a.json');
    assert.deepEqual(r.flags['allow-model'], ['a/b', 'c/d']);
  });

  it('errors when a value flag has no value, or an option is unknown', () => {
    assert.throws(() => parseArgs(['--approval'], spec), CliUsageError);
    assert.throws(() => parseArgs(['--approval', '--dry-run'], spec), /requires a value/);
    assert.throws(() => parseArgs(['--allow-model='], spec), /requires a value/);
    assert.throws(() => parseArgs(['--nope'], spec), /Unknown option/);
    assert.throws(() => parseArgs(['--dry-run=yes'], spec), /does not take a value/);
  });
});

describe('systemVoices config', () => {
  it('has the provider-native defaults and validates its shape', () => {
    for (const v of ['Friendly_Person', 'Wise_Woman', 'Deep_Voice_Man', 'Elegant_Man', 'Casual_Guy', 'English_*']) {
      assert.ok(DEFAULT_GUARD.systemVoices.includes(v), v);
    }
    assert.throws(() => validateConfig({ ...DEFAULT_GUARD, systemVoices: null }, 'x'), /systemVoices/);
    assert.throws(() => validateConfig({ ...DEFAULT_GUARD, systemVoices: ['ok', 3] }, 'x'), /systemVoices/);
    assert.doesNotThrow(() => validateConfig({ ...DEFAULT_GUARD, systemVoices: [] }, 'x'));
  });

  it('isSystemVoice matches exact names and trailing-* globs only', () => {
    const list = ['Friendly_Person', 'English_*'];
    assert.equal(isSystemVoice('Friendly_Person', list), true);
    assert.equal(isSystemVoice('English_Deep-VoicedGentleman', list), true);
    assert.equal(isSystemVoice('Friendly_Person2', list), false);
    assert.equal(isSystemVoice('NotEnglish_X', list), false);
  });
});

describe('model alias normalization', () => {
  const config = {
    allowedModels: ['minimax/speech-2.8-hd', 'wavespeed-ai/infinitetalk-fast'],
    blockedModels: ['wavespeed-ai/infinitetalk'],
  };

  it('strips a leading replicate/ only when the rest is a vendor/model id', () => {
    assert.equal(normalizeModelId('replicate/minimax/speech-2.8-hd'), 'minimax/speech-2.8-hd');
    assert.equal(normalizeModelId('replicate/wavespeed-ai/infinitetalk'), 'wavespeed-ai/infinitetalk');
    assert.equal(normalizeModelId('replicate/flux-schnell'), 'replicate/flux-schnell');
    assert.equal(normalizeModelId('minimax/speech-2.8-hd'), 'minimax/speech-2.8-hd');
    assert.equal(normalizeModelId('elevenlabs'), 'elevenlabs');
  });

  it('allows the replicate-prefixed alias of an allowed model', () => {
    assert.doesNotThrow(() => assertModelAllowed('replicate/minimax/speech-2.8-hd', { config }));
  });

  it('blockedModels still wins after normalization', () => {
    assert.throws(() => assertModelAllowed('replicate/wavespeed-ai/infinitetalk', { config }), /blocked/);
  });

  it('allowBlocked matches through the alias in either direction', () => {
    assert.doesNotThrow(() =>
      assertModelAllowed('replicate/wavespeed-ai/infinitetalk', { config, allowBlocked: ['wavespeed-ai/infinitetalk'] }),
    );
    assert.doesNotThrow(() =>
      assertModelAllowed('wavespeed-ai/infinitetalk', { config, allowBlocked: ['replicate/wavespeed-ai/infinitetalk'] }),
    );
  });

  it('a guard authorizes the alias and ledgers the normalized id', async () => {
    const root = tmp();
    const cfg = { ...structuredClone(DEFAULT_GUARD), budgetPerRunUsd: 10, dailyCapUsd: 10 };
    const guard = new SpendGuard({ config: cfg, root, approval: () => ({ ok: true }) });
    await guard.authorize({ kind: 'tts', model: 'replicate/minimax/speech-2.8-hd', estUsd: 0.01, ref: 'r' });
    assert.equal(readLedger(root)[0].model, 'minimax/speech-2.8-hd');
    await assert.rejects(
      guard.authorize({ kind: 'avatar', model: 'replicate/wavespeed-ai/infinitetalk', estUsd: 0.1 }),
      /blocked/,
    );
  });

  it('plan_hash treats the alias and the normalized model flag as the same choice', () => {
    const a = computePlanHash('x', { tts: 'replicate/minimax/speech-2.8-hd' });
    assert.equal(a, computePlanHash('x', { tts: 'minimax/speech-2.8-hd' }));
  });
});

describe('file lock hardening', () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  it('a lock held longer than staleMs is NOT broken while its heartbeat runs', async () => {
    const dir = tmp();
    const lock = path.join(dir, 'hb.lock');
    let secondRan = false;
    const holder = withFileLock(lock, () => sleep(500), { staleMs: 200, heartbeatMs: 40 });
    await sleep(50);
    const waiter = withFileLock(lock, () => { secondRan = true; }, { staleMs: 200, timeoutMs: 300, retryMs: 20, heartbeatMs: 40 }).catch((e) => e);
    const res = await waiter;
    assert.ok(res instanceof Error && /Timed out/.test(res.message), 'the live holder must not be robbed');
    assert.equal(secondRan, false);
    await holder;
  });

  it('a lock whose owner PID is dead is stale immediately, even with a fresh mtime', async () => {
    const dir = tmp();
    const lock = path.join(dir, 'dead.lock');
    fs.writeFileSync(lock, JSON.stringify({ pid: 2147483646, token: 'ghost', ts: Date.now() }));
    let ran = false;
    await withFileLock(lock, () => { ran = true; }, { staleMs: 60000, timeoutMs: 500 });
    assert.equal(ran, true);
  });

  it('two waiters racing for a stale lock never hold it together', async () => {
    const dir = tmp();
    const lock = path.join(dir, 'race.lock');
    fs.writeFileSync(lock, JSON.stringify({ pid: 2147483646, token: 'ghost', ts: 0 }));
    let active = 0;
    let peak = 0;
    const job = () =>
      withFileLock(lock, async () => {
        active++;
        peak = Math.max(peak, active);
        await sleep(30);
        active--;
      }, { staleMs: 100, timeoutMs: 2000, retryMs: 5 });
    await Promise.all([job(), job(), job()]);
    assert.equal(peak, 1);
  });

  it('release of a lock that now belongs to someone else is a no-op', async () => {
    const dir = tmp();
    const lock = path.join(dir, 'foreign.lock');
    const release = await acquireLock(lock);
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, token: 'someone-else', ts: Date.now() }));
    release();
    assert.ok(fs.existsSync(lock), 'a foreign lock must survive our release');
    assert.equal(JSON.parse(fs.readFileSync(lock, 'utf8')).token, 'someone-else');
  });
});
