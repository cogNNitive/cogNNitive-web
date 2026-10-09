#!/usr/bin/env node

/**
 * nn-video-script/test/vus-spec-pin.test.mjs
 *
 * Regression test for the pinned VUS spec. The spec is vendored INSIDE this skill
 * (`<skill>/specs/<version>.json`) so an installed copy is self-contained; nothing
 * here depends on an external checkout or on any environment variable:
 *  1. Mechanism: `loadVusSpec` accepts a spec whose bytes hash to the pin and
 *     rejects it loudly on drift, using throwaway fixtures.
 *  2. Live pin: the pin committed in SKILL.md must match the real vendored
 *     `V_0-3-3.json`, and the CLI must serve voices from it (never skipping).
 *  3. Vendored copy: the skill's copy must stay byte-identical to the package
 *     source `iNNfo/packages/innfo-video-parser/specs/<pin>.json`.
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
const SKILL_DIR = path.join(__dirname, '..');
// test -> nn-video-script -> skills -> video -> bluepriNNts -> specs -> iNNfo -> repo root
const REPO_ROOT = path.join(SKILL_DIR, '..', '..', '..', '..', '..', '..');

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

    // A single flipped byte in the spec, with the pin left at the original hash, must be rejected.
    writePin(computeSha256(specPath));
    fs.writeFileSync(specPath, specText.replace('"A"', '"B"').replace(/\n/g, '\r\n'), 'utf8');
    assert.throws(() => loadVusSpec({ specsDir: tmp, skillMdPath }), /hash drift/, 'a one-byte drift must be rejected');
    console.log('✔ spec rejected on a one-byte content drift');
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

// 3. The vendored copy is byte-identical to the package source (the VUS byte-check).
{
  const pin = readPinnedVusSpec(SKILL_MD);
  const vendored = path.join(SKILL_DIR, 'specs', `${pin.version}.json`);
  const source = path.join(REPO_ROOT, 'iNNfo', 'packages', 'innfo-video-parser', 'specs', `${pin.version}.json`);
  assert.strictEqual(
    resolveVusSpecPath(pin.version),
    vendored,
    'the skill must resolve its spec from its own specs/ directory',
  );
  assert.ok(fs.existsSync(vendored), `vendored spec missing at ${vendored}`);
  const sourcePkgDir = path.join(REPO_ROOT, 'iNNfo', 'packages', 'innfo-video-parser');
  if (!fs.existsSync(sourcePkgDir)) {
    // An installed copy (~/.agents/skills/nn-video-script/test/) has no monorepo around it. The
    // vendored-copy-vs-SKILL.md-pin check (section 2) still ran; only the cross-package
    // byte-compare is impossible here, so skip it explicitly instead of failing.
    console.log(`SKIP: monorepo package source not found at ${sourcePkgDir}; vendored-vs-source byte-compare not run`);
  } else {
    assert.ok(fs.existsSync(source), `package source spec missing at ${source}`);
    assert.ok(
      fs.readFileSync(vendored).equals(fs.readFileSync(source)),
      'vendored spec diverges from iNNfo/packages/innfo-video-parser/specs; re-copy it and update the pin together',
    );
    console.log('✔ vendored spec is byte-identical to the package source');
  }
}

// 4. The CLI serves the vendored spec with no environment variable and no skip line.
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
