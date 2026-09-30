#!/usr/bin/env node

/**
 * scripts/publish-web.mjs
 *
 * One-way publish of the built site (`docs/`) to the public distribution repo
 * `cogNNitive-web`, part of OpenSpec change `2026-09-30-public-web-repository-split`.
 *
 * Contract:
 *   - The private monorepo is the single source of truth; the public repo holds
 *     GENERATED OUTPUT ONLY.
 *   - Idempotent: when the built artifact is byte-identical to what the public
 *     repo already has, this is a no-op (no empty commit).
 *   - Append-only: it commits ON TOP of the public repo's history, so SHA-pinned
 *     manifest URLs stay valid.
 *
 * Env:
 *   INNFO_DOCS_OUT       built site root (default `<repo>/docs`)
 *   WEB_PUBLISH_REPO     target repo slug (default `cogNNitive/cogNNitive-web`)
 *   WEB_PUBLISH_TOKEN    token with Contents:write on the target repo (required)
 *   WEB_PUBLISH_SUBDIR   path inside the public repo (default `docs`)
 *
 * Usage:
 *   node scripts/publish-web.mjs [--dry-run]
 *
 * Exit: 0 on success or no-op; 1 on a real failure.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { diffTrees } = require('./lib/publish-diff.js');

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');
const docsRoot = process.env.INNFO_DOCS_OUT
  ? resolve(process.env.INNFO_DOCS_OUT)
  : join(repoRoot, 'docs');
const targetRepo = process.env.WEB_PUBLISH_REPO || 'cogNNitive/cogNNitive-web';
const subdir = (process.env.WEB_PUBLISH_SUBDIR || 'docs').replace(/^\/+|\/+$/g, '');

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

// Source trees that must NEVER reach the public repo: the site is generated
// output only. If the built artifact ever carries any of these, refuse to
// publish rather than leak private source (public-web-distribution: "Build
// Output Only").
const FORBIDDEN_SOURCE = [
  'src',
  'packages',
  'node_modules',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  '.env',
];

function assertNoSource(dir) {
  const offenders = [];
  const walk = (abs, rel) => {
    for (const name of readdirSync(abs)) {
      const full = join(abs, name);
      const relPath = rel ? `${rel}/${name}` : name;
      const isDir = statSync(full).isDirectory();
      if (!rel && FORBIDDEN_SOURCE.includes(name)) {
        offenders.push(isDir ? `${relPath}/` : relPath);
        continue;
      }
      if (isDir) walk(full, relPath);
    }
  };
  walk(dir, '');
  if (offenders.length > 0) {
    console.error(
      `publish-web: refusing to publish — the artifact carries source-like paths that must never be public: ${offenders.join(', ')}`,
    );
    process.exit(1);
  }
}

function main() {
  if (!existsSync(docsRoot)) {
    console.error(`publish-web: built docs not found at ${docsRoot} — run \`npm run build:docs\` first.`);
    process.exit(1);
  }

  const token = process.env.WEB_PUBLISH_TOKEN;
  if (!token && !DRY_RUN) {
    console.error('publish-web: WEB_PUBLISH_TOKEN is required (Contents: write on the target repo).');
    process.exit(1);
  }

  // Generated-output-only guarantee: never publish private source.
  assertNoSource(docsRoot);

  const work = mkdtempSync(join(tmpdir(), 'publish-web-'));
  try {
    const cloneUrl = token
      ? `https://x-access-token:${token}@github.com/${targetRepo}.git`
      : `https://github.com/${targetRepo}.git`;

    console.log(`publish-web: cloning ${targetRepo}...`);
    git(['clone', '--depth', '1', cloneUrl, work], repoRoot);

    // The public repo's Pages source is `main:<subdir>`. Diff the built tree
    // against exactly that subtree.
    const targetTree = join(work, subdir);
    const d = diffTrees(docsRoot, existsSync(targetTree) ? targetTree : join(work, '__absent__'));

    if (d.identical) {
      console.log('publish-web: artifact is byte-identical — no-op (no empty commit).');
      return;
    }

    console.log(
      `publish-web: publishing ${d.added.length} added, ${d.modified.length} modified, ${d.removed.length} removed file(s).`,
    );

    // Replace the subtree with the freshly built artifact (excluding the
    // public repo's own .git; .nojekyll/CNAME live inside docsRoot already).
    rmSync(targetTree, { recursive: true, force: true });
    cpSync(docsRoot, targetTree, { recursive: true });

    if (DRY_RUN) {
      console.log('publish-web: DRY RUN — no commit/push performed.');
      return;
    }

    git(['config', 'user.name', 'cogNNitive publish bot'], work);
    git(['config', 'user.email', 'publish@cognnitive.com'], work);
    git(['add', '--', subdir], work);

    // Nothing staged (e.g. only ignored files changed) -> no-op.
    const staged = git(['diff', '--cached', '--name-only'], work);
    if (!staged) {
      console.log('publish-web: nothing staged after add — no-op.');
      return;
    }

    const stamp = new Date().toISOString();
    git(['commit', '-m', `chore: publish site from cogNNitive@${process.env.GITHUB_SHA || 'local'} (${stamp})`], work);
    git(['push', 'origin', 'HEAD:main'], work);
    console.log('publish-web: pushed to', targetRepo);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main();
