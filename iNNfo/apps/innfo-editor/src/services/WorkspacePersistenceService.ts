import { recursiveSerialize } from '../model/recursiveSerializer'
import {
  parseFormatFilename,
  buildFormatFilename,
  bumpVersion,
  formatVersionString,
} from '../utils/version'
import { buildSpecificationUrl } from '../utils/constants'
import { parseFrontmatter, parseKnowledge, serializeKnowledge, mergeKnowledge } from '@cognnitive/innfo-core'
import { reconcileWorkspaceManifest } from './WorkspaceSyncService'
import type { DirectoryHandleLike, FileHandleLike } from '../model/fs-types'
import type { BumpLevel } from '../utils/version'
import type { KnowledgeDriver } from '@cognnitive/innfo-core'
import type { useKnowledgeStore } from '../stores/knowledgeStore'
import type { useUiStore } from '../stores/uiStore'

/**
 * Extracted from workspaceStore.ts (OpenSpec `2026-09-13-simple-refactors-batch`,
 * task 4): disk-I/O-heavy save/backup/version-bump logic that only *reads*
 * Pinia state and never needs reactivity internally. Store instances are
 * passed in explicitly by the caller (workspaceStore) — this module has no
 * Pinia coupling of its own, matching `WorkspaceSyncService.ts`'s convention
 * of taking data as explicit parameters rather than calling `useXStore()`.
 */

type ModelStore = ReturnType<typeof useKnowledgeStore>
type UiStore = ReturnType<typeof useUiStore>

/** Resolve (creating intermediate directories as needed) a file handle for writing. */
export async function resolveFileHandleForWrite(
  root: DirectoryHandleLike,
  refPath: string,
): Promise<FileHandleLike> {
  const segments = refPath
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.')
  let current: DirectoryHandleLike = root
  for (let i = 0; i < segments.length - 1; i++) {
    current = await current.getDirectoryHandle(segments[i], { create: true })
  }
  const last = segments[segments.length - 1]
  return current.getFileHandle(last, { create: true })
}

/** Resolve an existing file handle by workspace-relative path (no creation). */
export async function resolveFileHandleForRead(
  root: DirectoryHandleLike,
  refPath: string,
): Promise<FileHandleLike | null> {
  const segments = refPath
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.')
  if (segments.length === 0) return null
  let current: DirectoryHandleLike = root
  for (let i = 0; i < segments.length - 1; i++) {
    try {
      current = await current.getDirectoryHandle(segments[i])
    } catch {
      return null
    }
  }
  try {
    return await current.getFileHandle(segments[segments.length - 1])
  } catch {
    return null
  }
}

export async function removeFileByPath(root: DirectoryHandleLike, refPath: string): Promise<void> {
  const segments = refPath
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.')
  let current: DirectoryHandleLike = root
  for (let i = 0; i < segments.length - 1; i++) {
    current = await current.getDirectoryHandle(segments[i])
  }
  const last = segments[segments.length - 1]
  if (current.removeEntry) {
    await current.removeEntry(last)
  }
}

/**
 * Creates a backup of the root node's content before saving.
 * Writes to `backups/{YYYY-MM-DD_HHmmss}_{original-basename}.md`.
 * Non-blocking: failure is logged but does NOT prevent the save.
 */
