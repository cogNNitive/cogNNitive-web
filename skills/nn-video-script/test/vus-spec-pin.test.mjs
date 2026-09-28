#!/usr/bin/env node

/**
 * skills/nn-video-script/test/vus-spec-pin.test.mjs
 *
 * Two-part regression test for the pinned VUS spec:
 *  1. Deterministic: `loadVusSpec` accepts a spec whose bytes hash to the pin
 *     and rejects it loudly on drift — throwaway fixtures, no VIDGENN_ROOT.
 *  2. Freshness (environment-gated): when VIDGENN_ROOT points at a VidGeNN
 *     checkout, the pin committed in SKILL.md must match the real canonical
 *     `packages/core/specs/<version>.json`. Skipped, loudly, without it.
 *
 * The freshness half fails on a stale pin (the historical bug: pin 72630624…
 * vs canonical d617aadc…) and passes once the pin is corrected.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeSha256,
  listVoices,
  loadVusSpec,
  readPinnedVusSpec,
  resolveVusSpecPath,
} from '../scripts/vus-spec.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_MD = path.join(__dirname, '..', 'SKILL.md');

// 1. Deterministic mechanism test, no external checkout.
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vus-pin-'));
  try {
    const version = 'V_0-9-9';
    const specDir = path.join(tmp, 'packages', 'core', 'specs');
    fs.mkdirSync(specDir, { recursive: true });
    const specPath = path.join(specDir, `${version}.json`);
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
    const ok = loadVusSpec({ vidgennRoot: tmp, skillMdPath });
    assert.strictEqual(ok.skipped, false);
    assert.strictEqual(listVoices(ok.spec).length, 1);
    console.log('✔ pinned spec accepted when the hash matches (CRLF normalized)');

    writePin('0'.repeat(64));
    assert.throws(
      () => loadVusSpec({ vidgennRoot: tmp, skillMdPath }),
      /hash drift/,
      'drift must be rejected loudly',
    );
    console.log('✔ spec rejected on sha256 drift');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 2. Freshness test against the real VidGeNN checkout, when available.
{
  const root = process.env.VIDGENN_ROOT;
  if (!root || !fs.existsSync(root)) {
    console.log('SKIP: VIDGENN_ROOT not set/found; skipping live VUS pin freshness check.');
  } else {
    const pin = readPinnedVusSpec(SKILL_MD);
    const specPath = resolveVusSpecPath(root, pin.version);
    assert.ok(fs.existsSync(specPath), `pinned spec not found at ${specPath}`);
    const actual = computeSha256(specPath);
    assert.strictEqual(
      actual,
      pin.sha256,
      `SKILL.md pin is stale: pinned ${pin.sha256}, canonical ${specPath} hashes to ${actual}`,
    );
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    assert.ok(listVoices(spec).length > 0, 'canonical spec must expose voices');
    console.log(`✔ live pin matches ${specPath} (${listVoices(spec).length} voices)`);
  }
}

console.log('\nAll vus-spec pin tests passed! 🎉');
