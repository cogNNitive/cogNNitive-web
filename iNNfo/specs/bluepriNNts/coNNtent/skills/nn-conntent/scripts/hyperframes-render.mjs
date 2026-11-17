/**
 * nn-conntent/scripts/hyperframes-render.mjs
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
import { fileURLToPath } from 'node:url';
import { emitHyperframesProject, HYPERFRAMES_PIN, resolveHyperframesCli } from './scene-project.mjs';
import { runEnsureHyperframes } from './ensure-hyperframes.mjs';
import { SLOT_OF } from './overlay-blocks.mjs';
import { assertGsapPresent } from './lib/stage-assets.mjs';
import { emitHyperframesFrame } from './lib/frame-tokens.mjs';
import { spawnTool } from './lib/spawn-tool.mjs';

/** Default runner: the pinned CLI through `spawnTool` (the Windows `.cmd` shim runs safely). */
function defaultRun(cmd, args, opts = {}) {
  const res = spawnTool(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '', error: res.error };
}

const DETAIL_MAX = 2000;

/**
 * Verifies the pinned runtime and installs it once when it is missing, unless the caller opted out.
 * Auto-install is on by default because a render cannot start without it and the failure otherwise
 * lands after synthesis has been paid for; `INNFO_RENDER_AUTOINSTALL=0` keeps a machine hermetic.
 * @returns {Promise<{ ok: boolean, reason?: string, detail?: string }>}
 */
async function ensurePinnedRuntime({ skillDir, deps }) {
  const verify = deps.ensureRuntime || runEnsureHyperframes;
  const quiet = () => {};
  const autoInstall = deps.autoInstall ?? process.env.INNFO_RENDER_AUTOINSTALL !== '0';

  if ((await verify({ skillDir, print: quiet })) === 0) return { ok: true };
  if (!autoInstall) {
    return {
      ok: false,
      reason: 'hyperframes-missing',
      detail: 'auto-install disabled by INNFO_RENDER_AUTOINSTALL=0; run: node scripts/ensure-hyperframes.mjs --install',
    };
  }
  if ((await verify({ skillDir, install: true, print: quiet })) === 0) return { ok: true };
  return { ok: false, reason: 'hyperframes-missing' };
}

/** Last `DETAIL_MAX` chars of a captured stream, trimmed; '' when there is nothing. */
function outputTail(text) {
  return String(text || '').trim().slice(-DETAIL_MAX);
}

/**
 * Emit the project, link the vendored GSAP build into `<project>/vendor/`, and make the
 * compiled public assets available under `<project>/assets/`.
 *
 * Render is hermetic (capability cognnitive-video-engine): the project loads GSAP from
 * `vendor/gsap.min.js`, never from a CDN, so a missing install is a loud failure here.
 *
 * @param {object} manifest
 * @param {string} projectDir
 * @param {{ gsapPath?: string }} [opts]
 */
export function buildHyperframesProject(manifest, projectDir, opts = {}) {
  const narrationCaptions = opts.narrationCaptions ?? manifest?.metadata?.narrationCaptions ?? manifest?.captions;
  const built = emitHyperframesProject(manifest, { projectDir, narrationCaptions, ...opts });
  // GSAP is a 70 KB library, not a provider cache entry: it is copied. Copying it never
  // changes `link_mode`, which describes how the staged ASSETS were made available.
  const gsap = opts.gsapPath || assertGsapPresent();
  const vendorDir = path.join(projectDir, 'vendor');
  fs.mkdirSync(vendorDir, { recursive: true });
  fs.copyFileSync(gsap, path.join(vendorDir, 'gsap.min.js'));
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
  if (manifest?.metadata?.frame?.path) {
    emitHyperframesFrame({ frameDir: path.dirname(manifest.metadata.frame.path), projectDir, outDir: projectDir });
  }
  return built;
}

