#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/vus-spec.mjs
 *
 * Resolves `$VIDGENN_ROOT/packages/core/specs/<v>.json`, verifies the pinned
 * sha256 declared in this skill's own SKILL.md frontmatter (`vus_spec:`), and
 * exposes `voices` / `props <scope>` queries against the pinned spec.
 *
 * This is the single place the skill reads VUS-syntax facts (voice IDs,
 * property names/scopes) at run time — see video-script-skill's
 * No-Prose-Copy requirement. Nothing here is restated as literal prose
 * anywhere else in this skill's documentation.
 *
 * Zero dependencies. Requires Node >= 18.
 *
 * Usage:
 *   node vus-spec.mjs voices
 *   node vus-spec.mjs props <scope>
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_SKILL_MD_PATH = path.join(__dirname, '..', 'SKILL.md');

/**
 * Reads the `vus_spec: { version, sha256 }` block from SKILL.md frontmatter.
 * Deliberately a small hand-rolled scan (not a full YAML parser) to keep this
 * script zero-dependency, matching the rest of this skill's tooling.
 * @param {string} skillMdPath
 */
export function readPinnedVusSpec(skillMdPath = DEFAULT_SKILL_MD_PATH) {
  const content = fs.readFileSync(skillMdPath, 'utf8');
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) throw new Error(`No frontmatter found in ${skillMdPath}`);
  const fm = fmMatch[1];
  const blockMatch = fm.match(/vus_spec:\s*\r?\n((?:[ \t]+.+\r?\n?)+)/);
  if (!blockMatch) throw new Error(`vus_spec pin not found in ${skillMdPath} frontmatter`);
  const block = blockMatch[1];
  const versionMatch = block.match(/version:\s*"?([\w.-]+)"?/);
  const shaMatch = block.match(/sha256:\s*"?([0-9a-f]{64})"?/);
  if (!versionMatch || !shaMatch) {
    throw new Error(`vus_spec pin in ${skillMdPath} must declare both version and sha256`);
  }
  return { version: versionMatch[1], sha256: shaMatch[1] };
}

/** @param {Buffer} buf */
function normalizeForHash(buf) {
  let text = buf.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text.replace(/\r\n/g, '\n');
}

/** @param {string} filePath */
export function computeSha256(filePath) {
  const text = normalizeForHash(fs.readFileSync(filePath));
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/**
 * @param {string} vidgennRoot
 * @param {string} version
 */
export function resolveVusSpecPath(vidgennRoot, version) {
  return path.join(vidgennRoot, 'packages', 'core', 'specs', `${version}.json`);
}

/**
 * @param {{ vidgennRoot?: string, skillMdPath?: string }} [args]
 * @returns {{ skipped: true, reason: string } | { skipped: false, pin: {version:string,sha256:string}, spec: any }}
 */
export function loadVusSpec({ vidgennRoot = process.env.VIDGENN_ROOT, skillMdPath = DEFAULT_SKILL_MD_PATH } = {}) {
  if (!vidgennRoot) {
    return { skipped: true, reason: 'VIDGENN_ROOT is not set; skipping VUS spec pin verification.' };
  }
  const pin = readPinnedVusSpec(skillMdPath);
  const specPath = resolveVusSpecPath(vidgennRoot, pin.version);
  if (!fs.existsSync(specPath)) {
    throw new Error(`Pinned VUS spec not found at ${specPath}`);
  }
  const actualSha256 = computeSha256(specPath);
  if (actualSha256 !== pin.sha256) {
    throw new Error(
      `VUS spec hash drift at ${specPath}: pinned ${pin.sha256}, actual ${actualSha256}. The canonical source is packages/core/specs/, never .agent/skills/anydeo-script-builder/specs/.`,
    );
  }
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  if (spec.info?.version !== pin.version) {
    throw new Error(`VUS spec info.version "${spec.info?.version}" does not match pinned version "${pin.version}"`);
  }
  return { skipped: false, pin, spec };
}

/** @param {any} spec */
export function listVoices(spec) {
  return spec.api_options?.voices ?? [];
}

/**
 * @param {any} spec
 * @param {string} scope
 */
export function listPropsForScope(spec, scope) {
  return Object.entries(spec.properties ?? {})
    .filter(([, def]) => def.scope === scope)
    .map(([name, def]) => ({ name, ...def }));
}

function main() {
  const [command, arg] = process.argv.slice(2);
  const result = loadVusSpec();

  if (result.skipped) {
    console.log(`SKIP: ${result.reason}`);
    process.exit(0);
  }

  if (command === 'voices') {
    console.log(JSON.stringify(listVoices(result.spec), null, 2));
  } else if (command === 'props') {
    if (!arg) {
      console.error('Usage: node vus-spec.mjs props <scope>');
      process.exit(1);
    }
    console.log(JSON.stringify(listPropsForScope(result.spec, arg), null, 2));
  } else {
    console.error('Usage: node vus-spec.mjs <voices|props> [scope]');
    process.exit(1);
  }
}

// Symlink/junction-safe guard: compare realpaths, not the typed path vs import.meta.url.
const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
