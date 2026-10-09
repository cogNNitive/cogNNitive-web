import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFAULT_GUARD,
  GUARD_FILENAME,
  BudgetExceededError,
  ModelBlockedError,
  BudgetTracker,
  appendLedger,
  assertModelAllowed,
  createLimiter,
  findWorkspaceRoot,
  ledgerPath,
  loadGuard,
  resolveDefaultCacheDir,
} from '../scripts/lib/video-guard.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';

function tmp() {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'video-guard-')));
}

describe('loadGuard / findWorkspaceRoot', () => {
  it('uses safe defaults when no video-guard.json exists', () => {
    const root = tmp();
    fs.mkdirSync(path.join(root, '.git'));
    const guard = loadGuard(path.join(root, 'series', 'x'));
    assert.equal(guard.config.budgetPerRunUsd, 2.0);
    assert.equal(guard.config.maxAvatarConcurrency, 1);
    assert.ok(guard.config.blockedModels.includes('wavespeed-ai/infinitetalk'));
    assert.equal(guard.source, null);
    assert.equal(guard.root, root);
    assert.deepEqual(guard.config.voices, {});
  });

  it('walks up from a nested dir to the directory holding video-guard.json', () => {
    const root = tmp();
    fs.writeFileSync(
      path.join(root, GUARD_FILENAME),
      JSON.stringify({ version: 1, budgetPerRunUsd: 5, voices: { Ana: { voice_id: 'v1', series: 's' } } }),
    );
    const deep = path.join(root, 'series', 's', 'assets', 'ep1');
    fs.mkdirSync(deep, { recursive: true });
    const guard = loadGuard(deep);
    assert.equal(guard.root, root);
    assert.equal(guard.source, path.join(root, GUARD_FILENAME));
    assert.equal(guard.config.budgetPerRunUsd, 5);
    // Unspecified keys fall back to the safe defaults.
    assert.deepEqual(guard.config.blockedModels, DEFAULT_GUARD.blockedModels);
    assert.equal(guard.config.voices.Ana.voice_id, 'v1');
    assert.equal(findWorkspaceRoot(deep), root);
  });

  it('throws a clear error on malformed JSON', () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, GUARD_FILENAME), '{ nope');
    assert.throws(() => loadGuard(root), /video-guard\.json/);
  });
});

describe('assertModelAllowed', () => {
  const config = {
    allowedModels: ['minimax/speech-2.8-hd', 'wavespeed-ai/infinitetalk-fast'],
    blockedModels: ['wavespeed-ai/infinitetalk'],
  };

  it('accepts an allowlisted model', () => {
    assert.doesNotThrow(() => assertModelAllowed('minimax/speech-2.8-hd', { config }));
  });

  it('rejects a blocked model, naming the escape hatch', () => {
    assert.throws(
      () => assertModelAllowed('wavespeed-ai/infinitetalk', { config }),
      (err) => err instanceof ModelBlockedError && /--allow-model/.test(err.message),
    );
  });

  it('allows a blocked model only with an explicit allowBlocked entry', () => {
    assert.doesNotThrow(() =>
      assertModelAllowed('wavespeed-ai/infinitetalk', { config, allowBlocked: ['wavespeed-ai/infinitetalk'] }),
    );
  });

  it('allowBlocked does not unlock a different blocked model', () => {
    assert.throws(
      () => assertModelAllowed('wavespeed-ai/infinitetalk', { config, allowBlocked: ['other/model'] }),
      ModelBlockedError,
    );
  });

  it('rejects a model that is not on the allowlist, and --allow-model unlocks it', () => {
    assert.throws(() => assertModelAllowed('some/new-model', { config }), ModelBlockedError);
    assert.doesNotThrow(() => assertModelAllowed('some/new-model', { config, allowBlocked: ['some/new-model'] }));
  });
});

describe('BudgetTracker', () => {
  it('accumulates charges and exposes the running total', () => {
    const b = new BudgetTracker({ budgetUsd: 2 });
    b.charge(0.5, 'a');
    b.charge(1.0, 'b');
    assert.equal(b.totalUsd, 1.5);
    assert.equal(b.remainingUsd, 0.5);
  });

  it('throws BEFORE recording the call that would exceed the budget', () => {
    const b = new BudgetTracker({ budgetUsd: 2 });
    b.charge(1.5, 'first');
    assert.throws(
      () => b.charge(0.6, 'second'),
      (err) => err instanceof BudgetExceededError && /second/.test(err.message) && /2\.00/.test(err.message),
    );
    assert.equal(b.totalUsd, 1.5, 'a refused charge must not be recorded');
  });

  it('allows spending exactly up to the budget', () => {
    const b = new BudgetTracker({ budgetUsd: 1 });
    assert.doesNotThrow(() => b.charge(1, 'exact'));
  });
});

describe('appendLedger', () => {
  it('appends one JSON line per call under <root>/.cognnitive/video-ledger.jsonl', () => {
    const root = tmp();
    appendLedger(root, { model: 'm1', estUsd: 0.1, ref: 'scene-1' });
    appendLedger(root, { model: 'm2', estUsd: 0.2, ref: 'scene-2' });
    const lines = fs.readFileSync(ledgerPath(root), 'utf8').trim().split('\n');
    assert.equal(lines.length, 2);
    const first = JSON.parse(lines[0]);
    assert.equal(first.model, 'm1');
    assert.equal(first.estUsd, 0.1);
    assert.equal(first.ref, 'scene-1');
    assert.equal(first.cacheHit, false);
    assert.ok(!Number.isNaN(Date.parse(first.ts)));
    assert.equal(ledgerPath(root), path.join(root, '.cognnitive', 'video-ledger.jsonl'));
  });
});

describe('createLimiter', () => {
  it('never exceeds maxConcurrency', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const job = () =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
      });
    await Promise.all([job(), job(), job(), job(), job(), job()]);
    assert.equal(peak, 2);
  });

  it('serializes with maxConcurrency 1 and keeps running after a rejection', async () => {
    const limit = createLimiter(1);
    const order = [];
    const results = await Promise.allSettled([
      limit(async () => {
        order.push('a');
        throw new Error('boom');
      }),
      limit(async () => {
        order.push('b');
        return 'ok';
      }),
    ]);
    assert.equal(results[0].status, 'rejected');
    assert.equal(results[1].value, 'ok');
    assert.deepEqual(order, ['a', 'b']);
  });

  it('rejects a non-positive concurrency', () => {
    assert.throws(() => createLimiter(0), /maxConcurrency/);
  });
});

describe('default cache dir', () => {
  it('resolves to <workspaceRoot>/.cognnitive/cache/video regardless of cwd', () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, GUARD_FILENAME), '{"version":1}');
    const nested = path.join(root, 'series', 'a');
    fs.mkdirSync(nested, { recursive: true });
    assert.equal(resolveDefaultCacheDir(nested), path.join(root, '.cognnitive', 'cache', 'video'));
  });

  it('CacheManager uses the workspace cache for a startDir, and an explicit baseDir still wins', () => {
    const root = tmp();
    fs.writeFileSync(path.join(root, GUARD_FILENAME), '{"version":1}');
    const nested = path.join(root, 'series', 'a');
    fs.mkdirSync(nested, { recursive: true });

    const byWorkspace = new CacheManager({ startDir: nested });
    assert.equal(byWorkspace.baseDir, path.join(root, '.cognnitive', 'cache', 'video'));

    const explicit = path.join(tmp(), 'my-cache');
    assert.equal(new CacheManager({ baseDir: explicit, startDir: nested }).baseDir, explicit);
  });
});
