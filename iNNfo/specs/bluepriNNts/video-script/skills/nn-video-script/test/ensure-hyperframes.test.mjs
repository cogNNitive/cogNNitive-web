import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEnsureHyperframes, resolveInstalledCli } from '../scripts/ensure-hyperframes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'ensure-hyperframes.mjs');

test('reports ready (0) when the pinned CLI resolves', async () => {
  const lines = [];
  const code = await runEnsureHyperframes({
    resolveCli: () => '0.8.192',
    print: (l) => lines.push(l),
  });
  assert.equal(code, 0);
  assert.match(lines.join('\n'), /CLI 0\.8\.192 present/);
});

test('a missing CLI exits 1 and prints the fix (installs nothing, no npx)', async () => {
  const lines = [];
  const code = await runEnsureHyperframes({ resolveCli: () => null, print: (l) => lines.push(l) });
  assert.equal(code, 1);
  assert.match(lines.join('\n'), /skills-manager\.js update video-script/);
});

test('a version different from the pin exits 1', async () => {
  const lines = [];
  const code = await runEnsureHyperframes({ resolveCli: () => '9.9.9', print: (l) => lines.push(l) });
  assert.equal(code, 1);
  assert.match(lines.join('\n'), /9\.9\.9 ≠ pin 0\.8\.192/);
});

test('resolveInstalledCli returns null when node_modules carries no CLI', () => {
  // The test tree has no installed node_modules, so the real probe is null.
  assert.equal(resolveInstalledCli(), null);
});

test('the provisioner never shells out to a package runner', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.ok(!/\bnpx\b/.test(src), 'the provisioner must not shell out to npx');
});
