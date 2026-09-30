import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, isAbsolute } from 'node:path'
import {
  parseKnowledge,
  validateDocument,
  validateTemplateAgainstMetaschema,
  resolveBlueprintSchema,
  SpecResolutionError,
  parseFrontmatter,
  recursiveParse,
  buildWorkspaceIndex,
  validateWorkspaceReferences,
  validateWorkspaceSources,
  extractHeadings,
  levenshteinDistance,
  loadBaseline,
  fingerprint,
  diffNewOnly,
  normalizeBaselinePath,
  findCanonicalTemplate,
  CANONICAL_TEMPLATES,
} from '@cognnitive/innfo-core'
import type {
  SpecDocument,
  ValidationError,
  ConceptDriftDiagnostic,
  ParsedKnowledge,
  SubmodelResolver,
  SourceResolver,
  SpecCache,
  BlueprintSchemaResolver,
  DirectoryHandleLike,
  FileHandleLike,
  ReferenceDiagnostic,
  ValidationBaseline,
  BaselineEntry,
  BaselineDiff,
} from '@cognnitive/innfo-core'
import { resolveTemplateWithCache, findKnowledgeFile, deriveNameFromUrl, getSpec } from './spec.js'
import { buildIncludeContentMap } from './resolver-node.js'
import type { FreshnessResult } from './resolver-node.js'
import { loadKnowledge } from './knowledge-io.js'

export const DEFAULT_WORKSPACE_IGNORE: Set<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  '.spec-cache',
  'specs',
  'backups',
  'archive',
])

export const DEFAULT_WORKSPACE_IGNORE_WITH_SPECS: Set<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  '.spec-cache',
  'backups',
  'archive',
])

function syncFindSubmodel(
  rootDir: string,
  cleanPath: string,
  referringDir?: string,
  opts?: { includeSpecs?: boolean },
): string | null {
  const directCandidates = [
    join(rootDir, cleanPath),
    referringDir ? join(referringDir, cleanPath) : null,
    join(rootDir, 'models', cleanPath),
  ].filter(Boolean) as string[]

  for (const p of directCandidates) {
    if (existsSync(p)) return p
    if (existsSync(`${p}.md`)) return `${p}.md`
    if (existsSync(`${p}_NN.md`)) return `${p}_NN.md`
  }

  const baseName = basename(cleanPath, '.md').replace(/_NN$/i, '')
  const candidateNames = new Set([
    `${baseName}_NN.md`.toLowerCase(),
    `${baseName}.md`.toLowerCase(),
    baseName.toLowerCase(),
    cleanPath.toLowerCase(),
    `${cleanPath}.md`.toLowerCase(),
    `${cleanPath}_NN.md`.toLowerCase(),
  ])

  function searchDirSync(dir: string, depth = 0): string | null {
    if (depth > 8) return null
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      const subdirs: string[] = []
      for (const entry of entries) {
        const lower = entry.name.toLowerCase()
        if (entry.isFile() && candidateNames.has(lower)) {
          return join(dir, entry.name)
        }
        if (entry.isDirectory()) {
          const skip = opts?.includeSpecs
            ? DEFAULT_WORKSPACE_IGNORE_WITH_SPECS
            : DEFAULT_WORKSPACE_IGNORE
          if (!skip.has(lower)) {
            subdirs.push(join(dir, entry.name))
          }
        }
      }
      for (const subdir of subdirs) {
        const found = searchDirSync(subdir, depth + 1)
        if (found) return found
      }
    } catch (err) {
      /* v8 ignore start */
      // swallow deliberately: a search dir may legitimately not exist.
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn(`[validate] Failed to scan dir ${dir}: ${err}`)
      }
      return null
      /* v8 ignore stop */
    }
    return null
  }

  return searchDirSync(rootDir)
}

/**
 * Builds a SYNCHRONOUS `BlueprintSchemaResolver` (innfo-core's C1 callback
 * type, `recursiveParser/types.ts`) reading from an already-resolved
 * `SpecCache` (produced by `resolveTemplateWithCache`). Every template named
 * by a node's `parent_spec.name` — plus everything on its `includes` chain —
 * is already present in `cache.specs`, so no I/O happens at call time.
 *
 * Not wired into `validateKnowledge` in this slice (C1/PR3): the workspace-mode
 * entry point that calls `recursiveParse` with this resolver is a later
 * slice (PR5a). `validateKnowledge`'s single-file behavior is unchanged here.
 */
