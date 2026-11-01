/**
 * nn-video-script/scripts/hyperframes-render.mjs
 *
 * Headless HyperFrames render driver. Emits the project from the manifest
 * (`scene-project.mjs`), stages the compiled media into the project `assets/`
 * dir, then runs the pinned HyperFrames CLI to render the MP4. Import no
 * HyperFrames module — only the CLI is invoked.
 *
 * A failure is returned as `{ rendered: false, reason }`; the caller turns it
 * into a loud named error (never a silent mock unless `--allow-mock`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { emitHyperframesProject, HYPERFRAMES_PIN } from './scene-project.mjs';
import { SLOT_OF } from './overlay-blocks.mjs';

/** Quotes one argument so a shell passes it through as a single literal token. */
export function quoteArg(arg, platform = process.platform) {
  const a = String(arg);
  if (/^[\w@%+=:,./-]+$/.test(a)) return a;
  if (platform === 'win32') return `"${a.replace(/"/g, '\\"')}"`;
  return `'${a.replace(/'/g, "'\\''")}'`;
}

/** Default runner: `npx` on PATH. */
function defaultRun(cmd, args, opts = {}) {
  // `shell: true` is needed for the npx .cmd shim on Windows, so quote every arg ourselves.
  const res = spawnSync(cmd, args.map((a) => quoteArg(a)), {
    shell: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...opts,
  });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '', error: res.error };
}

const DETAIL_MAX = 2000;

/** Last `DETAIL_MAX` chars of a captured stream, trimmed; '' when there is nothing. */
function outputTail(text) {
  return String(text || '').trim().slice(-DETAIL_MAX);
}

/** Emit the project and copy the compiled public assets into `<project>/assets/`. */
export function buildHyperframesProject(manifest, projectDir) {
  const built = emitHyperframesProject(manifest, { projectDir });
  const publicDir = manifest?.metadata?.publicDir;
  const assetsDir = path.join(projectDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  // When the staging layer IS the asset dir there is nothing to copy (design D2).
  if (publicDir && path.resolve(publicDir) !== path.resolve(assetsDir) && fs.existsSync(publicDir)) {
    for (const entry of fs.readdirSync(publicDir)) {
      const src = path.join(publicDir, entry);
      if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(assetsDir, entry));
    }
  }
  stageComponents(manifest, projectDir);
  stageAuthoredProjects(manifest, projectDir);
  return built;
}

/**
 * Copies each authored animation project into `<project>/authored/<id>/` (design
 * D5/D7) so its root `index.html` and relative assets resolve in place. The
 * project's own `.hyperframes/` cache is skipped — it is machine state, not
 * source. Idempotent: a missing source directory is skipped.
 * @param {object} manifest
 * @param {string} projectDir
 */
export function stageAuthoredProjects(manifest, projectDir) {
  const scenes = manifest?.tracks?.scenes || [];
  const entries = scenes.flatMap((scene) => scene.animations || []);
  for (const entry of entries) {
    if (!entry?.id || !entry?.sourceDir || !fs.existsSync(entry.sourceDir)) continue;
    copyDir(entry.sourceDir, path.join(projectDir, 'authored', entry.id), new Set(['.hyperframes']));
  }
}

/** Recursive copy that skips any directory whose name is in `skip`. */
function copyDir(src, dest, skip) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to, skip);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

/**
 * Stages each resolved slot component into `<project>/components/<name>.html`
 * (design D5), so no `src` in the emitted tree climbs (`..`). A manifest that
 * carries no resolved component map (a raw manifest.json) falls back to the
 * skill's neutral fallback for every slot its overlays use.
 */
