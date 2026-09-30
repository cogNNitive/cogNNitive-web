import { defineStore } from 'pinia'
import { ref, markRaw } from 'vue'
import { useKnowledgeStore } from './knowledgeStore'
import { useUiStore } from './uiStore'
import { IndexedDbWorkspaceRepository } from '../repositories/IndexedDbWorkspaceRepository'
import type { WorkspaceIntegrityReport } from '@cognnitive/innfo-core'
import { useUrlDocLoader } from '../composables/useUrlDocLoader'
import { createWorkspaceIntegrityPorts } from '../services/workspaceIntegrityPorts'
import {
  resolveFileHandleForRead,
  saveActiveFile as persistSaveActiveFile,
  renameActiveFile as persistRenameActiveFile,
  saveActiveFileWithVersionBump as persistSaveActiveFileWithVersionBump,
} from '../services/WorkspacePersistenceService'
import type { DirectoryHandleLike } from '../model/fs-types'
import type { BumpLevel } from '../utils/version'
import type { KnowledgeDriver } from '@cognnitive/innfo-core'
import type { ActiveView } from './uiStore'

export type { DirectoryHandleLike }

export interface WorkspaceState {
  handle: DirectoryHandleLike | null
  driver: KnowledgeDriver | null
  hasHandle: boolean
  isParsing: boolean
  hasParsed: boolean
  parseCount: number
  saving: boolean
  error: string | null
  /** URL from which the current document was loaded (null when loaded via handle). */
  sourceUrl: string | null
  /** Whether auto-backup is enabled before saveActiveFile writes. Default true. */
  backupEnabled: boolean
  repository: IndexedDbWorkspaceRepository
  /** True when loaded from a sample/preview URL (no folder handle). */
  isSampleSession: boolean
  /** Human-readable template name for the sample banner. */
  sampleBlueprintName: string
  /** Set by open() when folder contains zero _NN.md model files. */
  emptyFolderError: boolean
  /** Workspace integrity report, produced fire-and-forget on open() (AD-6). */
  integrityReport: WorkspaceIntegrityReport | null
  /** True while the non-blocking integrity check is in flight. */
  integrityRunning: boolean
}

/**
 * workspaceStore owns the FS directory handle, permission verification,
 * and IndexedDB handle recovery. `open()` is the single entry point that
 * triggers exactly one parse pass into knowledgeStore (R1) — repeated calls
 * or route navigation must not re-parse.
 */