export function buildBlueprintSchemaResolverFromCache(
  cache: SpecCache | null,
): BlueprintSchemaResolver {
  return ({ frontmatter }) => {
    if (!cache) return null
    const name = (frontmatter as { parent_spec?: { name?: string } } | undefined)?.parent_spec?.name
    if (!name) return null
    const doc =
      cache.specs.get(name) ??
      [...cache.specs.values()].find((d) => d.name.toLowerCase() === name.toLowerCase())
    if (!doc) return null
    const resolveInclude = (ref: { name: string; url: string }): string | null => {
      const direct = cache.specs.get(ref.name)
      if (direct) return direct.rawContent
      for (const d of cache.specs.values()) {
        if (d.name.toLowerCase() === ref.name.toLowerCase()) return d.rawContent
      }
      return null
    }
    try {
      return resolveBlueprintSchema(doc.rawContent, resolveInclude).schema
    } catch (err) {
      /* v8 ignore start */
      // swallow deliberately: an unresolvable schema degrades to null (no
      // schema), never aborts validation — AD-04 contract.
      console.warn(`[validate] Schema resolution degraded for ${doc.name}: ${err}`)
      return null
      /* v8 ignore stop */
    }
  }
}

/* ── Node-backed DirectoryHandleLike (workspace mode) ──────────── */

/**
 * Minimal `FileHandleLike` reading a single real file lazily (only when
 * `getFile().text()` is actually awaited), backed by `node:fs/promises`.
 */
function createNodeFileHandle(filePath: string, name: string): FileHandleLike {
  return {
    kind: 'file',
    name,
    async getFile() {
      const text = await readFile(filePath, 'utf-8')
      return { text: async () => text }
    },
  }
}

/**
 * Minimal `DirectoryHandleLike` backed by `node:fs/promises`, so
 * `recursiveParse` can walk `rootDir` directly (no `KnowledgeDriver`
 * implementation needed — `recursiveParse` falls back to plain
 * `DirectoryHandleLike` traversal whenever no driver is supplied).
 */
export function createNodeDirectoryHandle(
  dirPath: string,
  ignore?: Set<string>,
): DirectoryHandleLike {
  return {
    kind: 'directory',
    name: basename(dirPath) || dirPath,
    async *entries() {
      let dirents
      try {
        dirents = await readdir(dirPath, { withFileTypes: true })
      } catch (err) {
        /* v8 ignore start */
        // swallow deliberately: a workspace dir may legitimately not exist or
        // be unreadable; the directory then contributes no entries.
        console.warn(`[validate] Failed to readdir ${dirPath}: ${err}`)
        return
        /* v8 ignore stop */
      }
      for (const dirent of dirents) {
        if (ignore && ignore.has(dirent.name)) continue
        if (dirent.isDirectory()) {
          yield [dirent.name, createNodeDirectoryHandle(join(dirPath, dirent.name), ignore)] as [
            string,
            DirectoryHandleLike,
          ]
        } else if (dirent.isFile()) {
          yield [dirent.name, createNodeFileHandle(join(dirPath, dirent.name), dirent.name)] as [
            string,
            FileHandleLike,
          ]
        }
      }
    },
    async getFileHandle(name: string) {
      const filePath = join(dirPath, name)
      try {
        const stats = await stat(filePath)
        if (!stats.isFile()) throw new Error('not a file')
      } catch {
        throw Object.assign(new Error(`file not found: ${name}`), { code: 'ENOENT' })
      }
      return createNodeFileHandle(filePath, name)
    },
    async getDirectoryHandle(name: string) {
      if (ignore && ignore.has(name)) {
        throw Object.assign(new Error(`directory ignored: ${name}`), { code: 'ENOENT' })
      }
      const subPath = join(dirPath, name)
      try {
        const stats = await stat(subPath)
        if (!stats.isDirectory()) throw new Error('not a directory')
      } catch {
        throw Object.assign(new Error(`directory not found: ${name}`), { code: 'ENOENT' })
      }
      return createNodeDirectoryHandle(subPath, ignore)
    },
  }
}

/**
 * Workspace-scope cross-model validation. Collects the UNFILTERED
 * diagnostics for the whole tree — one Node-backed `recursiveParse` over
 * `rootDir`, threading the SAME synchronous template-schema resolver the
 * per-file pass already warms via `resolveTemplateWithCache` (AD-04: an
 * absent/throwing resolver degrades a node to "no schema", never aborts the
 * parse), then `buildWorkspaceIndex` + `validateWorkspaceReferences` +
 * `validateWorkspaceSources`. `check_workspace` calls this once with a merged
 * `SpecCache` and filters per model; `validateKnowledge`'s `workspace: true` path
 * composes it with `filterDiagnosticsForModel` for byte-identical output.
 */
