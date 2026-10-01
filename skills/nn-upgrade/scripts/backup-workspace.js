#!/usr/bin/env node

/**
 * skills/nn-upgrade/scripts/backup-workspace.js
 *
 * Timestamped, full-tree out-of-workspace backup with SHA-256 manifest verification.
 *
 * Usage:
 *   node backup-workspace.js --workspace-dir <dir> [--target <dir>] [--dry-run] [--json]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const SKIP_DIRS = new Set(['.git', '.staging', 'backups', 'archive', 'node_modules', 'dist', 'coverage']);

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function isInside(child, parent) {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function defaultTarget(workspaceDir) {
  const parent = path.dirname(path.resolve(workspaceDir));
  const name = path.basename(path.resolve(workspaceDir));
  return path.join(parent, `${name}-backup-${stamp()}`);
}

function sha256(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Backup a workspace's full tree to a timestamped out-of-workspace dir.
 * Returns a manifest { target, files, missing, sha256Manifest }.
 */
function backupWorkspace(workspaceDir, options = {}) {
  const dryRun = options.dryRun || false;
  const skipDirs = options.skipDirs || SKIP_DIRS;
  const ws = path.resolve(workspaceDir);
  if (!fs.existsSync(ws) || !fs.statSync(ws).isDirectory()) {
    throw new Error(`workspace not found: ${ws}`);
  }
  const target = options.target ? path.resolve(options.target) : defaultTarget(ws);
  if (isInside(target, ws)) {
    throw new Error(`backup target must be outside the workspace: ${target}`);
  }

  const manifest = { target, files: [], dirs: [], missing: [], sha256Manifest: {} };

  function collect(dir, relDir = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (skipDirs.has(entry.name)) continue;
      const relPath = relDir ? path.join(relDir, entry.name) : entry.name;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        manifest.dirs.push(relPath.split(path.sep).join('/'));
        collect(fullPath, relPath);
      } else if (entry.isFile()) {
        const normRel = relPath.split(path.sep).join('/');
        manifest.files.push(normRel);
        if (!dryRun) {
          const destPath = path.join(target, relPath);
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.copyFileSync(fullPath, destPath);
          manifest.sha256Manifest[normRel] = sha256(destPath);
        }
      }
    }
  }

  if (!dryRun) {
    fs.mkdirSync(target, { recursive: true });
  }

  collect(ws);

  if (!dryRun) {
    const manifestLines = Object.entries(manifest.sha256Manifest)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([f, hash]) => `${hash}  ${f}`)
      .join('\n');
    fs.writeFileSync(path.join(target, 'manifest.sha256'), manifestLines + '\n', 'utf-8');
  }

  return manifest;
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : null;
}

function main() {
  const isJson = process.argv.includes('--json');
  const dryRun = process.argv.includes('--dry-run');
  const workspaceDir = getArg('--workspace-dir') || getArg('--domain-dir');
  const target = getArg('--target');

  if (!workspaceDir) {
    console.error('Usage: node backup-workspace.js --workspace-dir <dir> [--target <dir>] [--dry-run] [--json]');
    process.exit(2);
  }

  try {
    const manifest = backupWorkspace(workspaceDir, { target, dryRun });
    if (isJson) {
      console.log(JSON.stringify({ ok: true, dryRun, ...manifest }, null, 2));
    } else {
      const verb = dryRun ? 'Would back up' : 'Backed up';
      console.log(`${verb} to ${manifest.target}`);
      console.log(`  files: ${manifest.files.length} files backed up.`);
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ ok: false, error: err.message }));
    } else {
      console.error(`backup-workspace: ${err.message}`);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { backupWorkspace, defaultTarget, isInside, sha256 };