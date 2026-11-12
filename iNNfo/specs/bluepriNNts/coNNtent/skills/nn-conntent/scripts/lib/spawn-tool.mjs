/**
 * nn-conntent/scripts/lib/spawn-tool.mjs
 *
 * One way to run an external tool (ffmpeg, ffprobe, the pinned HyperFrames CLI)
 * that also works on Windows.
 *
 * Since Node 18.20.2 / 20.12.2 (CVE-2024-27980) `spawnSync` refuses a `.cmd` or
 * `.bat` file without a shell and fails with `EINVAL`, and npm installs every CLI
 * as such a shim. Passing `shell: true` is not the fix either: Node then joins the
 * arguments unquoted, so a path with a space splits in two. On Windows a shim runs
 * through `cmd.exe /d /s /c "<line>"` with every argument escaped for both the
 * C runtime and cmd.exe (the escaping cross-spawn uses); everything else, and
 * every other platform, spawns directly with no shell.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const SHIM_EXT = /\.(cmd|bat)$/i;
/** Characters cmd.exe interprets; each one is escaped with `^`. */
const CMD_META = /([()\][%!^"`<>&|;, *?])/g;
/** npm `node_modules/.bin/*.cmd` shims re-expand `%*`, so their args are escaped twice. */
const NPM_SHIM = /node_modules[\\/]\.bin[\\/][^\\/]+\.cmd$/i;

/** Escapes one argument for the C runtime, then for cmd.exe. */
export function escapeCmdArg(arg, { doubleEscape = false } = {}) {
  let a = String(arg);
  // Backslashes before a quote are doubled and the quote escaped; trailing ones doubled too.
  a = a.replace(/(\\*)"/g, '$1$1\\"');
  a = a.replace(/(\\*)$/, '$1$1');
  a = `"${a}"`;
  a = a.replace(CMD_META, '^$1');
  if (doubleEscape) a = a.replace(CMD_META, '^$1');
  return a;
}

/**
 * On Windows, resolves a bare command name (`hyperframes`) to the file cmd.exe
 * would run, so a `.cmd` shim found on PATH is detected. Returns `cmd` unchanged
 * when it already names a file or nothing matches.
 */
export function resolveWindowsCommand(cmd, { env = process.env, exists = fs.existsSync } = {}) {
  if (path.win32.extname(cmd) || /[\\/]/.test(cmd)) return cmd;
  const dirs = String(env.PATH ?? env.Path ?? '').split(';').filter(Boolean);
  const exts = String(env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  for (const dir of dirs) {
    for (const ext of exts) {
      const candidate = path.win32.join(dir, cmd + ext.toLowerCase());
      if (exists(candidate)) return candidate;
    }
  }
  return cmd;
}

/**
 * Builds the spawn call for a tool: `{ file, args, options }`.
 * @param {string} cmd
 * @param {string[]} args
 * @param {object} [options] spawn options; `shell` is always forced off
 * @param {{ platform?: string, env?: object, exists?: (p: string) => boolean }} [host]
 */
export function toolInvocation(cmd, args = [], options = {}, host = {}) {
  const platform = host.platform || process.platform;
  const opts = { ...options, shell: false };
  if (platform !== 'win32') return { file: cmd, args: [...args], options: opts };

  const resolved = resolveWindowsCommand(cmd, { env: host.env || options.env || process.env, exists: host.exists });
  if (!SHIM_EXT.test(resolved)) return { file: cmd, args: [...args], options: opts };

  const doubleEscape = NPM_SHIM.test(resolved);
  const line = [resolved.replace(CMD_META, '^$1'), ...args.map((a) => escapeCmdArg(a, { doubleEscape }))].join(' ');
  const env = host.env || options.env || process.env;
  return {
    file: env.ComSpec || env.COMSPEC || 'cmd.exe',
    args: ['/d', '/s', '/c', `"${line}"`],
    options: { ...opts, windowsVerbatimArguments: true },
  };
}

/**
 * Runs a tool synchronously and returns the `spawnSync` result.
 * @param {string} cmd
 * @param {string[]} [args]
 * @param {object} [options] spawnSync options
 * @param {{ platform?: string, env?: object, exists?: Function, spawn?: Function }} [host] test seams
 */
export function spawnTool(cmd, args = [], options = {}, host = {}) {
  const spawn = host.spawn || spawnSync;
  const inv = toolInvocation(cmd, args, options, host);
  return spawn(inv.file, inv.args, inv.options);
}
