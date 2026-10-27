/**
 * nn-video-script/test/skill-domain-setup.test.mjs
 *
 * Guard: SKILL.md documents the domain Video Defaults adoption step, naming the
 * package source path and the domain-root destination of the copy (design D16).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const skillMd = fs.readFileSync(path.resolve(here, '..', 'SKILL.md'), 'utf8');

test('SKILL.md documents the domain Video Defaults adoption copy', () => {
  assert.match(skillMd, /Domain setup/i);
  // The package source path and the domain-root destination are both named.
  assert.match(skillMd, /defaults\/video-defaults_NN\.md/);
  assert.match(skillMd, /<domain root>\/video-defaults_NN\.md/);
});
