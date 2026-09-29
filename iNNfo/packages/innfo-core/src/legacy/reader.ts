// legacy:nn-rename/language-map

import type { DomainReader } from './detect.js'

const IGNORED_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', 'backups', 'archive', 'specs'])

export interface LegacyDomainFiles {
  files: Record<string, string> // relPath -> content
}

export async function readLegacyDomain(r: DomainReader): Promise<LegacyDomainFiles> {
  const files: Record<string, string> = {}

  async function walk(dir: string, depth = 0) {
    if (depth > 10) return
    const entries = await r.list(dir)
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry) && !dir) continue
      const relPath = dir ? `${dir}/${entry}` : entry
      const content = await r.read(relPath)
      if (content !== null) {
        files[relPath] = content
      } else {
        // Assume directory and walk recursively
        await walk(relPath, depth + 1)
      }
    }
  }

  await walk('')
  return { files }
}
