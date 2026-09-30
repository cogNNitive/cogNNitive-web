#!/usr/bin/env node

/**
 * skills/nn-video-script/test/cli-symlink-guard.test.mjs
 *
 * Regression test for the symlink/junction-safe CLI entry guard. Every
 * `scripts/*.mjs` with a self-execution guard is invoked both through a
 * directory junction (Windows) / symlink (POSIX) and through its realpath,
 * and the two runs must behave identically. The historical bug: the guard
 * compared `import.meta.url` (a realpath URL) against `pathToFileURL(argv[1])`
 * (the typed path), so through a junction `main()` never ran — the process
 * exited 0 with no output, silently "passing" a validation gate.
 *
 * Zero external test framework dependencies (runs with plain node), matching
 * the repo's `*.test.mjs` convention.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.join(__dirname, '..', 'scripts');

const GUARDED_SCRIPTS = [
  'check-script.mjs',
  'vus-parse.mjs',
  'vus-spec.mjs',
  'finalize-video.mjs',
  'render-thumbnail.mjs',
];

function runCli(scriptPath) {
  const r = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
  return {
    status: r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
  };
}

function linkDirectory(linkPath, targetDir) {
  fs.symlinkSync(targetDir, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

function unlinkDirectory(linkPath) {
  if (process.platform === 'win32') fs.rmdirSync(linkPath);
  else fs.unlinkSync(linkPath);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-video-symlink-'));
const linkedScriptsDir = path.join(tmpDir, 'scripts-link');
let failures = 0;

try {
  linkDirectory(linkedScriptsDir, SCRIPTS_DIR);
  assert.ok(
    fs.existsSync(path.join(linkedScriptsDir, 'check-script.mjs')),
    'junction must resolve to the scripts directory',
  );

  for (const script of GUARDED_SCRIPTS) {
    const viaLink = runCli(path.join(linkedScriptsDir, script));
    const viaReal = runCli(path.join(SCRIPTS_DIR, script));

    try {
      assert.ok(
        !(viaLink.status === 0 && viaLink.stdout === '' && viaLink.stderr === ''),
        `${script}: silently exited 0 with no output through a junction`,
      );
      assert.deepStrictEqual(
        viaLink,
        viaReal,
        `${script}: junction run did not match the realpath run`,
      );
      console.log(`✔ ${script} runs identically through a junction`);
    } catch (err) {
      failures++;
      console.error(`✖ ${err.message}`);
    }
  }
} finally {
  try {
    unlinkDirectory(linkedScriptsDir);
  } catch {
    /* junction already gone */
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n✖ ${failures} symlink-guard test(s) failed.`);
  process.exit(1);
}
console.log('\nAll CLI symlink-guard tests passed! 🎉');
