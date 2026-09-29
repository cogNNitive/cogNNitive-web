#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/finalize-video.mjs
 *
 * The finalize/register step (video-folder-contract — "Finalize/Register Step
 * Promotes Rendered Output"). Copies `master`/`thumbnail`/`voiceover` out of
 * `renders/<ref>/` into the Video Element's own asset location. It never
 * moves or edits the model file (AD6) — a single writer (innfo-mcp) owns
 * model mutation; this script only prints the field values to set.
 *
 * Zero dependencies. Requires Node >= 18.
 *
 * Usage:
 *   node finalize-video.mjs --video-dir <dir> [--ref <r>] [--force-thumbnail]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** @param {string} videoDir */
export function listRenderRefs(videoDir) {
  const rendersDir = path.join(videoDir, 'renders');
  if (!fs.existsSync(rendersDir)) return [];
  return fs
    .readdirSync(rendersDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

/**
 * Picks `renders/<ref>/`. Fails when several candidates exist and no `--ref`
 * disambiguates, or when none exist.
 * @param {string} videoDir
 * @param {string|undefined} ref
 * @returns {string}
 */
export function resolveRenderRef(videoDir, ref) {
  const refs = listRenderRefs(videoDir);
  if (ref) {
    if (!refs.includes(ref)) {
      throw new Error(`Render ref "${ref}" not found under ${path.join(videoDir, 'renders')}`);
    }
    return ref;
  }
  if (refs.length === 0) {
    throw new Error(`No render refs found under ${path.join(videoDir, 'renders')}`);
  }
  if (refs.length > 1) {
    throw new Error(`Multiple render refs found (${refs.join(', ')}); pass --ref to disambiguate`);
  }
  return refs[0];
}

/**
 * Copies via a temp file then an atomic rename, per design AD6 / Data Flow.
 * @param {string} src
 * @param {string} dest
 */
function copyViaTempRename(src, dest) {
  const tmp = `${dest}.tmp-${process.pid}-${Date.now()}`;
  fs.copyFileSync(src, tmp);
  fs.renameSync(tmp, dest);
}

/**
 * @param {string} renderDir
 * @param {string} ref
 * @returns {string|null}
 */
function findVoiceoverFile(renderDir, ref) {
  const prefix = `${ref}_voiceover.`;
  const match = fs.readdirSync(renderDir).find((name) => name.startsWith(prefix));
  return match ? path.join(renderDir, match) : null;
}

/**
 * @param {{ videoDir: string, ref?: string, forceThumbnail?: boolean }} args
 * @returns {{ ok: true, ref: string, fields: Record<string,string>, messages: string[] }}
 */
export function finalizeVideo({ videoDir, ref, forceThumbnail = false }) {
  const resolvedRef = resolveRenderRef(videoDir, ref);
  const renderDir = path.join(videoDir, 'renders', resolvedRef);
  const fields = {};
  const messages = [];

  // 1. master
  const masterSrcCandidates = [
    path.join(renderDir, `${resolvedRef}.mp4`),
    path.join(renderDir, 'master.mp4'),
  ];
  const masterSrc = masterSrcCandidates.find((p) => fs.existsSync(p));
  if (masterSrc) {
    const masterDest = path.join(videoDir, 'master.mp4');
    copyViaTempRename(masterSrc, masterDest);
    fields.master = 'master.mp4';
    messages.push('master:: master.mp4');
  }

  // 2. thumbnail — series often design their own; preserve unless forced or absent.
  const thumbCandidates = [
    path.join(renderDir, `${resolvedRef}_thumbnail.png`),
    path.join(renderDir, 'thumbnail.png'),
  ];
  const thumbnailSrc = thumbCandidates.find((p) => fs.existsSync(p));
  if (thumbnailSrc) {
    const thumbnailDest = path.join(videoDir, 'thumbnail.png');
    const shouldCopy = forceThumbnail || !fs.existsSync(thumbnailDest);
    if (shouldCopy) {
      copyViaTempRename(thumbnailSrc, thumbnailDest);
      fields.thumbnail = 'thumbnail.png';
      messages.push('thumbnail:: thumbnail.png');
    } else {
      messages.push('thumbnail:: (preserved existing thumbnail.png; pass --force-thumbnail to overwrite)');
    }
  }

  // 3. voiceover
  const voiceoverSrc = findVoiceoverFile(renderDir, resolvedRef) ||
    (fs.existsSync(path.join(renderDir, 'voiceover.mp3')) ? path.join(renderDir, 'voiceover.mp3') : null);
  if (voiceoverSrc) {
    const ext = path.extname(voiceoverSrc);
    const voiceoverName = `voiceover${ext}`;
    copyViaTempRename(voiceoverSrc, path.join(videoDir, voiceoverName));
    fields.voiceover = voiceoverName;
    messages.push(`voiceover:: ${voiceoverName}`);
  }

  return { ok: true, ref: resolvedRef, fields, messages };
}

function parseArgs(argv) {
  const flag = (name) => {
    const idx = argv.indexOf(name);
    return idx !== -1 ? argv[idx + 1] : undefined;
  };
  return {
    videoDir: flag('--video-dir'),
    ref: flag('--ref'),
    forceThumbnail: argv.includes('--force-thumbnail'),
  };
}

function main() {
  const { videoDir, ref, forceThumbnail } = parseArgs(process.argv.slice(2));
  if (!videoDir) {
    console.error('Usage: node finalize-video.mjs --video-dir <dir> [--ref <r>] [--force-thumbnail]');
    process.exit(1);
  }
  try {
    const result = finalizeVideo({ videoDir: path.resolve(videoDir), ref, forceThumbnail });
    console.log(`✅ [finalize-video] Promoted renders/${result.ref}/ into ${videoDir}. Set these fields:`);
    for (const line of result.messages) console.log(`  ${line}`);
    if (result.messages.length === 0) {
      console.log('  (nothing to promote — no master/thumbnail/voiceover files found in the render)');
    }
  } catch (err) {
    console.error(`❌ [finalize-video] ${err.message}`);
    process.exit(1);
  }
}

// Symlink/junction-safe guard: compare realpaths, not the typed path vs import.meta.url.
const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
