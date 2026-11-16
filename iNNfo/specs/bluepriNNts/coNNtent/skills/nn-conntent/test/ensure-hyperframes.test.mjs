import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runEnsureHyperframes, resolveInstalledCli, resolveInstalledGsap, GSAP_PIN } from '../scripts/ensure-hyperframes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, '..', 'scripts', 'ensure-hyperframes.mjs');

const ready = (over = {}) => ({ resolveCli: () => '0.8.192', resolveGsap: () => '3.14.2', ...over });

test('reports ready (0) when the pinned CLI and GSAP resolve', async () => {
  const lines = [];
  const code = await runEnsureHyperframes({ ...ready(), print: (l) => lines.push(l) });
  assert.equal(code, 0);
  assert.match(lines.join('\n'), /CLI 0\.8\.192 present/);
  assert.match(lines.join('\n'), /GSAP 3\.14\.2 present/);
  assert.match(lines.join('\n'), /vendor\/gsap\.min\.js/);
});

test('a missing CLI exits 1 and prints the fix (installs nothing, no npx)', async () => {
  const lines = [];
  let installed = 0;
  const code = await runEnsureHyperframes({
    ...ready({ resolveCli: () => null }),
    print: (l) => lines.push(l),
    installRuntime: () => {
      installed++;
      return { ok: true, status: 0, detail: '' };
    },
  });
  assert.equal(code, 1);
  assert.equal(installed, 0, 'a readiness check never installs');
  assert.match(lines.join('\n'), /--install/);
});

test('--install installs the pinned runtime once and then reports it', async () => {
  const lines = [];
  const state = { cli: null, gsap: null };
  let installed = 0;
  const code = await runEnsureHyperframes({
    install: true,
    pin: '0.8.192',
    gsapPin: '3.14.2',
    resolveCli: () => state.cli,
    resolveGsap: () => state.gsap,
    print: (l) => lines.push(l),
    installRuntime: () => {
      installed++;
      state.cli = '0.8.192';
      state.gsap = '3.14.2';
      return { ok: true, status: 0, detail: '' };
    },
  });
  assert.equal(installed, 1);
  assert.equal(code, 0);
  assert.match(lines.join('\n'), /CLI 0\.8\.192 present/);
});

test('--install on a ready runtime never touches the network', async () => {
  const lines = [];
  let installed = 0;
  const code = await runEnsureHyperframes({
    ...ready(),
    install: true,
    print: (l) => lines.push(l),
    installRuntime: () => {
      installed++;
      return { ok: true, status: 0, detail: '' };
    },
  });
  assert.equal(installed, 0);
  assert.equal(code, 0);
});

test('a failed install exits 1 and names the command', async () => {
  const lines = [];
  const code = await runEnsureHyperframes({
    ...ready({ resolveCli: () => null }),
    install: true,
    print: (l) => lines.push(l),
    installRuntime: () => ({ ok: false, status: 1, detail: 'ERR_EACCES' }),
  });
  assert.equal(code, 1);
  assert.match(lines.join('\n'), /install failed/);
  assert.match(lines.join('\n'), /--install/);
});

test('a version different from the pin exits 1', async () => {
  const lines = [];
  const code = await runEnsureHyperframes({ ...ready({ resolveCli: () => '9.9.9' }), print: (l) => lines.push(l) });
  assert.equal(code, 1);
  assert.match(lines.join('\n'), /9\.9\.9 ≠ pin 0\.8\.192/);
});

test('a missing or mismatched GSAP exits 1: the project cannot be emitted hermetically', async () => {
  for (const resolveGsap of [() => null, () => '9.9.9']) {
    const lines = [];
    const code = await runEnsureHyperframes({ ...ready({ resolveGsap }), print: (l) => lines.push(l) });
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /GSAP/);
  }
});

test('the GSAP pin is exact (no range) and read from package.json', () => {
  assert.equal(GSAP_PIN, '3.14.2');
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.equal(pkg.dependencies.gsap, '3.14.2');
});

test('resolveInstalledCli reports the pin or null, never a wrong version as ready', () => {
  // Machine-independent: a checkout may or may not carry the skill's node_modules.
  const installed = resolveInstalledCli();
  assert.ok(installed === null || installed === '0.8.192', `unexpected installed CLI: ${installed}`);
});

test('resolveInstalledGsap reports the pin or null, never a wrong version as ready', () => {
  const installed = resolveInstalledGsap();
  assert.ok(installed === null || installed === '3.14.2', `unexpected installed GSAP: ${installed}`);
});

test('the provisioner never shells out to a package runner', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.ok(!/\bnpx\b/.test(src), 'the provisioner must not shell out to npx');
});
