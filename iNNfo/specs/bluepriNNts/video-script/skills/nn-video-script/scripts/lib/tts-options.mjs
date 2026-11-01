/**
 * nn-video-script/scripts/lib/tts-options.mjs
 *
 * The single definition of the TTS cache identity of a scene's narration: the voice options
 * compile builds and the registered-voice resolution the synthesizer applies. compile,
 * the synthesizer and synthesize-avatar (stale-audio check) all use these, so they always
 * agree on which cached audio belongs to which narration.
 *
 * Zero external dependencies. ESM module.
 */

import { resolve } from './video-scope.mjs';

/**
 * @param {{ properties?: Record<string, any> }} sc Lowered scene
 * @param {{ tts?: string }} [models] Explicitly chosen models (a chosen TTS model changes the output, so it joins the key)
 * @param {Record<string, Record<string, unknown>>} [bags] Cascade bags (`cli`/`series`/`domain`/`blueprint`) for the fallbacks
 * @returns {Record<string, unknown>}
 */
export function buildTtsVoiceOptions(sc, models = {}, _bags = {}) {
  // Every voice input was resolved through the cascade when the scene was
  // lowered (design D4), so the identity is read from one place. The internal
  // option keys stay `model`, `voice`, `speed`, `emotion` and
  // `modelOverride`: they are the TTS cache identity and MUST NOT follow the
  // public renames (design D5).
  const p = sc?.properties || {};
  const voiceOptions = {};
  if (p.scene_voice_model !== null && p.scene_voice_model !== undefined) voiceOptions.model = p.scene_voice_model;
  if (p.scene_voice !== null && p.scene_voice !== undefined) voiceOptions.voice = p.scene_voice;
  // Delivery changes the synthesized audio, so it belongs to the cache identity.
  // Only declared values are added: the provider defaults stay out of the key.
  if (p.scene_voice_speed !== undefined && p.scene_voice_speed !== null) voiceOptions.speed = p.scene_voice_speed;
  if (p.scene_voice_emotion) voiceOptions.emotion = p.scene_voice_emotion;
  if (models.tts) voiceOptions.modelOverride = models.tts;
  return voiceOptions;
}

/**
 * Adds the registered voice id (video-guard.json `voices`, by name or by voice_id) so it is part
 * of the cache key. System voices keep their original key (the name alone).
 * @param {Record<string, any>} voiceOptions
 * @param {{ voices?: Record<string, any> }} config
 */
export function resolveRegisteredVoice(voiceOptions, config) {
  if (voiceOptions.voiceId || voiceOptions.voice_id) return voiceOptions;
  const name = voiceOptions.voice;
  if (typeof name !== 'string' || name === '' || name === 'default') return voiceOptions;
  const voices = config?.voices || {};
  const entry = Object.hasOwn(voices, name)
    ? voices[name]
    : Object.values(voices).find((e) => e && e.voice_id && e.voice_id === name) || null;
  if (entry && !entry.pending && entry.voice_id) return { ...voiceOptions, voiceId: entry.voice_id };
  return voiceOptions;
}
