#!/usr/bin/env node

/**
 * skills/nn-video-script/test/vus-spec-pin.test.mjs
 *
 * Regression test for the pinned VUS spec. The spec is vendored inside the
 * monorepo (`@cognnitive/innfo-video-parser`), so nothing here depends on an
 * external checkout or on any environment variable:
 *  1. Mechanism: `loadVusSpec` accepts a spec whose bytes hash to the pin and
 *     rejects it loudly on drift, using throwaway fixtures.
 *  2. Live pin: the pin committed in SKILL.md must match the real vendored
 *     `V_0-3-3.json`, and the CLI must serve voices from it (never skipping).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import {
  VENDORED_SPECS_DIR,
  computeSha256,
  listVoices,
  loadVusSpec,
  readPinnedVusSpec,
  resolveVusSpecPath,
} from '../scripts/vus-spec.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_MD = path.join(__dirname, '..', 'SKILL.md');
const VUS_SPEC_CLI = path.join(__dirname, '..', 'scripts', 'vus-spec.mjs');

// 1. Deterministic mechanism test against a fixture specs directory.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vus-pin-'));
  try {
    const version = 'V_0-9-9';
    const specPath = path.join(tmp, `${version}.json`);
    const specText = JSON.stringify({ info: { version }, api_options: { voices: ['A'] }, properties: {} });
    fs.writeFileSync(specPath, specText.replace(/\n/g, '\r\n'), 'utf8');

    const skillMdPath = path.join(tmp, 'SKILL.md');
    const writePin = (sha) =>
      fs.writeFileSync(
        skillMdPath,
        `---\nname: x\nvus_spec:\n  version: "${version}"\n  sha256: "${sha}"\n---\n# x\n`,
        'utf8',
      );

    writePin(computeSha256(specPath));
    const ok = loadVusSpec({ specsDir: tmp, skillMdPath });
    assert.strictEqual(ok.skipped, undefined, 'the spec pin check must never skip');
    assert.strictEqual(listVoices(ok.spec).length, 1);
    console.log('✔ pinned spec accepted when the hash matches (CRLF normalized)');

    writePin('0'.repeat(64));
    assert.throws(() => loadVusSpec({ specsDir: tmp, skillMdPath }), /hash drift/, 'drift must be rejected loudly');
    console.log('✔ spec rejected on sha256 drift');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 2. Live pin against the vendored spec, no environment variable involved.
{
  const pin = readPinnedVusSpec(SKILL_MD);
  const specPath = resolveVusSpecPath(pin.version);
  assert.ok(specPath.startsWith(VENDORED_SPECS_DIR), 'the pin must resolve inside the vendored specs directory');
  assert.ok(fs.existsSync(specPath), `vendored spec not found at ${specPath}`);
  const actual = computeSha256(specPath);
  assert.strictEqual(
    actual,
    pin.sha256,
    `SKILL.md pin is stale: pinned ${pin.sha256}, vendored ${specPath} hashes to ${actual}`,
  );
  const live = loadVusSpec();
  assert.ok(listVoices(live.spec).length > 0, 'vendored spec must expose voices');
  console.log(`✔ live pin matches the vendored spec (${listVoices(live.spec).length} voices)`);
}

// 3. The CLI serves the vendored spec with no environment variable and no skip line.
{
  const env = { ...process.env };
  for (const name of ['EXTERNAL_SPEC_ROOT', 'VUS_ROOT', 'SPEC_ROOT']) delete env[name];
  const res = spawnSync('node', [VUS_SPEC_CLI, 'voices'], { encoding: 'utf8', env });
  assert.strictEqual(res.status, 0, `vus-spec voices must succeed, got: ${res.stderr}`);
  assert.ok(!/SKIP/.test(res.stdout), 'vus-spec must not print a skip line');
  assert.ok(Array.isArray(JSON.parse(res.stdout)) && JSON.parse(res.stdout).length > 0);
  console.log('✔ vus-spec voices runs from the vendored spec without any environment variable');
}

console.log('\nAll vus-spec pin tests passed! 🎉');
