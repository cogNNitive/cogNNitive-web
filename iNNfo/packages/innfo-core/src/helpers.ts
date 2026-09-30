/**
 * Additive helpers for the format-core programmatic surface.
 * These do NOT change any existing behavior — they provide convenience
 * wrappers that the MCP server consumes.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { parseFrontmatter } from './parser/index.js'
import { isDiscoverableModel, NN_FILENAME_RE as MODEL_NN_FILENAME_RE } from './workspace/discoverModels.js'

/* ── Version resolution ──────────────────────────────────────── */

/**
 * SemVer pattern as used in iNNfo filenames: `_V_MAJOR-MINOR-PATCH_`
 */
const VERSION_FILENAME_RE = /_V_(\d+-\d+-\d+)_/

/**
 * Extract the SemVer (e.g. `0-1-1`) from an iNNfo filename like
 * `Ghostbusters_V_0-1-0_business_NN.md` → `0-1-0`.
 * Returns `null` if no version marker is found.
 */
export function resolveSpecVersionFromFilename(filename: string): string | null {
  const match = filename.match(VERSION_FILENAME_RE)
  return match ? match[1] : null
}

/* ── Model scanning ──────────────────────────────────────────── */

export interface ModelInfo {
  /** Short model identifier (filename stem, used as `id` in MCP tools) */
  id: string
  /** Absolute filesystem path */
  path: string
  /** SemVer extracted from filename, e.g. `0-1-2` */
  version: string | null
}

const MD_FILE_RE = /\.md$/i

/** Directories that must never be scanned for model files. */
const IGNORED_DIRS = new Set(['backups', 'archive', 'specs', 'node_modules', '.git'])

function isIgnoredDir(name: string): boolean {
  return name.startsWith('.') || IGNORED_DIRS.has(name.toLowerCase())
}

/**
 * `collectModels()` and `isReconcilableModel()` share ONE discoverable-model
 * predicate (`isDiscoverableModel`, `workspace/discoverModels.ts`) instead of
 * two divergent ones (H6). Walk-level directory pruning stays here: it walks
 * ABSOLUTE paths and prunes `node_modules`, `.git`, dot-dirs and
 * `IGNORED_DIRS` at every level, which `isIgnoredPath` (workspace-relative,
 * first-segment only) does not replace.
 *
 * Per-file order, cheapest checks first: extension -> `index.md` skip ->
 * `_NN.md` name (cheap, no I/O) -> read + parse frontmatter -> shared
 * predicate. Only `_NN.md` candidates are ever read from disk.
 */
async function collectModels(dir: string, rootDir: string, models: ModelInfo[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (isIgnoredDir(entry.name)) continue
      await collectModels(join(dir, entry.name), rootDir, models)
      continue
    }
    if (!entry.isFile()) continue
    if (!MD_FILE_RE.test(entry.name)) continue
    if (entry.name.toLowerCase() === 'index.md') continue
    if (!MODEL_NN_FILENAME_RE.test(entry.name)) continue

    const filePath = join(dir, entry.name)
    const relPath = relative(rootDir, filePath).split('\\').join('/')

    let frontmatter: Record<string, unknown> | null = null
    try {
      const content = await readFile(filePath, 'utf-8')
      frontmatter = parseFrontmatter(content)
    } catch (err) {
      /* v8 ignore start */
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn(`[helpers] Failed to read or parse candidate model ${filePath}: ${err}`)
      }
      /* v8 ignore stop */
      continue
    }
    if (!frontmatter) continue
    if (!isDiscoverableModel({ path: relPath, frontmatter })) continue

    const id = entry.name.replace(MD_FILE_RE, '')
    const version = resolveSpecVersionFromFilename(entry.name)

    models.push({ id, path: filePath, version })
  }
}

/**
 * Scan a root directory (recursively) for discoverable iNNfo model files
 * (`_NN.md`, `level: 3`, resolvable `parent_spec` — see
 * `isDiscoverableModel`). Skips `backups`, `archive`, `specs`,
 * `node_modules`, `.git`, and any dot-directory. Returns an array of
 * `ModelInfo` sorted by id.
 */
export async function listKnowledge(rootDir: string): Promise<ModelInfo[]> {
  const models: ModelInfo[] = []
  await collectModels(rootDir, rootDir, models)
  models.sort((a, b) => a.id.localeCompare(b.id))
  return models
}