export const useWorkspaceStore = defineStore('workspace', () => {
  const handle = ref<DirectoryHandleLike | null>(null)
  const driver = ref<KnowledgeDriver | null>(null)
  const hasHandle = ref(false)
  const isParsing = ref(false)
  const hasParsed = ref(false)
  const parseCount = ref(0)
  const saving = ref(false)
  const error = ref<string | null>(null)
  const sourceUrl = ref<string | null>(null)
  const backupEnabled = ref(true)
  const repository = ref<IndexedDbWorkspaceRepository>(markRaw(new IndexedDbWorkspaceRepository()))
  const isSampleSession = ref(false)
  const sampleBlueprintName = ref('')
  const emptyFolderError = ref(false)
  const integrityReport = ref<WorkspaceIntegrityReport | null>(null)
  const integrityRunning = ref(false)

  /**
   * Runs the workspace integrity check against the in-memory graph and the
   * same-origin template catalog. Non-blocking and informational: a failure
   * of any port (or of the whole pass) clears the report and is swallowed —
   * it must never set `error` or prevent editing. Catalog-only on open
   * (Resolved Decision 4): resolveBlueprint/checkFreshness are omitted, so
   * those fields render as `not-checked`.
   */
  async function _runIntegrityCheck(): Promise<void> {
    if (integrityRunning.value) return
    integrityRunning.value = true
    try {
      const { buildWorkspaceIntegrityReport } = await import('@cognnitive/innfo-core')
      const report = await buildWorkspaceIntegrityReport(createWorkspaceIntegrityPorts())
      integrityReport.value = report
    } catch (err) {
      console.warn('[integrity] Workspace integrity check failed:', err)
      integrityReport.value = null
    } finally {
      integrityRunning.value = false
    }
  }

  /**
   * Opens a workspace from a directory handle and runs exactly one parse
   * pass into knowledgeStore. Calling this again with hasParsed already true
   * is a no-op unless `force` is explicitly passed.
   */
  async function open(newHandle: DirectoryHandleLike, options: { force?: boolean } = {}): Promise<void> {
    handle.value = markRaw(newHandle)
    hasHandle.value = true
    error.value = null
    emptyFolderError.value = false

    if (hasParsed.value && !options.force) {
      return
    }
    if (isParsing.value) {
      return
    }

    isParsing.value = true
    try {
      await repository.value.storeHandle(newHandle)
      const knowledgeStore = useKnowledgeStore()
      await knowledgeStore.parseFromHandle(newHandle, driver.value ?? undefined)

      // Detect empty folder — no canonical domaiNN / kNNowledge roots found
      const hasModelRoots = knowledgeStore.rootIds.some(
        (id) => !id.startsWith('spec:') && knowledgeStore.nodes[id],
      )
      const isLegacyDomain = knowledgeStore.parseIssues.some((issue) => issue.code === 'LEGACY_DOMAIN')

      if (!hasModelRoots && !isLegacyDomain) {
        emptyFolderError.value = true

        // Surface per-file parse problems so "no models found" is explainable:
        // e.g. a _NN.md file that exists but failed to parse. The <root> issue
        // (missing index.md fallback notice) is expected and not an error.
        const parseIssues = knowledgeStore.parseIssues.filter(
          (issue) => issue.path !== '<root>' && issue.code !== 'LEGACY_DOMAIN',
        )
        if (parseIssues.length > 0) {
          error.value = parseIssues
            .slice(0, 4)
            .map((issue) => (issue.path ? `${issue.path}: ${issue.message}` : issue.message))
            .join(' — ')
        }

        hasHandle.value = false
        handle.value = null
        hasParsed.value = false
        return
      }

      hasParsed.value = true
      parseCount.value += 1

      // Reset UI state so the dashboard shows after loading
      const uiStore = useUiStore()
      uiStore.setActiveView('editor')
      uiStore.selectNode(null)

      // Fire-and-forget workspace integrity check (AD-6): never blocks the
      // first paint, never rejects into open(), catalog-only on open
      // (Resolved Decision 4).
      void _runIntegrityCheck().catch(() => {})

      // Persist session state after successful parse
      const rootId = knowledgeStore.rootIds[0]
      if (rootId) {
        const rootNode = knowledgeStore.getNode(rootId)
        if (rootNode?.source.path) {
          repository.value.setSessionState('lastFile', rootNode.source.path).catch(() => {})
        }
      }
      repository.value.setSessionState('lastOpenedAt', new Date().toISOString()).catch(() => {})
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      isParsing.value = false
    }
  }

  /**
   * Loads multiple FORMAT model documents from URLs into knowledgeStore as a
   * unified virtual workspace (no File System handle — save is disabled).
   */
  async function loadVirtualWorkspace(
    urls: string[],
    name?: string,
    templateName?: string,
  ): Promise<void> {
    error.value = null
    sourceUrl.value = urls.join(',')
    emptyFolderError.value = false

    handle.value = null
    hasHandle.value = false

    if (isParsing.value) return
    isParsing.value = true

    try {
      const { loadWorkspaceIntoStore } = useUrlDocLoader()
      const result = await loadWorkspaceIntoStore(urls)

      if (result.error && Object.keys(result.nodes).length === 0) {
        error.value = result.error
        throw new Error(result.error)
      }

      hasParsed.value = true
      parseCount.value += 1

      const uiStore = useUiStore()
      const knowledgeStore = useKnowledgeStore()
      const firstRootId = knowledgeStore.rootIds[0] || null
      uiStore.selectNode(firstRootId)
      uiStore.setActiveView('editor')

      isSampleSession.value = true
      sampleBlueprintName.value = templateName || name || 'workspace'
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      isParsing.value = false
    }
  }

  /**
   * Loads a single FORMAT model document from a URL into knowledgeStore.
   */
  async function loadFromUrl(url: string, templateName?: string): Promise<void> {
    return loadVirtualWorkspace([url], undefined, templateName)
  }

  /**
   * Reloads the entire model graph from disk (or source URL), discarding
   * any in-memory-only changes. Caller must confirm if dirtyIds is non-empty.
   */
  async function reloadWorkspace(): Promise<void> {
    if (isParsing.value) return
    if (handle.value) {
      await open(handle.value, { force: true })
    } else if (sourceUrl.value) {
      await loadFromUrl(sourceUrl.value)
    } else {
      throw new Error('No hay un workspace activo para recargar')
    }
  }

  /** Enables or disables the auto-backup behaviour on save. */
  function enableBackup(val: boolean): void {
    backupEnabled.value = val
  }

  /** Shorthand for `enableBackup(false)`. */
  function disableBackup(): void {
    backupEnabled.value = false
  }

  /** Attempts to recover a previously granted handle from IndexedDB on boot. */
  async function recoverHandle(): Promise<DirectoryHandleLike | null> {
    const recovered = await repository.value.loadStoredHandle()
    if (recovered) {
      handle.value = markRaw(recovered)
      hasHandle.value = true

      // Restore uiStore state from persisted session
      try {
        const session = await repository.value.getSessionState()
        const uiStore = useUiStore()
        if (session.selectedNodeId && typeof session.selectedNodeId === 'string') {
          uiStore.selectNode(session.selectedNodeId)
        }
        if (session.activeView && typeof session.activeView === 'string') {
          uiStore.setActiveView(session.activeView as ActiveView)
        }
      } catch {
        // Session restoration is best-effort
      }
    }
    return recovered
  }

  /**
   * Persists a single tree node's expansion state to IndexedDB.
   */
  async function persistTreeState(nodeId: string, collapsed: boolean): Promise<void> {
    await repository.value.setTreeState(nodeId, collapsed)
  }

  /**
   * Restores the full tree state map from IndexedDB.
   * Returns a Map<nodeId, collapsed> — nodes not present default to expanded.
   */
  async function restoreTreeState(): Promise<Map<string, boolean>> {
    return await repository.value.getTreeState()
  }

  function reset(): void {
    handle.value = null
    driver.value = null
    hasHandle.value = false
    isParsing.value = false
    hasParsed.value = false
    parseCount.value = 0
    saving.value = false
    error.value = null
    sourceUrl.value = null
    backupEnabled.value = true
    isSampleSession.value = false
    sampleBlueprintName.value = ''
    emptyFolderError.value = false
    integrityReport.value = null
    integrityRunning.value = false
  }

  /**
   * Serializes all dirty nodes and writes them back to disk via
   * recursiveSerialize. Clears dirty flags on success.
   *
   * When `backupEnabled` is true (default), creates a timestamped backup
   * of the root node before writing.
   *
   * Delegates the actual disk I/O to `WorkspacePersistenceService` (see
   * OpenSpec `2026-09-13-simple-refactors-batch`, task 4) — this action
   * keeps only the `saving`/`error` state management.
   */
  async function saveActiveFile(): Promise<void> {
    if (!handle.value) throw new Error('No workspace handle')
    saving.value = true
    try {
      const knowledgeStore = useKnowledgeStore()
      const uiStore = useUiStore()
      await persistSaveActiveFile(
        handle.value,
        driver.value,
        knowledgeStore,
        uiStore,
        backupEnabled.value,
      )
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      saving.value = false
    }
  }

  /**
   * Renames the active file on disk (if handle present) and updates the source path in memory.
   */
  async function renameActiveFile(newFilename: string, targetRootId?: string): Promise<void> {
    const knowledgeStore = useKnowledgeStore()
    const uiStore = useUiStore()
    await persistRenameActiveFile(handle.value, knowledgeStore, uiStore, newFilename, targetRootId)
  }

  /**
   * Saves the active file under a new version-bumped filename, then
   * persists all dirty nodes. The original file is NOT deleted.
   *
   * The final persist step is delegated to this store's own
   * `saveActiveFile()` action (not called directly from the service) so the
   * `saving`/`error` state transitions happen exactly as before.
   */
  async function saveActiveFileWithVersionBump(level: BumpLevel, targetRootId?: string): Promise<void> {
    if (!handle.value) throw new Error('No workspace handle')
    const knowledgeStore = useKnowledgeStore()
    const uiStore = useUiStore()
    await persistSaveActiveFileWithVersionBump(handle.value, knowledgeStore, uiStore, level, targetRootId)
    await saveActiveFile()
  }

  /**
   * Read the full text content of a workspace file by relative path.
   * Returns null when the handle is missing or the file cannot be resolved.
   * Shared by FilePreviewModal and WorkspaceExplorer (no duplicated traversal).
   */
  async function readText(refPath: string): Promise<string | null> {
    if (!handle.value) return null
    const fileHandle = await resolveFileHandleForRead(handle.value, refPath)
    if (!fileHandle) return null
    const file = await fileHandle.getFile()
    return file.text()
  }

  /**
   * Read a file by relative path as a Blob (for image/PDF previews).
   * The FileHandleLike type only exposes {text()}, but the browser returns a
   * native File (a Blob subclass) — cast preserves size/type for object URLs.
   */
  async function readFileBlob(refPath: string): Promise<Blob | null> {
    if (!handle.value) return null
    const fileHandle = await resolveFileHandleForRead(handle.value, refPath)
    if (!fileHandle) return null
    const file = await fileHandle.getFile()
    return file as unknown as Blob
  }

  return {
    handle,
    driver,
    hasHandle,
    isParsing,
    hasParsed,
    parseCount,
    saving,
    error,
    sourceUrl,
    backupEnabled,
    repository,
    isSampleSession,
    sampleBlueprintName,
    emptyFolderError,
    integrityReport,
    integrityRunning,
    open,
    _runIntegrityCheck,
    loadFromUrl,
    loadVirtualWorkspace,
    reloadWorkspace,
    enableBackup,
    disableBackup,
    recoverHandle,
    persistTreeState,
    restoreTreeState,
    reset,
    saveActiveFile,
    renameActiveFile,
    saveActiveFileWithVersionBump,
    readText,
    readFileBlob,
  }
})
