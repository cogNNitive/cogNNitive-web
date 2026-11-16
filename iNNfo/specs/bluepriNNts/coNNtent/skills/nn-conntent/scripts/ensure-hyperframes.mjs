#!/usr/bin/env node

/**
 * nn-conntent/scripts/ensure-hyperframes.mjs
 *
 * Provisioner for the pinned render runtime: the exact HyperFrames CLI and GSAP build this skill
 * depends on. `--check` only VERIFIES that both resolve from `<skill>/node_modules`. `--install`
 * installs them when they are missing and then verifies, which is what a render needs: the emitted
 * project vendors GSAP and the renderer runs the pinned CLI, so a missing dependency is a dead end
 * discovered after the caller already paid for synthesis.
 *
 *   node ensure-hyperframes.mjs [--check | --install]
 *
 *   --check     readiness report only; exit 0 if ready, 1 otherwise.
 *   --install   install the pinned dependencies when missing, then verify.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
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
 * Installs the pinned dependencies in the skill's own package. `npm install --omit=dev` is enough:
 * both HyperFrames and GSAP are runtime `dependencies` of this skill, not devDependencies.
 * @param {{ skillDir?: string, spawn?: Function, platform?: string }} [options]
 * @returns {{ ok: boolean, status: number|null, detail: string }}
 */
export function installRuntime(options = {}) {
  const skillDir = options.skillDir || SKILL_DIR;
  const spawn = options.spawn || spawnSync;
  const platform = options.platform || process.platform;
  const cmd = platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawn(cmd, ['install', '--omit=dev', '--no-audit', '--no-fund'], {
    cwd: skillDir,
    encoding: 'utf8',
    // npm on Windows is a .cmd shim: it needs a shell, and its args are not re-expanded here.
    shell: platform === 'win32',
  });
  const detail = String((res && (res.stderr || res.stdout)) || '').trim().slice(-800);
  return { ok: Boolean(res) && res.status === 0, status: res ? res.status : null, detail };
}

/**
 * @param {{ check?: boolean, install?: boolean, skillDir?: string, spawn?: Function, pin?: string,
 *   gsapPin?: string, resolveCli?: () => string | null, resolveGsap?: () => string | null,
 *   print?: (line: string) => void, installRuntime?: Function }} [options]
 * @returns {Promise<0|1>}
 */
export async function runEnsureHyperframes(options = {}) {
  const resolveCli = options.resolveCli || resolveInstalledCli;
  const resolveGsap = options.resolveGsap || resolveInstalledGsap;
  const print = options.print || ((line) => console.log(line));
  const pin = options.pin || HYPERFRAMES_PIN;
  const gsapPin = options.gsapPin || GSAP_PIN;

  const ready = () => resolveCli() === pin && resolveGsap() === gsapPin;

  // Install first when asked, so the report below describes the state that matters. A run that
  // already has both dependencies never touches the network.
  if (options.install && !ready()) {
    const doInstall = options.installRuntime || installRuntime;
    print(`… ensure-hyperframes: installing the pinned runtime in ${options.skillDir || SKILL_DIR}.`);
    const res = doInstall({ skillDir: options.skillDir || SKILL_DIR, spawn: options.spawn });
    if (!res || !res.ok) {
      print(
        `❌ ensure-hyperframes: install failed${res && res.detail ? `: ${res.detail}` : ''}. ` +
          `Run: node ${path.join(SKILL_DIR, 'scripts', 'ensure-hyperframes.mjs')} --install`,
      );
      return 1;
    }
  }

  let code = 0;
  const installed = resolveCli();
  if (installed && installed === pin) {
    print(`✅ ensure-hyperframes: HyperFrames CLI ${installed} present (pin ${pin}).`);
  } else if (installed) {
    print(`❌ ensure-hyperframes: HyperFrames ${installed} ≠ pin ${pin}. Fix: node scripts/ensure-hyperframes.mjs --install`);
    code = 1;
  } else {
    print(`❌ ensure-hyperframes: pinned HyperFrames CLI ${pin} not found in node_modules. Fix: node scripts/ensure-hyperframes.mjs --install`);
    code = 1;
  }

  // Render is hermetic: the project loads GSAP from `vendor/`, so the pinned build must be
  // installed for a project to be emitted at all.
  const gsap = resolveGsap();
  if (gsap && gsap === gsapPin) {
    print(`✅ ensure-hyperframes: GSAP ${gsap} present (pin ${gsapPin}), vendored as vendor/gsap.min.js.`);
  } else if (gsap) {
    print(`❌ ensure-hyperframes: GSAP ${gsap} ≠ pin ${gsapPin}. Fix: node scripts/ensure-hyperframes.mjs --install`);
    code = 1;
  } else {
    print(`❌ ensure-hyperframes: pinned GSAP ${gsapPin} not found in node_modules. Fix: node scripts/ensure-hyperframes.mjs --install`);
    code = 1;
  }
  return code;
}

async function main() {
  const code = await runEnsureHyperframes({
    check: process.argv.includes('--check'),
    install: process.argv.includes('--install'),
  });
  process.exit(code);
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