/**
 * Copies each authored animation project into `<project>/authored/<id>/` (design
 * D5/D7) so its root `index.html` and relative assets resolve in place. The
 * project's own `.hyperframes/` cache is skipped — it is machine state, not
 * source. A project mounted by several scenes is staged once. Idempotent: a
 * missing source directory is skipped.
 *
 * HyperFrames resolves every `data-composition-src` against the ENTRY project
 * root, not against the file that mounts it. Inside the authored project a
 * sub-composition is therefore written `compositions/x.html`; once the project
 * sits under `authored/<id>/` of the emitted root that path would point at the
 * root's own `compositions/`. Each staged HTML file has its relative
 * `data-composition-src` values re-rooted to `authored/<id>/…`, so a project that
 * splits its scene into sub-composition files (what `hyperframes check` asks for)
 * renders when mounted.
 * @param {object} manifest
 * @param {string} projectDir
 */
export function stageAuthoredProjects(manifest, projectDir) {
  const scenes = manifest?.tracks?.scenes || [];
  const entries = scenes.flatMap((scene) => scene.animations || []);
  const staged = new Set();
  for (const entry of entries) {
    if (!entry?.id || !entry?.sourceDir || !fs.existsSync(entry.sourceDir) || staged.has(entry.id)) continue;
    staged.add(entry.id);
    const prefix = `authored/${entry.id}/`;
    copyDir(entry.sourceDir, path.join(projectDir, 'authored', entry.id), new Set(['.hyperframes']), (name, text) =>
      /\.html?$/i.test(name) ? rerootCompositionSrc(text, prefix) : null,
    );
  }
}

/**
 * Prefixes every relative `data-composition-src` in `html` with `prefix`. Absolute
 * URLs, root-absolute paths and values already under the prefix are kept.
 * @param {string} html
 * @param {string} prefix e.g. `authored/rig/`
 */
export function rerootCompositionSrc(html, prefix) {
  return String(html).replace(/(data-composition-src\s*=\s*)(["'])([^"']*)\2/g, (match, attr, quote, value) => {
    const src = value.trim();
    if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith('/') || src.startsWith(prefix)) return match;
    return `${attr}${quote}${prefix}${src.replace(/^\.\//, '')}${quote}`;
  });
}

/**
 * Recursive copy that skips any directory whose name is in `skip`. `transform`
 * may return new text for a file (null keeps the bytes as they are).
 */
function copyDir(src, dest, skip, transform = () => null) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to, skip, transform);
    else if (entry.isFile()) {
      const text = /\.html?$/i.test(entry.name) ? transform(entry.name, fs.readFileSync(from, 'utf8')) : null;
      if (text === null) fs.copyFileSync(from, to);
      else fs.writeFileSync(to, text, 'utf8');
    }
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
  // `fit:: component:<name>` components, resolved before spend by compile.
  const fitComponents = Object.values(manifest?.metadata?.fitComponents || {});
  if (slots.size === 0 && fitComponents.length === 0) return;
  const componentsDir = path.join(projectDir, 'components');
  fs.mkdirSync(componentsDir, { recursive: true });
  for (const entry of fitComponents) {
    if (entry?.path && fs.existsSync(entry.path)) fs.copyFileSync(entry.path, path.join(componentsDir, `${entry.name}.html`));
  }
  const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const slot of slots) {
    const entry = resolved[slot];
    const name = entry?.name || slot;
    // The resolved component path is the folder's index.html (folder-form
    // components); the fallback is the packaged slot contract.
    const src = entry?.path || path.join(skillDir, 'slots', `${name}.html`);
    if (!fs.existsSync(src)) continue;
    const html = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(path.join(componentsDir, `${name}.html`), stampCanvas(html, manifest.width, manifest.height), 'utf8');
  }
}

/**
 * Stamps a slot component's root (`id="root"`) with the canvas of the format project it is
 * staged into (spec S6): the source declares no fixed size, so one component serves every
 * format. A manifest without a size leaves the file as it is.
 * @param {string} html
 * @param {number} width
 * @param {number} height
 */
export function stampCanvas(html, width, height) {
  if (!(Number(width) > 0) || !(Number(height) > 0)) return html;
  return String(html).replace(/<div\b[^>]*\bid="root"[^>]*>/, (tag) =>
    tag
      .replace(/\s+data-(?:width|height)="[^"]*"/g, '')
      .replace(/\bid="root"/, `id="root" data-width="${Number(width)}" data-height="${Number(height)}"`),
  );
}

