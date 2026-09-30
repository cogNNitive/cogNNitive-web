/**
 * get_spec and get_template tools.
 *
 * The MCP is publisher-agnostic: it never stores spec/template URLs or
 * template names as constants. A spec/template is resolved ONLY from:
 *   1. an explicit `url` supplied by the caller, or
 *   2. the `parent_spec.url` declared by a loaded model (`model_id`).
 *
 * Resolution runs through `resolveParentChain` (innfo-core), which walks
 * the self-describing parent chain up to level 0, caching locally.
 */

import { join, basename, dirname } from 'node:path'
import { readFile, stat } from 'node:fs/promises'
import {
  getTemplate as coreGetTemplate,
  getFormatSpec,
  parseFrontmatter,
  SpecResolutionError,
  resolveTemplatePath,
  getTemplateSearchPaths,
  UnresolvedTemplateError,
} from '@cognnitive/innfo-core'
import { mkdir, copyFile, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import type {
  SpecDocument,
  SpecCache,
  TemplateProcedure,
  TemplateSkill,
  SpecFrontmatter,
} from '@cognnitive/innfo-core'
import {
  resolveParentChainNode,
  resolveTemplatePackage,
  hydrateTemplatePackageAtomically,
  fetchSpecContent,
  isLocalPath,
  toLocalFilePath,
  parseSpecName,
  findSpecInPackageDir,
} from './resolver-node.js'
import type { FreshnessResult, ResolvedCache } from './resolver-node.js'

/**
 * Derive a chain-start name from a spec/template URL.
 * `.../iNNfo_V_0-1-0_NN.md` → `iNNfo_V_0-1-0`.
 */
export function deriveNameFromUrl(url: string): string {
  return basename(url)
    .replace(/\.(md|markdown)$/i, '')
    .replace(/_(NN|FORMAT|F)$/i, '')
}

import { normalizeId } from './list-read.js'
import { isInsideRoot, isSafeRelativeId } from './path-guard.js'

export { normalizeId }

/**
 * Locate a kNNowledge document on disk by id.
 *
 * Searches the root directory, `kNNowledge/` and the conventional `kNNowledge/` subdirectory.
 * Supports nested relative paths (e.g. `subsystems/auth/tokens_NN.md`).
 */
export async function findModelFile(
  rootDir: string,
  id: string,
  opts?: { includeSpecs?: boolean },
): Promise<string | null> {
  // `id` is an untrusted MCP tool argument: reject traversal, absolute and
  // drive/UNC-qualified forms before it ever reaches a `join`.
  if (!isSafeRelativeId(id)) return null
  const cleanId = normalizeId(id)
  const searchDirs = [rootDir, join(rootDir, 'kNNowledge'), join(rootDir, 'models')]
  for (const dir of searchDirs) {
    const candidates = [
      join(dir, `${cleanId}_NN.md`),
      join(dir, `${cleanId}.md`),
      join(dir, cleanId),
      join(dir, id),
      join(dir, `${id}.md`),
      join(dir, `${id}_NN.md`),
    ].filter((fp) => isInsideRoot(rootDir, fp))
    for (const fp of candidates) {
      try {
        await stat(fp)
        return fp
      } catch (err) {
        // swallow deliberately: a candidate path may legitimately not exist.
        if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          console.warn(`[spec] Failed to stat candidate ${fp}: ${err}`)
        }
      }
    }
  }

  if (
    cleanId.toLowerCase().startsWith('domain') ||
    cleanId.toLowerCase().startsWith('workspace') ||
    id.toLowerCase().startsWith('domain') ||
    id.toLowerCase().startsWith('workspace')
  ) {
    const { readdir } = await import('node:fs/promises')
    for (const dir of searchDirs) {
      try {
        const files = await readdir(dir)
        const wsFile = files.find(
          (f) =>
            (f.toLowerCase().startsWith('domain') || f.toLowerCase().startsWith('workspace')) &&
            f.toLowerCase().endsWith('.md'),
        )
        if (wsFile) {
          return join(dir, wsFile)
        }
      } catch (err) {
        // swallow deliberately: a search dir may legitimately not exist.
        if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
          console.warn(`[spec] Failed to readdir ${dir}: ${err}`)
        }
      }
    }
  }

  // Recursive fallback across subdirectories
  const recursiveMatch = await recursiveFindModel(rootDir, cleanId, id, 0, opts)
  if (recursiveMatch) return recursiveMatch

  return null
}

