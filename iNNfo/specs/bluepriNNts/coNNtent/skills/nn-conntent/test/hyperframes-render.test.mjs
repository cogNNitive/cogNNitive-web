import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tryHyperframesRender, quoteArg } from '../scripts/hyperframes-render.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderVideo, splitPassthrough } from '../scripts/lib/render.mjs';

const manifest = {
  version: '1.0.0',
  compositionId: 'demo-video',
  fps: 30,
  width: 1080,
  height: 1080,
  totalDurationInFrames: 90,
  totalDurationInSeconds: 3,
  tracks: {
    scenes: [
      {
        id: 'scene_a',
        slug: 'a',
        fromFrame: 0,
        durationInFrames: 90,
        transition: { type: 'none' },
        props: { layers: [{ layer_type: 'image', layer_asset_source: 'bg.jpg', layer_level: 0 }] },
      },
    ],
    audio: [],
    overlays: [],
  },
  metadata: { generator: 'cogNNitive Video Engine' },
};

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hf-render-'));
/** A stand-in for the pinned GSAP build: emission vendors it into `vendor/`. */
const fakeGsap = path.join(os.tmpdir(), `nn-gsap-${process.pid}.js`);
fs.writeFileSync(fakeGsap, '/* gsap */');

test('a non-zero exit carries the stderr tail as detail', async () => {
  const dir = tmp();
  const stderr = 'noise\n'.repeat(1000) + 'Error: chrome crashed';
  const res = await tryHyperframesRender(
    { projectDir: '/tmp/nn-build/hyperframes', manifest, outputPath: path.join(dir, 'out.mp4'), gsapPath: fakeGsap },
    { run: async () => ({ status: 3, stdout: 'stdout text', stderr }) },
  );
  assert.equal(res.rendered, false);
  assert.equal(res.reason, 'hyperframes-exit-3');
  assert.match(res.detail, /Error: chrome crashed$/);
  assert.ok(res.detail.length <= 2000, 'detail is a bounded tail');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('detail falls back to stdout when stderr is empty', async () => {
  const dir = tmp();
  const res = await tryHyperframesRender(
    { projectDir: '/tmp/nn-build/hyperframes', manifest, outputPath: path.join(dir, 'out.mp4'), gsapPath: fakeGsap },
    { run: async () => ({ status: 1, stdout: 'only stdout', stderr: '  ' }) },
  );
  assert.equal(res.detail, 'only stdout');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('extraArgs are appended verbatim to the hyperframes render command', async () => {
  const dir = tmp();
  const out = path.join(dir, 'out.mp4');
  let seen;
  const res = await tryHyperframesRender(
    { projectDir: '/tmp/nn-build/hyperframes', manifest, outputPath: out, gsapPath: fakeGsap, extraArgs: ['--workers', '2', '--low-memory-mode'] },
    {
      run: async (cmd, args) => {
        seen = args;
        fs.writeFileSync(out, 'x');
        return { status: 0 };
      },
    },
  );
  assert.equal(res.rendered, true);
  assert.deepEqual(seen.slice(-3), ['--workers', '2', '--low-memory-mode']);
  assert.ok(seen.includes('render'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('renderVideo surfaces the captured detail in the named error and forwards hyperframesArgs', async () => {
  const dir = tmp();
  const manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, metadata: { hyperframesDir: path.join(dir, 'hyperframes'), videoSlug: 'demo-video' } }));
  let seen;
  await assert.rejects(
    renderVideo({
      manifestPath,
      gsapPath: fakeGsap,
      hyperframesArgs: ['--workers', '2'],
      hyperframesRun: async (cmd, args) => {
        seen = args;
        return { status: 1, stdout: '', stderr: 'out of memory' };
      },
    }),
    (err) => err.name === 'VideoRenderError' && /hyperframes-exit-1/.test(err.message) && /out of memory/.test(err.message),
  );
  assert.deepEqual(seen.slice(-2), ['--workers', '2']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('splitPassthrough separates everything after a literal --', () => {
  assert.deepEqual(splitPassthrough(['render', 'm.json', '--output', 'o.mp4', '--', '--workers', '2']), {
    argv: ['render', 'm.json', '--output', 'o.mp4'],
    passthrough: ['--workers', '2'],
  });
  assert.deepEqual(splitPassthrough(['render', 'm.json']), { argv: ['render', 'm.json'], passthrough: [] });
});

test('a spawn error (status null) is reported as error: <msg> with the output tail', async () => {
  const dir = tmp();
  const res = await tryHyperframesRender(
    { projectDir: '/tmp/nn-build/hyperframes', manifest, outputPath: path.join(dir, 'out.mp4'), gsapPath: fakeGsap },
    { run: async () => ({ status: null, error: new Error('ENOBUFS'), stderr: 'x' }) },
  );
  assert.equal(res.rendered, false);
  assert.equal(res.reason, 'error: ENOBUFS');
  assert.equal(res.detail, 'x');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('quoteArg keeps spaces and shell metacharacters inside a single literal argument', () => {
  assert.equal(quoteArg('a b', 'win32'), '"a b"');
  assert.equal(quoteArg('a&b', 'win32'), '"a&b"');
  assert.equal(quoteArg('say "hi"', 'win32'), '"say \\"hi\\""');
  assert.equal(quoteArg('--workers', 'win32'), '--workers');
  assert.equal(quoteArg('a b', 'linux'), "'a b'");
  assert.equal(quoteArg('a&b', 'linux'), "'a&b'");
  assert.equal(quoteArg("it's", 'linux'), String.raw`'it'\''s'`);
  assert.equal(quoteArg('--workers', 'linux'), '--workers');
});

test('a missing pinned CLI is a named reason, never an npx install', async () => {
  const dir = tmp();
  const emptySkill = path.join(dir, 'skill-without-cli');
  fs.mkdirSync(emptySkill, { recursive: true });
  const res = await tryHyperframesRender(
    { projectDir: '/tmp/nn-build/hyperframes',  manifest, outputPath: path.join(dir, 'out.mp4'), gsapPath: fakeGsap },
    { skillDir: emptySkill },
  );
  assert.equal(res.rendered, false);
  assert.equal(res.reason, 'hyperframes-missing');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a version different from the pin is a named reason', async () => {
  const dir = tmp();
  const res = await tryHyperframesRender(
    { projectDir: '/tmp/nn-build/hyperframes', manifest, outputPath: path.join(dir, 'out.mp4'), gsapPath: fakeGsap },
    { cliPath: '/fake/hyperframes', installedPin: '9.9.9' },
  );
  assert.equal(res.rendered, false);
  assert.match(res.reason, /^hyperframes-version-mismatch: 9\.9\.9≠/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an unknown command is refused instead of forwarding a passthrough', () => {
  const cli = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'lib', 'render.mjs');
  const res = spawnSync('node', [cli, 'bogus', '--', '--workers', '2'], { encoding: 'utf8' });
  assert.notEqual(res.status, 0, 'an unknown command must exit non-zero');
  assert.match(res.stderr, /Usage: node lib\/render\.mjs render/);
  assert.ok(!/--workers/.test(res.stdout), 'nothing is rendered from a passthrough alone');
});