export async function collectWorkspaceDiagnostics(
  rootDir: string,
  cache: SpecCache | null,
): Promise<ReferenceDiagnostic[]> {
  const resolveSchema: BlueprintSchemaResolver = buildBlueprintSchemaResolverFromCache(cache)
  const rootHandle = createNodeDirectoryHandle(rootDir, DEFAULT_WORKSPACE_IGNORE)
  const result = await recursiveParse(rootHandle, undefined, {
    resolveBlueprintSchema: resolveSchema,
  })
  const index = buildWorkspaceIndex(result)

  // Cross-model `[[Title :: Element]]` references + `sources::` Citations,
  // the latter resolved against real files under the workspace root. One read
  // per file: content backs headings AND the unit checks (rows/columns/fields).
  const resolveSource: SourceResolver = createWorkspaceSourceResolver(rootDir)
  return [
    ...validateWorkspaceReferences(result, index),
    ...validateWorkspaceSources(result, resolveSource),
  ]
}

/**
 * Creates a disk-backed SourceResolver that resolves sources relative to the referring
 * document by walking ancestor directories up to rootDir looking for sources/ directories,
 * and reports parent directory existence and fuzzy suggestions on failure.
 */
export function createWorkspaceSourceResolver(rootDir: string): SourceResolver {
  const rootResolved = resolve(rootDir)
  return (refPath, referringPath) => {
    const candidateDirs: string[] = []

    if (referringPath) {
      const absReferring = isAbsolute(referringPath)
        ? referringPath
        : resolve(rootDir, referringPath)
      let cur = dirname(absReferring)
      while (true) {
        const sourcesDir = join(cur, 'sources')
        if (existsSync(sourcesDir)) {
          candidateDirs.push(cur)
        }
        if (cur === rootResolved || dirname(cur) === cur) {
          break
        }
        const relToRoot = relative(rootResolved, cur)
        if (relToRoot.startsWith('..')) {
          break
        }
        cur = dirname(cur)
      }
    }

    if (!candidateDirs.includes(rootResolved)) {
      candidateDirs.push(rootResolved)
    }

    for (const dir of candidateDirs) {
      const abs = resolve(dir, refPath)
      const rel = relative(dir, abs)
      if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
        continue
      }
      if (existsSync(abs)) {
        try {
          const content = readFileSync(abs, 'utf-8')
          return {
            exists: true,
            headings: extractHeadings(content).map((h) => h.slug),
            content,
          }
        } catch (err) {
          /* v8 ignore start */
          // swallow deliberately: an unreadable source file reports not-exists.
          console.warn(`[validate] Failed to read source ${abs}: ${err}`)
          return { exists: false }
          /* v8 ignore stop */
        }
      }
    }

    const primaryDir = candidateDirs[0] ?? rootResolved
    const targetAbs = resolve(primaryDir, refPath)
    const targetParent = dirname(targetAbs)
    const parentExists = existsSync(targetParent)

    if (!parentExists) {
      return { exists: false, parentExists: false }
    }

    let suggestions: string[] | undefined
    try {
      const entries = readdirSync(targetParent, { withFileTypes: true })
      const targetBase = basename(refPath)
      const targetStem = targetBase.replace(/\.[^.]+$/, '')
      const files = entries.filter((e) => e.isFile()).map((e) => e.name)
      const maxAllowed = Math.max(1, Math.min(3, Math.floor(targetStem.length / 3)))
      const scored = files
        .map((name) => {
          const candStem = name.replace(/\.[^.]+$/, '')
          return { name, dist: levenshteinDistance(targetStem, candStem) }
        })
        .filter((item) => item.dist > 0 && item.dist <= maxAllowed)
        .sort((a, b) => a.dist - b.dist)
      if (scored.length > 0) {
        suggestions = scored.map((s) => s.name)
      }
    } catch {
      // directory read error
    }

    return {
      exists: false,
      parentExists: true,
      suggestions,
    }
  }
}

/** Pure. Diagnostics whose `path` names `resolvedModelPath`. */
export function filterDiagnosticsForModel(
  diagnostics: ReferenceDiagnostic[],
  rootDir: string,
  resolvedModelPath: string,
): ReferenceDiagnostic[] {
  const relativeModelPath = relative(rootDir, resolvedModelPath).replace(/\\/g, '/')
  return diagnostics.filter(
    (diag) => diag.path.includes(relativeModelPath) || diag.path.includes(resolvedModelPath),
  )
}

async function runWorkspaceValidation(
  rootDir: string,
  resolvedModelPath: string,
  cache: SpecCache | null,
): Promise<ReferenceDiagnostic[]> {
  return filterDiagnosticsForModel(
    await collectWorkspaceDiagnostics(rootDir, cache),
    rootDir,
    resolvedModelPath,
  )
}

/* ── validate_model ──────────────────────────────────────────── */

