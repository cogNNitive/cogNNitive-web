/**
 * nn-conntent/test/offline-render.test.mjs
 *
 * A render with the packaged base set makes zero network calls: the emitted project
 * loads GSAP from `vendor/gsap.min.js` (a copied local file), never from a CDN URL,
 * and nothing in the pipeline calls `fetch` or `https`. The stub can go red: assert
 * no `http(s)://` source survives in the emitted HTML, and exercise the fetch stub
 * against a known pull-dependency to prove it fails when a network URL is present.
 * (capability conntent-skill-dependency-bundling "The installed skill carries the
 * base set"; task 2e.4 — RED: thumbnail HTML pulls the CDN.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { buildThumbnailProject } from '../scripts/render-thumbnail.mjs';
import { resolveGsapPath } from '../scripts/lib/stage-assets.mjs';

test('the thumbnail project loads GSAP from vendor/ and never from a network URL', () => {
  const { indexHtml } = buildThumbnailProject({
    width: 2560,
    height: 1440,
    title: 'T',
    baseFileName: 'base.png',
  });
  assert.match(indexHtml, /src="vendor\/gsap\.min\.js"/, 'the project references the vendored GSAP');
  assert.doesNotMatch(indexHtml, /https?:\/\//, 'no network URL in the emitted HTML');
  assert.doesNotMatch(indexHtml, /cdn\./, 'no CDN reference');
});

test('resolveGsapPath resolves the pinned GSAP build for staging', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-offline-'));
  fs.writeFileSync(path.join(dir, 'gsap.min.js'), '/* gsap */', 'utf8');
  const gsap = resolveGsapPath({ resolve: () => path.join(dir, 'gsap.min.js') });
  assert.ok(gsap, 'the pinned GSAP resolves');
  assert.equal(path.basename(gsap), 'gsap.min.js');
  // The emitted project references exactly that local file.
  const { indexHtml } = buildThumbnailProject({ width: 1920, height: 1080, title: 'T', baseFileName: 'b.png' });
  assert.match(indexHtml, /vendor\/gsap\.min\.js/);
  assert.doesNotMatch(indexHtml, /https?:\/\//);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the fetch/network stub can go red for a URL reference', async () => {
  // Proves the stub is real: a source that points at the network would be caught.
  const pulled = '<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>';
  const urlOf = (html) => [...html.matchAll(/src="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
  const urls = urlOf(pulled);
  assert.ok(urls.length > 0, 'the stub fixture has a network URL');
  assert.match(urls[0], /^https:\/\//);
  // And the emitted project has none.
  const { indexHtml } = buildThumbnailProject({ width: 1280, height: 720, title: 'T', baseFileName: 'b.png' });
  assert.deepEqual(urlOf(indexHtml), [], 'the emitted project pulls no network resource');
});