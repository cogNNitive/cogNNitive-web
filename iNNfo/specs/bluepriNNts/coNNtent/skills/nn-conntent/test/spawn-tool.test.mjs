/**
 * nn-conntent/test/spawn-tool.test.mjs
 *
 * The shared tool spawner (#616): `.cmd` shims run on Windows without `EINVAL`
 * and without splitting arguments; every other case spawns directly, no shell.
 * The platform and runner are injected, so these run on any OS; one extra test
 * runs a real shim and only on Windows.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { spawnTool, toolInvocation, escapeCmdArg } from '../scripts/lib/spawn-tool.mjs';

const recorder = () => {
  const calls = [];
  return { calls, spawn: (file, args, options) => (calls.push({ file, args, options }), { status: 0, stdout: '', stderr: '' }) };
};

test('a .cmd shim on Windows runs through cmd.exe with verbatim, quoted arguments and no shell', () => {
  const r = recorder();
  spawnTool('C:\\skill\\node_modules\\.bin\\hyperframes.cmd', ['snapshot', 'C:\\My Projects\\ep 1'], { cwd: 'C:\\x' }, {
    platform: 'win32',
    env: { ComSpec: 'C:\\Windows\\system32\\cmd.exe' },
    spawn: r.spawn,
  });
  const [call] = r.calls;
  assert.equal(call.file, 'C:\\Windows\\system32\\cmd.exe');
  assert.deepEqual(call.args.slice(0, 3), ['/d', '/s', '/c']);
  assert.equal(call.options.shell, false);
  assert.equal(call.options.windowsVerbatimArguments, true);
  assert.equal(call.options.cwd, 'C:\\x');
  // The path with spaces stays one token.
  // npm shims re-expand `%*`, so the space is escaped twice and stays one token.
  assert.ok(call.args[3].includes('My^^^ Projects\\ep^^^ 1'), call.args[3]);
});

test('a bare command name resolving to a .cmd on PATH is detected as a shim', () => {
  const r = recorder();
  spawnTool('hyperframes', ['--version'], {}, {
    platform: 'win32',
    env: { PATH: 'C:\\bin;C:\\npm', PATHEXT: '.EXE;.CMD' },
    exists: (p) => p === 'C:\\npm\\hyperframes.cmd',
    spawn: r.spawn,
  });
  assert.equal(r.calls[0].file, 'cmd.exe');
  assert.match(r.calls[0].args[3], /C:\\npm\\hyperframes\.cmd/);
});

test('an .exe on Windows spawns directly with its arguments untouched (ffmpeg keeps working)', () => {
  const r = recorder();
  spawnTool('ffmpeg', ['-i', 'C:\\a b\\in.mp4', 'out.raw'], { encoding: 'utf8' }, {
    platform: 'win32',
    env: { PATH: 'C:\\ffmpeg', PATHEXT: '.EXE;.CMD' },
    exists: (p) => p === 'C:\\ffmpeg\\ffmpeg.exe',
    spawn: r.spawn,
  });
  assert.deepEqual(r.calls[0], {
    file: 'ffmpeg',
    args: ['-i', 'C:\\a b\\in.mp4', 'out.raw'],
    options: { encoding: 'utf8', shell: false },
  });
});

test('on POSIX a tool spawns directly even when the caller asked for a shell', () => {
  const inv = toolInvocation('/opt/hf/hyperframes', ['snapshot', '/tmp/my dir'], { shell: true }, { platform: 'linux' });
  assert.deepEqual(inv, { file: '/opt/hf/hyperframes', args: ['snapshot', '/tmp/my dir'], options: { shell: false } });
});

test('escapeCmdArg quotes for the C runtime and carets every cmd.exe metacharacter', () => {
  assert.equal(escapeCmdArg('a b'), '^"a^ b^"');
  assert.equal(escapeCmdArg('say "hi"'), '^"say^ \\^"hi\\^"^"');
  assert.equal(escapeCmdArg('100%&x'), '^"100^%^&x^"');
  assert.equal(escapeCmdArg('dir\\'), '^"dir\\\\^"');
});

test('a real npm-style .cmd shim receives every argument intact (Windows only)', { skip: process.platform !== 'win32' }, () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'nn spawn tool '));
  try {
    const bin = path.join(scratch, 'node_modules', '.bin');
    fs.mkdirSync(bin, { recursive: true });
    const js = path.join(scratch, 'echo-args.js');
    fs.writeFileSync(js, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))');
    const shim = path.join(bin, 'echo-args.cmd');
    // Same shape as the shims npm writes.
    fs.writeFileSync(shim, `@ECHO off\r\n"${process.execPath}" "${js}" %*\r\n`);
    const args = ['plain', 'with space', 'quote"inside', '100%', 'a&b|c', '^caret', 'C:\\dir with space\\'];
    const res = spawnTool(shim, args, { encoding: 'utf8' });
    assert.equal(res.error, undefined, String(res.error));
    assert.equal(res.status, 0, res.stderr);
    assert.deepEqual(JSON.parse(res.stdout), args);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('renderThumbnail drives a pinned-CLI .cmd shim that lives under a path with spaces (Windows only)', { skip: process.platform !== 'win32' }, async () => {
  const { renderThumbnail } = await import('../scripts/render-thumbnail.mjs');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'nn thumb shim '));
  try {
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');
    const bin = path.join(scratch, 'node_modules', '.bin');
    fs.mkdirSync(bin, { recursive: true });
    // Fake CLI: `snapshot <dir> ... --output <shots>` writes one PNG into <shots>.
    const js = path.join(scratch, 'fake-hyperframes.js');
    fs.writeFileSync(js, [
      "const fs = require('fs'), path = require('path');",
      "const a = process.argv.slice(2);",
      "if (a[0] !== 'snapshot' || !fs.existsSync(a[1])) process.exit(3);",
      "const out = a[a.indexOf('--output') + 1];",
      `fs.writeFileSync(path.join(out, 'frame.png'), Buffer.from('${PNG.toString('base64')}', 'base64'));`,
    ].join('\n'));
    const shim = path.join(bin, 'hyperframes.cmd');
    fs.writeFileSync(shim, `@ECHO off\r\n"${process.execPath}" "${js}" %*\r\n`);
    const base = path.join(scratch, 'base.png');
    fs.writeFileSync(base, PNG);
    const gsap = path.join(scratch, 'gsap.min.js');
    fs.writeFileSync(gsap, '/* gsap */');
    const out = path.join(scratch, 'out dir', 'thumb.png');
    await renderThumbnail({
      basePath: base,
      title: 'T',
      outputPath: out,
      deps: { cliPath: shim, appDir: path.join(scratch, 'work dir'), resolveGsap: () => gsap },
    });
    assert.deepEqual(fs.readFileSync(out), PNG);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