export const findKnowledgeFile = findModelFile

async function recursiveFindModel(
  dir: string,
  cleanId: string,
  rawId: string,
  depth = 0,
  opts?: { includeSpecs?: boolean },
): Promise<string | null> {
  if (depth > 8) return null
  const { readdir } = await import('node:fs/promises')
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    // swallow deliberately: a search dir may legitimately not exist.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[spec] Failed to readdir ${dir}: ${err}`)
    }
    return null
  }

  const subdirs: string[] = []
  const candidatesNames = new Set([
    `${cleanId}_NN.md`.toLowerCase(),
    `${cleanId}.md`.toLowerCase(),
    `${cleanId}`.toLowerCase(),
    `${rawId}`.toLowerCase(),
    `${rawId}.md`.toLowerCase(),
    `${rawId}_NN.md`.toLowerCase(),
  ])

  for (const entry of entries) {
    const nameLower = entry.name.toLowerCase()
    if (entry.isFile() && candidatesNames.has(nameLower)) {
      return join(dir, entry.name)
    }
    if (entry.isDirectory()) {
      const skip = opts?.includeSpecs
        ? ['node_modules', '.git', 'dist', '.spec-cache', 'backups', 'archive']
        : ['node_modules', '.git', 'dist', '.spec-cache', 'specs', 'backups', 'archive']
      if (!skip.includes(nameLower)) {
        subdirs.push(join(dir, entry.name))
      }
    }
  }

  for (const subdir of subdirs) {
    const found = await recursiveFindModel(subdir, cleanId, rawId, depth + 1, opts)
    if (found) return found
  }

  return null
}

/**
 * Read a model's `parent_spec` reference ({ url, name }) from disk.
 * Returns null when the model is missing or declares no resolvable parent.
 */
export async function readParentSpecUrl(
  rootDir: string,
  modelId: string,
): Promise<{ url: string; name: string } | null> {
  const filePath = await findModelFile(rootDir, modelId)
  if (!filePath) return null
  const content = await readFile(filePath, 'utf-8').catch(() => null)
  if (!content) return null
  const fm = parseFrontmatter(content)
  const url = fm?.parent_spec?.url
  const name = fm?.parent_spec?.name
  return url && name ? { url, name } : null
}

/**
 * Cache options for template/spec resolution: fetched content lands in the OS
 * temp cache by default; `inPlace: true` restores in-tree `specs/` writes.
 */
export interface ResolveCacheOptions {
  checkFreshness?: boolean
  cacheDir?: string
  inPlace?: boolean
}

/**
 * Get the iNNfo specification (level-1) for a spec/template URL or a model.
 *
 * @param opts.url     Explicit spec/template URL to resolve from.
 * @param opts.modelId Model id whose `parent_spec.url` seeds resolution.
 *
 * Returns `{ spec: null, specCache: null }` when neither input is provided.
 */
export async function getSpec(
  rootDir: string,
  opts: { url?: string; modelId?: string },
  cacheOpts?: ResolveCacheOptions,
): Promise<{ spec: SpecDocument | null; specCache: SpecCache | null }> {
  let url = opts.url
  let name: string | undefined

  if (!url && opts.modelId) {
    const parent = await readParentSpecUrl(rootDir, opts.modelId)
    if (parent) {
      url = parent.url
      name = parent.name
    }
  }

  if (!url) return { spec: null, specCache: null }
  if (!name) name = deriveNameFromUrl(url)

  try {
    const cache = await resolveParentChainNode(rootDir, url, name, cacheOpts)
    // get_spec always returns the level-1 iNNfo spec from the resolved chain,
    // falling back to the requested document when no level-1 is present.
    const spec = getFormatSpec(cache) ?? cache.specs.get(name) ?? null
    return { spec, specCache: cache }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'SpecResolutionError' || err instanceof SpecResolutionError)
    ) {
      throw err
    }
    return { spec: null, specCache: null }
  }
}

