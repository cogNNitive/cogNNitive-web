#!/usr/bin/env node

/**
 * nn-video-script/scripts/ensure-hyperframes.mjs
 *
 * Idempotent, consent-gated provisioner for the pinned HyperFrames CLI. It only
 * VERIFIES the CLI resolves (offline, `--no-install`); installing the pinned CLI
 * or its agent skills is a consent-gated action. Replaces `ensure-engine.mjs`
 * (removed). No Remotion.
 *
 *   node ensure-hyperframes.mjs [--check] [--yes]
 *
 *   --check   report readiness only (exit 0 if ready, 1 otherwise); install nothing.
 *   --yes     skip the interactive prompt (CI / non-interactive).
 */

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HYPERFRAMES_PIN } from './scene-project.mjs';

/** True when the pinned CLI resolves; returns its version string or null. */
export function resolveInstalledCli(deps = {}) {
  const run = deps.run || ((cmd, args) => spawnSync(cmd, args, { shell: true, encoding: 'utf8' }));
  try {
    const res = run('npx', ['--no-install', 'hyperframes', '--version']);
    if (res && res.status === 0) return String(res.stdout || '').trim() || 'unknown';
  } catch {
    // not installed
  }
  return null;
}

/**
 * @param {{ check?: boolean, yes?: boolean, pin?: string, deps?: object }} [options]
 * @returns {Promise<0|1>}
 */
export async function runEnsureHyperframes(options = {}) {
  const deps = options.deps || {};
  const resolveCli = deps.resolveCli || resolveInstalledCli;
  const updateSkills =
    deps.updateSkills ||
    ((pin) => spawnSync('npx', ['--yes', `hyperframes@${pin}`, 'skills', 'update'], { shell: true, stdio: 'inherit' }));
  const confirm = deps.confirm || (() => false);
  const print = deps.print || ((line) => console.log(line));
  const pin = options.pin || HYPERFRAMES_PIN;

  const installed = resolveCli();
  if (installed) {
    print(`✅ ensure-hyperframes: HyperFrames CLI present (${installed}); pin ${pin}.`);
    return 0;
  }

  if (options.check) {
    print(`❌ ensure-hyperframes: HyperFrames CLI missing (pin ${pin}). Run without --check to install it.`);
    return 1;
  }

  print(`⚠️  ensure-hyperframes: the pinned HyperFrames CLI is not present.`);
  print(`    Rendering installs it on demand via 'npx hyperframes@${pin}'.`);

  const accepted = options.yes ? true : await confirm(`Install the HyperFrames agent skills now (npx hyperframes@${pin} skills update)?`);
  if (!accepted) {
    print('❌ ensure-hyperframes: install declined.');
    return 1;
  }

  try {
    updateSkills(pin);
  } catch (err) {
    print(`❌ ensure-hyperframes: ${err.message}`);
    return 1;
  }
  print('✅ ensure-hyperframes: skills update requested.');
  return 0;
}

async function main() {
  const code = await runEnsureHyperframes({
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
