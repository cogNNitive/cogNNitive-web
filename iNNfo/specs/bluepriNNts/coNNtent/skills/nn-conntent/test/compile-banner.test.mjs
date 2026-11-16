/**
 * nn-conntent/test/compile-banner.test.mjs
 *
 * The cost banner before a compile run. It used to print "local (gratis)" whenever the planned
 * model list came back empty, which happens both when every asset is cached and when a planned
 * call carries no model id: the author read "free" and the run then charged the provider.
 * The banner now states one of three facts and never names a provider it did not resolve.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { cliReporter } from '../scripts/lib/compile.mjs';

function capture(fn) {
  const lines = [];
  const original = console.log;
  console.log = (line) => lines.push(String(line));
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines.join('\n');
}

const plan = (overrides = {}) => ({
  phase: 'plan',
  ttsTotal: 0,
  mediaTotal: 0,
  plannedCount: 0,
  models: [],
  totalUsd: 0,
  ...overrides,
});

test('a fully cached run says so and never claims a provider', () => {
  const out = capture(() => cliReporter(plan({ ttsTotal: 3, mediaTotal: 0, plannedCount: 0 })));
  assert.match(out, /0 llamadas al proveedor/);
  assert.doesNotMatch(out, /gratis/);
});

test('a planned run names the resolved models', () => {
  const out = capture(() =>
    cliReporter(
      plan({
        ttsTotal: 3,
        mediaTotal: 1,
        plannedCount: 2,
        models: ['minimax/speech-2.8-hd', 'wavespeed-ai/z-image/turbo'],
        totalUsd: 0.0034,
      }),
    ),
  );
  assert.match(out, /minimax\/speech-2\.8-hd/);
  assert.match(out, /wavespeed-ai\/z-image\/turbo/);
  assert.match(out, /0\.0034/);
  assert.doesNotMatch(out, /gratis/);
});

test('a planned run without a resolved model does not read as free', () => {
  const out = capture(() =>
    cliReporter(plan({ ttsTotal: 1, mediaTotal: 0, plannedCount: 1, totalUsd: 0.0021 })),
  );
  assert.doesNotMatch(out, /gratis/);
  assert.match(out, /sin modelo resuelto/);
});
