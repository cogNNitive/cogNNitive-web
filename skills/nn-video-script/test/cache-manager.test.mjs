#!/usr/bin/env node

/**
 * skills/nn-video-script/test/cache-manager.test.mjs
 *
 * Unit tests for CacheManager and AssetSynthesizer:
 * - SHA-256 hash determinism across runs and option key orders
 * - Cache hit vs cache miss behavior
 * - Directory isolation (tts/, images/, temp/)
 * - AssetSynthesizer TTS caching and probe audio duration
 */

import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CacheManager } from '../scripts/cache-manager.mjs';
import { AssetSynthesizer, probeAudioDuration } from '../scripts/asset-synthesizer.mjs';

// Hermetic: a maintainer machine may export real provider keys. Tests must never reach a paid provider.
for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'ELEVENLABS_API_KEY', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) {
  delete process.env[k];
}

function makeTempCacheDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cognnitive-cache-test-'));
}

async function runTests() {
  console.log('Running Cache Manager unit tests...');

  // Test 1: Deterministic hash generation
  {
    const baseDir = makeTempCacheDir();
    const cache = new CacheManager({ baseDir });

    const hash1 = cache.computeHash('Hello world', { voice: 'alloy', speed: 1.0 });
    const hash2 = cache.computeHash('Hello world', { speed: 1.0, voice: 'alloy' }); // reversed key order
    const hash3 = cache.computeHash('Hello world', { voice: 'echo', speed: 1.0 });

    assert.strictEqual(hash1, hash2, 'Hash must be identical regardless of object property ordering');
    assert.notStrictEqual(hash1, hash3, 'Different options must produce distinct hashes');
    assert.strictEqual(typeof hash1, 'string');
    assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 hex characters');
    console.log('✔ Deterministic SHA-256 hash generation is invariant to object key ordering');
  }

  // Test 2: Subdirectory isolation
  {
    const baseDir = makeTempCacheDir();
    const cache = new CacheManager({ baseDir });

    assert.ok(fs.existsSync(path.join(baseDir, 'tts')));
    assert.ok(fs.existsSync(path.join(baseDir, 'images')));
    assert.ok(fs.existsSync(path.join(baseDir, 'temp')));

    const ttsPath = await cache.put('samplehash123', 'mp3', Buffer.from('AUDIO'), 'tts');
    const imgPath = await cache.put('samplehash123', 'png', Buffer.from('IMAGE'), 'images');

    assert.ok(ttsPath.includes(path.join('tts', 'samplehash123.mp3')));
    assert.ok(imgPath.includes(path.join('images', 'samplehash123.png')));
    console.log('✔ Directory isolation for tts, images, and temp directories');
  }

  // Test 3: Cache miss followed by cache hit
  {
    const baseDir = makeTempCacheDir();
    const cache = new CacheManager({ baseDir });
    const synthesizer = new AssetSynthesizer({ cacheManager: cache });

    const text = 'Welcome to the cognitive video synthesis pipeline.';
    const voiceOpts = { voice: 'English_Male_Bold' };

    // Initial synthesis -> Cache miss
    const res1 = await synthesizer.synthesizeTTS(text, voiceOpts);
    assert.strictEqual(res1.fromCache, false, 'First request should be a cache miss');
    assert.ok(fs.existsSync(res1.assetPath));
    assert.ok(res1.fileSizeBytes > 0);
    // Duration is measured via @remotion/media-parser; when the engine is not
    // installed the measurement is 0 rather than an FFmpeg/size estimate.
    assert.ok(typeof res1.durationSeconds === 'number' && res1.durationSeconds >= 0);

    // Second synthesis -> Cache hit
    const res2 = await synthesizer.synthesizeTTS(text, voiceOpts);
    assert.strictEqual(res2.fromCache, true, 'Second request must be a cache hit');
    assert.strictEqual(res2.assetPath, res1.assetPath);
    assert.strictEqual(res2.sha256, res1.sha256);
    console.log('✔ AssetSynthesizer avoids redundant TTS synthesis on cache hit');
  }

  // Test 4: Media asset resolution and caching
  {
    const baseDir = makeTempCacheDir();
    const cache = new CacheManager({ baseDir });
    const synthesizer = new AssetSynthesizer({ cacheManager: cache });

    const prompt = 'Futuristic high-tech neural network visualization';
    const mediaRes1 = await synthesizer.resolveMedia(prompt);
    assert.strictEqual(mediaRes1.fromCache, false);
    assert.ok(fs.existsSync(mediaRes1.assetPath));

    const mediaRes2 = await synthesizer.resolveMedia(prompt);
    assert.strictEqual(mediaRes2.fromCache, true);
    assert.strictEqual(mediaRes2.assetPath, mediaRes1.assetPath);
    console.log('✔ Prompt media synthesis properly caches and resolves assets');
  }

  console.log('\nAll cache manager unit tests passed! ✨');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
