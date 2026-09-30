import type { DirectoryHandleLike, FileHandleLike } from '../fs-types.js'
import type { KnowledgeDriver, KnowledgeNode } from '../types/index.js'
import type { BlueprintSchema } from '../schema/index.js'
import { IdentityRegistry } from '../identity.js'
import type {
  ParseContext,
  RecursiveParseOptions,
  RecursiveParseResult,
  WorklistItem,
} from './types.js'
import { stripMdSuffix, normalizePathKey, resolveSubmodelPath, basename } from './paths.js'
import { parseAndRegisterKnowledge } from './knowledge.js'
import { attachSchemaTypedCitations } from './normalize.js'
import { parseKnowledge, parseFrontmatter, stripFrontmatter } from '../parser/index.js'
import { computeModelDagTopology } from './topology.js'
import { detectLegacy, type DomainReader } from '../legacy/detect.js'
import { CANONICAL_DOMAIN_ENTRYPOINT } from '../layout.js'

const INNFO_FILE_SUFFIX = '.md'
const INDEX_MD = 'index.md'

export const MAX_DEPTH = 10

/** Directories whose contents are never parsed as models. */
export const IGNORED_DIRECTORIES = new Set(['backups', 'archive', 'specs'])

/**
 * Returns true when the error indicates a file/directory was not found.
 * Handles:
 * - Browser File API (DOMException with name 'NotFoundError')
 * - Fake FS (Error with message matching /file not found/i)
 * - Node.js fs (Error with code 'ENOENT')
 */
export function isNotFound(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'NotFoundError') return true
  if (err instanceof Error && /file not found/i.test(err.message)) return true
  if (err instanceof Error && (err as { code?: string }).code === 'ENOENT') return true
  return false
}

/**
 * Returns true when the given path is inside an ignored directory
 * (backups/, archive/, specs/).
 */
export function isIgnoredPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')
  const firstSegment = normalized.split('/')[0]
  return IGNORED_DIRECTORIES.has(firstSegment)
}

/**
 * Splits a workspace-relative reference into clean path segments,
 * tolerating `./` prefixes, backslashes and redundant slashes.
 */
function pathSegments(refPath: string): string[] {
  return refPath
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.')
}

/**
 * Resolves a (possibly nested) relative reference to a file handle by walking
 * directory segments with getDirectoryHandle before the final getFileHandle.
 *
 * The File System Access API rejects any name that contains a path separator
 * (e.g. "sources/nn/model.md" or "./models/a_NN.md") with
 * "Name is not allowed", so references like `[[./models/a_NN.md]]` or
 * `[a](./sources/nn/a.md)` must be resolved segment by segment.
 *
 * References that escape the workspace root (`..`) are treated as not found
 * (unsupported) instead of surfacing a "Name is not allowed" error.
 */
async function resolveFileHandle(
  root: DirectoryHandleLike,
  refPath: string,
): Promise<FileHandleLike> {
  const segments = pathSegments(refPath)
  let current: DirectoryHandleLike = root
  for (let i = 0; i < segments.length - 1; i++) {
    if (segments[i] === '..') {
      throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
    }
    current = await current.getDirectoryHandle(segments[i])
  }
  const last = segments[segments.length - 1]
  if (last === '..') {
    throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
  }
  return current.getFileHandle(last)
}

/**
 * Matches the opt-in overview-root entrypoint pattern from the `base_V_0-1-0`
 * composite template (A2): any filename ending in `_base_<suffix>.md`, where
 * `<suffix>` is the literal `NN` placeholder used by this project's template
 * packages/samples (e.g. `Ghostbusters_V_0-1-0_base_NN.md`) or a real instance
 * number in a deployed workspace (e.g. `acme_base_01.md`). Case-insensitive,
 * `.md` suffix — same convention as `isWorkspaceManifest` below.
 */
const OVERVIEW_ROOT_RE = /_base_[a-z0-9]+\.md$/i

function isOverviewRoot(name: string): boolean {
  return OVERVIEW_ROOT_RE.test(name) && !isIgnoredPath(name)
}

function isWorkspaceManifest(name: string): boolean {
  return (
    name.toLowerCase().startsWith('workspace') &&
    name.endsWith(INNFO_FILE_SUFFIX) &&
    !isIgnoredPath(name)
  )
}

