import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AssetSynthesizer, probeAudioDuration, probeAudioDurationDetailed } from '../scripts/asset-synthesizer.mjs';
import { CacheManager } from '../scripts/cache-manager.mjs';
import { SpendGuard, DEFAULT_GUARD } from '../scripts/lib/video-guard.mjs';

const tmp = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'probe-dur-')));
const READER = { name: 'node-reader-sentinel' };
const NOT_A_URL = 'x is not a URL - needs to start with http:// or https:// or blob:';

function file(dir = tmp(), name = 'a.mp3') {
  const p = path.join(dir, name);
  fs.writeFileSync(p, Buffer.from('audio'));
  return p;
}

/** A 16-bit mono 8 kHz PCM WAV of `seconds` seconds. */
function wav(seconds) {
  const sr = 8000;
  const n = sr * seconds * 2;
  const b = Buffer.alloc(44 + n);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n, 40);
  return b;
}

describe('probeAudioDuration reads LOCAL files through the node reader', () => {
  it('passes reader: nodeReader (and the license acknowledgement) to parseMedia', async () => {
    let seen;
    const seconds = await probeAudioDuration(file(), {
      parseMedia: async (args) => {
        seen = args;
        return { durationInSeconds: 2.376 };
      },
      nodeReader: READER,
    });
    assert.equal(seconds, 2.376);
    assert.equal(seen.reader, READER, 'a local path needs the node reader; the default web reader throws');
    assert.equal(seen.acknowledgeRemotionLicense, true);
    assert.deepEqual(seen.fields, { durationInSeconds: true });
  });

  it('the old failure mode is visible: a parser that throws "is not a URL" returns 0 WITH the reason', async () => {
    const errors = [];
    const parseMedia = async () => { throw new Error(NOT_A_URL); };
    assert.equal(await probeAudioDuration(file(), { parseMedia, nodeReader: READER, onError: (m) => errors.push(m) }), 0);
    assert.match(errors[0], /media-parser failed: .*not a URL/);
    const detailed = await probeAudioDurationDetailed(file(), { parseMedia, nodeReader: READER });
    assert.equal(detailed.seconds, 0);
    assert.match(detailed.error, /media-parser failed: .*not a URL/);
  });

  it('degrades to 0 with a clear reason only when the module is truly unavailable', async () => {
    const detailed = await probeAudioDurationDetailed(file(), { loadModules: async () => null });
    assert.equal(detailed.seconds, 0);
    assert.match(detailed.error, /@remotion\/media-parser is not installed/);
  });

  it('explains a missing file and a parser that reports no duration', async () => {
    const missing = await probeAudioDurationDetailed(path.join(tmp(), 'nope.mp3'), {});
    assert.match(missing.error, /not found/);
    const none = await probeAudioDurationDetailed(file(), { parseMedia: async () => ({ durationInSeconds: null }), nodeReader: READER });
    assert.match(none.error, /no duration/i);
  });

  it('the synthesizer attaches the measured duration (so compile gets real frame counts)', async () => {
    const root = tmp();
    const guard = new SpendGuard({ config: structuredClone(DEFAULT_GUARD), root });
    const synth = new AssetSynthesizer({
      cacheManager: new CacheManager({ baseDir: path.join(root, 'cache') }),
      guard,
      env: {},
      probeDeps: { parseMedia: async () => ({ durationInSeconds: 2.376 }), nodeReader: READER },
    });
    const res = await synth.synthesizeTTS('a short narration for the test');
    assert.equal(res.durationSeconds, 2.376);
    const again = await synth.synthesizeTTS('a short narration for the test');
    assert.equal(again.fromCache, true);
    assert.equal(again.durationSeconds, 2.376);
  });

  it('measures a real WAV through the real parser when it is installed', async (t) => {
    let installed = true;
    try {
      await import('@remotion/media-parser');
      await import('@remotion/media-parser/node');
    } catch {
      installed = false;
    }
    if (!installed) {
      t.skip('@remotion/media-parser is not installed in this checkout (run ensure-engine.mjs); the reader wiring is covered by the seam tests');
      return;
    }
    const p = path.join(tmp(), 'tone.wav');
    fs.writeFileSync(p, wav(4));
    const detailed = await probeAudioDurationDetailed(p);
    assert.equal(detailed.error, undefined, detailed.error);
    assert.ok(Math.abs(detailed.seconds - 4) < 0.05, String(detailed.seconds));
  });
});

describe('the callers report why a duration is unknown', () => {
  it('synthesize-avatar says WHY it refuses to price (parser error included)', async () => {
    const { synthesizeAvatars } = await import('../scripts/synthesize-avatar.mjs');
    const { RemotionSceneCompiler } = await import('../scripts/remotion-scene-compiler.mjs');
    const { buildTtsVoiceOptions, resolveRegisteredVoice } = await import('../scripts/lib/tts-options.mjs');
    const root = tmp();
    fs.writeFileSync(path.join(root, 'video-guard.json'), '{"version":1}');
    const dir = path.join(root, 'ep');
    fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'audio'));
    fs.writeFileSync(path.join(dir, 'media', 'a.jpeg'), 'img');
    const script = ['//ANYDEO_SPEC: V_0-3-3', '# Video', '- video_title: T', '', '# Scenes', '', '## Scene 1: A', '@base Intro', 'Hello there.', '',
      '@@ Host', '- layer_type: talking_avatar', '  ![media](media/a.jpeg)', ''].join('\n');
    const scriptPath = path.join(dir, 'script.md');
    fs.writeFileSync(scriptPath, script);
    const sc = new RemotionSceneCompiler({}).parseScript(script).scenes[0];
    const cache = new CacheManager({ baseDir: path.join(root, '.cognnitive', 'cache', 'video') });
    const key = cache.computeHash(sc.narration.trim(), resolveRegisteredVoice(buildTtsVoiceOptions(sc, {}), structuredClone(DEFAULT_GUARD)));
    cache.putSync(key, 'mp3', Buffer.from('audio'), 'tts');
    fs.writeFileSync(path.join(dir, 'audio', sc.id + '_voiceover.mp3'), 'audio');
    const err = await synthesizeAvatars({
      scriptPath, dryRun: true, env: {},
      probeDeps: { parseMedia: async () => { throw new Error(NOT_A_URL); }, nodeReader: READER },
    }).then(() => null, (e) => e);
    assert.match(err.message, /media-parser failed: .*not a URL/);
    assert.match(err.message, /refusing to price/);
  });

  it('TTSGenerator.probeDuration uses the same reader wiring', async () => {
    const { TTSGenerator } = await import('../scripts/tts-generator.mjs');
    let seen;
    const gen = new TTSGenerator({
      baseDir: path.join(tmp(), 'cache'),
      env: {},
      probeDeps: { parseMedia: async (a) => { seen = a; return { durationInSeconds: 1.5 }; }, nodeReader: READER },
    });
    assert.equal(await gen.probeDuration(file()), 1.5);
    assert.equal(seen.reader, READER);
  });
});
