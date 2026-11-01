#!/usr/bin/env node

/**
 * nn-video-script/test/render-formats.test.mjs
 *
 * Unit tests for render-formats.mjs — the one derivation of every delivery file
 * from the single 1920x1920 master (design D5). Crop by default, blur opt-in with
 * a `_blur` suffix, names by true dimensions, and a refusal when the input is not
 * the declared master. ffmpeg and ffprobe are injected as seams, so the tests are
 * pure and run everywhere.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DELIVERY_FORMATS,
  slugFromMaster,
  variantName,
  renderFormats,
} from '../scripts/render-formats.mjs';

const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'render-formats-test-'));
const makeFile = (dir, name) => {
  const p = path.join(dir, name);
  fs.writeFileSync(p, 'x');
  return p;
};
const square = { width: 1920, height: 1920 };
const probeAs = (size) => () => size;

async function runTests() {
  console.log('Running render-formats unit tests...');

  // 1. Formats are pure functions of the master: no stream copy anywhere.
  {
    assert.strictEqual(DELIVERY_FORMATS.vertical.filter, 'crop=1080:1920:420:0');
    assert.strictEqual(DELIVERY_FORMATS.horizontal.filter, 'crop=1920:1080:0:420');
    assert.strictEqual(DELIVERY_FORMATS.square.filter, 'scale=1080:1080:flags=lanczos');
    for (const preset of Object.values(DELIVERY_FORMATS)) {
      assert.strictEqual('copy' in preset, false, 'no format is a stream copy any more');
    }
    console.log('OK every format is a crop or a scale of the master, never a copy');
  }

  // 2. The slug comes from the master file name.
  {
    assert.strictEqual(slugFromMaster('/x/pepper-mapache_1920x1920.mp4'), 'pepper-mapache');
    assert.strictEqual(variantName('pepper-mapache', DELIVERY_FORMATS.vertical), 'pepper-mapache_1080x1920.mp4');
    assert.strictEqual(
      variantName('pepper-mapache', { ...DELIVERY_FORMATS.vertical, suffix: '_blur' }),
      'pepper-mapache_1080x1920_blur.mp4',
    );
    console.log('OK the slug comes from the master and every name carries its true dimensions');
  }

  // 3. A master that is not 1920x1920 is refused before any ffmpeg run.
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'ep_1080x1080.mp4');
    let ran = 0;
    await assert.rejects(
      () => renderFormats({ master, probe: probeAs({ width: 1080, height: 1080 }), run: () => { ran++; return { status: 0 }; } }),
      /Master must be 1920x1920/,
    );
    assert.strictEqual(ran, 0, 'nothing is rendered when the input is not the master');
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('OK a non-1920x1920 input is refused before any ffmpeg run');
  }

  // 4. Each format derives with its own filter and the shared arguments.
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'ep_1920x1920.mp4');
    const calls = [];
    const res = await renderFormats({
      master,
      probe: probeAs(square),
      run: (args) => {
        calls.push(args);
        fs.writeFileSync(args[args.length - 1], 'x');
        return { status: 0 };
      },
    });
    assert.strictEqual(calls.length, 3, 'square, vertical and horizontal');
    const filters = calls.map((a) => a[a.indexOf('-filter_complex') + 1]);
    assert.deepStrictEqual(filters, [
      DELIVERY_FORMATS.square.filter,
      DELIVERY_FORMATS.vertical.filter,
      DELIVERY_FORMATS.horizontal.filter,
    ]);
    for (const args of calls) {
      assert.ok(args.includes('libx264'));
      assert.ok(args.includes('-crf'));
      assert.ok(args.includes('18'));
      assert.ok(args.includes('-fflags'));
      assert.ok(args.includes('+bitexact'));
      assert.strictEqual(args.includes('-c'), false, 'no -c copy');
    }
    assert.deepStrictEqual(
      res.variants.map((v) => path.basename(v.outputPath)),
      ['ep_1080x1080.mp4', 'ep_1080x1920.mp4', 'ep_1920x1080.mp4'],
    );
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('OK every format derives by its own filter with the shared arguments');
  }

  // 5. Blur is opt-in and only for the vertical/horizontal files.
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'ep_1920x1920.mp4');
    const calls = [];
    const run = (args) => {
      calls.push(args);
      fs.writeFileSync(args[args.length - 1], 'x');
      return { status: 0 };
    };
    const res = await renderFormats({ master, fill: 'blur', probe: probeAs(square), run });
    const names = res.variants.map((v) => path.basename(v.outputPath));
    assert.deepStrictEqual(names, ['ep_1080x1080.mp4', 'ep_1080x1920_blur.mp4', 'ep_1920x1080_blur.mp4']);
    assert.match(calls[1][calls[1].indexOf('-filter_complex') + 1], /gblur/);
    assert.match(calls[2][calls[2].indexOf('-filter_complex') + 1], /gblur/);
    assert.strictEqual(calls[0][calls[0].indexOf('-filter_complex') + 1], DELIVERY_FORMATS.square.filter);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('OK blur is opt-in, suffixed and never applied to the square');
  }

  // 6. An existing output is kept unless --force.
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'ep_1920x1920.mp4');
    const existing = makeFile(dir, 'ep_1080x1920.mp4');
    let ran = 0;
    const run = (args) => {
      ran++;
      fs.writeFileSync(args[args.length - 1], 'x');
      return { status: 0 };
    };
    const skipped = await renderFormats({ master, probe: probeAs(square), run });
    assert.strictEqual(ran, 2, 'only the two missing files are written');
    assert.ok(skipped.variants.find((v) => path.basename(v.outputPath) === path.basename(existing)).skipped);
    const forced = await renderFormats({ master, force: true, probe: probeAs(square), run });
    assert.strictEqual(ran, 5, '--force re-derives all three');
    assert.strictEqual(forced.variants.length, 3);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('OK an existing variant is kept unless --force');
  }

  // 7. Dry run writes nothing.
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'ep_1920x1920.mp4');
    let ran = 0;
    const res = await renderFormats({ master, dryRun: true, probe: probeAs(square), run: () => { ran++; return { status: 0 }; } });
    assert.strictEqual(ran, 0);
    assert.strictEqual(res.dryRun, true);
    assert.strictEqual(res.variants.length, 3);
    assert.deepStrictEqual(fs.readdirSync(dir), ['ep_1920x1920.mp4']);
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('OK dry run plans every variant and writes nothing');
  }

  // 8. ffmpeg missing is a loud, named error.
  {
    const dir = tmpDir();
    const master = makeFile(dir, 'ep_1920x1920.mp4');
    await assert.rejects(
      () => renderFormats({ master, formats: ['square'], probe: probeAs(square), run: () => ({ error: { code: 'ENOENT' } }) }),
      /ffmpeg was not found on PATH/,
    );
    fs.rmSync(dir, { recursive: true, force: true });
    console.log('OK a missing ffmpeg is a named error');
  }

  console.log('\nAll render-formats tests passed!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
