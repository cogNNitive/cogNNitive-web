#!/usr/bin/env node

/**
 * nn-video-script/scripts/tts-generator.mjs
 *
 * TTS generator module providing direct TTS synthesis, duration probing,
 * and deterministic caching.
 */

import { AssetSynthesizer, probeAudioDuration } from './asset-synthesizer.mjs';
import { CacheManager } from './cache-manager.mjs';

export class TTSGenerator {
  /**
   * @param {Object} [options]
   */
  constructor(options = {}) {
    this.cacheManager = options.cacheManager || new CacheManager(options);
    this.synthesizer = new AssetSynthesizer({
      cacheManager: this.cacheManager,
      ...options,
    });
  }

  /**
   * Synthesizes speech from text.
   * @param {string} text
   * @param {Record<string, unknown>} [options]
   */
  async generate(text, options = {}) {
    return this.synthesizer.synthesizeTTS(text, options);
  }

  /**
   * Probes duration of an audio file in seconds.
   * @param {string} filePath
   */
  async probeDuration(filePath) {
    return probeAudioDuration(filePath, this.synthesizer.probeDeps);
  }
}

export { probeAudioDuration, CacheManager, AssetSynthesizer };
