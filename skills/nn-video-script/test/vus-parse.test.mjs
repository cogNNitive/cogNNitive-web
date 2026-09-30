#!/usr/bin/env node

/**
 * skills/nn-video-script/test/vus-parse.test.mjs
 *
 * Tests for vus-parse.mjs. The parser is the in-repo
 * `@cognnitive/innfo-video-parser` workspace package, so every test here runs
 * with no external checkout: nothing may skip, and no environment variable
 * pointing outside the monorepo is read.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runVusParse } from '../scripts/vus-parse.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vusParsePath = path.join(__dirname, '..', 'scripts', 'vus-parse.mjs');
const WORKSPACE_SAMPLE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'iNNfo',
  'specs',
  'bluepriNNts',
  'video',
  'samples',
  'assets',
  'ghostbusters-recruitment-spot',
  'script.md',
);

const VALID_SAMPLE_SCRIPT = `//ANYDEO_SPEC: V_0-3-3
# Intro
@ Scene
This is the narration for the scene.
@@ Visual
- layer_type: image
![media](media/hero.jpg)
`;

const INVALID_SAMPLE_SCRIPT = `//ANYDEO_SPEC: V_0-3-3
# Intro
@ Scene
This is the narration for the scene.
- scene_not_a_real_property: nope
`;

function writeTmpScript(content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vus-parse-test-'));
  const scriptPath = path.join(tmpDir, 'script.md');
  fs.writeFileSync(scriptPath, content, 'utf8');
  return scriptPath;
}

// Environment variables that once pointed the CLI at an external spec checkout.
const DECOY_ROOT_VARS = ['EXTERNAL_SPEC_ROOT', 'VUS_ROOT', 'SPEC_ROOT'];

function cleanEnv() {
  const env = { ...process.env };
  for (const name of DECOY_ROOT_VARS) delete env[name];
  return env;
}

async function runTests() {
  console.log('Running vus-parse unit tests...');

  // Test 1: CLI runs to completion with no external root variable set. It must not skip.
  {
    const scriptPath = writeTmpScript(VALID_SAMPLE_SCRIPT);
    const res = spawnSync('node', [vusParsePath, scriptPath], {
      encoding: 'utf8',
      env: cleanEnv(),
    });
    assert.strictEqual(res.status, 0, `CLI must exit 0, got stderr: ${res.stderr}`);
    assert.ok(!/SKIP/.test(res.stdout), `CLI must not skip, got stdout: ${res.stdout}`);
    assert.ok(/zero issues/.test(res.stdout), `CLI must report zero issues, got stdout: ${res.stdout}`);
    console.log('✔ CLI parses a valid script with no external root variable set and does not skip');
  }

  // Test 2: a stale/foreign root variable is ignored, never consulted.
  {
    const scriptPath = writeTmpScript(VALID_SAMPLE_SCRIPT);
    const bogus = path.join(os.tmpdir(), 'does-not-exist-external-root');
    const env = { ...process.env };
    for (const name of DECOY_ROOT_VARS) env[name] = bogus;
    const res = spawnSync('node', [vusParsePath, scriptPath], { encoding: 'utf8', env });
    assert.strictEqual(res.status, 0, `CLI must ignore external root variables, got stderr: ${res.stderr}`);
    assert.ok(!/SKIP/.test(res.stdout));
    console.log('✔ external root variables are ignored');
  }

  // Test 3 (function-level): runVusParse never reports skipped.
  {
    const scriptPath = writeTmpScript(VALID_SAMPLE_SCRIPT);
    const result = runVusParse({ scriptPath });
    assert.strictEqual(result.skipped, false);
    assert.deepStrictEqual(result.issues, [], `Expected zero issues, got: ${JSON.stringify(result.issues)}`);
    console.log('✔ runVusParse returns zero issues on a valid script');
  }

  // Test 4: an invalid script is reported and the CLI exits non-zero.
  {
    const scriptPath = writeTmpScript(INVALID_SAMPLE_SCRIPT);
    const res = spawnSync('node', [vusParsePath, scriptPath], {
      encoding: 'utf8',
      env: cleanEnv(),
    });
    assert.strictEqual(res.status, 1, `CLI must exit 1 on issues, got status ${res.status}: ${res.stdout}`);
    assert.ok(/issue\(s\)/.test(res.stderr), `CLI must list the issues, got stderr: ${res.stderr}`);
    console.log('✔ CLI exits 1 and lists issues for an invalid script');
  }

  // Test 5: the shipped workspace sample runs through the real parser (no skip)
  // and is valid against the vendored spec.
  {
    const res = spawnSync('node', [vusParsePath, WORKSPACE_SAMPLE], {
      encoding: 'utf8',
      env: cleanEnv(),
    });
    assert.ok(!/SKIP/.test(res.stdout), 'workspace sample must not be skipped');
    assert.strictEqual(res.status, 0, `sample must parse clean, got status ${res.status}: ${res.stderr}${res.stdout}`);
    console.log('✔ Workspace sample is parsed for real and is valid');
  }


  console.log('\nAll vus-parse unit tests passed! 🎉');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
