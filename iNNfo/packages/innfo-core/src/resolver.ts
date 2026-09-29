import { SpecCache, SpecDocument, ResolverOptions } from './types/index.js'

export interface SpecResolver {
  resolveParentChain(
    parentUrl: string,
    parentName: string,
    options?: ResolverOptions,
  ): Promise<SpecCache>
}

export class SpecResolutionError extends Error {
  constructor(
    message: string,
    public readonly url?: string,
  ) {
    super(message)
    this.name = 'SpecResolutionError'
  }
}

export interface MultiStoreResolverOptions {
  workspaceDir?: string
  domainDir?: string
  globalBlueprintsDir?: string
  /** @deprecated use globalBlueprintsDir */
  globalTemplatesDir?: string
  skillsDir?: string
  timeout?: number
}

export interface SpecTemplateLocation {
  name: string
  filePath: string
  source: 'workspace' | 'global' | 'skill'
  skillName?: string
}

export class UnresolvedTemplateError extends Error {
  public readonly checkedPaths: string[]
  constructor(templateName: string, checkedPaths: string[]) {
    const formatted = checkedPaths.map((p) => `  - ${p}`).join('\n')
    super(`Unresolved template "${templateName}". (searched:\n${formatted})`)
    this.name = 'UnresolvedTemplateError'
    this.checkedPaths = checkedPaths
  }
}

export function getSpecForLevel(cache: SpecCache, level: number): SpecDocument | undefined {
  for (const doc of cache.specs.values()) {
    if (doc.level === level) return doc
  }
  return undefined
}

export function getTemplate(cache: SpecCache): SpecDocument | undefined {
  return getSpecForLevel(cache, 3) ?? getSpecForLevel(cache, 2)
}

export function getFormatSpec(cache: SpecCache): SpecDocument | undefined {
  return getSpecForLevel(cache, 1)
}

export function getDefiNNe(cache: SpecCache): SpecDocument | undefined {
  return getSpecForLevel(cache, 0)
}

interface TemplateCandidate {
  filePath: string
  source: 'workspace' | 'global' | 'skill'
  skillName?: string
}

/**
 * Builds the ordered list of paths that blueprint resolution will check, in
 * precedence order: domain (specs/bluepriNNts/), then global user blueprints (~/.agents/bluepriNNts/),
 * then the blueprints bundled with each installed skill (~/.agents/skills/*\/bluepriNNts/).
 *
 * Resolution and the "searched:" diagnostics in `UnresolvedTemplateError` both
 * read from this one list, so the precedence order cannot drift between where
 * a blueprint is actually found and where we claim to have looked.
 */
async function buildTemplateCandidates(
  templateName: string,
  options?: MultiStoreResolverOptions,
): Promise<TemplateCandidate[]> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  const os = await import('node:os')

  const workspaceDir = options?.domainDir ?? options?.workspaceDir ?? process.cwd()
  const globalBlueprintsDir =
    options?.globalBlueprintsDir ??
    options?.globalTemplatesDir ??
    path.join(os.homedir(), '.agents', 'bluepriNNts')
  const skillsDir = options?.skillsDir ?? path.join(os.homedir(), '.agents', 'skills')

  const candidateNames = templateName.endsWith('.md')
    ? [templateName]
    : [`${templateName}.md`, templateName]

  const candidates: TemplateCandidate[] = []

  // Tier 1: Domain/Workspace-local directories (specs/bluepriNNts/, specs/, root)
  for (const candidate of candidateNames) {
    candidates.push({
      filePath: path.join(workspaceDir, 'specs', 'bluepriNNts', candidate),
      source: 'workspace',
    })
    candidates.push({ filePath: path.join(workspaceDir, 'specs', candidate), source: 'workspace' })
    candidates.push({ filePath: path.join(workspaceDir, candidate), source: 'workspace' })
  }

  // Tier 2: Global user agents blueprints directory (~/.agents/bluepriNNts/)
  for (const candidate of candidateNames) {
    candidates.push({ filePath: path.join(globalBlueprintsDir, candidate), source: 'global' })
  }

  // Tier 3: Installed skill blueprints directories (~/.agents/skills/*/bluepriNNts/)
  let skillNames: string[] = []
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true })
    skillNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: the skills directory may legitimately not exist.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[resolver] Failed to scan skills bluepriNNts dir ${skillsDir}: ${err}`)
    }
    /* v8 ignore stop */
  }
  for (const skillName of skillNames) {
    for (const candidate of candidateNames) {
      candidates.push({
        filePath: path.join(skillsDir, skillName, 'bluepriNNts', candidate),
        source: 'skill',
        skillName,
      })
      candidates.push({
        filePath: path.join(skillsDir, skillName, candidate),
        source: 'skill',
        skillName,
      })
    }
  }

  return candidates
}

/**
 * Returns every path template resolution would check, in precedence order.
 * Intended for diagnostics after `resolveTemplatePath` returns null.
 */
export async function getTemplateSearchPaths(
  templateName: string,
  options?: MultiStoreResolverOptions,
): Promise<string[]> {
  const candidates = await buildTemplateCandidates(templateName, options)
  return candidates.map((candidate) => candidate.filePath)
}

export async function resolveTemplatePath(
  templateName: string,
  options?: MultiStoreResolverOptions,
): Promise<SpecTemplateLocation | null> {
  const fs = await import('node:fs/promises')
  const candidates = await buildTemplateCandidates(templateName, options)

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate.filePath)
      if (stat.isFile()) {
        return {
          name: templateName,
          filePath: candidate.filePath,
          source: candidate.source,
          ...(candidate.skillName ? { skillName: candidate.skillName } : {}),
        }
      }
    } catch (err) {
      /* v8 ignore start */
      // swallow deliberately: a precedence candidate may legitimately not exist.
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn(`[resolver] Failed to stat template candidate ${candidate.filePath}: ${err}`)
      }
      /* v8 ignore stop */
    }
  }

  return null
}
