import { readFile, readdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { parseModel } from '@cognnitive/innfo-core'
import type { ReachabilityGraph } from '@cognnitive/innfo-core'
import { parseSpecName, normalizeVersion } from './resolver-node.js'
import { getMarkdownFiles } from './fs-utils.js'
import { createSpecsBackupZip } from './spec-backup.js'

/* ── Reachability Graph & Spec Pruning Engine ───────────────── */

/**
 * Traverses L3 models (`kNNowledge/`), root entrypoints (`domaiNN_NN.md`, `index.md`),
 * and L2 templates (`templates/`) to build the workspace reference reachability graph.
 */
export async function calculateSpecReachability(rootDir: string): Promise<ReachabilityGraph> {
  const activeSpecs = new Set<string>()
  const referencedBy = new Map<string, string[]>()

  const addReference = (specRef: string, sourceFile: string) => {
    if (!specRef) return
    const key = specRef.toLowerCase().trim()
    activeSpecs.add(key)

    // Store normalized <name>@<version> and base <name> in activeSpecs (Fix W-02 & C-01)
    const parsed = parseSpecName(key)
    if (parsed.base) {
      activeSpecs.add(parsed.base)
      if (parsed.version) {
        activeSpecs.add(`${parsed.base}@${parsed.version}`)
        const normVKey = `${parsed.base}_v_${parsed.version.replace(/\./g, '-')}`
        activeSpecs.add(normVKey)
      }
    }

    const existing = referencedBy.get(key) ?? []
    if (!existing.includes(sourceFile)) {
      existing.push(sourceFile)
      referencedBy.set(key, existing)
    }
  }

  const searchDirs = [join(rootDir, 'models'), rootDir, join(rootDir, 'templates')]
  const scannedFiles = new Set<string>()

  for (const dir of searchDirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) {
          const filePath = join(dir, entry.name)
          if (scannedFiles.has(filePath)) continue
          scannedFiles.add(filePath)

          try {
            const content = await readFile(filePath, 'utf-8')
            const parsed = parseModel(content)
            const fm = parsed.frontmatter
            const parentName =
              fm?.parent_spec?.name ||
              (typeof fm?.parent === 'string' ? fm.parent : (fm?.parent as any)?.name)
            const parentUrl = fm?.parent_spec?.url || (fm?.parent as any)?.url

            if (parentName) {
              addReference(parentName, filePath)
            }
            if (parentUrl) {
              const urlStem = basename(parentUrl).replace(/\.(md|markdown)$/i, '')
              addReference(urlStem, filePath)
              const tmplMatch = parentUrl.match(/\/templates\/([^/]+)\/([^/]+)/i)
              if (tmplMatch) {
                const pkgBase = tmplMatch[1].toLowerCase()
                const pkgVer = normalizeVersion(tmplMatch[2])
                addReference(pkgBase, filePath)
                addReference(`${pkgBase}@${pkgVer}`, filePath)
              }
            }

            for (const inc of fm?.includes ?? []) {
              if (inc.name) {
                addReference(inc.name, filePath)
                if (inc.url) {
                  const urlStem = basename(inc.url).replace(/\.(md|markdown)$/i, '')
                  addReference(urlStem, filePath)
                  const tmplMatch = inc.url.match(/\/templates\/([^/]+)\/([^/]+)/i)
                  if (tmplMatch) {
                    const pkgBase = tmplMatch[1].toLowerCase()
                    const pkgVer = normalizeVersion(tmplMatch[2])
                    addReference(pkgBase, filePath)
                    addReference(`${pkgBase}@${pkgVer}`, filePath)
                  }
                }
              }
            }
          } catch (err) {
            /* v8 ignore start */
            // swallow deliberately: an unparseable template package is skipped.
            console.warn(`[reachability] Failed to scan template package: ${err}`)
            /* v8 ignore stop */
          }
        }
      }
    } catch (err) {
      /* v8 ignore start */
      // swallow deliberately: the package dir may legitimately not exist.
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn(`[reachability] Failed to scan package dir: ${err}`)
      }
      /* v8 ignore stop */
    }
  }

  // Helper to test if a candidate spec file matches specKey (Fix C-01)
  const matchesCandidateFile = (filePath: string, specKey: string): boolean => {
    const normPath = filePath.replace(/\\/g, '/').toLowerCase()
    const keyLow = specKey.toLowerCase().trim()
    if (normPath.includes(keyLow) || basename(filePath).toLowerCase().includes(keyLow)) return true

    const keyParts = keyLow.split('@')
    const keyBase = keyParts[0].split(/_v_/i)[0]
    const keyVer = keyParts[1] ? normalizeVersion(keyParts[1]) : undefined

    if (normPath.includes(`/templates/${keyBase}/`)) {
      if (!keyVer) return true
      if (
        normPath.includes(`/${keyVer}/`) ||
        normPath.includes(`/v_${keyVer.replace(/\./g, '-')}/`) ||
        normPath.includes(`/v_${keyVer}/`)
      ) {
        return true
      }
    }
    const parsedFile = parseSpecName(basename(filePath))
    if (parsedFile.base === keyBase) {
      if (!keyVer || !parsedFile.version || parsedFile.version === keyVer) return true
    }
    return false
  }

  // Transitive closure of includes up to depth 10
  const queue = Array.from(activeSpecs)
  const visited = new Set<string>()

  while (queue.length > 0) {
    const specKey = queue.shift()!
    if (visited.has(specKey)) continue
    visited.add(specKey)

    const candidateFiles = await getMarkdownFiles(join(rootDir, 'specs')).catch(() => [])
    for (const file of candidateFiles) {
      if (matchesCandidateFile(file, specKey)) {
        try {
          const content = await readFile(file, 'utf-8')
          const parsed = parseModel(content)
          const fm = parsed.frontmatter
          for (const inc of fm?.includes ?? []) {
            if (inc.name) {
              const incKey = inc.name.toLowerCase()
              addReference(inc.name, file)
              if (!visited.has(incKey)) queue.push(incKey)
              if (inc.url) {
                const urlStem = basename(inc.url).replace(/\.(md|markdown)$/i, '')
                addReference(urlStem, file)
                const tmplMatch = inc.url.match(/\/templates\/([^/]+)\/([^/]+)/i)
                if (tmplMatch) {
                  const pkgBase = tmplMatch[1].toLowerCase()
                  const pkgVer = normalizeVersion(tmplMatch[2])
                  addReference(pkgBase, file)
                  addReference(`${pkgBase}@${pkgVer}`, file)
                  if (!visited.has(`${pkgBase}@${pkgVer}`)) queue.push(`${pkgBase}@${pkgVer}`)
                }
              }
            }
          }
        } catch (err) {
          /* v8 ignore start */
          // swallow deliberately: an unparseable candidate spec file is skipped.
          console.warn(`[reachability] Failed to scan candidate spec: ${err}`)
          /* v8 ignore stop */
        }
      }
    }
  }

  const orphanedCandidates: string[] = []
  const specsDir = join(rootDir, 'specs')

  try {
    const entries = await readdir(specsDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(specsDir, entry.name)

      if (entry.name === 'templates') {
        try {
          const tmplEntries = await readdir(fullPath, { withFileTypes: true })
          for (const nameDir of tmplEntries) {
            if (nameDir.isDirectory()) {
              const pkgName = nameDir.name
              const verPath = join(fullPath, pkgName)
              const verEntries = await readdir(verPath, { withFileTypes: true })

              for (const verDir of verEntries) {
                if (verDir.isDirectory()) {
                  const pkgVerDir = join(verPath, verDir.name)
                  const verClean = normalizeVersion(verDir.name)
                  const verDash = verClean.replace(/\./g, '-')
                  const pkgNameLow = pkgName.toLowerCase()

                  const isPkgActive = Array.from(activeSpecs).some((s) => {
                    const sLow = s.toLowerCase()
                    if (sLow === pkgNameLow) return true
                    if (sLow === `${pkgNameLow}@${verClean}`) return true
                    if (sLow === `${pkgNameLow}_v_${verDash}`) return true
                    if (sLow === `${pkgNameLow}_v_${verClean}`) return true

                    const parsed = parseSpecName(sLow)
                    if (parsed.base === pkgNameLow) {
                      if (!parsed.version || parsed.version === verClean) return true
                    }

                    if (
                      sLow.includes(`${pkgNameLow}@${verClean}`) ||
                      sLow.includes(`${pkgNameLow}_v_${verDash}`)
                    ) {
                      return true
                    }

                    return false
                  })

                  if (!isPkgActive) {
                    orphanedCandidates.push(pkgVerDir)
                  }
                }
              }
            }
          }
        } catch (err) {
          /* v8 ignore start */
          // swallow deliberately: an unparseable spec file is skipped.
          console.warn(`[reachability] Failed to scan spec subdir: ${err}`)
          /* v8 ignore stop */
        }
      } else if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) {
        const stem = entry.name.replace(/\.(md|markdown)$/i, '').toLowerCase()
        const parsedFile = parseSpecName(stem)
        const isFileActive = Array.from(activeSpecs).some((s) => {
          const sLow = s.toLowerCase()
          if (sLow === stem) return true
          const parsedSpec = parseSpecName(sLow)
          if (parsedSpec.base === parsedFile.base) {
            if (
              !parsedSpec.version ||
              !parsedFile.version ||
              parsedSpec.version === parsedFile.version
            ) {
              return true
            }
          }
          if (parsedFile.version && sLow.includes(`${parsedFile.base}@${parsedFile.version}`))
            return true
          return stem.includes(sLow) || sLow.includes(stem)
        })

        if (!isFileActive) {
          orphanedCandidates.push(fullPath)
        }
      }
    }
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: the specs dir may legitimately not exist.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[reachability] Failed to scan specs dir ${specsDir}: ${err}`)
    }
    /* v8 ignore stop */
  }

  return {
    activeSpecs,
    referencedBy,
    orphanedCandidates,
  }
}

export interface PruneOrphanedSpecsResult {
  success: boolean
  dryRun: boolean
  orphanedCount: number
  removedFiles: string[]
  backupZip: string | null
  message: string
}

/**
 * Prunes orphaned spec packages and files not reachable in active workspace models.
 * Supports parameters dry_run (default true) and backup (default true).
 */
export async function pruneOrphanedSpecs(
  rootDir: string,
  opts?: { dry_run?: boolean; backup?: boolean },
): Promise<PruneOrphanedSpecsResult> {
  const dryRun = opts?.dry_run ?? true
  const backup = opts?.backup ?? true

  const graph = await calculateSpecReachability(rootDir)
  const candidates = graph.orphanedCandidates

  if (candidates.length === 0) {
    return {
      success: true,
      dryRun,
      orphanedCount: 0,
      removedFiles: [],
      backupZip: null,
      message: 'No orphaned specs found.',
    }
  }

  if (dryRun) {
    return {
      success: true,
      dryRun: true,
      orphanedCount: candidates.length,
      removedFiles: candidates,
      backupZip: null,
      message: `Dry run: ${candidates.length} orphaned spec candidate(s) identified for deletion.`,
    }
  }

  let zipPath: string | null = null
  if (backup) {
    zipPath = await createSpecsBackupZip(rootDir, candidates)
  }

  for (const c of candidates) {
    await rm(c, { recursive: true, force: true }).catch(() => {})
  }

  return {
    success: true,
    dryRun: false,
    orphanedCount: candidates.length,
    removedFiles: candidates,
    backupZip: zipPath,
    message: `Successfully pruned ${candidates.length} orphaned spec candidate(s).${zipPath ? ` Backup created at ${zipPath}` : ''}`,
  }
}