/**
 * Differential validation against a versioned known-errors baseline.
 *
 * Single shared implementation: re-exported from `@cognnitive/innfo-core`
 * (`innfo-core/src/validator/baseline.ts`, exposed through the core barrel).
 * This module keeps the exported names so existing import sites are
 * untouched; the algorithm is core's, so fingerprints match core-generated
 * baselines byte-for-byte by construction.
 */
export { loadBaseline, fingerprint, diffNewOnly, normalizeBaselinePath }
export type { ValidationBaseline, BaselineEntry, BaselineDiff }

/** Read a baseline file; a missing file means full output (`null`). */
async function loadBaselineFile(baselinePath: string): Promise<ValidationBaseline | null> {
  let raw: string
  try {
    raw = await readFile(baselinePath, 'utf-8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null
    throw err
  }
  return loadBaseline(raw)
}

const RESERVED_STRUCTURAL_HEADINGS = new Set([
  'index',
  'matrices',
  'item-markers matrix',
  'external watch roots',
  'external watch roots:',
  'agent modification',
  'agent modification:',
  'agent modifications',
  'concept definition',
  'field definition',
  'marker definition',
  'matrix definition',
  'concepts',
  'elements',
  'markers',
])

function isReservedStructuralHeading(concept: string): boolean {
  const norm = concept.trim().toLowerCase().replace(/^#+\s*(nn\s*)?/i, '')
  if (RESERVED_STRUCTURAL_HEADINGS.has(norm)) return true
  if (norm.startsWith('matrices:') || norm.startsWith('matrices')) return true
  if (norm.startsWith('external watch roots')) return true
  if (norm.startsWith('agent modification')) return true
  return false
}


export function analyzeConceptDrift(
  model: ParsedKnowledge,
  templateConcepts: Array<{ name: string }>,
  modelPath: string,
): ConceptDriftDiagnostic[] {
  const diagnostics: ConceptDriftDiagnostic[] = []
  const knownConcepts = new Map<string, string>()
  for (const c of templateConcepts) {
    knownConcepts.set(c.name.toLowerCase(), c.name)
  }

  const instantiatedConcepts = new Set<string>()
  for (const key of model.elements.keys()) {
    instantiatedConcepts.add(key)
  }
  if (model.rawSections) {
    for (const key of Object.keys(model.rawSections)) {
      instantiatedConcepts.add(key)
    }
  }

  for (const concept of instantiatedConcepts) {
    if (isReservedStructuralHeading(concept)) continue
    const conceptLower = concept.toLowerCase()
    if (knownConcepts.has(conceptLower)) continue

    // 1. Typo / Levenshtein distance against current template concepts
    let bestTypoMatch: string | null = null
    let bestDistance = Infinity
    for (const [knownLower, originalName] of knownConcepts.entries()) {
      const dist = levenshteinDistance(conceptLower, knownLower)
      const maxLen = Math.max(conceptLower.length, knownLower.length)
      const isPluralSingular =
        conceptLower + 's' === knownLower ||
        knownLower + 's' === conceptLower ||
        conceptLower + 'es' === knownLower ||
        knownLower + 'es' === conceptLower
      if (isPluralSingular || dist <= 2 || (maxLen > 4 && dist / maxLen <= 0.35)) {
        if (dist < bestDistance) {
          bestDistance = dist
          bestTypoMatch = originalName
        }
      }
    }

    if (bestTypoMatch) {
      const action = `Did you mean "${bestTypoMatch}"?`
      diagnostics.push({
        path: `elements.${concept}`,
        code: 'CONCEPT_DRIFT_WARNING',
        message: `[CONCEPT_DRIFT_WARNING] Concept "${concept}" is not defined in template. Did you mean "${bestTypoMatch}"?`,
        promptHint: action,
        severity: 'warning',
        filePath: modelPath,
        concept,
        suggestionType: 'typo',
        suggestedAction: action,
        meta: {
          concept,
          suggestionType: 'typo',
          suggestedAction: action,
          suggestedConcept: bestTypoMatch,
        },
      })
      continue
    }

    // 2. Cross-template match across canonical templates
    let crossTemplateMatch: { templateName: string; conceptName: string } | null = null
    for (const tmpl of Object.values(CANONICAL_TEMPLATES)) {
      const schema = resolveBlueprintSchema(tmpl.specContent, (ref) => {
        const inc = findCanonicalTemplate(ref.name) || (ref.url ? findCanonicalTemplate(ref.url) : null)
        return inc?.specContent ?? null
      })
      const foundInOther = schema.schema.concepts.find(
        (c) => c.name.toLowerCase() === conceptLower,
      )
      if (foundInOther) {
        crossTemplateMatch = { templateName: tmpl.name, conceptName: foundInOther.name }
        break
      }
    }

    if (crossTemplateMatch) {
      const action = `Concept '${concept}' belongs to the ${crossTemplateMatch.templateName} template. Consider composing templates via 'includes' in a Level 2 specialization.`
      diagnostics.push({
        path: `elements.${concept}`,
        code: 'CONCEPT_DRIFT_WARNING',
        message: `[CONCEPT_DRIFT_WARNING] ${action}`,
        promptHint: action,
        severity: 'warning',
        filePath: modelPath,
        concept,
        suggestionType: 'cross_template',
        suggestedAction: action,
        meta: {
          concept,
          suggestionType: 'cross_template',
          suggestedAction: action,
          matchingTemplate: crossTemplateMatch.templateName,
        },
      })
      continue
    }

    // 3. Specialization recommendation for novel concepts
    const action = `Consider creating a Level 2 specialization to declare this concept.`
    diagnostics.push({
      path: `elements.${concept}`,
      code: 'CONCEPT_DRIFT_WARNING',
      message: `[CONCEPT_DRIFT_WARNING] Concept "${concept}" is not defined in template. Consider creating a Level 2 specialization to declare this concept.`,
      promptHint: action,
      severity: 'warning',
      filePath: modelPath,
      concept,
      suggestionType: 'specialization',
      suggestedAction: action,
      meta: {
        concept,
        suggestionType: 'specialization',
        suggestedAction: action,
      },
    })
  }

  return diagnostics
}

/**
 * Validate a model against its template using a 4-phase validation lifecycle:
 * Phase 1: Ingestion & Frontmatter Parse
 * Phase 2: Schema Resolution Hard-Gate (Short-circuits validation without cascading child errors on resolution failure)
 * Phase 3: Structural & Concept Alignment + Concept Drift Detection
 * Phase 4: Element, Field, Matrix, WikiLinks & Workspace Reference Validation
 */
export async function validateKnowledge(
  rootDir: string,
  id?: string,
  content?: string,
  templateUrl?: string,
  workspace?: boolean,
  options: {
    checkFreshness?: boolean
    baselinePath?: string
    cacheDir?: string
    inPlace?: boolean
  } = {},
): Promise<{
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  suppressedCount: number
  staleEntries: BaselineEntry[]
  backlog: string | null
  summary: string | null
}> {
  // ── Phase 1: Ingestion & Frontmatter Parse ──
  const checkFreshness = options.checkFreshness ?? true
  let model: ParsedKnowledge

  if (content) {
    model = parseKnowledge(content)
  } else if (id) {
    const filePath = await findKnowledgeFile(rootDir, id)
    if (!filePath) {
      return {
        valid: false,
        errors: [{ path: '', message: `Model not found: ${id}`, severity: 'error' }],
        warnings: [],
        suppressedCount: 0,
        staleEntries: [],
        backlog: null,
        summary: null,
      }
    }
    model = await loadKnowledge(filePath)
  } else {
    return {
      valid: false,
      errors: [{ path: '', message: 'Provide either id or content', severity: 'error' }],
      warnings: [],
      suppressedCount: 0,
      staleEntries: [],
      backlog: null,
      summary: null,
    }
  }

  // D1: Auto-detect Level 2 templates and delegate to validateTemplate
  if (model.frontmatter.level === 2) {
    const delegated = await validateTemplate(rootDir, id, content, templateUrl)
    return { ...delegated, suppressedCount: 0, staleEntries: [], backlog: null, summary: null }
  }

  const resolvedModelPath = id ? await findKnowledgeFile(rootDir, id) : null
  const modelPath = resolvedModelPath ?? (id ?? 'inline')
  const referringDir = resolvedModelPath ? dirname(resolvedModelPath) : rootDir
  const fileNameForCheck = id ? basename(resolvedModelPath ?? id) : 'inline_NN.md'

  // ── Phase 2: Schema Resolution Hard-Gate ──
  let template: SpecDocument | null = null
  let resolveInclude: (ref: { name: string; url: string }) => string | null = () => null
  let resolutionDetail: string | null = null
  let specCache: SpecCache | null = null
  let freshness: FreshnessResult | null = null
  const parentRef = model.frontmatter.parent_spec
  try {
    if (parentRef?.url && parentRef?.name) {
      const resolved = await resolveTemplateWithCache(rootDir, parentRef.url, parentRef.name, {
        checkFreshness,
        cacheDir: options.cacheDir,
        inPlace: options.inPlace,
      })
      template = resolved.template
      resolveInclude = resolved.resolveInclude
      specCache = resolved.cache
      freshness = resolved.freshness
    }
    if (!template && templateUrl) {
      const resolved = await resolveTemplateWithCache(
        rootDir,
        templateUrl,
        deriveNameFromUrl(templateUrl),
        { checkFreshness, cacheDir: options.cacheDir, inPlace: options.inPlace },
      )
      template = resolved.template
      resolveInclude = resolved.resolveInclude
      freshness = resolved.freshness
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'SpecResolutionError' || err instanceof SpecResolutionError)
    ) {
      resolutionDetail = err.message
    }
  }

  // Phase 2 Hard-Gate: If parent_spec is declared (or explicit templateUrl provided) but could not be resolved,
  // short-circuit validation immediately, suppressing downstream Phase 3 and Phase 4 checks.
  const parentUrl = parentRef?.url ?? templateUrl
  if (!template && parentUrl) {
    const searchedSuffix = ` (searched: ${rootDir}/specs, network, canonical registry)`
    const detailSuffix = resolutionDetail ? ` Detail: ${resolutionDetail}` : ''
    const blockingError: ValidationError = {
      path: 'parent_spec',
      code: 'PARENT_RESOLUTION_FAILED',
      message: `[PARENT_RESOLUTION_FAILED] Parent template could not be resolved from parent_spec.url "${parentUrl}"${searchedSuffix}${detailSuffix}`,
      promptHint: 'Correct the parent_spec.url to a valid stable URL or workspace-relative path in specs/.',
      severity: 'error',
      filePath: modelPath,
    }

    const initialWarnings: ValidationError[] = []
    const rawToCheck =
      content ??
      (id && modelPath !== 'inline' ? await readFile(modelPath, 'utf-8').catch(() => '') : '')
    if (rawToCheck.charCodeAt(0) === 0xfeff) {
      initialWarnings.push({
        path: 'format.bom',
        message: 'File starts with a byte-order mark; stripped before parsing.',
        severity: 'info',
        code: 'BOM_WARNING',
        promptHint: 'Save the file as UTF-8 without BOM.',
        filePath: modelPath,
        meta: { stripped: true },
      })
    }

    let finalErrors = [blockingError]
    let suppressedCount = 0
    let staleEntries: BaselineEntry[] = []
    let backlog: string | null = null
    let summary: string | null = null
    let isValid = false

    if (options.baselinePath) {
      const baseline = await loadBaselineFile(options.baselinePath)
      if (baseline) {
        backlog = baseline.backlog
        const diff = diffNewOnly(finalErrors, baseline)
        finalErrors = diff.newErrors
        suppressedCount = diff.suppressedCount
        staleEntries = diff.staleEntries
        if (staleEntries.length > 0) {
          initialWarnings.push({
            path: 'baseline',
            message: `[BASELINE_STALE] ${staleEntries.length} baseline ${staleEntries.length === 1 ? 'entry matches' : 'entries match'} no current error; prune ${staleEntries.length === 1 ? 'it' : 'them'} or keep ${staleEntries.length === 1 ? 'it' : 'them'} as backlog.`,
            code: 'BASELINE_STALE',
            severity: 'info',
            filePath: options.baselinePath,
          })
        }
        summary =
          `Suppressed ${suppressedCount} known error(s) (backlog: ${backlog}).` +
          (staleEntries.length > 0
            ? ` ${staleEntries.length} stale baseline entr(ies) reported.`
            : '')
        isValid = finalErrors.length === 0
      }
    }

    return {
      valid: isValid,
      errors: finalErrors,
      warnings: initialWarnings,
      suppressedCount,
      staleEntries,
      backlog,
      summary,
    }
  }

  // ── Phase 3 & 4: Structural, Concept Alignment, and Reference Validation ──
  const resolveSubmodel: SubmodelResolver = (refPath: string) => {
    try {
      const clean = refPath
        .replace(/^\[\[\s*/, '')
        .replace(/\s*\]\]$/, '')
        .trim()
      const foundPath = syncFindSubmodel(rootDir, clean, referringDir)
      if (!foundPath) {
        return { exists: false }
      }
      const raw = readFileSync(foundPath, 'utf-8')
      const fm = parseFrontmatter(raw)
      const templateName =
        fm?.parent_spec?.name ?? (typeof fm?.title === 'string' ? fm.title : undefined)
      const submodelUrl = fm?.parent_spec?.url
      return { exists: true, templateName, templateUrl: submodelUrl }
    } catch (err) {
      /* v8 ignore start */
      console.warn(`[validate] Failed to inspect model ${refPath}: ${err}`)
      return { exists: false }
      /* v8 ignore stop */
    }
  }

  const doc = validateDocument(model.rawContent, {
    fileName: fileNameForCheck,
    template,
    resolveInclude,
    resolveSubmodel,
    referringPath: resolvedModelPath ?? undefined,
  })

  // Phase 3: Concept Drift Detection
  const templatePath = template?.name ? `${template.name}_NN.md` : 'parent_spec'
  const warnings: ValidationError[] = [...doc.warnings]
  let docErrors = [...doc.errors]

  if (template) {
    const composed = resolveBlueprintSchema(template.rawContent, resolveInclude)
    const driftDiagnostics = analyzeConceptDrift(model, composed.schema.concepts, modelPath)
    if (driftDiagnostics.length > 0) {
      warnings.push(...driftDiagnostics)
      // Convert / filter unknown concept errors from docErrors so concept drift remains a non-fatal warning
      const driftedConcepts = new Set(driftDiagnostics.map((d) => d.concept.toLowerCase()))
      docErrors = docErrors.filter((e) => {
        const match = e.message.match(/Concept "([^"]+)" is not defined in template/i)
        if (match && driftedConcepts.has(match[1].toLowerCase())) {
          return false
        }
        return true
      })
    }
  } else {
    warnings.push({
      path: 'parent_spec',
      message: 'No template resolved; structural validation only',
      severity: 'warning',
    })
  }

  // Staleness provenance
  if (checkFreshness && freshness?.verdict === 'stale') {
    warnings.push({
      path: 'parent_spec',
      code: 'TEMPLATE_CACHE_STALE',
      message: `[TEMPLATE_CACHE_STALE] Local template cache for "${freshness.name}" differs from the canonical remote "${freshness.url}". Run check_workspace to rehydrate the template cache and re-validate.`,
      promptHint: `Run check_workspace to update the template cache with the canonical remote version "${freshness.url}" and re-validate the model.`,
      meta: {
        canonicalUrl: freshness.url,
        templateName: freshness.name,
      },
      severity: 'warning',
    })
  }

  const errors = docErrors.map((e) => ({
    ...e,
    filePath: e.path.startsWith('parent') ? templatePath : modelPath,
  }))

  const warningsWithFile = warnings.map((w) => ({
    ...w,
    filePath: w.path.startsWith('parent') ? templatePath : modelPath,
  }))

  // Phase 4: Workspace-scope cross-model validation
  let valid = errors.length === 0
  if (workspace && id && modelPath !== 'inline') {
    const workspaceDiagnostics = await runWorkspaceValidation(rootDir, modelPath, specCache)
    for (const diag of workspaceDiagnostics) {
      const decorated = {
        path: diag.path,
        message: diag.message,
        severity: diag.severity,
        filePath: modelPath,
      }
      if (diag.severity === 'error') {
        errors.push(decorated)
        valid = false
      } else {
        warningsWithFile.push(decorated)
      }
    }
  }

  // Differential baseline handling
  let surfacedErrors: ValidationError[] = errors
  let suppressedCount = 0
  let staleEntries: BaselineEntry[] = []
  let backlog: string | null = null
  let summary: string | null = null
  if (options.baselinePath) {
    const baseline = await loadBaselineFile(options.baselinePath)
    if (baseline) {
      backlog = baseline.backlog
      const diff = diffNewOnly(surfacedErrors, baseline)
      surfacedErrors = diff.newErrors
      suppressedCount = diff.suppressedCount
      staleEntries = diff.staleEntries
      if (staleEntries.length > 0) {
        warningsWithFile.push({
          path: 'baseline',
          message: `[BASELINE_STALE] ${staleEntries.length} baseline ${staleEntries.length === 1 ? 'entry matches' : 'entries match'} no current error; prune ${staleEntries.length === 1 ? 'it' : 'them'} or keep ${staleEntries.length === 1 ? 'it' : 'them'} as backlog.`,
          code: 'BASELINE_STALE',
          severity: 'info',
          filePath: options.baselinePath,
        })
      }
      summary =
        `Suppressed ${suppressedCount} known error(s) (backlog: ${backlog}).` +
        (staleEntries.length > 0 ? ` ${staleEntries.length} stale baseline entr(ies) reported.` : '')
      valid = surfacedErrors.length === 0
    }
  }

  return {
    valid,
    errors: surfacedErrors,
    warnings: warningsWithFile,
    suppressedCount,
    staleEntries,
    backlog,
    summary,
  }
}