/**
 * Resolve a template document directly from a URL — the model's own
 * `parent_spec.url` is the source of truth. No hardcoded names or base URLs.
 */
export async function getTemplateFromUrl(
  rootDir: string,
  url: string,
  name: string,
  cacheOpts?: ResolveCacheOptions,
): Promise<SpecDocument | null> {
  try {
    const cache = await resolveParentChainNode(rootDir, url, name, cacheOpts)
    // Prefer a level-2/3 template from the walked chain; fall back to
    // whatever was resolved for the requested name itself (e.g. a level-1
    // spec requested directly) — it's already in `cache.specs`, no need to
    // re-read anything from disk.
    return coreGetTemplate(cache) ?? cache.specs.get(name) ?? null
  } catch (err) {
    // Surface the actionable resolution detail (searched locations) to the
    // caller so validate_model output can include it; other failures keep the
    // null fallback behavior.
    if (
      err instanceof Error &&
      (err.name === 'SpecResolutionError' || err instanceof SpecResolutionError)
    ) {
      throw err
    }
    return null
  }
}

/**
 * Like `getTemplateFromUrl`, but also returns the full resolved `SpecCache`
 * (parent chain + every `includes` target) and an `IncludeResolver` bound to
 * it — so a caller can pass template composition through to innfo-core's
 * `validateModel` / `resolveTemplateSchema` without re-reading anything.
 */
export async function resolveTemplateWithCache(
  rootDir: string,
  url: string,
  name: string,
  options?: ResolveCacheOptions,
): Promise<{
  template: SpecDocument | null
  cache: SpecCache | null
  resolveInclude: (ref: { name: string; url: string }) => string | null
  freshness: FreshnessResult | null
}> {
  let cache: ResolvedCache | null = null
  try {
    cache = await resolveParentChainNode(rootDir, url, name, options)
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'SpecResolutionError' || err instanceof SpecResolutionError)
    ) {
      throw err
    }
    cache = null
  }
  const template = cache ? (coreGetTemplate(cache) ?? cache.specs.get(name) ?? null) : null
  const resolveInclude = (ref: { name: string; url: string }): string | null => {
    if (!cache) return null
    const direct = cache.specs.get(ref.name)
    if (direct) return direct.rawContent
    for (const doc of cache.specs.values()) {
      if (doc.name.toLowerCase() === ref.name.toLowerCase()) return doc.rawContent
    }
    return null
  }
  const freshness = cache?.freshness?.get(name) ?? null
  return { template, cache, resolveInclude, freshness }
}

/**
 * Resolve a template from a loaded model, deriving the URL from its
 * `parent_spec.url`. Returns null when the model declares no parent.
 */
export async function getTemplateFromModel(
  rootDir: string,
  modelId: string,
  cacheOpts?: ResolveCacheOptions,
): Promise<SpecDocument | null> {
  const parent = await readParentSpecUrl(rootDir, modelId)
  if (!parent) return null
  return getTemplateFromUrl(rootDir, parent.url, parent.name, cacheOpts)
}

export interface DiscoveredTemplate {
  name: string
  version: string
  source: 'workspace' | 'global' | string
  filePath: string
  skillName?: string
}

