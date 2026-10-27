/**
 * nn-video-script/test/no-phantom-providers.test.mjs
 *
 * The phantom providers `elevenlabs` / `edge-tts` (an enum value and an API-key
 * check with no request path) are deleted from the engine, and no cascade default
 * model id lives in engine code: the pricing catalog and the guard allow-list are
 * data, every selection default resolves from the cascade bags.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PHANTOM = /elevenlabs|edge-tts|edge_tts/i;
// The test itself names the phantom provider, so it is the only whole-tree exception.
const ALLOWED = new Set(['test/no-phantom-providers.test.mjs']);

function walk(dir, out, filter) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out, filter);
    else if (filter(entry.name)) out.push(full);
  }
}

test('no phantom TTS provider survives in the skill', () => {
  const files = [];
  walk(SKILL_DIR, files, (n) => /\.(mjs|js|cjs|md|json|html)$/i.test(n));
  const offenders = [];
  for (const file of files) {
    const rel = path.relative(SKILL_DIR, file).split(path.sep).join('/');
    if (ALLOWED.has(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    if (PHANTOM.test(text)) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `phantom provider references remain: ${offenders.join(', ')}`);
});

// The pricing catalog and the guard allow-list carry the model ids as DATA; every
// other engine script must obtain them from the cascade, never hardcode them.
const DATA_MODULES = new Set(['asset-cost-estimator.mjs', 'lib/video-guard.mjs']);
const DEFAULT_MODEL_IDS = /minimax\/speech-2\.8-hd|wavespeed-ai\/z-image\/turbo|wavespeed-ai\/infinitetalk-fast/;

test('no cascade default model id or selection helper lives in engine code', () => {
  const scriptsDir = path.join(SKILL_DIR, 'scripts');
  const files = [];
  walk(scriptsDir, files, (n) => /\.(mjs|js|cjs)$/i.test(n));
  const offenders = [];
  for (const file of files) {
    const rel = path.relative(scriptsDir, file).split(path.sep).join('/');
    const text = fs.readFileSync(file, 'utf8');
    if (PHANTOM.test(text)) offenders.push(`${rel} (phantom provider)`);
    if (/DEFAULT_MODELS|resolveEngineModel/.test(text)) offenders.push(`${rel} (hardcoded selection helper)`);
    if (!DATA_MODULES.has(rel) && DEFAULT_MODEL_IDS.test(text)) offenders.push(`${rel} (hardcoded default model id)`);
  }
  assert.deepEqual(offenders, [], `engine code must resolve defaults from the cascade: ${offenders.join(', ')}`);
});
