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

/**
 * @param {{ properties?: Record<string, any>, resolvedTemplate?: { tool?: string, voice?: string, model?: string } }} sc Lowered scene
 * @param {{ tts?: string }} [models] Explicitly chosen models (a chosen TTS model changes the output, so it joins the key)
 * @returns {Record<string, unknown>}
 */
export function buildTtsVoiceOptions(sc, models = {}) {
  // Voice/model come from the resolved `template::` instance, never from a
  // script-declared field (a script declares no voice or model).
  const tmpl = sc.resolvedTemplate || (sc.template && typeof sc.template === 'object' ? sc.template : null);
  const model = tmpl?.model || tmpl?.tool || sc.properties?.scene_tts_model || 'elevenlabs';
  const voiceOptions = {
    model,
    voice: tmpl?.voice || sc.properties?.scene_voice || 'default',
  };
  for (const k of Object.keys(voiceOptions)) {
    if (voiceOptions[k] === undefined) delete voiceOptions[k];
  }
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
