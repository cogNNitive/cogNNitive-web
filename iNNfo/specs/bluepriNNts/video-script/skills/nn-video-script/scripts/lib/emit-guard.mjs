/**
 * nn-video-script/scripts/lib/emit-guard.mjs
 *
 * The one guarded writer for an emitted HyperFrames project. A `.nn-emit.json`
 * record stores one SHA-256 per emitted file; the next emission refuses when a
 * recorded file was edited by hand, naming every edited file and writing nothing.
 * A deleted recorded file is simply regenerated. No `--force` (design D9).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** Name of the emission record, kept at the project root. */
export const EMIT_RECORD = '.nn-emit.json';

/** Raised when regeneration would overwrite a hand-edited emitted file. */
export class RegenerationRefusedError extends Error {
  /** @param {string[]} files */
  constructor(files) {
    super(
      `Refusing to regenerate: ${files.length} emitted file(s) were edited by hand:\n  ${files.join('\n  ')}\n` +
        'Move or delete your changes to regenerate.',
    );
    this.name = 'RegenerationRefusedError';
    this.files = files;
  }
}

/** @param {string} text */
function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** @param {string} dir */
function readRecord(dir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, EMIT_RECORD), 'utf8'));
    return parsed && typeof parsed.files === 'object' && parsed.files ? parsed.files : {};
  } catch {
    return {};
  }
}

/**
 * Writes `files` (posix-relative path → content) into `projectDir` under the
 * regeneration guard. Returns the written posix-relative paths.
 * @param {string} projectDir
 * @param {Record<string, string>} files
 * @returns {string[]}
 */
export function writeGuarded(projectDir, files) {
  const dir = path.resolve(projectDir);
  const recorded = readRecord(dir);

  /** @type {string[]} */
  const edited = [];
  for (const [rel, hash] of Object.entries(recorded)) {
    const abs = path.join(dir, rel);
    if (!fs.existsSync(abs)) continue; // deleted → regenerate
    try {
      if (sha256(fs.readFileSync(abs, 'utf8')) !== hash) edited.push(rel);
    } catch {
      // unreadable recorded file: treat as edited rather than silently overwrite
      edited.push(rel);
    }
  }
  if (edited.length > 0) throw new RegenerationRefusedError(edited.sort());

  /** @type {Record<string, string>} */
  const next = {};
  const written = [];
  for (const rel of Object.keys(files).sort()) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, files[rel], 'utf8');
    next[rel] = sha256(files[rel]);
    written.push(rel);
  }
  fs.writeFileSync(path.join(dir, EMIT_RECORD), `${JSON.stringify({ files: next }, null, 2)}\n`, 'utf8');
  return written;
}
