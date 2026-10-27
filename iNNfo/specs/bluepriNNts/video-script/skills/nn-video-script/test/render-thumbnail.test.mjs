/**
 * nn-video-script/test/render-thumbnail.test.mjs
 *
 * Tests for render-thumbnail.mjs after the S4b rewrite: it emits a one-frame
 * HyperFrames composition and renders it through the pinned CLI (no `sharp`).
 * The CLI is stubbed via the `deps.run` seam, so no real render runs here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  wrapText,
  parseCliArgs,
  buildThumbnailProject,
  resolveThumbnailText,
  renderThumbnail,
} from '../scripts/render-thumbnail.mjs';

// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nn-thumb-'));
}

/** Resolves the snapshot output dir and writes one PNG there. */
function stubRun(_cmd, args) {
  const i = args.indexOf('--output');
  const dir = args[i + 1];
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'frame-00-at-0s.png'), PNG);
  return { status: 0, stdout: '', stderr: '' };
}

test('wrapText wraps by length and respects explicit newlines', () => {
  const lines = wrapText('LA RUEDA DE HIERRO Y MADERA', 15);
  assert.ok(lines.length > 1);
  assert.equal(lines[0], 'LA RUEDA DE');
  const explicit = wrapText('PRIMERA LINEA\nSEGUNDA LINEA', 50);
  assert.deepEqual(explicit, ['PRIMERA LINEA', 'SEGUNDA LINEA']);
});

test('parseCliArgs parses every flag', () => {
  const parsed = parseCliArgs(['--base', 'b.jpg', '--title', 'T', '--subtitle', 'S', '--badge', 'B', '--out', 'o.png', '--series', 's', '--width', '1920', '--height', '1080']);
  assert.deepEqual(parsed, { basePath: 'b.jpg', title: 'T', subtitle: 'S', badge: 'B', outputPath: 'o.png', seriesDir: 's', width: 1920, height: 1080 });
});

test('resolveThumbnailText defaults subtitle/badge to the series title', () => {
  assert.deepEqual(resolveThumbnailText({ seriesTitle: 'Other Series' }), { subtitle: 'Other Series', badge: 'Other Series' });
  assert.deepEqual(resolveThumbnailText({ subtitle: 'S', badge: 'B', seriesTitle: 'X' }), { subtitle: 'S', badge: 'B' });
  assert.equal(resolveThumbnailText({}).badge, 'iNNtrevistas');
});

test('buildThumbnailProject emits a one-frame composition with the text and the frame tokens', () => {
  const { indexHtml } = buildThumbnailProject({
    width: 2560,
    height: 1440,
    title: 'LA BRUJULA',
    subtitle: 'Shen Kuo',
    badge: 'iNNtrevistas',
    baseFileName: 'base_abc.png',
    frameTokens: { colors: { primary: '#1e2bfa' }, typography: { body: { fontFamily: 'Inter' } } },
  });
  assert.match(indexHtml, /data-composition-id="thumbnail"/);
  assert.match(indexHtml, /data-width="2560"/);
  assert.match(indexHtml, /data-height="1440"/);
  assert.match(indexHtml, /src="assets\/base_abc\.png"/);
  assert.match(indexHtml, /id="badge"[^>]*>iNNtrevistas</);
  assert.match(indexHtml, /id="title"[^>]*>LA BRUJULA</);
  assert.match(indexHtml, /id="subtitle"[^>]*>Shen Kuo</);
  assert.match(indexHtml, /'Inter'/);
  assert.match(indexHtml, /#1e2bfa/);
  assert.doesNotMatch(indexHtml, /sharp/i);
});

test('renderThumbnail runs the CLI snapshot and copies the PNG output', async () => {
  const dir = tmp();
  try {
    const base = path.join(dir, 'base.png');
    fs.writeFileSync(base, PNG);
    const out = path.join(dir, 'thumb.png');
    const res = await renderThumbnail({ basePath: base, title: 'T', outputPath: out, deps: { run: stubRun, cliPath: '/fake/hyperframes' } });
    assert.equal(res.width, 2560);
    assert.ok(fs.existsSync(out));
    assert.deepEqual(fs.readFileSync(out), PNG);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('renderThumbnail converts to JPEG via ffmpeg for a .jpg output', async () => {
  const dir = tmp();
  try {
    const base = path.join(dir, 'base.png');
    fs.writeFileSync(base, PNG);
    const out = path.join(dir, 'thumb.jpg');
    let ffmpegCalled = false;
    const ffmpegRun = (_cmd, args) => {
      ffmpegCalled = true;
      fs.writeFileSync(args[args.length - 1], Buffer.from('jpeg'));
      return { status: 0 };
    };
    await renderThumbnail({ basePath: base, title: 'T', outputPath: out, deps: { run: stubRun, cliPath: '/fake/hyperframes', ffmpegRun } });
    assert.ok(ffmpegCalled, 'ffmpeg runs for a JPEG output');
    assert.ok(fs.existsSync(out));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('renderThumbnail fails loudly when the CLI is missing or mismatched', async () => {
  const dir = tmp();
  try {
    const base = path.join(dir, 'base.png');
    fs.writeFileSync(base, PNG);
    await assert.rejects(
      renderThumbnail({ basePath: base, title: 'T', outputPath: path.join(dir, 'o.png'), deps: { run: stubRun, installedVersion: '0.0.1' } }),
      /hyperframes-version-mismatch/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the skill declares no sharp dependency and the thumbnail renderer imports no sharp', () => {
  const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(skillDir, 'package.json'), 'utf8'));
  assert.ok(!pkg.dependencies || !pkg.dependencies.sharp, 'no declared sharp dependency');
  const src = fs.readFileSync(path.join(skillDir, 'scripts', 'render-thumbnail.mjs'), 'utf8');
  assert.doesNotMatch(src, /require\(['"]sharp['"]\)|from ['"]sharp['"]/);
});
