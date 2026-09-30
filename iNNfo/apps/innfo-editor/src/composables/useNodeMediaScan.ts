/**
 * useNodeMediaScan — reactive wrapper around useMediaScanner that
 * caches scanned results per node and triggers scans on demand.
 *
 * Components like Pill (thumbnail) and BlockSheet (full media gallery)
 * call `scan(nodeId)` and consume `scannedImages.value` / `allScanned.value`.
 */
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useKnowledgeStore } from '../stores/knowledgeStore'
import { scanNodeMedia, type ScannedAsset } from './useMediaScanner'

/** In-memory cache: nodeId → ScannedAsset[] */
const scanCache = new Map<string, ScannedAsset[]>()

export function useNodeMediaScan() {
  const workspace = useWorkspaceStore()
  const model = useKnowledgeStore()

  const scannedAssets = ref<ScannedAsset[]>([])
  const scanning = ref(false)
  const scanError = ref('')

  const scannedImages = computed(() =>
    scannedAssets.value.filter((a) => a.type === 'image'),
  )

  const scannedNonImages = computed(() =>
    scannedAssets.value.filter((a) => a.type !== 'image'),
  )

  const firstImage = computed(() => scannedImages.value[0] ?? null)

  async function scan(nodeId: string): Promise<void> {
    // Check cache first
    const cached = scanCache.get(nodeId)
    if (cached) {
      scannedAssets.value = cached
      return
    }

    const handle = workspace.handle
    if (!handle) {
      scannedAssets.value = []
      return
    }

    const node = model.getNode(nodeId)
    if (!node) {
      scannedAssets.value = []
      return
    }

    const slug = node.slug || node.name.toLowerCase().replace(/[^a-z0-9-]/g, '_')

    scanning.value = true
    scanError.value = ''

    try {
      const { assets } = await scanNodeMedia(handle, slug)
      scanCache.set(nodeId, assets)
      scannedAssets.value = assets
    } catch (err) {
      scanError.value = err instanceof Error ? err.message : String(err)
      scannedAssets.value = []
    } finally {
      scanning.value = false
    }
  }

  /** Clears the cache for a specific node (e.g., after save). */
  function invalidate(nodeId: string): void {
    scanCache.delete(nodeId)
    if (scannedAssets.value.length > 0) {
      scannedAssets.value = []
    }
  }

  function invalidateAll(): void {
    scanCache.clear()
    scannedAssets.value = []
  }

  return {
    scannedAssets,
    scannedImages,
    scannedNonImages,
    firstImage,
    scanning,
    scanError,
    scan,
    invalidate,
    invalidateAll,
  }
}
