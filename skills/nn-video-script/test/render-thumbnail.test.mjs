#!/usr/bin/env node

/**
 * skills/nn-video-script/test/render-thumbnail.test.mjs
 *
 * Unit tests for render-thumbnail.mjs: SVG generation, text escaping,
 * CLI argument parsing, and Sharp image compositing.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  escapeXml,
  wrapText,
  generateThumbnailSvg,
  parseCliArgs,
  renderThumbnail,
} from '../scripts/render-thumbnail.mjs';

async function runTests() {
  console.log('Running render-thumbnail unit tests...');

  // Test 1: escapeXml escapes special XML characters
  {
    const raw = `Shen Kuo & <"Innovators"> '1086'`;
    const escaped = escapeXml(raw);
    assert.strictEqual(
      escaped,
      'Shen Kuo &amp; &lt;&quot;Innovators&quot;&gt; &apos;1086&apos;',
      'XML entities should be properly escaped'
    );
    console.log('✔ escapeXml handles XML entities');
  }

  // Test 2: wrapText wraps words within character budget and respects newlines
  {
    const text = 'LA RUEDA DE HIERRO Y MADERA';
    const lines = wrapText(text, 15);
    assert.ok(lines.length > 1, 'Long text should wrap across multiple lines');
    assert.strictEqual(lines[0], 'LA RUEDA DE');
    assert.strictEqual(lines[1], 'HIERRO Y MADERA');

    const explicit = 'PRIMERA LINEA\nSEGUNDA LINEA';
    const explicitLines = wrapText(explicit, 50);
    assert.strictEqual(explicitLines.length, 2);
    assert.strictEqual(explicitLines[0], 'PRIMERA LINEA');
    assert.strictEqual(explicitLines[1], 'SEGUNDA LINEA');
    console.log('✔ wrapText splits by length and respects explicit newlines');
  }

  // Test 3: generateThumbnailSvg produces valid SVG structure with proper tags
  {
    const svg = generateThumbnailSvg({
      width: 2560,
      height: 1440,
      title: 'LA BRÚJULA',
      subtitle: 'Shen Kuo · 1086',
      badge: 'iNNtrevistas',
    });

    assert.ok(svg.includes('<svg width="2560" height="1440"'), 'SVG contains correct root attributes');
    assert.ok(svg.includes('LA BRÚJULA'), 'SVG contains main title text');
    assert.ok(svg.includes('Shen Kuo · 1086'), 'SVG contains subtitle text');
    assert.ok(svg.includes('iNNtrevistas'), 'SVG contains brand badge');
    assert.ok(svg.includes('filter="url(#shadow-main)"'), 'SVG contains drop-shadow filter reference');
    console.log('✔ generateThumbnailSvg outputs structured SVG markup');
  }

  // Test 4: parseCliArgs parses command line flags correctly
  {
    const argv = [
      '--base', 'test/base.jpg',
      '--title', 'LA IMPRENTA',
      '--subtitle', 'Bi Sheng · 1040',
      '--badge', 'iNNtrevistas',
      '--out', 'test/thumb.jpg',
      '--width', '1920',
      '--height', '1080',
    ];
    const parsed = parseCliArgs(argv);
    assert.strictEqual(parsed.basePath, 'test/base.jpg');
    assert.strictEqual(parsed.title, 'LA IMPRENTA');
    assert.strictEqual(parsed.subtitle, 'Bi Sheng · 1040');
    assert.strictEqual(parsed.badge, 'iNNtrevistas');
    assert.strictEqual(parsed.outputPath, 'test/thumb.jpg');
    assert.strictEqual(parsed.width, 1920);
    assert.strictEqual(parsed.height, 1080);
    console.log('✔ parseCliArgs parses all CLI arguments accurately');
  }

  // Test 5: End-to-end rendering pipeline using sharp composite
  {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cog-thumb-test-'));
    const testBaseFile = path.join(tempDir, 'test-base.jpg');
    const testOutputFile = path.join(tempDir, 'test-thumb-out.jpg');
    const testPngOutputFile = path.join(tempDir, 'test-thumb-out.png');

    try {
      // 1. Create a synthetic 1280x720 base image
      await sharp({
        create: {
          width: 1280,
          height: 720,
          channels: 3,
          background: { r: 30, g: 41, b: 59 },
        },
      })
        .jpeg()
        .toFile(testBaseFile);

      assert.ok(fs.existsSync(testBaseFile), 'Synthetic base image created');

      // 2. Render JPEG thumbnail
      const resultJpeg = await renderThumbnail({
        basePath: testBaseFile,
        title: 'LA RUEDA',
        subtitle: 'Mesopotamia · 3500 a.C.',
        badge: 'iNNtrevistas',
        outputPath: testOutputFile,
        width: 2560,
        height: 1440,
      });

      assert.ok(fs.existsSync(testOutputFile), 'JPEG thumbnail output exists');
      const jpegMeta = await sharp(testOutputFile).metadata();
      assert.strictEqual(jpegMeta.width, 2560, 'Output width should match 2560');
      assert.strictEqual(jpegMeta.height, 1440, 'Output height should match 1440');
      assert.strictEqual(jpegMeta.format, 'jpeg', 'Format should be jpeg');

      // 3. Render PNG thumbnail
      await renderThumbnail({
        basePath: testBaseFile,
        title: 'LA BRÚJULA',
        outputPath: testPngOutputFile,
        width: 1920,
        height: 1080,
      });

      assert.ok(fs.existsSync(testPngOutputFile), 'PNG thumbnail output exists');
      const pngMeta = await sharp(testPngOutputFile).metadata();
      assert.strictEqual(pngMeta.width, 1920, 'Output width should match 1920');
      assert.strictEqual(pngMeta.height, 1080, 'Output height should match 1080');
      assert.strictEqual(pngMeta.format, 'png', 'Format should be png');

      console.log('✔ renderThumbnail completes deterministic end-to-end rendering (JPEG & PNG)');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  console.log('\nAll render-thumbnail tests passed! ✨');
}

runTests().catch((err) => {
  console.error('❌ Test failure:', err);
  process.exit(1);
});
