// legacy:nn-rename/legacy-hint

import fs from 'node:fs/promises'
import path from 'node:path'
import { detectLegacy, type DetectLegacyResult, type DomainReader } from '@cognnitive/innfo-core/legacy'

export function makeFsDomainReader(rootDir: string): DomainReader {
  return {
    async list(dir: string): Promise<string[]> {
      try {
        const targetDir = dir ? path.join(rootDir, dir) : rootDir
        const entries = await fs.readdir(targetDir)
        return entries
      } catch {
        return []
      }
    },
    async read(filePath: string): Promise<string | null> {
      try {
        const targetFile = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath)
        return await fs.readFile(targetFile, 'utf8')
      } catch {
        return null
      }
    },
  }
}

export async function checkLegacyDomain(rootDir: string): Promise<DetectLegacyResult> {
  const reader = makeFsDomainReader(rootDir)
  return await detectLegacy(reader)
}
