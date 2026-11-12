#!/usr/bin/env node

/**
 * nn-conntent/test/console-regen-shared-writer.test.mjs
 *
 * Issue #611 item 5: `produce` logged `console: regeneration failed ... The "path"
 * argument must be of type string ... Received undefined` while the same export from the
 * CLI worked. Every pipeline test injects `deps.writeConsole`, so the real lookup of the
 * shared writer (`resolveConsoleModulePath` from the nn-core mirror) never ran in a test.
 * These tests run `regenerateOnExit` without an injected writer, the way `produce` does.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { regenerateOnExit, EXIT_DONE } from '../scripts/lib/pipeline.mjs';

function withConsoleDir(fn) {
  return async () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-conntent-console-regen-'));
    const consoleDir = path.join(scratch, 'console');
    const rootDir = path.join(scratch, 'domain');
    fs.mkdirSync(consoleDir, { recursive: true });
    fs.mkdirSync(rootDir, { recursive: true });
    fs.writeFileSync(
      path.join(consoleDir, 'export-console.mjs'),
      'export async function writeConsole(opts) {\n' +
        '  globalThis.__nnConsoleRegenCalls = (globalThis.__nnConsoleRegenCalls || []).concat([opts]);\n' +
        "  return { status: 'written', path: opts.rootDir + '/domaiNN_console.html' };\n" +
        '}\n',
    );
    const saved = { dir: process.env.INNFO_CONSOLE_DIR, noOpen: process.env.INNFO_CONSOLE_NO_OPEN };
    process.env.INNFO_CONSOLE_DIR = consoleDir;
    process.env.INNFO_CONSOLE_NO_OPEN = '1';
    globalThis.__nnConsoleRegenCalls = [];
    try {
      await fn({ rootDir });
    } finally {
      if (saved.dir === undefined) delete process.env.INNFO_CONSOLE_DIR;
      else process.env.INNFO_CONSOLE_DIR = saved.dir;
      if (saved.noOpen === undefined) delete process.env.INNFO_CONSOLE_NO_OPEN;
      else process.env.INNFO_CONSOLE_NO_OPEN = saved.noOpen;
      delete globalThis.__nnConsoleRegenCalls;
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  };
}

test(
  'without an injected writer, produce regenerates the console through the shared writer it locates',
  withConsoleDir(async ({ rootDir }) => {
    const lines = [];
    const result = await regenerateOnExit({ rootDir, exitCode: EXIT_DONE, log: (l) => lines.push(l) });
    assert.equal(result.status, 'written', `regeneration failed: ${lines.join('\n')}`);
    assert.equal(globalThis.__nnConsoleRegenCalls.length, 1, 'the located writer ran once');
    assert.equal(globalThis.__nnConsoleRegenCalls[0].rootDir, rootDir);
    assert.equal(globalThis.__nnConsoleRegenCalls[0].scope, 'domain');
  }),
);

test(
  'an injected writer still wins over the located one',
  withConsoleDir(async ({ rootDir }) => {
    const calls = [];
    const writeConsole = async (opts) => {
      calls.push(opts);
      return { status: 'injected', path: 'x' };
    };
    const result = await regenerateOnExit({ rootDir, exitCode: EXIT_DONE, deps: { writeConsole } });
    assert.equal(result.status, 'injected');
    assert.equal(calls.length, 1);
    assert.equal(globalThis.__nnConsoleRegenCalls.length, 0, 'the located writer did not run');
  }),
);
