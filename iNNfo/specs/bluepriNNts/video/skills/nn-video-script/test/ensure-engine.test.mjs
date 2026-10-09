#!/usr/bin/env node

/**
 * nn-video-script/test/ensure-engine.test.mjs
 *
 * Guards the consent-gated, idempotent engine install:
 *  1. Idempotent no-op when @remotion/renderer resolves and the version pin matches.
 *  2. Missing engine + consent decline → exit 1, no install.
 *  3. The size notice is printed BEFORE any install is attempted.
 *
 * All side effects are injected through the `deps` seam (resolve/install/confirm/
 * print) — the test never touches the network or node_modules.
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEnsureEngine } from '../scripts/ensure-engine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runTests() {
  console.log('Running ensure-engine unit tests...');

  // 1. Idempotent no-op: engine present and the version pin matches.
  {
    const output = [];
    const code = await runEnsureEngine({
      deps: {
        resolveEngine: () => '0.4.0',
        installEngine: async () => {
          throw new Error('installEngine must not run when the engine is present');
        },
        confirm: async () => true,
        print: (line) => output.push(line),
      },
    });
    assert.strictEqual(code, 0, 'engine present must exit 0');
    assert.ok(output.some((l) => /engine present/i.test(l)), `expected an "engine present" notice, got: ${output.join('\n')}`);
    console.log('✔ idempotent re-run is a no-op when the engine is present');
  }

  // 2. Missing engine + consent decline → exit 1, no install.
  {
    const output = [];
    let installed = false;
    const code = await runEnsureEngine({
      deps: {
        resolveEngine: () => null,
        installEngine: async () => {
          installed = true;
        },
        confirm: async () => false,
        print: (line) => output.push(line),
      },
    });
    assert.strictEqual(code, 1, 'a declined install must exit 1');
    assert.strictEqual(installed, false, 'a declined install must not run');
    console.log('✔ declining consent exits 1 without installing');
  }

  // 3. Missing engine + consent accept → size notice printed before install, exit 0.
  {
    const output = [];
    const order = [];
    let installedNow = false;
    const code = await runEnsureEngine({
      deps: {
        resolveEngine: () => (installedNow ? '0.4.0' : null),
        installEngine: async () => {
          order.push('install');
          installedNow = true;
        },
        confirm: async () => {
          order.push('confirm');
          return true;
        },
        print: (line) => output.push(line),
      },
    });
    assert.strictEqual(code, 0, 'an accepted install must exit 0');
    assert.ok(order.indexOf('confirm') < order.indexOf('install'), 'the notice/consent must come before install');
    assert.ok(
      output.some((l) => /mb|size/i.test(l)),
      `expected a size notice before install, got: ${output.join('\n')}`,
    );
    assert.ok(
      output.some((l) => /browser/i.test(l)),
      `expected a first-render browser notice, got: ${output.join('\n')}`,
    );
    console.log('✔ the size + browser notice is printed before install, then installs');
  }

  console.log('\nAll ensure-engine unit tests passed! 🎉');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
