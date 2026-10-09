#!/usr/bin/env node

/**
 * nn-video-script/test/parser-mirror.test.mjs
 *
 * Guards the self-contained VUS parser mirror:
 *  1. The committed ESM artifact imports and parses a valid script with zero issues,
 *     with no npm install and no monorepo path (spec: Installed copy compiles with no
 *     monorepo checkout).
 *  2. `build-video-parser-mirror.mjs --check` exits 0 when in sync and non-zero after
 *     the parser source drifts (spec: drift check fails on stale mirror).
 *  3. The live mirror's VUS_SPEC digest matches the pin in SKILL.md.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, '..');
// nn-video-script -> skills -> video -> bluepriNNts -> specs -> iNNfo -> repo root
const REPO_ROOT = path.join(SKILL_DIR, '..', '..', '..', '..', '..', '..');
const MIRROR_PATH = path.join(SKILL_DIR, 'scripts', 'lib', 'innfo-video-parser.generated.mjs');
const BUILDER = path.join(REPO_ROOT, 'scripts', 'build-video-parser-mirror.mjs');
const SKILL_MD = path.join(SKILL_DIR, 'SKILL.md');

const VALID_SCRIPT = `//ANYDEO_SPEC: V_0-3-3
# Intro
@ Scene
This is the narration for the scene.
@@ Visual
- layer_type: image
![media](media/hero.jpg)
`;

function readPinnedSha() {
  const content = fs.readFileSync(SKILL_MD, 'utf8');
  const m = content.match(/sha256:\s*"?([0-9a-f]{64})"?/);
  if (!m) throw new Error('no sha256 pin found in SKILL.md');
  return m[1];
}

async function runTests() {
  console.log('Running parser-mirror unit tests...');

  // 1. The committed mirror imports by relative path and parses cleanly.
  {
    assert.ok(fs.existsSync(MIRROR_PATH), `mirror missing at ${MIRROR_PATH}`);
    const mod = await import(new URL(`file://${MIRROR_PATH.replace(/\\/g, '/')}`).href);
    assert.strictEqual(typeof mod.parse, 'function', 'mirror must export parse');
    const result = mod.parse(VALID_SCRIPT, 'test');
    assert.deepStrictEqual(result.issues, [], `expected zero issues, got ${JSON.stringify(result.issues)}`);
    console.log('✔ committed mirror parses a valid script with zero issues');
  }

  // 2. The embedded spec digest matches the canonical LF-normalized hash of the
  //    vendored spec file (also the SKILL.md pin).
  {
    const mod = await import(new URL(`file://${MIRROR_PATH.replace(/\\/g, '/')}`).href);
    const specFile = path.join(
      REPO_ROOT,
      'iNNfo',
      'packages',
      'innfo-video-parser',
      'specs',
      'V_0-3-3.json',
    );
    let text = fs.readFileSync(specFile, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    text = text.replace(/\r\n/g, '\n');
    const realSha = createHash('sha256').update(text, 'utf8').digest('hex');
    assert.strictEqual(mod.VUS_SPEC.sha256, realSha, 'mirror VUS_SPEC.sha256 must match the vendored spec');
    assert.strictEqual(mod.VUS_SPEC.sha256, readPinnedSha(), 'mirror digest must match the SKILL.md pin');
    console.log('✔ mirror spec digest matches the vendored spec and SKILL.md pin');
  }

  // 3. --check exits 0 when the mirror is in sync.
  {
    const res = spawnSync('node', [BUILDER, '--check'], { encoding: 'utf8', cwd: REPO_ROOT });
    assert.strictEqual(res.status, 0, `--check must pass when in sync, got: ${res.stderr}${res.stdout}`);
    console.log('✔ --check exits 0 when the mirror is in sync');
  }

  // 4. --check exits non-zero after the parser source is touched (drift).
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'video-mirror-drift-'));
    try {
      const outFile = path.join(tmp, 'stale.mjs');
      const gen = spawnSync('node', [BUILDER, '--out', outFile], { encoding: 'utf8', cwd: REPO_ROOT });
      assert.strictEqual(gen.status, 0, `builder --out must succeed: ${gen.stderr}`);
      fs.appendFileSync(outFile, '\n// drift\n');
      const res = spawnSync('node', [BUILDER, '--check', '--out', outFile], { encoding: 'utf8', cwd: REPO_ROOT });
      assert.strictEqual(res.status, 1, `--check must exit 1 on drift, got ${res.status}`);
      console.log('✔ --check exits non-zero on a stale mirror');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  console.log('\nAll parser-mirror unit tests passed! 🎉');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
