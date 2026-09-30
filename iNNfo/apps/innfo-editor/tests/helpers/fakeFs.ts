import type {
  DirectoryHandleLike,
  FileHandleLike,
  WritableStreamLike,
} from '../../src/model/fs-types'

/** In-memory tree description used to build fake FS Access API handles for tests. */
export type FakeTree = { [name: string]: string | FakeTree }

class FakeWritableStream implements WritableStreamLike {
  private buffer = ''
  constructor(private onClose: (content: string) => void) {}
  async write(data: string): Promise<void> {
    this.buffer += data
  }
  async close(): Promise<void> {
    this.onClose(this.buffer)
  }
}

class FakeFileHandle implements FileHandleLike {
  kind: 'file' = 'file'
  constructor(
    public name: string,
    public content: string,
    public fileSize: number = content.length,
    public fileLastModified: number = Date.now(),
  ) {}
  async getFile() {
    const content = this.content
    const name = this.name
    const size = this.fileSize
    const lastModified = this.fileLastModified
    return {
      name,
      size,
      lastModified,
      async text() {
        return content
      },
    }
  }
  async createWritable(): Promise<WritableStreamLike> {
    return new FakeWritableStream((content) => {
      this.content = content
    })
  }
}

class FakeDirectoryHandle implements DirectoryHandleLike {
  kind: 'directory' = 'directory'
  constructor(
    public name: string,
    private tree: FakeTree,
  ) {}

  async *entries(): AsyncIterableIterator<[string, FileHandleLike | DirectoryHandleLike]> {
    for (const [entryName, value] of Object.entries(this.tree)) {
      if (typeof value === 'string') {
        yield [entryName, new FakeFileHandle(entryName, value)]
      } else {
        yield [entryName, new FakeDirectoryHandle(entryName, value)]
      }
    }
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike> {
    const normalized = name.replace(/\\/g, '/')
    if (normalized.includes('/')) {
      const parts = normalized.split('/')
      const fileName = parts.pop()!
      let current: FakeDirectoryHandle = this
      for (const part of parts) {
        current = (await current.getDirectoryHandle(part, options)) as FakeDirectoryHandle
      }
      return current.getFileHandle(fileName, options)
    }
    const value = this.tree[name]
    if (typeof value !== 'string') {
      if (options?.create) {
        this.tree[name] = ''
        const handle = new FakeFileHandle(name, '')
        // Keep the underlying tree in sync when the writable stream closes.
        const originalCreateWritable = handle.createWritable.bind(handle)
        handle.createWritable = async () => {
          const stream = await originalCreateWritable()
          return {
            write: (data: string) => stream.write(data),
            close: async () => {
              await stream.close()
              this.tree[name] = handle.content
            },
          }
        }
        return handle
      }
      throw new Error(`File not found: ${name}`)
    }
    const handle = new FakeFileHandle(name, value)
    const originalCreateWritable = handle.createWritable.bind(handle)
    handle.createWritable = async () => {
      const stream = await originalCreateWritable()
      return {
        write: (data: string) => stream.write(data),
        close: async () => {
          await stream.close()
          this.tree[name] = handle.content
        },
      }
    }
    return handle
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<DirectoryHandleLike> {
    const normalized = name.replace(/\\/g, '/')
    if (normalized.includes('/')) {
      const parts = normalized.split('/')
      let current: FakeDirectoryHandle = this
      for (const part of parts) {
        current = (await current.getDirectoryHandle(part, options)) as FakeDirectoryHandle
      }
      return current
    }
    const value = this.tree[name]
    if (!value || typeof value === 'string') {
      if (options?.create) {
        this.tree[name] = {}
        return new FakeDirectoryHandle(name, this.tree[name] as FakeTree)
      }
      throw new Error(`Directory not found: ${name}`)
    }
    return new FakeDirectoryHandle(name, value)
  }
}

/** Builds a fake root DirectoryHandleLike from a plain nested object tree. */
export function buildFakeTree(name: string, tree: FakeTree): DirectoryHandleLike {
  return new FakeDirectoryHandle(name, tree)
}

/** Reads back the current (possibly mutated) content of a file at `path` (slash-separated) from a fake tree. */
export function readFakeTree(tree: FakeTree, path: string): string | undefined {
  const parts = path.split('/')
  let cursor: string | FakeTree = tree
  for (const part of parts) {
    if (typeof cursor === 'string') return undefined
    cursor = cursor[part]
    if (cursor === undefined) return undefined
  }
  return typeof cursor === 'string' ? cursor : undefined
}
