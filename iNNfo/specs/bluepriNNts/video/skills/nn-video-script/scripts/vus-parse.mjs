#!/usr/bin/env node

/**
 * nn-video-script/scripts/vus-parse.mjs
 *
 * Runs the vendored VUS parser over a script and fails only on parser ERRORS.
 * Warnings are reported but never block authoring - a scene may legitimately
 * carry no narration yet (e.g. @ 00 Intro without a template), which the
 * parser flags as a warning. The parser is
 * the committed self-contained mirror (`./lib/innfo-video-parser.generated.mjs`), so the
 * child runs under plain `node` — no external loader, no monorepo checkout.
 *
 * The parser now lives inside the skill: nothing here references an external checkout,
 * no environment variable is read, and the run never skips.
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
    [RUNNER_PATH, path.resolve(scriptPath)],
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

  const errors = result.issues.filter((i) => i.severity === 'error');
  const warnings = result.issues.filter((i) => i.severity !== 'error');

  if (warnings.length > 0) {
    // Warnings are advisory: report them but never block authoring.
    console.warn(`! [vus-parse] ${warnings.length} warning(s) reported by ScriptParser:`);
    for (const issue of warnings) {
      console.warn(`  - [${issue.severity}] line ${issue.line}: ${issue.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`✗ [vus-parse] ${errors.length} error(s) reported by ScriptParser:`);
    for (const issue of errors) {
      console.error(`  - [${issue.severity}] line ${issue.line}: ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(
    errors.length === 0 && warnings.length === 0
      ? `✓ [vus-parse] ScriptParser reports zero issues.`
      : `✓ [vus-parse] ScriptParser reports no errors.`,
  );
}


// Symlink/junction-safe guard: compare realpaths, not the typed path vs import.meta.url.
const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