/**
 * Chooses the primary entrypoint filename from a flat list of candidate names.
 * An overview root (A2) wins when one is present; otherwise falls back to
 * today's `workspace*.md` selection, unchanged.
 */
function makeDomainReader(root: DirectoryHandleLike, driver?: KnowledgeDriver): DomainReader {
  return {
    async list(dir: string): Promise<string[]> {
      if (driver) {
        try {
          const children = await driver.listChildren(dir)
          return children.map((c) => c.name)
        } catch {
          return []
        }
      }
      try {
        let current: DirectoryHandleLike = root
        if (dir) {
          const segments = dir.split('/').filter(Boolean)
          for (const s of segments) {
            current = await current.getDirectoryHandle(s)
          }
        }
        const entries: string[] = []
        for await (const [name] of current.entries()) {
          entries.push(name)
        }
        return entries
      } catch {
        return []
      }
    },
    async read(path: string): Promise<string | null> {
      if (driver) {
        try {
          const m = await driver.readKnowledge(path)
          return m.rawContent
        } catch {
          return null
        }
      }
      try {
        const fileHandle = await resolveFileHandle(root, path)
        const file = await fileHandle.getFile()
        return await file.text()
      } catch {
        return null
      }
    },
  }
}

async function findCanonicalDomainEntrypoint(
  root: DirectoryHandleLike,
  driver?: KnowledgeDriver,
): Promise<{ path: string; name: string; content: string } | null> {
  const target = CANONICAL_DOMAIN_ENTRYPOINT
  if (driver) {
    try {
      const parsed = await driver.readKnowledge(target)
      return {
        path: target,
        name: stripMdSuffix(target),
        content: parsed.rawContent,
      }
    } catch {
      return null
    }
  }

  try {
    const fileHandle = await root.getFileHandle(target)
    const file = await fileHandle.getFile()
    const content = await file.text()
    return { path: target, name: stripMdSuffix(target), content }
  } catch {
    return null
  }
}

export interface ExtractedSubmodelRef {
  name: string
  path: string
  referringPath: string
  author?: string
}

export function extractSubmodelRefs(
  content: string,
  referringPath: string,
  templateSchema?: BlueprintSchema,
): ExtractedSubmodelRef[] {
  const modelRefs: ExtractedSubmodelRef[] = []

  const addRef = (target: string, author?: string) => {
    let cleanTarget = target.trim()
    try {
      cleanTarget = decodeURIComponent(cleanTarget)
    } catch (err) {
      // keep raw target if malformed
    }
    if (cleanTarget.startsWith('[[') && cleanTarget.endsWith(']]')) {
      cleanTarget = cleanTarget.slice(2, -2).trim()
    }
    if (
      cleanTarget.endsWith(INNFO_FILE_SUFFIX) &&
      cleanTarget.toLowerCase() !== INDEX_MD &&
      cleanTarget.toLowerCase() !== basename(referringPath).toLowerCase() &&
      !isIgnoredPath(cleanTarget)
    ) {
      const cleanAuthor =
        typeof author === 'string' && author.trim() !== '' ? author.trim() : undefined
      const resolved = resolveSubmodelPath(cleanTarget, referringPath)
      if (
        normalizePathKey(resolved) !== normalizePathKey(referringPath) &&
        !isIgnoredPath(resolved)
      ) {
        const ref: ExtractedSubmodelRef = {
          name: stripMdSuffix(basename(cleanTarget)),
          path: cleanTarget,
          referringPath,
          author: cleanAuthor,
        }
        if (
          !modelRefs.some(
            (r) =>
              normalizePathKey(resolveSubmodelPath(r.path, referringPath)) ===
              normalizePathKey(resolved),
          )
        ) {
          modelRefs.push(ref)
        }
      }
    }
  }

  // 1. Extract path:: / file_ref:: or fields typed as model
  try {
    const parsed = parseKnowledge(content)
    const modelFieldNames = new Set<string>([
      'path',
      'file_ref',
      'source_model',
      'procedure_model',
      'artifact_model',
      'models',
      'sources',
      'procedures',
      'artifacts',
    ])
    if (templateSchema?.concepts) {
      for (const c of templateSchema.concepts) {
        for (const f of c.fields ?? []) {
          if (f.type === 'knowledge') {
            modelFieldNames.add(f.name.toLowerCase())
          }
        }
      }
    }

    for (const [, elementNodes] of parsed.elements.entries()) {
      for (const el of elementNodes) {
        for (const [key, val] of Object.entries(el.fields)) {
          const normKey = key.toLowerCase().trim().replace(/[\s_-]+/g, '')
          if (
            modelFieldNames.has(key.toLowerCase()) ||
            modelFieldNames.has(normKey)
          ) {
            const rawVal = typeof val === 'string' ? val : undefined
            if (rawVal) {
              const author =
                typeof el.fields['author'] === 'string'
                  ? (el.fields['author'] as string)
                  : undefined
              addRef(rawVal, author)
            }
          }
        }
      }
    }
  } catch (err) {
    /* v8 ignore start */
    // log + continue: parse failure degrades to regex wikilink extraction.
    console.warn(`[workspace] Submodel reference parse failed; falling back to regex: ${err}`)
    /* v8 ignore stop */
  }

  // 2. Extract Wikilinks: [[target.md]]
  const body = stripFrontmatter(content).trim()
  const wikilinkRegex = /\[\[([^\]]+)\]\]/g
  let match: RegExpExecArray | null
  while ((match = wikilinkRegex.exec(body)) !== null) {
    addRef(match[1])
  }

  // 3. Extract Markdown links: [text](target.md)
  const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
  while ((match = mdLinkRegex.exec(body)) !== null) {
    addRef(match[2])
  }

  return modelRefs
}

