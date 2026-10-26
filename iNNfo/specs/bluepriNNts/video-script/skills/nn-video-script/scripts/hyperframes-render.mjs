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
import { emitHyperframesProject, HYPERFRAMES_PIN } from './scene-project.mjs';

/** Default runner: `npx` on PATH. */
function defaultRun(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { shell: true, encoding: 'utf8', ...opts });
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '', error: res.error };
}

/** Emit the project and copy the compiled public assets into `<project>/assets/`. */
export function buildHyperframesProject(manifest, projectDir) {
  const built = emitHyperframesProject(manifest, { projectDir });
  const publicDir = manifest?.metadata?.publicDir;
  const assetsDir = path.join(projectDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  if (publicDir && fs.existsSync(publicDir)) {
    for (const entry of fs.readdirSync(publicDir)) {
      const src = path.join(publicDir, entry);
      if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(assetsDir, entry));
    }
  }
  return built;
}

/**
 * @param {{ manifest: object, outputPath: string, projectDir?: string, concurrency?: number, pin?: string }} input
 * @param {{ run?: (cmd: string, args: string[], opts?: object) => any }} [deps]
 * @returns {Promise<{ rendered: true } | { rendered: false, reason: string }>}
 */
export async function tryHyperframesRender(input, deps = {}) {
  const { manifest, outputPath } = input;
  const pin = input.pin || HYPERFRAMES_PIN;
  const projectDir = path.resolve(input.projectDir || path.join(path.dirname(outputPath), 'hyperframes'));
  const run = deps.run || defaultRun;

  if (process.env.NN_HYPERFRAMES_DISABLE === '1') return { rendered: false, reason: 'disabled' };

  try {
    buildHyperframesProject(manifest, projectDir);
  } catch (err) {
    return { rendered: false, reason: `emit-failed: ${err?.message || String(err)}` };
  }

  // Attempt the render directly: `npx --yes hyperframes@<pin>` installs the pinned
  // CLI on demand. A failure (missing network, CLI error) is returned as a reason and
  // the caller raises a loud named error; there is no FFmpeg fallback.
  const cmd = ['npx', ['--yes', `hyperframes@${pin}`, 'render', projectDir, '--output', path.resolve(outputPath)]];
  try {
    const res = await run(cmd[0], cmd[1], { cwd: projectDir });
    if (res && typeof res.status === 'number' && res.status !== 0) {
      return { rendered: false, reason: `hyperframes-exit-${res.status}` };
    }
  } catch (err) {
    return { rendered: false, reason: `error: ${err?.message || String(err)}` };
  }

  if (!fs.existsSync(outputPath)) return { rendered: false, reason: 'no-output' };
  return { rendered: true };
}
