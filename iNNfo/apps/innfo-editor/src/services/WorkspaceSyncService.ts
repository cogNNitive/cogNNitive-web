import { reconcileManifest, isReconcilableModel, parseFrontmatter } from '@cognnitive/innfo-core'
import type { DiscoveredModel, ManifestChange, CandidateFile } from '@cognnitive/innfo-core'
import type { DirectoryHandleLike, FileHandleLike } from '../model/fs-types'

/**
 * Autorregistro (PR7): the editor's `reconcileManifest` caller. There is no
 * native filesystem watcher in this app yet (browser File System Access API
 * exposes no add/remove events); the closest add/remove-aware integration
 * point is the editor's own disk-write moment (`saveActiveFile`), which is
 * exactly when the on-disk model set can have changed. This re-scans the
 * whole workspace each call (see AD-08's call-site pseudocode), so it also
 * catches files removed through means other than the editor itself.
 */

const NN_MD_RE = /\.md$/i

function stripMdSuffix(filename: string): string {
  return filename.replace(/_NN\.md$/i, '').replace(/\.md$/i, '')
}

function basename(path: string): string {
  const segments = path
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
  return segments[segments.length - 1] ?? path
}

function parentSpecBlueprintName(frontmatter: Record<string, unknown>): string | undefined {
  const parentSpec = frontmatter['parent_spec']
  if (!parentSpec) return undefined
  if (typeof parentSpec === 'string') return parentSpec
  if (typeof parentSpec === 'object') {
    const name = (parentSpec as { name?: unknown }).name
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

interface WalkedFile {
  path: string
  handle: FileHandleLike
}

async function walkMarkdownFiles(
  dir: DirectoryHandleLike,
  prefix: string,
  out: WalkedFile[] = [],
): Promise<WalkedFile[]> {
  for await (const [name, entry] of dir.entries()) {
    const path = prefix ? `${prefix}/${name}` : name
    if (entry.kind === 'directory') {
      await walkMarkdownFiles(entry, path, out)
    } else if (entry.kind === 'file' && NN_MD_RE.test(name)) {
      out.push({ path, handle: entry })
    }
  }
  return out
}

/**
 * Finds the workspace manifest path (`workspace*.md` at the workspace root),
 * mirroring innfo-core's `findPrimaryWorkspaceFile` root-scan convention.
 */
export async function findWorkspaceManifestPath(root: DirectoryHandleLike): Promise<string | null> {
  for await (const [name, entry] of root.entries()) {
    if (
      entry.kind === 'file' &&
      name.toLowerCase().startsWith('workspace') &&
      name.toLowerCase().endsWith('.md')
    ) {
      return name
    }
  }
  return null
}

/**
 * Host-side (editor) enumeration of reconciliation candidates: walks the
 * workspace directory handle, parses each `.md` file's frontmatter, and
 * filters through the shared `isReconcilableModel` predicate.
 */
export async function enumerateReconcilableModels(
  root: DirectoryHandleLike,
  manifestPath: string,
): Promise<DiscoveredModel[]> {
  const files = await walkMarkdownFiles(root, '')
  const discovered: DiscoveredModel[] = []

  for (const { path, handle } of files) {
    let content: string
    try {
      const file = await handle.getFile()
      content = await file.text()
    } catch {
      continue
    }

    const frontmatter = (parseFrontmatter(content) ?? {}) as Record<string, unknown>
    const candidate: CandidateFile = { path, frontmatter }
    if (!isReconcilableModel(candidate, manifestPath)) continue

    const title =
      typeof frontmatter['title'] === 'string' ? (frontmatter['title'] as string).trim() : ''
    discovered.push({
      path,
      name: title !== '' ? title : stripMdSuffix(basename(path)),
      template: parentSpecBlueprintName(frontmatter),
    })
  }

  return discovered
}

/**
 * Reconciles the workspace manifest against the current on-disk model set
 * and writes the result back ONLY when a mutating change was computed
 * (never on a no-op pass — guards against dirtying git on every save).
 */
export async function reconcileWorkspaceManifest(
  root: DirectoryHandleLike,
): Promise<{ changes: ManifestChange[]; written: boolean }> {
  const manifestPath = await findWorkspaceManifestPath(root)
  if (!manifestPath) return { changes: [], written: false }

  const manifestHandle = await root.getFileHandle(manifestPath)
  const manifestFile = await manifestHandle.getFile()
  const manifestContent = await manifestFile.text()

  const discovered = await enumerateReconcilableModels(root, manifestPath)
  const { content, changes } = reconcileManifest(manifestContent, discovered)

  const mutating = changes.some((c) => c.kind !== 'skipped-not-owned')
  if (mutating) {
    const writableHandle = await root.getFileHandle(manifestPath, { create: true })
    if (writableHandle.createWritable) {
      const writable = await writableHandle.createWritable()
      await writable.write(content)
      await writable.close()
    }
  }

  return { changes, written: mutating }
}