/**
 * Links the referring model to the just-resolved child in the node graph.
 * DP1: the FIRST parent wins `parentId`; every parent gets the child in `childIds`,
 * so non-primary (diamond) edges are recoverable without a new KnowledgeNode field (AD-02).
 */
function linkParentChild(
  ctx: ParseContext,
  referringPath: string,
  childNormKey: string,
): { parentNode?: KnowledgeNode; childNode?: KnowledgeNode } {
  const referringNorm = normalizePathKey(resolveSubmodelPath(referringPath))
  const byPath = (key: string) =>
    Object.values(ctx.nodes).find(
      (n) => n.kind === 'root' && (n.source?.path ? normalizePathKey(n.source.path) : '') === key,
    )
  const parentNode = byPath(referringNorm)
  const childNode = byPath(childNormKey)
  if (parentNode && childNode && childNode.id !== parentNode.id) {
    if (childNode.parentId === null) childNode.parentId = parentNode.id // first parent wins
    if (!parentNode.childIds.includes(childNode.id)) parentNode.childIds.push(childNode.id)
  }
  return { parentNode, childNode }
}

/**
 * Resolves a node's composed template schema via the host-supplied
 * `options.resolveBlueprintSchema`, when one was supplied. A throwing or
 * absent resolver degrades that node to today's behavior (no `type:: knowledge`
 * field following) instead of aborting the whole parse (AD-04).
 */
function schemaFor(
  options: RecursiveParseOptions | undefined,
  path: string,
  name: string,
  content: string,
): BlueprintSchema | undefined {
  if (!options?.resolveBlueprintSchema) return undefined
  try {
    const fm = (parseFrontmatter(content) ?? {}) as Record<string, unknown>
    return options.resolveBlueprintSchema({ path, name, content, frontmatter: fm }) ?? undefined
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: an unresolvable template schema degrades to "no
    // schema" for this model (AD-04 contract), never aborts the parse.
    console.warn(`[workspace] Template schema resolution failed for ${path}: ${err}`)
    return undefined
    /* v8 ignore stop */
  }
}

/**
 * Parses a domaiNN by reading `domaiNN_NN.md` as the primary entry point,
 * detecting legacy layouts, or falling back to a root directory scan.
 */