export async function listTemplates(
  rootDir: string,
  opts?: { globalDir?: string; skillsDir?: string },
): Promise<DiscoveredTemplate[]> {
  const globalDir = opts?.globalDir ?? join(homedir(), '.agents', 'bluepriNNts')
  const skillsDir = opts?.skillsDir ?? join(homedir(), '.agents', 'skills')

  const discovered: DiscoveredTemplate[] = []
  const seenNames = new Set<string>()

  const scanDir = async (
    dir: string,
    source: 'workspace' | 'global' | 'skill',
    skillName?: string,
  ) => {
    try {
      const files = await readdir(dir, { withFileTypes: true })
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.md')) {
          const filePath = join(dir, file.name)
          const stem = file.name.replace(/\.md$/i, '')
          if (seenNames.has(stem)) continue
          seenNames.add(stem)

          let version = 'V_0-1-0'
          try {
            const content = await readFile(filePath, 'utf-8')
            const fm = parseFrontmatter(content)
            if (fm?.blueprint_version) version = String(fm.blueprint_version)
            else if (fm?.blueprint_version) version = String(fm.blueprint_version)
            else if (fm?.version) version = String(fm.version)
            else if (fm?.spec_version) version = String(fm.spec_version)
          } catch (err) {
            // swallow deliberately: an unreadable template falls back to the
            // default version — version is advisory metadata.
            console.warn(`[spec] Failed to read frontmatter of ${filePath}: ${err}`)
          }

          discovered.push({
            name: stem,
            version,
            source: source === 'skill' ? `skill:${skillName}` : source,
            filePath,
            ...(skillName ? { skillName } : {}),
          })
        } else if (file.isDirectory()) {
          const skip = [
            'node_modules',
            '.git',
            'dist',
            '.spec-cache',
            'backups',
            'archive',
            'samples',
            'procedures',
            'assets',
            'web',
          ]
          if (!skip.includes(file.name.toLowerCase())) {
            const pkgDir = join(dir, file.name)
            const specFile = await findSpecInPackageDir(pkgDir, file.name)
            if (specFile && !seenNames.has(file.name)) {
              seenNames.add(file.name)
              let version = 'V_0-1-0'
              try {
                const content = await readFile(specFile, 'utf-8')
                const fm = parseFrontmatter(content)
                if (fm?.blueprint_version) version = String(fm.blueprint_version)
                else if (fm?.blueprint_version) version = String(fm.blueprint_version)
                else if (fm?.version) version = String(fm.version)
                else if (fm?.spec_version) version = String(fm.spec_version)
              } catch (_) {
                /* unreadable/invalid frontmatter — fall back to the default version */
              }
              discovered.push({
                name: file.name,
                version,
                source: source === 'skill' ? `skill:${skillName}` : source,
                filePath: specFile,
                ...(skillName ? { skillName } : {}),
              })
            }
          }
        }
      }
    } catch (err) {
      // swallow deliberately: a tier directory may legitimately not exist.
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn(`[spec] Failed to scan template tier dir: ${err}`)
      }
    }
  }

  await scanDir(join(rootDir, 'specs', 'bluepriNNts'), 'workspace')
  await scanDir(join(rootDir, 'specs'), 'workspace')
  await scanDir(globalDir, 'global')

  try {
    const skillEntries = await readdir(skillsDir, { withFileTypes: true })
    for (const entry of skillEntries) {
      if (entry.isDirectory()) {
        await scanDir(join(skillsDir, entry.name, 'bluepriNNts'), 'skill', entry.name)
        await scanDir(join(skillsDir, entry.name), 'skill', entry.name)
      }
    }
  } catch (err) {
    // swallow deliberately: no skills directory installed — skip the skill tier.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[spec] Failed to scan skills dir ${skillsDir}: ${err}`)
    }
  }

  return discovered
}

export const listBlueprints = listTemplates

export interface HydrateTemplateResult {
  success: boolean
  templateName: string
  targetPath: string
  source: string
  message?: string
}

