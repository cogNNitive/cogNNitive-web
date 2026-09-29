import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join, relative, basename as pathBasename } from 'node:path'
import { reconcileManifest, isReconcilableModel, parseFrontmatter } from '@cognnitive/innfo-core'
import type { DiscoveredModel, ManifestChange, CandidateFile } from '@cognnitive/innfo-core'

/**
 * sync_workspace_manifest — the headless (MCP) caller of `reconcileManifest`
 * (AD-09: an innfo-mcp tool, not a new actioNN CLI binary). Mirrors the
 * editor's write-guard: only writes when a mutating change was computed.
 */

export interface SyncWorkspaceManifestInput {
  root?: string
  dry_run?: boolean
}

export interface SyncWorkspaceManifestResult {
  dry_run: boolean
  manifest_path: string
  changes: ManifestChange[]
  diff?: string
  written: boolean
}

/** Directories that are never worth walking into looking for model files. */
const SKIP_DIR_NAMES = new Set(['node_modules', '.git'])

function toRelative(root: string, filePath: string): string {
  return relative(root, filePath).replace(/\\/g, '/')
}

function stripMdSuffix(filename: string): string {
  return filename.replace(/_NN\.md$/i, '').replace(/\.md$/i, '')
}

async function walkMarkdownFiles(dir: string, out: string[] = []): Promise<string[]> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: a workspace dir may legitimately not exist.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[workspace-sync] Failed to readdir ${dir}: ${err}`)
    }
    return out
    /* v8 ignore stop */
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue
      await walkMarkdownFiles(join(dir, entry.name), out)
    } else if (entry.isFile() && /\.md$/i.test(entry.name)) {
      out.push(join(dir, entry.name))
    }
  }
  return out
}

/** Finds the domain/workspace manifest (`domaiNN*.md`, `domain*.md`, `workspace*.md` at the domain root). */
async function findManifestPath(root: string): Promise<string | null> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: the workspace root may legitimately not exist.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[workspace-sync] Failed to readdir root ${root}: ${err}`)
    }
    return null
    /* v8 ignore stop */
  }
  const match = entries.find(
    (e) =>
      e.isFile() &&
      (e.name.toLowerCase().startsWith('domain') || e.name.toLowerCase().startsWith('workspace')) &&
      e.name.toLowerCase().endsWith('.md'),
  )
  return match ? join(root, match.name) : null
}

function parentSpecTemplateName(frontmatter: Record<string, unknown>): string | undefined {
  const parentSpec = frontmatter['parent_spec']
  if (!parentSpec) return undefined
  if (typeof parentSpec === 'string') return parentSpec
  if (typeof parentSpec === 'object') {
    const name = (parentSpec as { name?: unknown }).name
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

async function discoverCandidates(
  root: string,
  manifestRelPath: string,
): Promise<DiscoveredModel[]> {
  const files = await walkMarkdownFiles(root)
  const discovered: DiscoveredModel[] = []

  for (const filePath of files) {
    const relPath = toRelative(root, filePath)
    let content: string
    try {
      content = await readFile(filePath, 'utf-8')
    } catch (err) {
      /* v8 ignore start */
      // swallow deliberately: an unreadable md file is skipped.
      console.warn(`[workspace-sync] Failed to read ${filePath}: ${err}`)
      continue
      /* v8 ignore stop */
    }

    const frontmatter = (parseFrontmatter(content) ?? {}) as Record<string, unknown>
    const candidate: CandidateFile = { path: relPath, frontmatter }
    if (!isReconcilableModel(candidate, manifestRelPath)) continue

    const title =
      typeof frontmatter['title'] === 'string' ? (frontmatter['title'] as string).trim() : ''
    discovered.push({
      path: relPath,
      name: title !== '' ? title : stripMdSuffix(pathBasename(relPath)),
      template: parentSpecTemplateName(frontmatter),
    })
  }

  return discovered
}

/**
 * Builds a single-hunk unified diff between two full-file strings. Not a
 * general Myers diff — sufficient for `reconcileManifest`'s always-localized
 * edits (status flips, appended blocks), which never touch more than one
 * contiguous region of the file.
 */
export function buildUnifiedDiff(oldContent: string, newContent: string, path: string): string {
  if (oldContent === newContent) return ''
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')

  let prefix = 0
  while (
    prefix < oldLines.length &&
    prefix < newLines.length &&
    oldLines[prefix] === newLines[prefix]
  ) {
    prefix++
  }

  let oldEnd = oldLines.length
  let newEnd = newLines.length
  while (oldEnd > prefix && newEnd > prefix && oldLines[oldEnd - 1] === newLines[newEnd - 1]) {
    oldEnd--
    newEnd--
  }

  const removed = oldLines.slice(prefix, oldEnd)
  const added = newLines.slice(prefix, newEnd)

  const header = [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${prefix + 1},${removed.length} +${prefix + 1},${added.length} @@`,
  ]
  const body = [...removed.map((l) => `-${l}`), ...added.map((l) => `+${l}`)]
  return [...header, ...body].join('\n')
}

/**
 * Reconciles the workspace manifest against discovered Level-3 model files.
 * `dry_run` (default `true`) reports `changes`/`diff` without writing.
 */
export async function syncWorkspaceManifest(
  root: string,
  options: { dry_run?: boolean } = {},
): Promise<SyncWorkspaceManifestResult> {
  const dryRun = options.dry_run !== false

  const manifestPath = await findManifestPath(root)
  if (!manifestPath) {
    return { dry_run: dryRun, manifest_path: '', changes: [], written: false }
  }

  const manifestRelPath = toRelative(root, manifestPath)
  const manifestContent = await readFile(manifestPath, 'utf-8')
  const discovered = await discoverCandidates(root, manifestRelPath)
  const { content, changes } = reconcileManifest(manifestContent, discovered)

  const mutating = changes.some((c) => c.kind !== 'skipped-not-owned')
  let written = false
  let diff: string | undefined

  if (mutating) {
    diff = buildUnifiedDiff(manifestContent, content, manifestRelPath)
    if (!dryRun) {
      await writeFile(manifestPath, content, 'utf-8')
      written = true
    }
  }

  return {
    dry_run: dryRun,
    manifest_path: manifestRelPath,
    changes,
    ...(diff !== undefined ? { diff } : {}),
    written,
  }
}

export const syncDomainManifest = syncWorkspaceManifest

