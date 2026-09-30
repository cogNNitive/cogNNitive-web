#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/vus-parse.mjs
 *
 * Runs the in-repo VUS parser (`@cognnitive/innfo-video-parser`) over a script
 * and requires zero issues. The package ships TypeScript source, so the actual
 * import happens in a child process spawned under the `tsx` loader
 * (vus-parse-runner.mjs) — this file itself runs under plain `node`.
 *
 * The parser lives in this monorepo: there is no external checkout and no
 * environment variable to set, and the run never skips.
 *
 * Usage:
 *   node vus-parse.mjs <script.md>
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RUNNER_PATH = path.join(__dirname, 'vus-parse-runner.mjs');

/**
 * @param {{ scriptPath: string }} args
 * @returns {{ skipped: false, issues: any[] }}
 */
export function runVusParse({ scriptPath }) {
  const result = spawnSync(
    process.execPath,
    ['--import', import.meta.resolve('tsx/esm'), RUNNER_PATH, path.resolve(scriptPath)],
    { encoding: 'utf8' },
  );

  if (result.status !== 0) {
    throw new Error(`vus-parse-runner failed (exit ${result.status}): ${result.stderr || result.stdout}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(`vus-parse-runner produced non-JSON output: ${result.stdout}\n${err.message}`);
  }

  return { skipped: false, issues: parsed.issues };
}

function main() {
  const scriptPath = process.argv[2];
  if (!scriptPath) {
    console.error('Usage: node vus-parse.mjs <script.md>');
    process.exit(1);
  }

  const result = runVusParse({ scriptPath });

  if (result.issues.length > 0) {
    console.error(`❌ [vus-parse] ${result.issues.length} issue(s) reported by ScriptParser:`);
    for (const issue of result.issues) {
      console.error(`  - [${issue.severity}] line ${issue.line}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log('✅ [vus-parse] ScriptParser reports zero issues.');
}

// Symlink/junction-safe guard: compare realpaths, not the typed path vs import.meta.url.
const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
