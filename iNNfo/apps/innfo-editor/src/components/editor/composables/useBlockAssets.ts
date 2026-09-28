import { computed, type ComputedRef, type Ref } from 'vue'
import { useWorkspaceStore } from '../../../stores/workspaceStore'
import { isImageFieldValue } from '../../../utils/imageDetection'
import type { ModelNode } from '../../../model/types'
import type { ScannedAsset } from '../../../composables/useMediaScanner'

export interface BlockAssetItem {
  filename: string
  url: string
}

/**
 * Blob URL cache for FS-resolved asset paths — module-local (shared across
 * all BlockSheet instances), moved verbatim from BlockSheet.vue's
 * component-local cache.
 */
const blobUrlCache = new Map<string, string>()

/**
 * Resolves and merges BlockSheet.vue's Media & Attachments assets
 * (declared node assets, image-valued fields, and filesystem-scanned
 * assets) — moved verbatim, no logic change.
 */
export function useBlockAssets(
  node: Ref<ModelNode | null | undefined>,
  scannedAssets: Ref<ScannedAsset[]>,
): {
  resolveAssetUrl(relativePath: string): Promise<string>
  assetItems: ComputedRef<BlockAssetItem[]>
} {
  async function resolveAssetUrl(relativePath: string): Promise<string> {
    if (
      relativePath.startsWith('http') ||
      relativePath.startsWith('data:') ||
      relativePath.startsWith('blob:')
    ) {
      return relativePath
    }

    const ws = useWorkspaceStore()
    const handle = ws.handle
    if (!handle) return relativePath

    const n = node.value
    const modelPath = n?.source?.path || ''

    // Auto-derive slug
    let slug = ''
    if (n) {
      slug =
        n.slug ||
        n.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim()
          .replace(/[\s_]+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-+|-+$/g, '')
    }

    async function getModelDirectoryHandle(rootHandle: any, modelFile: string): Promise<any> {
      const parts = modelFile.replace(/\\/g, '/').split('/').filter(Boolean)
      parts.pop()
      let current = rootHandle
      for (const part of parts) {
        current = await current.getDirectoryHandle(part)
      }
      return current
    }

    // Cache the blob URL keyed by path + size + mtime so a replaced on-disk
    // asset (same path, changed content) misses the cache and shows the new
    // file instead of a stale blob (E6).
    const cacheWithStats = (file: File): string => {
      const key = `${relativePath}:${file.size}:${file.lastModified}`
      const existing = blobUrlCache.get(key)
      if (existing) return existing
      const url = URL.createObjectURL(file)
      blobUrlCache.set(key, url)
      return url
    }

    async function findFileInDir(dirHandle: any, pathParts: string[]): Promise<any> {
      let current = dirHandle
      for (let i = 0; i < pathParts.length - 1; i++) {
        const seg = pathParts[i]
        const decodedSeg = decodeURIComponent(seg)
        try {
          current = await current.getDirectoryHandle(seg)
        } catch {
          try {
            current = await current.getDirectoryHandle(decodedSeg)
          } catch {
            // Try matching by normalized name
            let found = null
            for await (const [name, entry] of current.entries()) {
              if (entry.kind === 'directory') {
                if (
                  name.toLowerCase() === seg.toLowerCase() ||
                  name.toLowerCase() === decodedSeg.toLowerCase() ||
                  name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
                    decodedSeg.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                ) {
                  found = entry
                  break
                }
              }
            }
            if (!found) return null
            current = found
          }
        }
      }

      const fileSeg = pathParts[pathParts.length - 1]
      const decodedFileSeg = decodeURIComponent(fileSeg)
      try {
        return await current.getFileHandle(fileSeg)
      } catch {
        try {
          return await current.getFileHandle(decodedFileSeg)
        } catch {
          for await (const [name, entry] of current.entries()) {
            if (entry.kind === 'file') {
              if (
                name.toLowerCase() === fileSeg.toLowerCase() ||
                name.toLowerCase() === decodedFileSeg.toLowerCase() ||
                name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
                  decodedFileSeg.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
              ) {
                return entry
              }
            }
          }
          return null
        }
      }
    }

    try {
      const modelDirHandle = modelPath ? await getModelDirectoryHandle(handle, modelPath) : handle
      const cleanPath = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
      const parts = cleanPath.split('/').filter(Boolean)

      // 1. Try resolving against workspace root (handle)
      const rootFh = await findFileInDir(handle, parts)
      if (rootFh) {
        const file = await rootFh.getFile()
        return cacheWithStats(file)
      }

      // 2. Try resolving against model directory handle
      if (modelDirHandle && modelDirHandle !== handle) {
        const modelFh = await findFileInDir(modelDirHandle, parts)
        if (modelFh) {
          const file = await modelFh.getFile()
          return cacheWithStats(file)
        }
      }

      // 3. Try canonical per-element assets: assets/{slug}/{filename}
      if (slug && parts.length === 1) {
        const slugFh = await findFileInDir(handle, ['assets', slug, parts[0]])
        if (slugFh) {
          const file = await slugFh.getFile()
          return cacheWithStats(file)
        }
      }

      // 4. Try centralized assets: assets/{filename}
      if (parts.length === 1) {
        const assetFh = await findFileInDir(handle, ['assets', parts[0]])
        if (assetFh) {
          const file = await assetFh.getFile()
          return cacheWithStats(file)
        }
      }

      return relativePath
    } catch {
      return relativePath
    }
  }

  // Merge declared assets (from parser), field assets (from node fields) and scanned assets (from filesystem)
  const assetItems = computed<BlockAssetItem[]>(() => {
    const n = node.value
    const declared: BlockAssetItem[] = n?.assets
      ? n.assets.map((path: string) => ({
          filename: path.split('/').pop() || path,
          url: path,
        }))
      : []

    const fieldAssets: BlockAssetItem[] = []
    if (n?.fields) {
      for (const [key, valObj] of Object.entries(n.fields)) {
        const rawVal =
          typeof valObj === 'object' && valObj !== null && 'value' in valObj
            ? (valObj as any).value
            : valObj
        if (typeof rawVal === 'string' && rawVal.trim()) {
          const val = rawVal.trim()
          if (isImageFieldValue(key, val)) {
            fieldAssets.push({
              filename: val.split('/').pop()?.split('?')[0] || val,
              url: val,
            })
          }
        }
      }
    }

    const scanned: BlockAssetItem[] = scannedAssets.value.map((a) => ({
      filename: a.filename,
      url: a.relativePath,
    }))

    const seen = new Set<string>()
    const merged: BlockAssetItem[] = []
    for (const item of [...fieldAssets, ...declared, ...scanned]) {
      if (item.url && !seen.has(item.url)) {
        seen.add(item.url)
        merged.push(item)
      }
    }

    return merged
  })

  return { resolveAssetUrl, assetItems }
}
