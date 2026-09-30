/**
 * Builds a read-only `DirectoryHandleLike` tree from a `webkitdirectory`
 * `FileList` (the non-File-System-Access fallback folder picker).
 *
 * This lets the fallback path run through the exact SAME parse pipeline
 * (`workspace.open()` -> `knowledgeStore.parseFromHandle()`) as the primary
 * File System Access flow, instead of a second, independently-maintained
 * parser (F-13). No browser exposes a real `FileSystemDirectoryHandle` for
 * an `<input type="file" webkitdirectory>` selection — only a flat
 * `FileList` with `webkitRelativePath` on each `File` — so this adapter
 * reconstructs the directory tree from those paths.
 */
import type { DirectoryHandleLike, FileHandleLike } from '../model/fs-types'

interface DirNode {
  kind: 'directory'
  name: string
  children: Map<string, DirNode | FileNode>
}

interface FileNode {
  kind: 'file'
  name: string
  file: File
}

export function createDirectoryHandleFromFileList(files: FileList | File[]): DirectoryHandleLike {
  const fileArray = Array.from(files)
  if (fileArray.length === 0) {
    throw new Error('createDirectoryHandleFromFileList: empty file list')
  }

  const firstRelPath = fileArray[0].webkitRelativePath || fileArray[0].name
  const rootName = firstRelPath.split('/')[0] || 'workspace'
  const root: DirNode = { kind: 'directory', name: rootName, children: new Map() }

  for (const file of fileArray) {
    const relPath = file.webkitRelativePath || file.name
    const parts = relPath.split('/').filter(Boolean)
    // parts[0] is the root folder name itself — walk only the segments below it.
    let cursor = root
    for (let i = 1; i < parts.length - 1; i++) {
      const segment = parts[i]
      const existing = cursor.children.get(segment)
      if (existing && existing.kind === 'directory') {
        cursor = existing
      } else {
        const next: DirNode = { kind: 'directory', name: segment, children: new Map() }
        cursor.children.set(segment, next)
        cursor = next
      }
    }
    const fileName = parts[parts.length - 1]
    cursor.children.set(fileName, { kind: 'file', name: fileName, file })
  }

  return toDirectoryHandle(root)
}

function toDirectoryHandle(node: DirNode): DirectoryHandleLike {
  return {
    kind: 'directory',
    name: node.name,
    async *entries(): AsyncIterableIterator<[string, FileHandleLike | DirectoryHandleLike]> {
      for (const [name, child] of node.children) {
        yield [name, child.kind === 'directory' ? toDirectoryHandle(child) : toFileHandle(child)]
      }
    },
    async getFileHandle(name: string): Promise<FileHandleLike> {
      const child = node.children.get(name)
      if (!child || child.kind !== 'file') {
        throw new DOMException(`File not found: ${name}`, 'NotFoundError')
      }
      return toFileHandle(child)
    },
    async getDirectoryHandle(name: string): Promise<DirectoryHandleLike> {
      const child = node.children.get(name)
      if (!child || child.kind !== 'directory') {
        throw new DOMException(`Directory not found: ${name}`, 'NotFoundError')
      }
      return toDirectoryHandle(child)
    },
    // No `removeEntry` / `createWritable` — this handle is read-only by
    // construction, matching the fallback picker's read-only contract.
  }
}

function toFileHandle(node: FileNode): FileHandleLike {
  return {
    kind: 'file',
    name: node.name,
    async getFile() {
      const file = node.file
      return { text: () => file.text() }
    },
  }
}