function stageComponents(manifest, projectDir) {
  const overlays = manifest?.tracks?.overlays || [];
  const resolved = manifest?.metadata?.components || {};
  const slots = new Set(overlays.map((o) => SLOT_OF[o.type]).filter(Boolean));
  if (slots.size === 0) return;
  const componentsDir = path.join(projectDir, 'components');
  fs.mkdirSync(componentsDir, { recursive: true });
  const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const slot of slots) {
    const entry = resolved[slot];
    const name = entry?.name || slot;
    const src = entry?.path || path.join(skillDir, 'components', `${name}.html`);
    if (!fs.existsSync(src)) continue;
    fs.copyFileSync(src, path.join(componentsDir, `${name}.html`));
  }
}

/**
 * `extraArgs` are forwarded verbatim to `hyperframes render` (e.g. `--workers 2`).
 * @param {{ manifest: object, outputPath: string, projectDir?: string, concurrency?: number, pin?: string, extraArgs?: string[] }} input
 * @param {{ run?: (cmd: string, args: string[], opts?: object) => any }} [deps]
 * @returns {Promise<{ rendered: true } | { rendered: false, reason: string, detail?: string }>}
 */
export async function tryHyperframesRender(input, deps = {}) {
  const { manifest, outputPath } = input;
  const pin = input.pin || HYPERFRAMES_PIN;
  if (!input.projectDir) throw new Error('tryHyperframesRender: projectDir is required (compile sets manifest.metadata.buildDir)');
  const projectDir = path.resolve(input.projectDir);
  const run = deps.run || defaultRun;

  if (process.env.NN_HYPERFRAMES_DISABLE === '1') return { rendered: false, reason: 'disabled' };

  try {
    buildHyperframesProject(manifest, projectDir);
  } catch (err) {
    return { rendered: false, reason: `emit-failed: ${err?.message || String(err)}` };
  }

  // Resolve the pinned CLI from this skill's node_modules/.bin. A missing CLI or a
  // version different from the pin is returned as a named reason — never a silent
  // `npx` install. The caller raises a loud named error; there is no FFmpeg fallback.
  const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const binName = process.platform === 'win32' ? 'hyperframes.cmd' : 'hyperframes';
  const injectedCli = deps.cliPath !== undefined;
  const cliPath = deps.cliPath || path.join(skillDir, 'node_modules', '.bin', binName);
  const installedPkgPath = path.join(skillDir, 'node_modules', 'hyperframes', 'package.json');
  let installedPin = deps.installedPin !== undefined ? deps.installedPin : null;
  // An injected runner (tests) owns CLI resolution; otherwise verify the real pin.
  if (!injectedCli && !deps.run) {
    if (!fs.existsSync(cliPath) || !fs.existsSync(installedPkgPath)) {
      return { rendered: false, reason: 'hyperframes-missing' };
    }
    try {
      installedPin = JSON.parse(fs.readFileSync(installedPkgPath, 'utf8')).version;
    } catch (_) {
      installedPin = null;
    }
  }
  if (installedPin && installedPin !== pin) {
    return { rendered: false, reason: `hyperframes-version-mismatch: ${installedPin}≠${pin}` };
  }

  const extra = (input.extraArgs || []).map(String);
  const cmd = [cliPath, ['render', projectDir, '--output', path.resolve(outputPath), ...extra]];
  try {
    const res = await run(cmd[0], cmd[1], { cwd: projectDir });
    // Keep the CLI's own words: the exit code alone says nothing about why it failed.
    const detail = res ? outputTail(res.stderr) || outputTail(res.stdout) : '';
    if (res?.error) {
      return { rendered: false, reason: `error: ${res.error.message || String(res.error)}`, ...(detail && { detail }) };
    }
    if (res && typeof res.status === 'number' && res.status !== 0) {
      return { rendered: false, reason: `hyperframes-exit-${res.status}`, ...(detail && { detail }) };
    }
  } catch (err) {
    return { rendered: false, reason: `error: ${err?.message || String(err)}` };
  }

  if (!fs.existsSync(outputPath)) return { rendered: false, reason: 'no-output' };
  return { rendered: true };
}
