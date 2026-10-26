import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEnsureHyperframes, resolveInstalledCli } from '../scripts/ensure-hyperframes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'ensure-hyperframes.mjs');

test('--check exits 1 when the CLI is absent, without installing', async () => {
  let installed = false;
  const code = await runEnsureHyperframes({
    check: true,
    deps: {
      resolveCli: () => null,
      updateSkills: () => { installed = true; },
      print: () => {},
    },
  });
  assert.equal(code, 1);
  assert.equal(installed, false, 'check must install nothing');
});

test('reports ready (0) when the CLI resolves', async () => {
  const lines = [];
  const code = await runEnsureHyperframes({
    deps: { resolveCli: () => '0.8.192', print: (l) => lines.push(l) },
  });
  assert.equal(code, 0);
  assert.match(lines.join('\n'), /CLI present/);
});

test('consent-gated install runs the skills update with the pinned CLI', async () => {
  let calledWith = null;
  const code = await runEnsureHyperframes({
    yes: true,
    deps: {
      resolveCli: () => null,
      updateSkills: (pin) => { calledWith = pin; },
      print: () => {},
    },
  });
  assert.equal(code, 0);
  assert.equal(calledWith, '0.8.192');
});

test('declined install exits non-zero', async () => {
  const code = await runEnsureHyperframes({
    deps: { resolveCli: () => null, confirm: async () => false, print: () => {} },
  });
  assert.equal(code, 1);
});

test('resolveInstalledCli maps a non-zero probe to null', () => {
  assert.equal(resolveInstalledCli({ run: () => ({ status: 1, stdout: '' }) }), null);
  assert.equal(resolveInstalledCli({ run: () => ({ status: 0, stdout: '0.8.192\n' }) }), '0.8.192');
});

test('no Remotion reference remains', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.ok(!/@remotion/.test(src), 'the provisioner must not reference Remotion');
});