/* ── validate_model_url ─────────────────────────────────────── */

/**
 * Validate a model fetched from a URL without writing to disk.
 * Accepts a model URL and optional template_url. Fetches the model content,
 * then delegates to validateKnowledge (content mode).
 */
export async function validateKnowledgeUrl(
  rootDir: string,
  modelUrl: string,
  templateUrl?: string,
): Promise<{
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}> {
  let content: string
  try {
    const response = await fetch(modelUrl)
    if (!response.ok) {
      return {
        valid: false,
        errors: [
          {
            path: '',
            message: `Failed to fetch model URL: ${response.status} ${response.statusText}`,
            severity: 'error',
          },
        ],
        warnings: [],
      }
    }
    content = await response.text()
  } catch (err) {
    return {
      valid: false,
      errors: [{ path: '', message: `Model URL unreachable: ${err}`, severity: 'error' }],
      warnings: [],
    }
  }

  return validateKnowledge(rootDir, undefined, content, templateUrl)
}

/* ── validate_template ──────────────────────────────────────── */

/**
 * Validate a Level 2 template against its Level 1 parent spec.
 * Auto-detects frontmatter `level === 2` and resolves parent spec from parent_spec.url or explicit url.
 * Emits [PARENT_RESOLUTION_FAILED] diagnostic error if the parent spec cannot be resolved.
 *
 * @param rootDir Workspace root directory
 * @param id Template model id on disk
 * @param content Raw template content string
 * @param url Explicit parent spec URL override
 */
