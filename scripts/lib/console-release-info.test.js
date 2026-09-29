#!/usr/bin/env node

/**
 * scripts/lib/console-release-info.test.js
 *
 * Unit tests for the console release-info derivation
 * (scripts/lib/console-release-info.js): the bundle version and CDN URL must
 * come from `manifest/source.yaml`, not from hardcoded literals in
 * build-console-bundle.mjs / export-console.mjs. Uses a disposable fixture
 * `manifest/source.yaml` in a temp dir — never the repo's real manifest — so
 * this test cannot pass for ambient reasons.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getConsoleReleaseInfo } = require('./console-release-info.js');

function makeRepoWithManifest(sourceYaml) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'console-release-info-'));
  fs.mkdirSync(path.join(dir, 'manifest'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'manifest', 'source.yaml'), sourceYaml, 'utf8');
  return dir;
}

function main() {
  console.log('Running console-release-info unit tests...');

  // 1. Derives version and CDN URL matching the fixture manifest (derived ref).
  {
    const dir = makeRepoWithManifest(`
console_assets:
  - name: innfo-console
    repo: cogNNitive/cogNNitive
    file: iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js
    version: "0.2.0"
    ref_key: innfo-console

channels:
  stable:
    refs:
      - key: innfo-console
        repo: cogNNitive/cogNNitive
`);
    try {
      const info = getConsoleReleaseInfo(dir);
      assert.strictEqual(info.version, '0.2.0');
      assert.strictEqual(info.cdnRef, 'innfo-console-v0.2.0');
      assert.strictEqual(
        info.cdnUrl,
        'https://cdn.jsdelivr.net/gh/cogNNitive/cogNNitive@innfo-console-v0.2.0/iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js',
      );
      console.log('✔ Derives version and CDN URL from manifest/source.yaml');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 2. A bumped manifest changes both derived values (proves no hardcoded fallback).
  {
    const dir = makeRepoWithManifest(`
console_assets:
  - name: innfo-console
    repo: cogNNitive/cogNNitive
    file: iNNfo/specs/bluepriNNts/console/innfo-console.bundle.js
    version: "0.3.0"
    ref_key: innfo-console

channels:
  stable:
    refs:
      - key: innfo-console
        repo: cogNNitive/cogNNitive
`);
    try {
      const info = getConsoleReleaseInfo(dir);
      assert.strictEqual(info.version, '0.3.0');
      assert.match(info.cdnUrl, /innfo-console-v0\.3\.0/);
      console.log('✔ Bumped manifest is reflected without code changes');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // 3. Missing console_assets entry throws instead of silently defaulting.
  {
    const dir = makeRepoWithManifest(`
console_assets: []

channels:
  stable:
    refs: []
`);
    try {
      assert.throws(() => getConsoleReleaseInfo(dir), /console_assets/);
      console.log('✔ Missing console_assets entry throws');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log('All console-release-info unit tests passed successfully!');
}

main();
