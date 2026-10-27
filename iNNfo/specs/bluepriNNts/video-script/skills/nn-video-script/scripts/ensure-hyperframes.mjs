#!/usr/bin/env node

/**
 * nn-video-script/scripts/ensure-hyperframes.mjs
 *
 * Check-only provisioner for the pinned HyperFrames CLI. The CLI is an exact npm
 * dependency of this skill and is installed by the skills manager
 * (`skills-manager.js update video-script`); this script only VERIFIES that the
 * pinned version resolves from `<skill>/node_modules`. It never installs and never
 * shells out to a package runner.
 *
 *   node ensure-hyperframes.mjs [--check]
 *
 *   --check   same behavior (readiness report only; exit 0 if ready, 1 otherwise).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HYPERFRAMES_PIN } from './scene-project.mjs';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Installed HyperFrames version from this skill's node_modules, or null when absent. */
export function resolveInstalledCli(deps = {}) {
  const pkgPath = path.join(SKILL_DIR, 'node_modules', 'hyperframes', 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || null;
  } catch {
    return null;
  }
}

/**
 * @param {{ check?: boolean, pin?: string, resolveCli?: () => string | null, print?: (line: string) => void }} [options]
 * @returns {Promise<0|1>}
 */
export async function runEnsureHyperframes(options = {}) {
  const resolveCli = options.resolveCli || resolveInstalledCli;
  const print = options.print || ((line) => console.log(line));
  const pin = options.pin || HYPERFRAMES_PIN;

  const installed = resolveCli();
  if (installed && installed === pin) {
    print(`✅ ensure-hyperframes: HyperFrames CLI ${installed} present (pin ${pin}).`);
    return 0;
  }
  if (installed) {
    print(`❌ ensure-hyperframes: HyperFrames ${installed} ≠ pin ${pin}. Fix: skills-manager.js update video-script`);
    return 1;
  }
  print(`❌ ensure-hyperframes: pinned HyperFrames CLI ${pin} not found in node_modules. Fix: skills-manager.js update video-script`);
  return 1;
}

async function main() {
  const code = await runEnsureHyperframes({ check: process.argv.includes('--check') });
  process.exit(code);
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
