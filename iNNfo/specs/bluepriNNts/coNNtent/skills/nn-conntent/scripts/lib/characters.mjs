/**
 * nn-conntent/scripts/lib/characters.mjs
 *
 * The Character: a folder `library/characters/<name>/` (domaiNN or series) or
 * `media/characters/<name>/` (episode) with a required `CHARACTER.md` and optional
 * `avatars/`, `backgrounds/` and `voice/` sub-folders (capability conntent-character).
 *
 * `loadCharacter(dir)` reads the frontmatter (`name`, `voices`, `default_pose`,
 * `avatar_model`, `avatar_resolution`, `default_background`), validates it against the
 * folder (name matches, voices non-empty ISO codes, default pose/background exist) and
 * lists the poses/backgrounds. `findCharacter(root, name)` resolves `characters/<name>`
 * through the library lookup; an unresolved name throws `character-not-found`.
 *
 * The cascade consumes a character as a node directly beneath the explicit fields of
 * the level that sets `character` (design D19): the character supplies `voice`
 * (`voices[<language>]`), `pose` (`default_pose`), `avatar_model`,
 * `avatar_resolution` and `background` (`default_background`).
 *
 * Zero external dependencies (nn-core via the shared mirror). ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseKnowledge } = require('./nn-core.generated.cjs');

/** The folder name of a Character. */
export const CHARACTER_DIR = 'characters';
export const CHARACTER_FILENAME = 'CHARACTER.md';

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp'];
const ISO_639_1 = /^[a-z]{2}$/;
const KNOWN_KEYS = new Set([
  'name',
  'voices',
  'default_pose',
  'avatar_model',
  'avatar_resolution',
  'default_background',
]);

/** @param {string} name */
function isSafeName(name) {
  return typeof name === 'string' && /^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u.test(name) && name.length <= 64;
}

function basenamesWithoutExt(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => IMAGE_EXT.includes(path.extname(f).toLowerCase()))
    .map((f) => path.basename(f, path.extname(f)))
    .sort();
}

/**
 * Reads and validates one Character from its folder.
 * @param {string} dir The character folder (`.../library/characters/<name>` or `.../media/characters/<name>`).
 * @returns {{ name: string, voices: Record<string, string>, poses: string[], backgrounds: string[],
 *   defaultPose: string|null, avatarModel: string|null, avatarResolution: string|null,
 *   defaultBackground: string|null }}
 */
export function loadCharacter(dir) {
  const file = path.join(dir, CHARACTER_FILENAME);
  if (!fs.existsSync(file)) {
    const err = new Error(`character-invalid: no ${CHARACTER_FILENAME} in ${dir}; a Character needs that file.`);
    err.code = 'character-invalid';
    throw err;
  }
  const text = fs.readFileSync(file, 'utf8');
  const parsed = parseKnowledge(text);
  const front = parsed.frontmatter || {};

  for (const key of Object.keys(front)) {
    if (!KNOWN_KEYS.has(key)) {
      const err = new Error(`character-invalid: ${CHARACTER_FILENAME} declares unknown key "${key}" in ${file}; allowed: ${[...KNOWN_KEYS].sort().join(', ')}`);
      err.code = 'character-invalid';
      throw err;
    }
  }

  const name = front.name === undefined ? '' : String(front.name);
  const folderName = path.basename(dir);
  if (name !== folderName) {
    const err = new Error(`character-invalid: ${file} names "${name}" but the folder is "${folderName}".`);
    err.code = 'character-invalid';
    throw err;
  }
  if (!isSafeName(name)) {
    const err = new Error(`character-invalid: ${file} has an unsafe name "${name}".`);
    err.code = 'character-invalid';
    throw err;
  }

  const voicesRaw = front.voices;
  const voices = {};
  if (voicesRaw && typeof voicesRaw === 'object' && !Array.isArray(voicesRaw)) {
    for (const [lang, slug] of Object.entries(voicesRaw)) {
      if (!ISO_639_1.test(lang)) {
        const err = new Error(`character-invalid: ${file} voices key "${lang}" is not an ISO 639-1 lowercase two-letter code (voices.${lang}).`);
        err.code = 'character-invalid';
        throw err;
      }
      voices[lang] = String(slug);
    }
  }
  if (Object.keys(voices).length === 0) {
    const err = new Error(`character-invalid: ${file} must declare a non-empty "voices" map of language to Voice slug.`);
    err.code = 'character-invalid';
    throw err;
  }

  const poses = basenamesWithoutExt(path.join(dir, 'avatars'));
  const backgrounds = basenamesWithoutExt(path.join(dir, 'backgrounds'));
  const defaultPose = front.default_pose === undefined || front.default_pose === null ? null : String(front.default_pose);
  if (poses.length > 0 && (defaultPose === null || !poses.includes(defaultPose))) {
    const err = new Error(
      `character-invalid: ${file} default_pose "${defaultPose}" is not one of the avatars; available: ${poses.join(', ')}`,
    );
    err.code = 'character-invalid';
    throw err;
  }
  const defaultBackground = front.default_background === undefined || front.default_background === null ? null : String(front.default_background);
  if (defaultBackground !== null && !backgrounds.includes(defaultBackground)) {
    const err = new Error(
      `character-invalid: ${file} default_background "${defaultBackground}" is not one of the backgrounds; available: ${backgrounds.join(', ')}`,
    );
    err.code = 'character-invalid';
    throw err;
  }

  return {
    name,
    voices,
    poses,
    backgrounds,
    defaultPose,
    avatarModel: front.avatar_model === undefined || front.avatar_model === null ? null : String(front.avatar_model),
    avatarResolution: front.avatar_resolution === undefined || front.avatar_resolution === null ? null : String(front.avatar_resolution),
    defaultBackground,
  };
}