/**
 * `extraArgs` are forwarded verbatim to `hyperframes render` (e.g. `--workers 2`).
 * @param {{ manifest: object, outputPath: string, projectDir?: string, concurrency?: number, pin?: string, extraArgs?: string[], gsapPath?: string }} input
 * @param {{ run?: (cmd: string, args: string[], opts?: object) => any }} [deps]
 * @returns {Promise<{ rendered: true } | { rendered: false, reason: string, detail?: string }>}
 */
export async function tryHyperframesRender(input, deps = {}) {
  const { manifest, outputPath } = input;
  const pin = input.pin || HYPERFRAMES_PIN;
  if (!input.projectDir) throw new Error('tryHyperframesRender: projectDir is required (compile sets manifest.metadata.hyperframesDir)');
  const projectDir = path.resolve(input.projectDir);
  const run = deps.run || defaultRun;

  if (process.env.NN_HYPERFRAMES_DISABLE === '1') return { rendered: false, reason: 'disabled' };

  const skillDir = deps.skillDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  // The pinned runtime must exist before anything is emitted: the emitter vendors GSAP and the
  // renderer runs the pinned CLI. Checking here turns "emit-failed: gsap is not installed" — which
  // arrived after the caller had already paid for synthesis — into a one-time provision instead.
  const injectedRuntime = deps.cliPath !== undefined || deps.run !== undefined;
  if (!injectedRuntime) {
    const ensured = await ensurePinnedRuntime({ skillDir, deps });
    if (!ensured.ok) {
      return {
        rendered: false,
        reason: ensured.reason,
        ...(ensured.detail ? { detail: ensured.detail } : {}),
      };
    }
  }

  try {
    buildHyperframesProject(manifest, projectDir, { gsapPath: input.gsapPath });
  } catch (err) {
    return { rendered: false, reason: `emit-failed: ${err?.message || String(err)}` };
  }

  // Resolve the pinned CLI from this skill's node_modules/.bin. A missing CLI or a
  // version different from the pin is returned as a named reason — never a silent
  // `npx` install. The caller raises a loud named error; there is no FFmpeg fallback.
  const injectedCli = deps.cliPath !== undefined;
  const cliPath = deps.cliPath || resolveHyperframesCli({ skillDir });
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

/**
 * Runs `hyperframes check --json <projectDir>` with the pinned CLI from this skill's
 * `node_modules/.bin` (never `npx`) on one emitted format project (spec S9). The project
 * must already be emitted (the render emits it). A missing CLI is a failed check, never a
 * skipped one.
 * @param {{ projectDir: string }} input
 * @param {{ run?: Function, cliPath?: string, skillDir?: string }} [deps]
 * @returns {Promise<{ ok: boolean, reason?: string, detail?: string }>}
 */
export async function runHyperframesCheck({ projectDir }, deps = {}) {
  const skillDir = deps.skillDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const cliPath = deps.cliPath || resolveHyperframesCli({ skillDir });
  const run = deps.run || defaultRun;
  if (!deps.run && !fs.existsSync(cliPath)) return { ok: false, reason: 'hyperframes-missing' };
  if (!projectDir || !fs.existsSync(path.join(projectDir, 'index.html'))) {
    return { ok: false, reason: 'project-missing', detail: `no index.html in ${projectDir}` };
  }
  try {
    const res = await run(cliPath, ['check', '--json', path.resolve(projectDir)], { cwd: projectDir });
    const detail = res ? outputTail(res.stdout) || outputTail(res.stderr) : '';
    if (res?.error) return { ok: false, reason: `error: ${res.error.message || String(res.error)}`, ...(detail && { detail }) };
    if (res && typeof res.status === 'number' && res.status !== 0) {
      return { ok: false, reason: `hyperframes-check-exit-${res.status}`, ...(detail && { detail }) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `error: ${err?.message || String(err)}` };
  }
}