export async function validateTemplate(
  rootDir: string,
  id?: string,
  content?: string,
  url?: string,
): Promise<{
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}> {
  let templateContent: string
  if (content) {
    templateContent = content
  } else if (id) {
    const filePath = await findKnowledgeFile(rootDir, id, { includeSpecs: true })
    if (!filePath) {
      return {
        valid: false,
        errors: [{ path: '', message: `Template file not found: ${id}`, severity: 'error' }],
        warnings: [],
      }
    }
    templateContent = await readFile(filePath, 'utf-8').catch(() => '')
    if (!templateContent) {
      return {
        valid: false,
        errors: [{ path: '', message: `Failed to read template file: ${id}`, severity: 'error' }],
        warnings: [],
      }
    }
  } else {
    return {
      valid: false,
      errors: [{ path: '', message: 'Provide either id or content', severity: 'error' }],
      warnings: [],
    }
  }

  const parsed = parseKnowledge(templateContent)
  const fm = parsed.frontmatter

  const parentUrl = url ?? fm?.parent_spec?.url
  if (!parentUrl) {
    return {
      valid: false,
      errors: [
        {
          path: 'parent_spec',
          message: '[PARENT_RESOLUTION_FAILED] Parent spec URL missing for level-2 template',
          severity: 'error',
        },
      ],
      warnings: [],
    }
  }

  let parentSpec = null
  let resolutionDetail: string | null = null
  try {
    const result = await getSpec(rootDir, { url: parentUrl })
    parentSpec = result.spec
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'SpecResolutionError' || err instanceof SpecResolutionError)
    ) {
      resolutionDetail = err.message
    }
  }
  if (!parentSpec) {
    const detailSuffix = resolutionDetail ? ` Detail: ${resolutionDetail}` : ''
    return {
      valid: false,
      errors: [
        {
          path: 'parent_spec',
          message: `[PARENT_RESOLUTION_FAILED] Parent spec '${parentUrl}' could not be resolved${detailSuffix}`,
          severity: 'error',
        },
      ],
      warnings: [],
    }
  }

  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  if (fm?.level !== undefined && fm.level !== 2) {
    errors.push({
      path: 'frontmatter.level',
      message: `Expected level 2 for template, got ${fm.level}`,
      severity: 'error',
    })
  }

  if (!fm?.title) {
    errors.push({
      path: 'frontmatter.title',
      message: 'Missing title in template frontmatter',
      severity: 'error',
    })
  }

  // Schema-driven: check the template's root-primitive elements
  // (Concept/Field/Marker/Matrix Definition) against the level-1 metaschema
  // resolved from the parent spec. Same code path as level-3-against-template.
  for (const diag of validateTemplateAgainstMetaschema(templateContent, parentSpec.rawContent)) {
    ;(diag.severity === 'error' ? errors : warnings).push(diag)
  }

  // `includes` composition: resolve every referenced template and surface any
  // name collision (a Definition declared by two sources) as an ERROR.
  const includeRefs = fm?.includes ?? []
  if (includeRefs.length > 0) {
    const includeMap = await buildIncludeContentMap(rootDir, includeRefs)
    const composed = resolveBlueprintSchema(
      templateContent,
      (ref) => includeMap.get(ref.name) ?? includeMap.get(ref.name.toLowerCase()) ?? null,
    )
    for (const diag of composed.errors) {
      ;(diag.severity === 'error' ? errors : warnings).push(diag)
    }
  }

  const templatePath = id
    ? ((await findKnowledgeFile(rootDir, id, { includeSpecs: true })) ?? id)
    : 'inline'
  const decoratedErrors = errors.map((e) => ({ ...e, filePath: templatePath }))
  const decoratedWarnings = warnings.map((w) => ({ ...w, filePath: templatePath }))

  return {
    valid: errors.length === 0,
    errors: decoratedErrors,
    warnings: decoratedWarnings,
  }
}

export const validateBlueprint = validateTemplate