export async function _createBackup(
  handle: DirectoryHandleLike | null,
  knowledgeStore: ModelStore,
): Promise<void> {
  if (!handle) return

  const dirtyRootIds = knowledgeStore.rootIds.filter((id) => knowledgeStore.dirtyIds.has(id))
  if (dirtyRootIds.length === 0) return

  for (const rootId of dirtyRootIds) {
    const rootNode = knowledgeStore.getNode(rootId)
    if (!rootNode?.rawContent) continue

    try {
      const now = new Date()
      const ts =
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_` +
        `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`

      const rawBasename = rootNode.source.path.split(/[/\\]/).pop() ?? 'document'
      const cleanBasename = rawBasename.split(/[?#]/)[0]
      const backupName = `${ts}_${cleanBasename.replace(/[^a-zA-Z0-9._-]/g, '_').trim()}`

      let backupsDir: DirectoryHandleLike
      try {
        backupsDir = await handle.getDirectoryHandle('backups', { create: true })
      } catch {
        console.warn('[backup] Could not create backups/ directory')
        return
      }

      const fileHandle = await backupsDir.getFileHandle(backupName, { create: true })
      if (fileHandle.createWritable) {
        const writable = await fileHandle.createWritable()
        await writable.write(rootNode.rawContent)
        await writable.close()
      }
    } catch (err) {
      console.warn('[backup] Failed to create backup:', err)
    }
  }
}

/**
 * Downloads the generic iNNfo specification (level-1) into specs/ when
 * the root node declares a spec_version and the file is not already present.
 *
 * Best-effort: network failures or missing versions degrade gracefully.
 */
export async function _ensureGeneralSpec(
  handle: DirectoryHandleLike,
  knowledgeStore: ModelStore,
  uiStore: UiStore,
): Promise<void> {
  const rootId =
    (uiStore.activeModelId && knowledgeStore.nodes[uiStore.activeModelId]
      ? uiStore.activeModelId
      : undefined) ??
    knowledgeStore.rootIds.find((id) => !id.startsWith('spec:')) ??
    knowledgeStore.rootIds[0]
  if (!rootId) return
  const rootNode = knowledgeStore.getNode(rootId)
  if (!rootNode?.rawContent) return

  const fm = parseFrontmatter(rootNode.rawContent)
  const specVersion = fm?.spec_version
  if (!specVersion) return

  const specFilename = `iNNfo_${specVersion}_NN.md`

  try {
    const specsDir = await handle.getDirectoryHandle('specs', { create: true })

    // Skip if already exists
    try {
      await specsDir.getFileHandle(specFilename)
      return
    } catch {
      // Not found — proceed to download
    }

    // Single URL strategy: the filename already encodes the version, so the
    // `main` branch is content-pinned (see `spec-versioning`, A4). There is
    // no separate tag-pinned or `models/specs/` fallback anymore.
    let text = ''
    try {
      const resp = await fetch(buildSpecificationUrl(specVersion))
      if (resp.ok) {
        text = await resp.text()
      }
    } catch {
      // network failure — degrade gracefully below
    }

    if (!text) {
      console.warn(`[spec] Failed to fetch spec for version ${specVersion}`)
      return
    }

    const fileHandle = await specsDir.getFileHandle(specFilename, { create: true })
    if (fileHandle.createWritable) {
      const w = await fileHandle.createWritable()
      await w.write(text)
      await w.close()
    }
  } catch (e) {
    console.warn('[spec] Could not ensure general spec:', e)
  }
}

/**
 * Serializes all dirty nodes and writes them back to disk via
 * recursiveSerialize. Clears dirty flags on success.
 *
 * When `backupEnabled` is true (default), creates a timestamped backup
 * of the root node before writing.
 */
export async function saveActiveFile(
  handle: DirectoryHandleLike | null,
  driver: KnowledgeDriver | null | undefined,
  knowledgeStore: ModelStore,
  uiStore: UiStore,
  backupEnabled: boolean,
): Promise<void> {
  if (!handle) throw new Error('No workspace handle')

  // Non-blocking backup before write
  if (backupEnabled) {
    await _createBackup(handle, knowledgeStore)
  }

  const reports = await recursiveSerialize(knowledgeStore.nodes, knowledgeStore.dirtyIds, driver ?? undefined)

  if (!driver) {
    // If no driver is set, write the dirty model files directly using the directory handle
    for (const report of reports) {
      if (report.nodeId.startsWith('spec:')) continue
      const node = knowledgeStore.getNode(report.nodeId)
      if (node && node.rawContent !== undefined) {
        let contentToWrite = node.rawContent

        // Collision detection & Semantic AST auto-merge with disk
        const existingHandle = await resolveFileHandleForRead(handle, report.path)
        if (existingHandle) {
          try {
            const diskFile = await existingHandle.getFile()
            const diskText = await diskFile.text()
            if (diskText && diskText.trim() !== contentToWrite.trim()) {
              const diskParsed = parseKnowledge(diskText)
              const memoryParsed = parseKnowledge(contentToWrite)
              const merged = mergeKnowledge(diskParsed, memoryParsed)
              contentToWrite = serializeKnowledge(merged)
              node.rawContent = contentToWrite
            }
          } catch (err) {
            console.warn('[save] Could not perform disk pre-merge:', err)
          }
        }

        const fileHandle = await resolveFileHandleForWrite(handle, report.path)
        if (fileHandle.createWritable) {
          const w = await fileHandle.createWritable()
          await w.write(contentToWrite)
          await w.close()
        }
      }
    }
  }

  // Persist spec:* nodes (templates/specs) to specs/ directory.
  // Write-once: specs/ content is immutable by convention, so an
  // existing file is left as authoritative rather than overwritten.
  const specsDir = await handle.getDirectoryHandle('specs', { create: true })
  for (const [id, node] of Object.entries(knowledgeStore.nodes)) {
    if (id.startsWith('spec:') && node.rawContent) {
      const specName = node.name || id.substring(5)
      const filename = specName.endsWith('_NN') ? `${specName}.md` : `${specName}_NN.md`
      const alreadyPresent = await specsDir
        .getFileHandle(filename)
        .then(() => true)
        .catch(() => false)
      if (alreadyPresent) continue
      const fileHandle = await specsDir.getFileHandle(filename, { create: true })
      if (fileHandle.createWritable) {
        const w = await fileHandle.createWritable()
        await w.write(node.rawContent)
        await w.close()
      }
    }
  }

  // Also ensure the generic iNNfo spec is present
  await _ensureGeneralSpec(handle, knowledgeStore, uiStore)

  // Clear dirty flags after successful write
  for (const id of Array.from(knowledgeStore.dirtyIds)) {
    knowledgeStore.clearDirty(id)
  }

  // Autorregistro (PR7): reconcile the workspace manifest against the
  // current on-disk model set now that a write just happened — the
  // closest add/remove-aware moment this app has (no native fs watcher
  // exists yet). Never lets a reconciliation failure fail the save.
  if (!driver) {
    try {
      await reconcileWorkspaceManifest(handle)
    } catch (err) {
      console.warn('Workspace manifest reconciliation skipped:', err)
    }
  }
}

/**
 * Renames the active file on disk (if handle present) and updates the source path in memory.
 */
export async function renameActiveFile(
  handle: DirectoryHandleLike | null,
  knowledgeStore: ModelStore,
  uiStore: UiStore,
  newFilename: string,
  targetRootId?: string,
): Promise<void> {
  const rootId =
    targetRootId ??
    (uiStore.activeModelId && knowledgeStore.nodes[uiStore.activeModelId]
      ? uiStore.activeModelId
      : undefined) ??
    knowledgeStore.rootIds.find((id) => !id.startsWith('spec:')) ??
    knowledgeStore.rootIds[0]
  const rootNode = rootId ? knowledgeStore.getNode(rootId) : null
  if (!rootNode) throw new Error('No root node found to rename')

  const oldPath = rootNode.source.path.replace(/\\/g, '/')
  const pathSegments = oldPath.split('/')
  pathSegments.pop()
  const dirPath = pathSegments.join('/')

  let cleanNewFilenameOnly = newFilename.trim()
  if (!cleanNewFilenameOnly.endsWith('.md')) {
    cleanNewFilenameOnly += '.md'
  }
  cleanNewFilenameOnly = cleanNewFilenameOnly.replace(/[^a-zA-Z0-9._-]/g, '_')
  const cleanNewFilename = dirPath ? `${dirPath}/${cleanNewFilenameOnly}` : cleanNewFilenameOnly

  if (handle) {
    const oldFilename = rootNode.source.path
    if (oldFilename === cleanNewFilename) return

    // Create new file and copy content
    const newFileHandle = await resolveFileHandleForWrite(handle, cleanNewFilename)
    if (!newFileHandle.createWritable) {
      throw new Error(`File handle for "${cleanNewFilename}" does not support writing`)
    }
    const writable = await newFileHandle.createWritable()
    await writable.write(rootNode.rawContent ?? '')
    await writable.close()

    // Delete old file
    try {
      await removeFileByPath(handle, oldFilename)
    } catch (e) {
      console.warn(`Failed to delete old file "${oldFilename}":`, e)
    }
  }

  // Update in memory path for root node and all child nodes belonging to this model
  const oldPathRef = rootNode.source.path
  rootNode.source.path = cleanNewFilename
  for (const node of Object.values(knowledgeStore.nodes)) {
    if (
      node.source &&
      (node.source.path === oldPathRef || knowledgeStore.getKnowledgeRootForNode(node.id) === rootId)
    ) {
      node.source.path = cleanNewFilename
    }
  }
}

/**
 * Renames the active file to a version-bumped filename, archives the
 * previous version, and marks the root node dirty so the caller's
 * subsequent `saveActiveFile()` persists the change. Does NOT itself
 * perform that final save — the caller (workspaceStore) owns the
 * `saving`/`error` state transitions around its own `saveActiveFile()`
 * action, so this function stops once the rename/archive/dirty-mark is done.
 */
export async function saveActiveFileWithVersionBump(
  handle: DirectoryHandleLike | null,
  knowledgeStore: ModelStore,
  uiStore: UiStore,
  level: BumpLevel,
  targetRootId?: string,
): Promise<void> {
  if (!handle) throw new Error('No workspace handle')

  const rootId =
    targetRootId ??
    (uiStore.activeModelId && knowledgeStore.nodes[uiStore.activeModelId]
      ? uiStore.activeModelId
      : undefined) ??
    knowledgeStore.rootIds.find((id) => !id.startsWith('spec:')) ??
    knowledgeStore.rootIds[0]
  const rootNode = knowledgeStore.getNode(rootId)
  if (!rootNode) throw new Error('No root node found for version bump')

  const oldPath = rootNode.source.path.replace(/\\/g, '/')
  const pathSegments = oldPath.split('/')
  const oldFilenameOnly = pathSegments.pop() || ''
  const dirPath = pathSegments.join('/')

  const parsed = parseFormatFilename(oldFilenameOnly)
  if (!parsed) throw new Error('Could not parse filename for version bump')

  const newVersion = bumpVersion(parsed.version, level)
  const newFilenameOnly = buildFormatFilename(parsed.baseName, parsed.templateName, newVersion)
  const versionStr = formatVersionString(newVersion)
  const oldFilename = rootNode.source.path

  const cleanNewFilenameOnly = newFilenameOnly.replace(/[^a-zA-Z0-9._-]/g, '_').trim()
  const cleanNewFilename = dirPath ? `${dirPath}/${cleanNewFilenameOnly}` : cleanNewFilenameOnly

  // Create the new file and write current content
  const newFileHandle = await resolveFileHandleForWrite(handle, cleanNewFilename)
  if (!newFileHandle.createWritable) {
    throw new Error(`New file handle "${cleanNewFilename}" does not support writing`)
  }
  const writable = await newFileHandle.createWritable()
  await writable.write(rootNode.rawContent ?? '')
  await writable.close()

  // Archive the previous version (non-blocking)
  if (oldFilename !== cleanNewFilename) {
    try {
      const archiveDir = await handle.getDirectoryHandle('Archive', { create: true })
      const oldFileHandle = await resolveFileHandleForWrite(handle, oldFilename)
      const oldFile = await oldFileHandle.getFile()
      const oldContent = await oldFile.text()
      const archiveFileHandle = await resolveFileHandleForWrite(archiveDir, oldFilename)
      if (archiveFileHandle.createWritable) {
        const archiveWritable = await archiveFileHandle.createWritable()
        await archiveWritable.write(oldContent)
        await archiveWritable.close()
      }
      await removeFileByPath(handle, oldFilename)
    } catch (err) {
      console.warn('[version-bump] Failed to archive previous version:', err)
    }
  }

  // Update the root node's in-memory frontmatter version
  if (rootNode.rawContent) {
    rootNode.rawContent = rootNode.rawContent.replace(
      /^(knowledge_version|version):\s*"V_\d+-\d+-\d+"/m,
      `$1: "${versionStr}"`,
    )
  }

  // Update the root node's source path and all child nodes belonging to this model
  rootNode.source.path = cleanNewFilename
  for (const node of Object.values(knowledgeStore.nodes)) {
    if (
      node.source &&
      (node.source.path === oldFilename || knowledgeStore.getKnowledgeRootForNode(node.id) === rootId)
    ) {
      node.source.path = cleanNewFilename
    }
  }

  // Mark root node dirty so the caller's saveActiveFile() persists changes
  knowledgeStore.markDirty(rootId)
}
