/**
 * nn-video-script/scripts/lib/legacy-draft-keys.mjs
 *
 * The single list of retired keys a draft or reviewed JSON may no longer carry,
 * with the replacement each one was renamed to. A file carrying one is rejected
 * with `legacy-draft-keys`: it is never ignored or translated, because a silent
 * drop could fall back to a default voice or model and spend.
 */

/** Retired key -> current name (the rename table of the video-presets change). */
export const RETIRED_DRAFT_KEYS = {
  template: 'presets',
  speed: 'voice_speed',
  emotion: 'voice_emotion',
  tts_model: 'voice_model',
  music: 'background_audio',
  music_volume: 'background_audio_volume',
  presenter_asset: 'avatar',
  intro_asset: 'intro',
};

/**
 * Every retired key found where a draft or reviewed state keeps parameters:
 * `config[].key`, `config.effective`/`config.overrides`, `videoOverrides`,
 * per-scene override maps and `scenes[].template`. Off-schema keys and
 * `scenes[].choice.model` (an avatar model id) are not legacy. Self-contained
 * (no module references) because the review console embeds its source.
 * @returns {{ at: string, key: string, replacement: string }[]}
 */
export function findLegacyKeys(doc, retired) {
  const found = [];
  const has = (k) => Object.prototype.hasOwnProperty.call(retired, k);
  const flag = (at, key) => { if (has(key)) found.push({ at, key, replacement: retired[key] }); };
  const keysOf = (at, map) => {
    if (map && typeof map === 'object' && !Array.isArray(map)) Object.keys(map).forEach((k) => flag(at, k));
  };
  const d = doc && typeof doc === 'object' ? doc : {};
  if (Array.isArray(d.config)) d.config.forEach((c) => flag('config[].key', c && c.key));
  else if (d.config && typeof d.config === 'object') {
    keysOf('config.effective', d.config.effective);
    keysOf('config.overrides', d.config.overrides);
  }
  keysOf('videoOverrides', d.videoOverrides);
  (Array.isArray(d.scenes) ? d.scenes : []).forEach((sc) => {
    if (!sc || typeof sc !== 'object') return;
    const at = 'scenes[' + (sc.slug || '?') + ']';
    if (Object.prototype.hasOwnProperty.call(sc, 'template')) flag(at + '.template', 'template');
    keysOf(at + '.sceneOverrides', sc.sceneOverrides);
    keysOf(at + '.overrides', sc.overrides);
  });
  return found;
}

/**
 * Throws `legacy-draft-keys` naming the file and each retired key with its replacement.
 * @param {object} doc a parsed draft or reviewed JSON
 * @param {string} source file path or label, for the message
 */
export function assertNoLegacyKeys(doc, source) {
  const found = findLegacyKeys(doc, RETIRED_DRAFT_KEYS);
  if (found.length === 0) return;
  const list = found.map((f) => `${f.key} (${f.at}, now ${f.replacement})`).join('; ');
  const err = new Error(`legacy-draft-keys: ${source} carries retired keys: ${list}. Re-draft it, or produce this episode with the earlier blueprint version.`);
  err.code = 'legacy-draft-keys';
  throw err;
}