/**
 * Resolves `characters/<name>` through the library lookup: domaiNN `library/`, then
 * `.../media/`-adjacent episode folders are out of scope for this call; the caller
 * passes the root that owns the search (the resolved workspace root or the series
 * root). An unresolved name throws `character-not-found`.
 * @param {string} root The workspace root whose `library/` holds the characters.
 * @param {string} name
 * @returns {string} The character folder path.
 */
export function findCharacter(root, name) {
  const candidates = [
    path.join(root, 'library', CHARACTER_DIR, name),
    path.join(root, 'media', CHARACTER_DIR, name),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, CHARACTER_FILENAME))) return dir;
  }
  const err = new Error(
    `character-not-found: no Character "${name}" (${CHARACTER_FILENAME}) in: ${candidates.join(' or ')}`,
  );
  err.code = 'character-not-found';
  throw err;
}

/**
 * The cascade node values of a character for one language: the character supplies
 * `voice`, `pose`, `avatar_model`, `avatar_resolution` and `background` (design D19).
 * @param {{ name: string, voices: Record<string,string>, defaultPose: string|null,
 *   avatarModel: string|null, avatarResolution: string|null, defaultBackground: string|null }} character
 * @param {string} language ISO 639-1 resolved episode language.
 * @returns {{ voice: string, pose: string|null, avatar_model: string|null,
 *   avatar_resolution: string|null, background: string|null }}
 */
export function characterValues(character, language) {
  const lang = String(language || '').toLowerCase();
  return {
    voice: character.voices[lang] || null,
    pose: character.defaultPose,
    avatar_model: character.avatarModel,
    avatar_resolution: character.avatarResolution,
    background: character.defaultBackground,
  };
}

/**
 * The Character voice for a scene MUST be `voices[<resolved language>]`; a language
 * with no entry fails before any spend with `missing-character-voice` naming the
 * Character and the language, WITHOUT falling back to another language's voice or to
 * a domaiNN voice (capability conntent-character "Voice Follows The Episode
 * Language"). Returns the voice slug on success.
 * @param {{ name: string, voices: Record<string,string> }} character
 * @param {string} language ISO 639-1 resolved episode language.
 * @returns {string}
 */
export function assertCharacterVoice(character, language) {
  const lang = String(language || '').toLowerCase();
  const voice = character.voices?.[lang];
  if (typeof voice !== 'string' || voice.trim() === '') {
    const err = new Error(
      `missing-character-voice: Character "${character.name}" has no voice for language "${lang}" ` +
        `(available: ${Object.keys(character.voices || {}).join(', ') || 'none'}); ` +
        `declare a Voice for that language instead of reusing another language's voice.`,
    );
    err.code = 'missing-character-voice';
    throw err;
  }
  return voice;
}

/** The closed set of fields a Character supplies (capability conntent-character). */
export const CHARACTER_FIELDS = ['voice', 'avatar', 'pose', 'background', 'avatar_model', 'avatar_resolution'];

/**
 * Reports `character-override` warnings: fields the active Character supplies whose
 * winning source is a preset or an explicit field instead of the Character. Each
 * warning names the field, the winning source and the Character; the same
 * field+source pair is reported once per scope, not once per scene. A scene whose
 * own `character` wins resolves against THAT character and warns nothing. Never stops
 * a run (capability conntent-character "Overriding A Character Value Warns").
 * @param {{ cascade: { at: (scene?: string, layer?: string) => { get: (field: string) => { value: unknown, source: string|null } } },
 *   characterOf: (name: string) => object | null,
 *   position?: { scene?: string, layer?: string } }} o
 * @returns {Array<{ code: 'character-override', field: string, source: string, character: string }>}
 */
export function characterOverrides({ cascade, characterOf, position = {} }) {
  const warnings = [];
  const seen = new Set();
  const at = cascade.at(position.scene ?? 'scene-1', position.layer);
  for (const field of CHARACTER_FIELDS) {
    const r = at.get(field);
    if (!r || r.source == null) continue;
    // The Character node itself is `<level>:character:<name>` (source trace).
    if (r.source.includes(':character:')) continue;
    // The character whose values could have supplied this field: the active character
    // at the innermost level that declares `character`, or the resolution winner.
    const active = activeCharacterName(cascade, characterOf, position);
    if (!active) continue;
    const key = `${field}|${r.source}`;
    if (seen.has(key)) continue;
    seen.add(key);
    warnings.push({ code: 'character-override', field, source: r.source, character: active });
  }
  return warnings;
}

/** The character named by the nearest scope bag that declares `character::`. */
function activeCharacterName(cascade, characterOf, position = {}) {
  // Cheap and dependency-free: reuse the resolver's own trace for `character`.
  const r = cascade.at(position.scene ?? 'scene-1', position.layer).get('character');
  const name = r && r.source && r.source.includes(':character:')
    ? r.source.split(':character:')[1]
    : (r.source === 'scene' || r.source === 'series' || r.source === 'video' || r.source === 'kind' ? r.value : null);
  return name && characterOf && characterOf(String(name)) ? String(name) : null;
}