export async function hydrateTemplate(
  rootDir: string,
  templateName: string,
  opts?: { targetDir?: string; globalDir?: string; skillsDir?: string },
): Promise<HydrateTemplateResult> {
  const parsed = parseSpecName(templateName)
  if (parsed.base === 'domainn' && !parsed.version) {
    throw new UnresolvedTemplateError(templateName, [
      'Versionless hydration for domaiNN is not allowed; specify a versioned blueprint name or ref',
    ])
  }

  const globalTemplatesDir = opts?.globalDir ?? join(homedir(), '.agents', 'bluepriNNts')
  const skillsDir = opts?.skillsDir ?? join(homedir(), '.agents', 'skills')

  const pkg = await resolveTemplatePackage(rootDir, templateName, undefined, {
    globalDir: globalTemplatesDir,
    skillsDir,
  })

  if (pkg) {
    let content = ''
    try {
      content = await readFile(pkg.specFilePath, 'utf-8')
    } catch (err) {
      // swallow deliberately: an unreadable spec file yields empty content and
      // the caller reports it as unresolved.
      console.warn(`[spec] Failed to read spec ${pkg.specFilePath}: ${err}`)
    }

    const sourceName =
      pkg.tier === 'global-cache'
        ? 'global'
        : pkg.tier === 'installed-skill'
          ? 'skill'
          : pkg.tier === 'workspace-package' || pkg.tier === 'workspace-flat'
            ? 'workspace'
            : pkg.tier

    if (content) {
      if (opts?.targetDir || !pkg.isPackageDir) {
        const targetDir = opts?.targetDir ?? join(rootDir, 'specs', 'bluepriNNts')
        await mkdir(targetDir, { recursive: true })
        const fileName = templateName.endsWith('.md') ? templateName : `${templateName}.md`
        const targetPath = join(targetDir, fileName)
        try {
          await stat(targetPath)
          return {
            success: true,
            templateName,
            targetPath,
            source: sourceName,
            message: `Blueprint ${templateName} already present at ${targetPath} (write-once cache immutability)`,
          }
        } catch (err) {
          /* v8 ignore start */
          if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
            console.warn(`[spec] Failed to stat target path ${targetPath}: ${err}`)
          }
          /* v8 ignore stop */
          await copyFile(pkg.specFilePath, targetPath)
          return {
            success: true,
            templateName,
            targetPath,
            source: sourceName,
            message: `Hydrated blueprint ${templateName} from ${sourceName} to ${targetPath}`,
          }
        }
      }

      // Default: hydrate into workspace package directory specs/bluepriNNts/<name>/<version>/
      const targetPkgDir = await hydrateTemplatePackageAtomically(
        rootDir,
        pkg.name,
        pkg.version,
        content,
      )
      return {
        success: true,
        templateName,
        targetPath: targetPkgDir,
        source: sourceName,
        message: `Hydrated blueprint package ${templateName} (${pkg.version}) from ${sourceName} to ${targetPkgDir}`,
      }
    }
  }

  const location = await resolveTemplatePath(templateName, {
    workspaceDir: rootDir,
    globalTemplatesDir,
    skillsDir,
  })

  if (!location) {
    const checkedPaths = await getTemplateSearchPaths(templateName, {
      workspaceDir: rootDir,
      globalTemplatesDir,
      skillsDir,
    })
    throw new UnresolvedTemplateError(templateName, checkedPaths)
  }

  const targetDir = opts?.targetDir ?? join(rootDir, 'specs', 'bluepriNNts')
  await mkdir(targetDir, { recursive: true })

  const fileName = templateName.endsWith('.md') ? templateName : `${templateName}.md`
  const targetPath = join(targetDir, fileName)

  try {
    await stat(targetPath)
    return {
      success: true,
      templateName,
      targetPath,
      source: location.source,
      message: `Blueprint ${templateName} already present at ${targetPath} (write-once cache immutability)`,
    }
  } catch (err) {
    /* v8 ignore start */
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[spec] Failed to stat target path ${targetPath}: ${err}`)
    }
    /* v8 ignore stop */
    await copyFile(location.filePath, targetPath)
  }

  return {
    success: true,
    templateName,
    targetPath,
    source: location.source,
    message: `Hydrated blueprint ${templateName} from ${location.source} to ${targetPath}`,
  }
}

export const hydrateBlueprint = hydrateTemplate

export interface ListTemplateProceduresOptions {
  model_path?: string
  model_id?: string
  blueprint_name?: string
  version?: string
  url?: string
}

export interface ListTemplateSkillsOptions {
  model_path?: string
  model_id?: string
  blueprint_name?: string
  version?: string
  url?: string
}

interface DiscoveredAssets {
  procedures: TemplateProcedure[]
  skills: TemplateSkill[]
}

export async function discoverTransitiveAssets(
  rootDir: string,
  opts?: ListTemplateProceduresOptions,
): Promise<DiscoveredAssets> {
  const specsDir = join(rootDir, 'specs')
  const queue: Array<{
    docName: string
    fm: SpecFrontmatter
    depth: number
    filePath?: string
  }> = []

  let modelId = opts?.model_id
  if (!modelId && opts?.model_path) {
    modelId = opts.model_path
  }

  if (modelId) {
    const filePath =
      (await findModelFile(rootDir, modelId)) ??
      (isLocalPath(modelId) ? toLocalFilePath(modelId, rootDir) : null)
    if (filePath) {
      const content = await readFile(filePath, 'utf-8').catch(() => null)
      if (content) {
        const fm = parseFrontmatter(content)
        if (fm) {
          queue.push({ docName: basename(filePath, '.md'), fm, depth: 0, filePath })
        }
      }
    }
  }

  if (opts?.blueprint_name) {
    const pkg = await resolveTemplatePackage(rootDir, opts.blueprint_name, opts.version)
    if (pkg) {
      const content = await readFile(pkg.specFilePath, 'utf-8').catch(() => null)
      if (content) {
        const fm = parseFrontmatter(content)
        if (fm) {
          queue.push({
            docName: basename(pkg.specFilePath, '.md') || opts.blueprint_name || pkg.name,
            fm,
            depth: 0,
            filePath: pkg.specFilePath,
          })
        }
      }
    }
  }

  if (opts?.url) {
    const name = opts.blueprint_name || deriveNameFromUrl(opts.url)
    const content = await fetchSpecContent(name, opts.url, specsDir, 10000)
    if (content) {
      const fm = parseFrontmatter(content)
      if (fm) {
        queue.push({ docName: name, fm, depth: 0 })
      }
    }
  }

  if (queue.length === 0) {
    const templates = await listTemplates(rootDir)
    for (const tmpl of templates) {
      const content = await readFile(tmpl.filePath, 'utf-8').catch(() => null)
      if (content) {
        const fm = parseFrontmatter(content)
        if (fm) {
          queue.push({ docName: tmpl.name, fm, depth: 0, filePath: tmpl.filePath })
        }
      }
    }
  }

  const procedures: TemplateProcedure[] = []
  const skills: TemplateSkill[] = []
  const seenProcIds = new Set<string>()
  const seenSkillNames = new Set<string>()
  const seenTemplates = new Set<string>()

  while (queue.length > 0) {
    const item = queue.shift()!
    const key = item.docName.toLowerCase()
    if (seenTemplates.has(key) || item.depth > 10) continue
    seenTemplates.add(key)

    const fm = item.fm

    if (Array.isArray(fm.procedures)) {
      for (const p of fm.procedures) {
        if (p && typeof p === 'object' && p.id && !seenProcIds.has(p.id)) {
          seenProcIds.add(p.id)
          procedures.push({
            id: String(p.id),
            name: String(p.name ?? p.id),
            path: String(p.path ?? ''),
            source_template: p.source_template ? String(p.source_template) : item.docName,
          })
        }
      }
    }

    // Discover procedures from on-disk procedures/ folder if present
    let templateDir: string | null = null
    if (item.filePath) {
      templateDir = dirname(item.filePath)
    } else {
      const pkg = await resolveTemplatePackage(rootDir, item.docName)
      if (pkg) {
        templateDir = pkg.isPackageDir ? pkg.packagePath : dirname(pkg.specFilePath)
      }
    }

    if (templateDir) {
      const procsDir = join(templateDir, 'procedures')
      try {
        const procEntries = await readdir(procsDir, { withFileTypes: true })
        for (const pe of procEntries) {
          if (pe.isFile() && pe.name.endsWith('.md')) {
            const procStem = pe.name.replace(/\.md$/i, '')
            const procId = procStem.replace(/_NN$/i, '').toLowerCase().replace(/_/g, '-')
            if (!seenProcIds.has(procId)) {
              seenProcIds.add(procId)
              let procName = procStem
                .replace(/_NN$/i, '')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase())
              try {
                const procContent = await readFile(join(procsDir, pe.name), 'utf-8')
                const procFm = parseFrontmatter(procContent)
                if (procFm?.title) procName = String(procFm.title)
                else if (procFm?.name) procName = String(procFm.name)
              } catch (_) {
                /* unreadable/invalid frontmatter — fall back to the default name */
              }
              procedures.push({
                id: procId,
                name: procName,
                path: `procedures/${pe.name}`,
                source_template: item.docName,
              })
            }
          }
        }
      } catch (_) {
        /* procedures directory unreadable — skip discovery for this template */
      }
    }

    if (Array.isArray(fm.skills)) {
      for (const s of fm.skills) {
        if (s && typeof s === 'object' && s.name && !seenSkillNames.has(s.name)) {
          seenSkillNames.add(s.name)
          skills.push({
            name: String(s.name),
            repo: String(s.repo ?? ''),
            path: String(s.path ?? ''),
            source_template: s.source_template ? String(s.source_template) : item.docName,
          })
        }
      }
    }

    if (item.depth < 10) {
      if (Array.isArray(fm.includes)) {
        for (const inc of fm.includes) {
          if (!inc || !inc.name) continue
          const incKey = inc.name.toLowerCase()
          if (seenTemplates.has(incKey)) continue

          let incVersion: string | undefined
          if (inc.url) {
            const vMatch =
              inc.url.match(/_V_(\d+[-.]\d+[-.]\d+)/i) ||
              inc.url.match(/\/V_?(\d+[-.]\d+[-.]\d+)\//i)
            if (vMatch) {
              incVersion = vMatch[1]
            } else {
              const parsedFromUrl = parseSpecName(basename(inc.url))
              if (parsedFromUrl.version) incVersion = parsedFromUrl.version
            }
          }

          let incContent: string | null = null
          const pkg = await resolveTemplatePackage(rootDir, inc.name, incVersion)
          if (pkg) {
            incContent = await readFile(pkg.specFilePath, 'utf-8').catch(() => null)
          }
          if (!incContent) {
            incContent = await fetchSpecContent(inc.name, inc.url, specsDir, 5000)
          }

          if (incContent) {
            const incFm = parseFrontmatter(incContent)
            if (incFm) {
              queue.push({
                docName: inc.name,
                fm: incFm,
                depth: item.depth + 1,
                filePath: pkg?.specFilePath,
              })
            }
          }
        }
      }

      if (fm.parent_spec && typeof fm.parent_spec === 'object' && fm.parent_spec.name) {
        const pName = fm.parent_spec.name
        const pKey = pName.toLowerCase()
        if (!seenTemplates.has(pKey)) {
          let pVersion: string | undefined
          if (fm.parent_spec.url) {
            const vMatch =
              fm.parent_spec.url.match(/_V_(\d+[-.]\d+[-.]\d+)/i) ||
              fm.parent_spec.url.match(/\/V_?(\d+[-.]\d+[-.]\d+)\//i)
            if (vMatch) {
              pVersion = vMatch[1]
            } else {
              const parsedFromUrl = parseSpecName(basename(fm.parent_spec.url))
              if (parsedFromUrl.version) pVersion = parsedFromUrl.version
            }
          }

          let parentContent: string | null = null
          const pkg = await resolveTemplatePackage(rootDir, pName, pVersion)
          if (pkg) {
            parentContent = await readFile(pkg.specFilePath, 'utf-8').catch(() => null)
          }
          if (!parentContent) {
            parentContent = await fetchSpecContent(pName, fm.parent_spec.url, specsDir, 5000)
          }
          if (parentContent) {
            const pFm = parseFrontmatter(parentContent)
            if (pFm) {
              queue.push({
                docName: pName,
                fm: pFm,
                depth: item.depth + 1,
                filePath: pkg?.specFilePath,
              })
            }
          }
        }
      }
    }
  }

  return { procedures, skills }
}

export async function listTemplateProcedures(
  rootDir: string,
  opts?: ListTemplateProceduresOptions,
): Promise<{ procedures: TemplateProcedure[] }> {
  const assets = await discoverTransitiveAssets(rootDir, opts)
  return { procedures: assets.procedures }
}

export async function listTemplateSkills(
  rootDir: string,
  opts?: ListTemplateSkillsOptions,
): Promise<{ skills: TemplateSkill[] }> {
  const assets = await discoverTransitiveAssets(rootDir, opts)
  return { skills: assets.skills }
}