export async function recursiveParse(
  root: DirectoryHandleLike,
  driver?: KnowledgeDriver,
  options?: RecursiveParseOptions,
): Promise<RecursiveParseResult> {
  const visitedPaths = new Set<string>()
  const ctx: ParseContext = {
    nodes: {},
    identity: new IdentityRegistry(),
    issues: [],
    visitedPaths,
  }
  const elementNameToModel = new Map<string, string>()

  // Step 0: Check for legacy signals using DomainReader and detectLegacy
  const reader = makeDomainReader(root, driver)
  const legacyCheck = await detectLegacy(reader)
  if (legacyCheck.kind === 'legacy' || legacyCheck.kind === 'mixed') {
    return {
      nodes: {},
      rootIds: [],
      issues: [
        {
          path: '<root>',
          message: legacyCheck.hint,
          code: 'LEGACY_DOMAIN',
          severity: 'error',
        },
      ],
      isLegacy: true,
      legacyResult: legacyCheck,
    }
  }

  // Step 1: Search primary entrypoint domaiNN_NN.md
  const primary = await findCanonicalDomainEntrypoint(root, driver)

  let entrypointContent: string | null = null
  let entrypointPath: string = ''

  if (primary) {
    entrypointContent = primary.content
    entrypointPath = primary.path
    await parseAndRegisterKnowledge(
      primary.content,
      primary.path,
      primary.name,
      ctx,
      elementNameToModel,
    )
    visitedPaths.add(normalizePathKey(primary.path))
  }

  // Fallback: domaiNN_NN.md does not exist -> scan root for standalone .md files (index.md is NOT entrypoint)
  if (!entrypointContent) {
    if (!driver) {
      const modelRefsFromScan: Array<{ name: string; path: string }> = []
      for await (const [name, entry] of root.entries()) {
        if (
          entry.kind === 'file' &&
          name.endsWith(INNFO_FILE_SUFFIX) &&
          !isIgnoredPath(name)
        ) {
          modelRefsFromScan.push({ name: stripMdSuffix(name), path: name })
        }
      }

      for (const ref of modelRefsFromScan) {
        try {
          const fileHandle = await resolveFileHandle(root, ref.path)
          const file = await fileHandle.getFile()
          const content = await file.text()
          visitedPaths.add(normalizePathKey(ref.path))
          await parseAndRegisterKnowledge(content, ref.path, ref.name, ctx, elementNameToModel)
        } catch (scanErr) {
          ctx.issues.push({
            path: ref.path,
            message: scanErr instanceof Error ? scanErr.message : String(scanErr),
          })
        }
      }
    } else {
      try {
        const children = await driver.listChildren('')
        for (const child of children) {
          if (child.name.endsWith(INNFO_FILE_SUFFIX) && !isIgnoredPath(child.name)) {
            const parsed = await driver.readKnowledge(child.uri || child.name)
            visitedPaths.add(normalizePathKey(child.name))
            await parseAndRegisterKnowledge(parsed.rawContent, child.name, stripMdSuffix(child.name), ctx, elementNameToModel)
          }
        }
      } catch (scanErr) {
        ctx.issues.push({
          path: '<root>',
          message: scanErr instanceof Error ? scanErr.message : String(scanErr),
        })
      }
    }

    const topology = computeModelDagTopology(ctx.nodes)
    const rootCount = topology.rootIds.length
    ctx.issues.unshift({
      path: '<root>',
      message:
        rootCount > 0
          ? `No domaiNN_NN.md found — loaded ${rootCount} standalone model(s) from root directory`
          : 'Missing domaiNN_NN.md — domaiNN root must contain a domaiNN_NN.md file',
      code: 'MISSING_ENTRYPOINT',
      severity: 'warning',
    })

    return { nodes: ctx.nodes, rootIds: topology.rootIds, issues: ctx.issues, topology }
  }

  // Step 3: Iterative worklist traversal
  const queue: WorklistItem[] = []
  const entrypointSchema = schemaFor(
    options,
    entrypointPath,
    primary?.name ?? '',
    entrypointContent,
  )
  const initialRefs = extractSubmodelRefs(entrypointContent, entrypointPath, entrypointSchema)
  const entrypointKey = normalizePathKey(entrypointPath)

  // A3 (entrypoint gap fix): wire schema-typed `type:: citation` fields on
  // elements defined directly on the entrypoint model too. The worklist loop
  // below only ever calls attachSchemaTypedCitations for resolvedPath values
  // drawn from queued submodel items — the entrypoint's own path never goes
  // through that loop, so its citation-typed fields were never wired.
  // Mirrors the same post-schema-stash pattern used at the A3 call site
  // inside the worklist loop (see below).
  if (entrypointSchema) {
    for (const node of Object.values(ctx.nodes)) {
      if (node.kind === 'element' && node.source.path === entrypointPath) {
        attachSchemaTypedCitations(node, entrypointSchema)
      }
    }
  }

  for (const ref of initialRefs) {
    queue.push({
      path: ref.path,
      name: ref.name,
      referringPath: entrypointPath,
      depth: 1,
      author: ref.author,
      ancestorKeys: [entrypointKey],
    })
  }

  while (queue.length > 0) {
    const item = queue.shift()!
    const resolvedPath = resolveSubmodelPath(item.path, item.referringPath)
    const normKey = normalizePathKey(resolvedPath)

    if (item.ancestorKeys.includes(normKey)) {
      ctx.issues.push({
        path: item.path,
        message: `Cycle detected: "${item.path}" referenced from "${item.referringPath}" is an ancestor on this branch`,
        code: 'CYCLE_DETECTED',
      })
      continue
    }
    if (visitedPaths.has(normKey)) {
      linkParentChild(ctx, item.referringPath, normKey) // diamond: second edge, no issue
      continue
    }

    visitedPaths.add(normKey)

    if (item.depth > MAX_DEPTH) {
      ctx.issues.push({
        path: item.path,
        message: `Traversal depth limit exceeded (MAX_DEPTH = 10) while resolving submodel "${item.path}"`,
        code: 'DEPTH_LIMIT',
      })
      continue
    }

    let content: string
    try {
      if (driver) {
        const parsed = await driver.readKnowledge(resolvedPath)
        content = parsed.rawContent
      } else {
        const fileHandle = await resolveFileHandle(root, resolvedPath)
        const file = await fileHandle.getFile()
        content = await file.text()
      }
    } catch (err) {
      if (isNotFound(err)) {
        ctx.issues.push({
          path: item.path,
          message: `Referenced model "${item.path}" not found — skipping`,
          code: 'MODEL_NOT_FOUND',
        })
        continue
      }
      ctx.issues.push({
        path: item.path,
        message: err instanceof Error ? err.message : String(err),
      })
      continue
    }

    await parseAndRegisterKnowledge(content, resolvedPath, item.name, ctx, elementNameToModel)

    // Establish parent-child relationship in graph between referring model and this model
    const { childNode } = linkParentChild(ctx, item.referringPath, normKey)

    // Propagate workspace-scoped author from referring manifest
    if (item.author && childNode) {
      childNode.author = item.author
    }

    // C1: resolve this node's composed template schema (if a resolver was
    // supplied) and stash it on the freshly linked child node immediately,
    // reusing the childNode already returned by linkParentChild (no extra lookup).
    const schema = schemaFor(options, resolvedPath, item.name, content)
    if (childNode && schema) {
      childNode.templateSchema = schema
    }

    // A3: wire schema-typed `type:: citation` fields into the graph once the
    // schema is known (design D3: must run after templateSchema is stashed,
    // never inside normalizeElementsIntoGraph). Additive to the name-based
    // path in attachSourceCitations, which already ran during normalization.
    if (schema) {
      for (const node of Object.values(ctx.nodes)) {
        if (node.kind === 'element' && node.source.path === resolvedPath) {
          attachSchemaTypedCitations(node, schema)
        }
      }
    }

    // Extract nested submodel references from this model
    const nestedRefs = extractSubmodelRefs(content, resolvedPath, schema)
    const nestedAncestorKeys = [...item.ancestorKeys, normKey]
    for (const nRef of nestedRefs) {
      queue.push({
        path: nRef.path,
        name: nRef.name,
        referringPath: resolvedPath,
        depth: item.depth + 1,
        author: nRef.author,
        ancestorKeys: nestedAncestorKeys,
      })
    }
  }

  const topology = computeModelDagTopology(ctx.nodes, entrypointPath)

  return { nodes: ctx.nodes, rootIds: topology.rootIds, issues: ctx.issues, entrypointPath, topology }
}
