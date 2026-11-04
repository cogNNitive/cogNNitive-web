#!/usr/bin/env node

/**
 * nn-conntent/scripts/prune-duplicates.mjs
 *
 * Finds files in an episode or Series folder whose exact bytes already live in the
 * content-addressed provider cache, and optionally deletes them.
 *
 * The rule is deliberately narrow (design P3, "one of every fact"): a file is a
 * duplicate only when its sha256, its extension and a real cache entry all match. A
 * same-name-different-bytes file, a different extension and anything the cache does not
 * hold byte-for-byte are reported and never touched. The cache entry itself is never
 * deleted: it is the copy of record.
 *
 * Usage:
 *   node prune-duplicates.mjs <episode-or-series-dir> [--apply] [--json]
 *
 * Without `--apply` it only reports (a dry run), which is the default because this is the
 * one cleanup that deletes authored files.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolveWorkspace } from './lib/video-guard.mjs';

/** Extensions the provider cache can hold. Anything else is never a duplicate. */
const PRUNABLE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.mp4', '.wav', '.mp3', '.m4a']);

/** Directories that are engine output or the cache itself, never authored media. */
const SKIP_DIRS = new Set(['node_modules', 'hyperframes', 'formats', '.git', '.cognnitive']);

function walk(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile() && PRUNABLE_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * Every file under `target` whose bytes are also a cache entry.
 * @param {{ target: string, cacheDir: string }} options
 * @returns {Array<{ file: string, cacheEntry: string, bytes: number }>}
 */
export function findDuplicates({ target, cacheDir }) {
  const cache = path.resolve(cacheDir);
  if (!fs.existsSync(cache)) return [];
  const found = [];
  for (const file of walk(path.resolve(target))) {
    const ext = path.extname(file).toLowerCase();
    const hash = sha256(file);
    // The cache stores `<hash><ext>`; the extension must match too, so a renamed
    // container (the same bytes under another type) is never treated as the same asset.
    const entry = [path.join(cache, 'images', `${hash}${ext}`), path.join(cache, 'tts', `${hash}${ext}`), path.join(cache, 'temp', `${hash}${ext}`)].find(
      (candidate) => fs.existsSync(candidate),
    );
    if (!entry) continue;
    found.push({ file, cacheEntry: entry, bytes: fs.statSync(file).size });
  }
  return found;
}

/**
 * @param {{ target: string, cacheDir: string, apply?: boolean }} options
 * @returns {{ duplicates: Array<{ file: string, cacheEntry: string, bytes: number }>, removed: string[], reclaimableBytes: number }}
 */
export function pruneDuplicates({ target, cacheDir, apply = false }) {
  const duplicates = findDuplicates({ target, cacheDir });
  const removed = [];
  if (apply) {
    for (const duplicate of duplicates) {
      fs.rmSync(duplicate.file, { force: true });
      removed.push(duplicate.file);
    }
  }
  const reclaimableBytes = duplicates.reduce((sum, d) => sum + d.bytes, 0);
  return { duplicates, removed, reclaimableBytes };
}

const USAGE = [
  'Usage: node prune-duplicates.mjs <episode-or-series-dir> [options]',
  '  --apply   delete the duplicates (default: report only)',
  '  --json    machine-readable output',
  'Only files whose exact bytes and extension are a cache entry are deleted; the cache is never touched.',
].join('\n');

function main() {
  const argv = process.argv.slice(2);
  const target = argv.find((a) => !a.startsWith('--'));
  if (!target || !fs.existsSync(target)) {
    console.error(USAGE);
    process.exit(1);
  }
  const apply = argv.includes('--apply');
  const json = argv.includes('--json');
  const unknown = argv.filter((a) => a.startsWith('--') && !['--apply', '--json'].includes(a));
  if (unknown.length > 0) {
    console.error(`Unknown option ${unknown[0]}\n${USAGE}`);
    process.exit(1);
  }

  const workspace = resolveWorkspace(path.resolve(target));
  const cacheDir = path.join(workspace.root, '.cognnitive', 'cache', 'video');
  const result = pruneDuplicates({ target: path.resolve(target), cacheDir, apply });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  for (const duplicate of result.duplicates) {
    console.log(`${apply ? 'deleted' : 'duplicate'} ${duplicate.file} (${duplicate.bytes} B)`);
  }
  const summary =
    `${result.duplicates.length} duplicate(s), ${result.reclaimableBytes} B ` +
    `${apply ? 'reclaimed' : 'reclaimable (dry run, pass --apply to delete)'}`;
  console.log(summary);
}

const isMain =
  process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
