/**
 * nn-conntent/scripts/lib/description.mjs
 *
 * The chapter block of `description.md`: one line per Scene, computed from the
 * compiled manifest's measured scene starts (design D6 of change
 * 2026-11-01-video-folder-contract).
 *
 * The engine only PRINTS the block; the agent writes `description.md` itself
 * (title, summary, chapters, sources, attribution), so no file is ever touched
 * here and no marker comments exist.
 *
 * Zero dependencies. ESM module.
 */

import fs from 'node:fs'
import path from 'node:path'

export const CHAPTERS_START = '<!-- chapters:start -->'
export const CHAPTERS_END = '<!-- chapters:end -->'

/**
 * Formats seconds as `MM:SS`, or `H:MM:SS` when the value reaches one hour.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatTimecode(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

/**
 * Builds the chapter lines from a manifest: start = floor(fromFrame / fps), title
 * from `props.title`. The first line is always `00:00`.
 *
 * @param {{ fps?: number, tracks?: { scenes?: Array<any> } }} manifest
 * @returns {Array<{ startSeconds: number, timecode: string, title: string }>}
 */
export function buildChapters(manifest) {
  const fps = Number(manifest?.fps) || 30
  const scenes = manifest?.tracks?.scenes || []
  return scenes.map((scene, index) => {
    const fromFrame = Number(scene?.fromFrame) || 0
    const startSeconds = Math.floor(fromFrame / fps)
    const title = String(scene?.props?.title || scene?.title || `Scene ${index + 1}`).trim()
    return { startSeconds, timecode: index === 0 ? '00:00' : formatTimecode(startSeconds), title }
  })
}

/**
 * The printable block: one `MM:SS Title` line per Scene.
 * @param {{ fps?: number, tracks?: { scenes?: Array<any> } }} manifest
 * @returns {string[]}
 */
export function chapterLines(manifest) {
  return buildChapters(manifest).map((c) => `${c.timecode} ${c.title}`)
}

/**
 * Builds the chapter block wrapped in markers.
 * @param {{ fps?: number, tracks?: { scenes?: Array<any> } }} manifest
 * @returns {string}
 */
export function renderChapterBlock(manifest) {
  const lines = chapterLines(manifest)
  return `${CHAPTERS_START}\n${lines.join('\n')}\n${CHAPTERS_END}`
}

/**
 * Updates description markdown text: seeds the chapter block or replaces the
 * content between the markers, leaving all surrounding text untouched.
 *
 * @param {string} existingText
 * @param {{ fps?: number, tracks?: { scenes?: Array<any> } }} manifest
 * @returns {string}
 */
export function updateDescriptionText(existingText, manifest) {
  const block = renderChapterBlock(manifest)
  if (!existingText || !existingText.trim()) {
    return block + '\n'
  }
  const startIdx = existingText.indexOf(CHAPTERS_START)
  const endIdx = existingText.indexOf(CHAPTERS_END)
  if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
    const before = existingText.slice(0, startIdx)
    const after = existingText.slice(endIdx + CHAPTERS_END.length)
    return before + block + after
  }
  return existingText.trimEnd() + '\n\n' + block + '\n'
}

/**
 * Writes or updates the description file atomically by rename.
 *
 * @param {string} descriptionPath
 * @param {{ fps?: number, tracks?: { scenes?: Array<any> } }} manifest
 * @returns {string} The written text
 */
export function writeDescriptionFile(descriptionPath, manifest) {
  const existing = fs.existsSync(descriptionPath) ? fs.readFileSync(descriptionPath, 'utf8') : ''
  const updated = updateDescriptionText(existing, manifest)
  const tmp = descriptionPath + '.tmp'
  fs.writeFileSync(tmp, updated, 'utf8')
  fs.renameSync(tmp, descriptionPath)
  return updated
}

/**
 * Reads the manifest a finalize run needs, and refuses a stale or foreign one.
 *
 * @param {{ episodeDir: string, scriptPath: string, manifestPath?: string }} options
 * @returns {{ manifest: any, manifestPath: string }}
 */
export function readManifestForFinalize({ episodeDir, scriptPath, manifestPath } = {}) {
  const file = manifestPath || path.join(episodeDir, 'hyperframes', 'manifest.json')
  if (!fs.existsSync(file)) {
    throw new Error(`Missing build manifest at ${file}; run compile (or render) first`)
  }
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  const source = manifest?.metadata?.scriptSource
  if (source && path.resolve(source) !== path.resolve(scriptPath)) {
    throw new Error(
      `The manifest at ${file} was compiled from ${source}, not from ${scriptPath}; re-run compile`,
    )
  }
  if (source && fs.statSync(file).mtimeMs < fs.statSync(scriptPath).mtimeMs) {
    throw new Error(
      `The manifest at ${file} is older than the script; re-run render (which recompiles) before finalizing`,
    )
  }
  return { manifest, manifestPath: file }
}
