#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/ensure-engine.mjs
 *
 * Idempotent, consent-gated installer for the Remotion renderer runtime. The parser
 * is already vendored (no npm needed); this only brings in the renderer + bundler and,
 * on first render, Chromium. Everything is behind an explicit size notice and consent.
 *
 *   node ensure-engine.mjs [--check] [--yes]
 *
 *   --check   report readiness only (exit 0 if ready, 1 otherwise); install nothing.
 *   --yes     skip the interactive prompt (CI / non-interactive).
 *
 * exit 0 = ready; exit 1 = missing/declined.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_MD = path.join(__dirname, '..', 'SKILL.md');
const DEFAULT_ENGINE_VERSION = '4.0.0';
const APPROX_TOTAL_MB = '≈ 120 MB (bundler + renderer + React runtime)';

/** Reads the `engine: { version }` pin from SKILL.md frontmatter (hand-rolled, zero-dep). */
export function readEnginePin(skillMdPath = SKILL_MD) {
  try {
    const content = fs.readFileSync(skillMdPath, 'utf8');
    const m = content.match(/engine:\s*\r?\n(?:[ \t]+.+\r?\n?)+/);
    if (m) {
      const v = m[0].match(/version:\s*"?([\w.-]+)"?/);
      if (v) return { version: v[1] };
    }
  } catch {
    // fall through to default
  }
  return { version: DEFAULT_ENGINE_VERSION };
}

/** True when @remotion/renderer resolves from this skill's location. */
export function resolveInstalledEngine() {
  const require = createRequire(import.meta.url);
  for (const base of [__dirname, path.join(__dirname, '..', '..', '..')]) {
    try {
      const pkgPath = require.resolve('@remotion/renderer/package.json', { paths: [base] });
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return pkg.version || 'unknown';
    } catch {
      // try the next base
    }
  }
  return null;
}

/** Default installer: npm install the Remotion runtime into the skill directory. */
async function defaultInstallEngine() {
  const res = spawnSync(
    'npm',
    ['install', '--no-save', 'remotion', '@remotion/bundler', '@remotion/renderer', 'react', 'react-dom'],
    { cwd: path.join(__dirname, '..'), encoding: 'utf8', stdio: 'inherit', shell: true },
  );
  if (res.status !== 0) {
    throw new Error(`engine install failed (exit ${res.status})`);
  }
}

/** Default interactive confirmation on stdin. */
function defaultConfirm(question) {
  process.stdout.write(`${question} [y/N] `);
  const buf = Buffer.alloc(64);
  try {
    const n = fs.readSync(0, buf, 0, buf.length, null);
    return /^y(es)?$/i.test(buf.slice(0, n).toString('utf8').trim());
  } catch {
    return false;
  }
}

/**
 * @param {{ deps?: object, check?: boolean, yes?: boolean }} [options]
 * @returns {Promise<0|1>}
 */
export async function runEnsureEngine(options = {}) {
  const deps = options.deps || {};
  const resolveEngine = deps.resolveEngine || resolveInstalledEngine;
  const installEngine = deps.installEngine || defaultInstallEngine;
  const confirm = deps.confirm || defaultConfirm;
  const print = deps.print || ((line) => console.log(line));

  const { version: pin } = readEnginePin();
  const installed = resolveEngine();

  if (installed) {
    print(`✅ ensure-engine: engine present (@remotion/renderer ${installed}); no action needed.`);
    return 0;
  }

  if (options.check) {
    print(`❌ ensure-engine: engine missing (pin ${pin}). Run without --check to install.`);
    return 1;
  }

  print(`⚠️  ensure-engine: Remotion runtime is not installed.`);
  print(`    Approximate total download: ${APPROX_TOTAL_MB}.`);
  print(`    A headless browser (Chromium) downloads on the first render.`);

  const accepted = options.yes ? true : await confirm('Install the Remotion runtime now?');
  if (!accepted) {
    print('❌ ensure-engine: install declined.');
    return 1;
  }

  try {
    await installEngine();
  } catch (err) {
    print(`❌ ensure-engine: ${err.message}`);
    return 1;
  }

  const after = resolveEngine();
  if (!after) {
    print('❌ ensure-engine: install completed but @remotion/renderer still does not resolve.');
    return 1;
  }
  print(`✅ ensure-engine: engine installed (@remotion/renderer ${after}).`);
  return 0;
}

async function main() {
  const code = await runEnsureEngine({
    check: process.argv.includes('--check'),
    yes: process.argv.includes('--yes'),
  });
  process.exit(code);
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
