#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/vus-parse.mjs
 *
 * Runs `npx tsx` against `$VIDGENN_ROOT/packages/core/src/index.ts` to invoke
 * the real `ScriptParser` and requires zero issues (design.md "Data Flow" /
 * "Interfaces / Contracts"). VidGeNN core ships TypeScript source only, so
 * the actual import happens in a child process spawned under tsx
 * (vus-parse-runner.mjs) — this file itself runs under plain `node`.
 *
 * Gated on VIDGENN_ROOT: when unset, this NEVER probes a default path (see
 * the `preflight-tests-leak-real-home-dir` lesson) — it prints an explicit
 * skip line and exits 0 (a skip is not a failure).
 *
 * Zero dependencies beyond the `tsx` devDependency already used elsewhere in
 * this monorepo (VidGeNN's own `spec-audit` script uses the same toolchain).
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
 * @param {{ scriptPath: string, vidgennRoot?: string }} args
 * @returns {{ skipped: true, reason: string } | { skipped: false, issues: any[] }}
 */
export function runVusParse({ scriptPath, vidgennRoot = process.env.VIDGENN_ROOT }) {
  if (!vidgennRoot) {
    return { skipped: true, reason: 'VIDGENN_ROOT is not set; skipping VUS parser validation.' };
  }

  const result = spawnSync('npx', ['tsx', RUNNER_PATH, vidgennRoot, path.resolve(scriptPath)], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

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

  if (result.skipped) {
    console.log(`SKIP: ${result.reason}`);
    process.exit(0);
  }

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
