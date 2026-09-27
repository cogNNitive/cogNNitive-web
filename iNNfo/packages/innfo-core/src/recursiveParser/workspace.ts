import type { DirectoryHandleLike, FileHandleLike } from '../fs-types.js'
import type { ModelDriver, ModelNode } from '../types/index.js'
import type { TemplateSchema } from '../schema/index.js'
import { IdentityRegistry } from '../identity.js'
import type {
  ParseContext,
  RecursiveParseOptions,
  RecursiveParseResult,
  WorklistItem,
} from './types.js'
import { stripMdSuffix, normalizePathKey, resolveSubmodelPath, basename } from './paths.js'
import { parseAndRegisterModel } from './model.js'
import { attachSchemaTypedCitations } from './normalize.js'
import { parseModel, parseFrontmatter, stripFrontmatter } from '../parser/index.js'
import { computeModelDagTopology } from './topology.js'

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
function pickEntrypointName(names: string[]): string | null {
  return names.find(isOverviewRoot) ?? names.find(isWorkspaceManifest) ?? null
}

async function findPrimaryWorkspaceFile(
  root: DirectoryHandleLike,
  driver?: ModelDriver,
): Promise<{ path: string; name: string; content: string } | null> {
  if (driver) {
    try {
      const children = await driver.listChildren('')
      const chosenName = pickEntrypointName(children.map((c) => c.name))
      const workspaceEntry = chosenName ? children.find((c) => c.name === chosenName) : undefined
      if (workspaceEntry) {
        const parsed = await driver.readModel(workspaceEntry.uri || workspaceEntry.name)
        return {
          path: workspaceEntry.uri || workspaceEntry.name,
          name: stripMdSuffix(basename(workspaceEntry.name)),
          content: parsed.rawContent,
        }
      }
    } catch (err) {
      /* v8 ignore start */
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn(`[workspace] Primary entrypoint discovery via driver failed; attempting fallback: ${err}`)
      }
      /* v8 ignore stop */
      for (const name of ['workspace_01.md', 'workspace_NN.md', 'workspace.md']) {
        try {
          const parsed = await driver.readModel(name)
          return { path: name, name: stripMdSuffix(name), content: parsed.rawContent }
        } catch (fallbackErr) {
          /* v8 ignore start */
          // swallow deliberately: a fallback entrypoint file may not exist.
          if ((fallbackErr as NodeJS.ErrnoException)?.code !== 'ENOENT') {
            console.warn(`[workspace] Failed to read fallback entrypoint ${name}: ${fallbackErr}`)
          }
          /* v8 ignore stop */
        }
      }
    }
    return null
  }

  const fileNames: string[] = []
  for await (const [name, entry] of root.entries()) {
    if (entry.kind === 'file') {
      fileNames.push(name)
    }
  }

  let candidates = fileNames
  while (candidates.length > 0) {
    const chosenName = pickEntrypointName(candidates)
    if (!chosenName) break
    try {
      const fileHandle = await root.getFileHandle(chosenName)
      const file = await fileHandle.getFile()
      const content = await file.text()
      return { path: chosenName, name: stripMdSuffix(chosenName), content }
    } catch (err) {
      /* v8 ignore start */
      if (!isNotFound(err)) {
        console.warn(`[workspace] Failed to read entrypoint candidate ${chosenName}: ${err}`)
      }
      /* v8 ignore stop */
      // Drop this candidate and try the next (mirrors the pre-A2 per-name loop).
      candidates = candidates.filter((n) => n !== chosenName)
    }
  }
  return null
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
  templateSchema?: TemplateSchema,
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
    const parsed = parseModel(content)
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
          if (f.type === 'model') {
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
 * so non-primary (diamond) edges are recoverable without a new ModelNode field (AD-02).
 */
function linkParentChild(
  ctx: ParseContext,
  referringPath: string,
  childNormKey: string,
): { parentNode?: ModelNode; childNode?: ModelNode } {
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
 * `options.resolveTemplateSchema`, when one was supplied. A throwing or
 * absent resolver degrades that node to today's behavior (no `type:: model`
 * field following) instead of aborting the whole parse (AD-04).
 */
function schemaFor(
  options: RecursiveParseOptions | undefined,
  path: string,
  name: string,
  content: string,
): TemplateSchema | undefined {
  if (!options?.resolveTemplateSchema) return undefined
  try {
    const fm = (parseFrontmatter(content) ?? {}) as Record<string, unknown>
    return options.resolveTemplateSchema({ path, name, content, frontmatter: fm }) ?? undefined
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
 * Parses a workspace by reading `workspace_NN.md` (or matching `workspace_*_NN.md`)
 * as the primary entry point, falling back to legacy `index.md`, or a root directory scan.
 */
export async function recursiveParse(
  root: DirectoryHandleLike,
  driver?: ModelDriver,
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

  // Step 1: Search primary entrypoint workspace_NN.md
  const primary = await findPrimaryWorkspaceFile(root, driver)

  let entrypointContent: string | null = null
  let entrypointPath: string = ''

  if (primary) {
    entrypointContent = primary.content
    entrypointPath = primary.path
    await parseAndRegisterModel(
      primary.content,
      primary.path,
      primary.name,
      ctx,
      elementNameToModel,
    )
    visitedPaths.add(normalizePathKey(primary.path))
  } else {
    // Step 2: Fallback to legacy index.md
    try {
      if (driver) {
        const parsed = await driver.readModel(INDEX_MD)
        entrypointContent = parsed.rawContent
      } else {
        const indexHandle = await root.getFileHandle(INDEX_MD)
        const indexFile = await indexHandle.getFile()
        entrypointContent = await indexFile.text()
      }
      entrypointPath = INDEX_MD
      visitedPaths.add(normalizePathKey(INDEX_MD))
    } catch (err) {
      if (!isNotFound(err)) {
        return {
          nodes: {},
          rootIds: [],
          issues: [{ path: '<root>', message: err instanceof Error ? err.message : String(err) }],
        }
      }
    }
  }

  // Fallback 3: Neither workspace_NN.md nor index.md exists -> scan root for standalone .md files
  if (!entrypointContent) {
    if (!driver) {
      const modelRefsFromScan: Array<{ name: string; path: string }> = []
      for await (const [name, entry] of root.entries()) {
        if (
          entry.kind === 'file' &&
          name.endsWith(INNFO_FILE_SUFFIX) &&
          name.toLowerCase() !== INDEX_MD &&
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
          await parseAndRegisterModel(content, ref.path, ref.name, ctx, elementNameToModel)
        } catch (scanErr) {
          ctx.issues.push({
            path: ref.path,
            message: scanErr instanceof Error ? scanErr.message : String(scanErr),
          })
        }
      }
    }

    const topology = computeModelDagTopology(ctx.nodes)
    const rootCount = topology.rootIds.length
    ctx.issues.unshift({
      path: '<root>',
      message:
        rootCount > 0
          ? `No index.md found — loaded ${rootCount} standalone model(s) from root directory`
          : 'Missing index.md — workspace root must contain an index.md file',
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
        const parsed = await driver.readModel(resolvedPath)
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

    await parseAndRegisterModel(content, resolvedPath, item.name, ctx, elementNameToModel)

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
