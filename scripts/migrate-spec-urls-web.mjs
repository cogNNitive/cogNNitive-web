#!/usr/bin/env node

/**
 * scripts/migrate-spec-urls-web.mjs
 *
 * Codemod: re-roots the canonical spec hosting URLs from the (soon to be
 * private) `cogNNitive/cogNNitive` monorepo to the public distribution host
 * `cogNNitive/cogNNitive-web`. Part of OpenSpec change
 * `2026-09-30-public-web-repository-split` (decision: canonical base = the
 * public repo raw path; minimal repo-name swap only).
 *
 * Enforces LF line endings on all modified files. Idempotent: re-running finds
 * nothing to replace.
 *
 * Usage:
 *   node scripts/migrate-spec-urls-web.mjs --dry-run
 *   node scripts/migrate-spec-urls-web.mjs
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');

const INCLUDED_EXTENSIONS = new Set([
  '.md',
  '.ts',
  '.vue',
  '.js',
  '.mjs',
  '.html',
  '.json',
  '.yaml',
  '.yml',
]);

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'archive',
  'dist',
  'temp',
  '.claude',
]);

// Self: this codemod names both hosts in its own prose/regexes.
const SELF_PATH = 'scripts/migrate-spec-urls-web.mjs';

function shouldSkip(relPath, isDir) {
  const normalized = relPath.replace(/\\/g, '/');
  const segments = normalized.split('/');

  for (const seg of segments) {
    if (EXCLUDED_DIRS.has(seg)) return true;
  }

  // Historical archives keep the pre-split URLs (permanent history).
  if (normalized.startsWith('openspec/changes/archive/')) return true;
  // The legacy predecessor codemod records the old cogNNitive/iNNfo slug on purpose.
  if (normalized === 'scripts/migrate-spec-urls.mjs') return true;
  // The strict checker + its own tests name both hosts in their regexes/exclusions.
  if (normalized === 'scripts/check-spec-version.mjs') return true;
  if (normalized === 'iNNfo/scripts/check-spec-version.mjs') return true;
  if (normalized.startsWith('scripts/lib/legacy-write-guard')) return true;
  // Frozen write-once predecessors (permanent history, never migrated).
  if (normalized === 'iNNfo/specs/defiNNe_V_0-1-0_NN.md') return true;
  if (normalized === 'iNNfo/specs/defiNNition_V_0-1-0_NN.md') return true;
  if (normalized === 'iNNfo/packages/innfo-core/src/schema/canonical-registry.ts') return true;
  // Quarantine fixture: the migrator's input keeps the pre-rename template URLs.
  if (normalized.startsWith('iNNfo/packages/innfo-core/tests/legacy/fixtures/')) return true;
  // The frozen legacy-domain fixture (editor tests) keeps the pre-rename URLs.
  if (normalized.startsWith('iNNfo/apps/innfo-editor/tests/fixtures/models')) return true;

  if (!isDir) {
    if (normalized === SELF_PATH) return true;
    if (normalized.endsWith('.bundle.js')) return true;
  }

  return false;
}

function collectFiles(dir) {
  const files = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const relPath = relative(REPO_ROOT, fullPath);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      if (!shouldSkip(relPath, true)) {
        files.push(...collectFiles(fullPath));
      }
    } else {
      if (!shouldSkip(relPath, false)) {
        const ext = extname(entry);
        if (INCLUDED_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  return files;
}

// The active canonical raw base and browsing blob base, both rooted at the
// monorepo. Only these two are re-rooted; other `cogNNitive/cogNNitive`
// references (repo links, install instructions) stay as-is.
const RAW_SPECS_RE =
  /https:\/\/raw\.githubusercontent\.com\/cogNNitive\/cogNNitive\/(?:main|v[\d.]+)\/iNNfo\/specs\//g;

const BLOB_INNFO_RE = /https:\/\/github\.com\/cogNNitive\/cogNNitive\/blob\/main\/iNNfo\//g;

function migrateContent(content) {
  let count = 0;
  let updated = content;

  updated = updated.replace(RAW_SPECS_RE, () => {
    count++;
    return 'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/';
  });

  updated = updated.replace(BLOB_INNFO_RE, () => {
    count++;
    return 'https://github.com/cogNNitive/cogNNitive-web/blob/main/iNNfo/';
  });

  return { updated, count };
}

function run() {
  console.log(`[codemod:web] Scanning repo starting at ${REPO_ROOT}...`);
  const files = collectFiles(REPO_ROOT);
  console.log(`[codemod:web] Collected ${files.length} candidate files.`);

  let modifiedCount = 0;
  let totalReplacements = 0;

  for (const file of files) {
    const relPath = relative(REPO_ROOT, file);
    const content = readFileSync(file, 'utf8');
    const { updated, count } = migrateContent(content);

    if (count > 0) {
      modifiedCount++;
      totalReplacements += count;
      console.log(`  [RE-ROOT] (${count}) ${relPath}`);

      if (!DRY_RUN) {
        const lfContent = updated.replace(/\r\n/g, '\n');
        writeFileSync(file, lfContent, 'utf8');
      }
    }
  }

  console.log(
    `\n[codemod:web] Complete: ${modifiedCount} files modified, ${totalReplacements} total replacements.${
      DRY_RUN ? ' (DRY RUN - no files written)' : ''
    }`
  );
}

run();
