#!/usr/bin/env node

/**
 * nn-video-script/scripts/finalize-video.mjs
 *
 * Finalize derives the delivery formats from the single 1920x1920 master, prints
 * the chapters of `description.md` and prints the two Field values the Video
 * record needs. It never writes the model and never copies anything: render wrote
 * the master in place (`<slug>_1920x1920.mp4`), so there is no promotion step and
 * no `renders/<ref>/` to read (design D2/D5/D6 of change
 * 2026-11-01-video-folder-contract).
 *
 * Zero dependencies. Requires Node >= 18.
 *
 * Usage:
 *   node finalize-video.mjs <episode-dir> [--formats vertical,horizontal,square]
 *     [--fill crop|blur] [--force] [--dry-run]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFormats } from './render-formats.mjs';
import { chapterLines, readManifestForFinalize } from './lib/description.mjs';

const MASTER_SUFFIX = '_1920x1920.mp4';
const THUMBNAIL_NAME = null; // resolved from the files on disk, see below

/** @param {string} dir */
export function listEpisodeScripts(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('_video-script_') || /_video-script_.*_NN\.md$/.test(f))
    .sort();
}

/** The episode's script document: the one `*_video-script_*_NN.md` in the folder. */
export function episodeScriptPath(episodeDir) {
  const scripts = listEpisodeScripts(episodeDir);
  if (scripts.length === 0) {
    throw new Error(`No episode script found in ${path.resolve(episodeDir)} (*_video-script_*_NN.md)`);
  }
  if (scripts.length > 1) {
    throw new Error(`Several episode scripts in ${path.resolve(episodeDir)}: ${scripts.join(', ')}`);
  }
  return path.join(path.resolve(episodeDir), scripts[0]);
}

/** The master render wrote in place. */
export function masterPath(episodeDir) {
  const dir = path.resolve(episodeDir);
  const masters = fs.readdirSync(dir).filter((f) => f.endsWith(MASTER_SUFFIX));
  if (masters.length === 0) {
    throw new Error(`No <slug>${MASTER_SUFFIX} in ${dir}; run render first`);
  }
  if (masters.length > 1) {
    throw new Error(`Several masters in ${dir}: ${masters.join(', ')}; keep one`);
  }
  return path.join(dir, masters[0]);
}

/** The delivered thumbnail, if the episode already has one. */
export function thumbnailPath(episodeDir) {
  const dir = path.resolve(episodeDir);
  const thumbs = fs
    .readdirSync(dir)
    .filter((f) => /_thumbnail_\d+x\d+\.(png|jpe?g)$/i.test(f))
    .sort();
  return thumbs.length ? path.join(dir, thumbs[0]) : null;
}

/** Parses `--formats a,b` into the canonical list. */
export function parseFormats(value) {
  if (!value) return ['vertical', 'horizontal', 'square'];
  const names = String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const known = new Set(['vertical', 'horizontal', 'square']);
  for (const name of names) {
    if (!known.has(name)) {
      throw new Error(`Unknown format "${name}" (known: ${[...known].join(', ')})`);
    }
  }
  return names;
}

/**
 * Finalizes one episode: derive the formats, print the chapters and the Field
 * values, write nothing else.
 *
 * @param {{ episodeDir: string, formats?: string[], fill?: 'crop'|'blur', force?: boolean,
 *   dryRun?: boolean, run?: Function, probe?: Function }} options
 */
export async function finalizeVideo({
  episodeDir,
  formats = ['vertical', 'horizontal', 'square'],
  fill = 'crop',
  force = false,
  dryRun = false,
  run,
  probe,
} = {}) {
  const dir = path.resolve(episodeDir);
  const scriptPath = episodeScriptPath(dir);
  const master = masterPath(dir);
  const { manifest, manifestPath } = readManifestForFinalize({ episodeDir: dir, scriptPath });
  const messages = [];

  // 1. The delivery formats are pure functions of the master.
  const derived = await renderFormats({ master, formats, fill, force, dryRun, ...(run ? { run } : {}), ...(probe ? { probe } : {}) });
  for (const variant of derived.variants) {
    messages.push(
      variant.skipped
        ? `skip ${path.basename(variant.outputPath)} (already present)`
        : `derive ${path.basename(variant.outputPath)}`,
    );
  }

  // 2. The chapters, from measured scene starts.
  const chapters = chapterLines(manifest);

  // 3. The two Field values the record needs. The agent pastes them; no writer
  //    touches the model (AD6).
  const masterName = path.basename(master);
  const thumb = thumbnailPath(dir);
  const fields = { master: masterName, ...(thumb ? { thumbnail: path.basename(thumb) } : {}) };
  messages.push(`master:: ${masterName}`);
  if (thumb) messages.push(`thumbnail:: ${path.basename(thumb)}`);
  else messages.push('thumbnail:: (no <slug>_thumbnail_<W>x<H>.png yet)');

  return { ok: true, episodeDir: dir, scriptPath, manifestPath, master, formats, fields, chapters, messages, dryRun };
}

function argValue(argv, name) {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const episodeDir = argv.find((a) => !a.startsWith('--'));
  if (!episodeDir) {
    console.error(
      'usage: node finalize-video.mjs <episode-dir> [--formats vertical,horizontal,square] [--fill crop|blur] [--force] [--dry-run]',
    );
    process.exit(1);
  }
  const fill = argValue(argv, 'fill') || 'crop';
  if (fill !== 'crop' && fill !== 'blur') {
    console.error(`unknown --fill "${fill}" (expected crop or blur)`);
    process.exit(1);
  }
  try {
    const res = await finalizeVideo({
      episodeDir,
      formats: parseFormats(argValue(argv, 'formats')),
      fill,
      force: argv.includes('--force'),
      dryRun: argv.includes('--dry-run'),
    });
    for (const line of res.messages) console.log(`   ${line}`);
    console.log('');
    console.log('Chapters (paste into description.md):');
    for (const line of res.chapters) console.log(`   ${line}`);
    console.log('');
    console.log(`   master:: ${res.fields.master}`);
    if (res.fields.thumbnail) console.log(`   thumbnail:: ${res.fields.thumbnail}`);
    if (res.dryRun) console.log('Dry run: nothing was written.');
  } catch (err) {
    console.error(`finalize: ${err.message}`);
    process.exit(1);
  }
}

// Compare real paths on both sides: through a junction, `import.meta.url` is
// already resolved while `argv[1]` is the typed path.
const invokedDirectly =
  Boolean(process.argv[1]) &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) main();

export { THUMBNAIL_NAME };
