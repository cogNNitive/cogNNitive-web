#!/usr/bin/env node

/**
 * skills/nn-video-script/test/check-script.test.mjs
 *
 * Unit tests for check-script.mjs — the Zero-Unresolved-Placeholder Gate and
 * the No-Upward-Escape asset check. Zero external test framework dependencies
 * (runs with plain node), matching the repo's `*.test.mjs` convention.
 */

import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import {
  findPlaceholders,
  findLeftoverSlotComments,
  findHeaderIssues,
  findAssetEscapes,
  runCheckScript,
} from '../scripts/check-script.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const checkScriptPath = path.join(__dirname, '..', 'scripts', 'check-script.mjs');
const PINNED = 'V_0-3-3';

async function runTests() {
  console.log('Running check-script unit tests...');

  // Test 1: leaked {{slot}} placeholder is detected with line:col
  {
    const content = 'Line one\n{{hook_line}} is still here\n';
    const findings = findPlaceholders(content);
    assert.strictEqual(findings.length, 1, 'Expected exactly one leaked placeholder');
    assert.strictEqual(findings[0].line, 2, 'Placeholder should be reported on line 2');
    assert.strictEqual(findings[0].col, 1, 'Placeholder should be reported at column 1');
    console.log('✔ Leaked {{slot}} placeholder detected');
  }

  // Test 2: fully resolved content has zero placeholder findings
  {
    const content = 'Line one\nNo placeholders here.\n';
    assert.strictEqual(findPlaceholders(content).length, 0, 'Expected zero placeholder findings');
    console.log('✔ Fully resolved content passes the placeholder check');
  }

  // Test 3: leftover slot instruction comment is detected
  {
    const content = '{{hook_line}}<!-- slot: one sentence -->\n';
    const findings = findLeftoverSlotComments(content);
    assert.strictEqual(findings.length, 1, 'Expected one leftover slot comment finding');
    assert.strictEqual(findings[0].line, 1);
    console.log('✔ Leftover <!-- slot: --> comment detected');
  }

  // Test 4: missing header line is rejected
  {
    const content = '# Intro\n@ Scene\n';
    const findings = findHeaderIssues(content, PINNED);
    assert.strictEqual(findings.length, 1, 'Expected missing-header finding');
    assert.strictEqual(findings[0].line, 1);
    console.log('✔ Missing header line rejected');
  }

  // Test 5: header pinned to the wrong version is rejected
  {
    const content = `//ANYDEO_SPEC: V_0-3-2\n# Intro\n`;
    const findings = findHeaderIssues(content, PINNED);
    assert.strictEqual(findings.length, 1, 'Expected version-mismatch finding');
    assert.ok(/V_0-3-2/.test(findings[0].message), 'Message should mention the wrong version');
    console.log('✔ Wrong pinned header version rejected');
  }

  // Test 6: correctly pinned header passes
  {
    const content = `//ANYDEO_SPEC: ${PINNED}\n# Intro\n`;
    assert.strictEqual(findHeaderIssues(content, PINNED).length, 0, 'Expected zero header findings');
    console.log('✔ Correctly pinned header passes');
  }

  // Test 7: an allowed in-series asset path is accepted
  {
    const seriesRoot = path.join('workspace', 'series', 'innovators');
    const scriptDir = path.join(seriesRoot, 'assets', 'pilot');
    const content = '![media](../../shared/hero.mp4)\n';
    const findings = findAssetEscapes(content, { scriptDir, seriesRoot });
    assert.strictEqual(findings.length, 0, 'In-series relative path must be accepted');
    console.log('✔ Allowed ../../shared asset path accepted');
  }

  // Test 8: an asset path that escapes the Series folder is rejected
  {
    const seriesRoot = path.join('workspace', 'series', 'innovators');
    const scriptDir = path.join(seriesRoot, 'assets', 'pilot');
    const content = '![media](../../../../assets/x.mp4)\n';
    const findings = findAssetEscapes(content, { scriptDir, seriesRoot });
    assert.strictEqual(findings.length, 1, 'Escaping path must be rejected');
    assert.ok(/escapes its Series folder/.test(findings[0].message));
    console.log('✔ Escaping asset path rejected');
  }

  // Test 9: http(s) asset paths are always allowed
  {
    const seriesRoot = path.join('workspace', 'series', 'innovators');
    const scriptDir = path.join(seriesRoot, 'assets', 'pilot');
    const content = '![media](https://cdn.example.com/hero.mp4)\n';
    assert.strictEqual(findAssetEscapes(content, { scriptDir, seriesRoot }).length, 0, 'http(s) paths must be allowed');
    console.log('✔ http(s) asset path allowed');
  }

  // Test 10: file://, absolute, and asset:// paths are rejected outright
  {
    const seriesRoot = path.join('workspace', 'series', 'innovators');
    const scriptDir = path.join(seriesRoot, 'assets', 'pilot');
    for (const forbidden of ['file:///etc/passwd', '/etc/passwd', 'asset://hero.mp4', 'C:/Windows/hero.mp4']) {
      const content = `![media](${forbidden})\n`;
      const findings = findAssetEscapes(content, { scriptDir, seriesRoot });
      assert.strictEqual(findings.length, 1, `Expected ${forbidden} to be rejected`);
    }
    console.log('✔ file://, absolute, and asset:// paths rejected');
  }

  // Test 11: runCheckScript runs categories in order and fails fast on the first one
  {
    const seriesRoot = path.join('workspace', 'series', 'innovators');
    const scriptDir = path.join(seriesRoot, 'assets', 'pilot');
    const content = `{{leaked}}<!-- slot: x -->\n`; // both placeholder AND leftover comment present
    const result = runCheckScript({ content, scriptDir, seriesRoot, pinnedVersion: PINNED });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.category, 'placeholder', 'Placeholder check must run first and fail fast');
    console.log('✔ runCheckScript fails fast on the first category (placeholder before slot comment)');
  }

  // Test 12: runCheckScript passes end-to-end on a fully clean script
  {
    const seriesRoot = path.join('workspace', 'series', 'innovators');
    const scriptDir = path.join(seriesRoot, 'assets', 'pilot');
    const content = `//ANYDEO_SPEC: ${PINNED}\n# Intro\n@ Scene\nHello world.\n![media](../../shared/hero.mp4)\n`;
    const result = runCheckScript({ content, scriptDir, seriesRoot, pinnedVersion: PINNED });
    assert.strictEqual(result.ok, true, `Expected a clean script to pass, got: ${JSON.stringify(result)}`);
    console.log('✔ runCheckScript passes on a fully clean script');
  }

  // Test 13: CLI exits 1 with line:col findings printed to stderr on failure
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-script-cli-'));
    const scriptPath = path.join(tmpDir, 'script.md');
    fs.writeFileSync(scriptPath, `//ANYDEO_SPEC: ${PINNED}\n{{leaked}}\n`, 'utf8');
    const res = spawnSync('node', [checkScriptPath, scriptPath, '--series-root', tmpDir, '--pinned-version', PINNED], { encoding: 'utf8' });
    assert.strictEqual(res.status, 1, 'CLI must exit 1 on a failed check');
    assert.ok(/\d+:\d+/.test(res.stderr), 'CLI stderr must include line:col findings');
    console.log('✔ CLI exits 1 with line:col findings on failure');
  }

  // Test 14: CLI exits 0 on a fully clean script
  {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-script-cli-'));
    const scriptPath = path.join(tmpDir, 'script.md');
    fs.writeFileSync(scriptPath, `//ANYDEO_SPEC: ${PINNED}\n# Intro\n@ Scene\nHello world.\n`, 'utf8');
    const res = spawnSync('node', [checkScriptPath, scriptPath, '--series-root', tmpDir, '--pinned-version', PINNED], { encoding: 'utf8' });
    assert.strictEqual(res.status, 0, `CLI must exit 0 on a clean script, got stderr: ${res.stderr}`);
    console.log('✔ CLI exits 0 on a fully clean script');
  }

  console.log('\nAll check-script unit tests passed! 🎉');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
