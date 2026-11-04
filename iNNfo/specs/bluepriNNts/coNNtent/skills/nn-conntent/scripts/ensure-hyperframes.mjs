#!/usr/bin/env node

/**
 * nn-conntent/scripts/ensure-hyperframes.mjs
 *
 * Check-only provisioner for the pinned HyperFrames CLI. The CLI is an exact npm
 * dependency of this skill and is installed by the skills manager
 * (`skills-manager.js update coNNtent`); this script only VERIFIES that the
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

/** The exact GSAP version the emitted project loads from `vendor/` (render is hermetic). */
export const GSAP_PIN = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(SKILL_DIR, 'package.json'), 'utf8'));
    return (pkg.dependencies && pkg.dependencies.gsap) || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

/** Installed HyperFrames version from this skill's node_modules, or null when absent. */
export function resolveInstalledCli(deps = {}) {
  const pkgPath = path.join(SKILL_DIR, 'node_modules', 'hyperframes', 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || null;
  } catch {
    return null;
  }
}

/** Installed GSAP version from this skill's node_modules, or null when absent. */
export function resolveInstalledGsap() {
  const pkgPath = path.join(SKILL_DIR, 'node_modules', 'gsap', 'package.json');
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version || null;
  } catch {
    return null;
  }
}

/**
 * @param {{ check?: boolean, pin?: string, gsapPin?: string, resolveCli?: () => string | null, resolveGsap?: () => string | null, print?: (line: string) => void }} [options]
 * @returns {Promise<0|1>}
 */
export async function runEnsureHyperframes(options = {}) {
  const resolveCli = options.resolveCli || resolveInstalledCli;
  const resolveGsap = options.resolveGsap || resolveInstalledGsap;
  const print = options.print || ((line) => console.log(line));
  const pin = options.pin || HYPERFRAMES_PIN;
  const gsapPin = options.gsapPin || GSAP_PIN;

  let code = 0;
  const installed = resolveCli();
  if (installed && installed === pin) {
    print(`✅ ensure-hyperframes: HyperFrames CLI ${installed} present (pin ${pin}).`);
  } else if (installed) {
    print(`❌ ensure-hyperframes: HyperFrames ${installed} ≠ pin ${pin}. Fix: skills-manager.js update coNNtent`);
    code = 1;
  } else {
    print(`❌ ensure-hyperframes: pinned HyperFrames CLI ${pin} not found in node_modules. Fix: skills-manager.js update coNNtent`);
    code = 1;
  }

  // Render is hermetic: the project loads GSAP from `vendor/`, so the pinned build must be
  // installed for a project to be emitted at all.
  const gsap = resolveGsap();
  if (gsap && gsap === gsapPin) {
    print(`✅ ensure-hyperframes: GSAP ${gsap} present (pin ${gsapPin}), vendored as vendor/gsap.min.js.`);
  } else if (gsap) {
    print(`❌ ensure-hyperframes: GSAP ${gsap} ≠ pin ${gsapPin}. Fix: skills-manager.js update coNNtent`);
    code = 1;
  } else {
    print(`❌ ensure-hyperframes: pinned GSAP ${gsapPin} not found in node_modules. Fix: skills-manager.js update coNNtent`);
    code = 1;
  }
  return code;
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
