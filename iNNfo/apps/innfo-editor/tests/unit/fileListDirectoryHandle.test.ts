import { describe, it, expect } from 'vitest'
import { createDirectoryHandleFromFileList } from '../../src/utils/fileListDirectoryHandle'
import { useModelStore } from '../../src/stores/modelStore'
import { setActivePinia, createPinia } from 'pinia'

function makeFile(relPath: string, content: string): File {
  const name = relPath.split('/').pop() as string
  const file = new File([content], name, { type: 'text/markdown' })
  Object.defineProperty(file, 'webkitRelativePath', { value: relPath })
  return file
}

describe('createDirectoryHandleFromFileList (F-13)', () => {
  it('reconstructs a nested directory tree from webkitRelativePath entries', async () => {
    const files = [
      makeFile('workspace/Root_NN.md', '# root'),
      makeFile('workspace/sub/Child_NN.md', '# child'),
    ]

    const handle = createDirectoryHandleFromFileList(files)
    expect(handle.kind).toBe('directory')
    expect(handle.name).toBe('workspace')

    const entries: string[] = []
    for await (const [name] of handle.entries()) {
      entries.push(name)
    }
    expect(entries.sort()).toEqual(['Root_NN.md', 'sub'])

    const rootFile = await handle.getFileHandle('Root_NN.md')
    const text = await (await rootFile.getFile()).text()
    expect(text).toBe('# root')

    const subDir = await handle.getDirectoryHandle('sub')
    const childFile = await subDir.getFileHandle('Child_NN.md')
    expect(await (await childFile.getFile()).text()).toBe('# child')
  })

  it('throws NotFoundError for missing entries instead of a bare Error', async () => {
    const handle = createDirectoryHandleFromFileList([makeFile('workspace/A_NN.md', '# a')])
    await expect(handle.getFileHandle('missing.md')).rejects.toThrow(/not found/i)
    await expect(handle.getDirectoryHandle('missing')).rejects.toThrow(/not found/i)
  })

  it('is consumable by the SAME parse pipeline as the primary flow (modelStore.parseFromHandle)', async () => {
    setActivePinia(createPinia())
    const files = [
      makeFile(
        'workspace/domaiNN_NN.md',
        '---\nspec_version: "V_0-3-0"\nlevel: 1\ntitle: "Domain"\n---\n# NN index\n* [[kNNowledge/Doc_NN.md]]\n',
      ),
      makeFile(
        'workspace/kNNowledge/Doc_NN.md',
        '---\nspec_version: "V_0-3-0"\nknowledge_version: "V_1-0-0"\ntitle: "Doc"\n---\n# NN index\n',
      ),
    ]
    const handle = createDirectoryHandleFromFileList(files)
    const modelStore = useModelStore()

    await modelStore.parseFromHandle(handle)

    expect(modelStore.rootIds.length).toBeGreaterThan(0)
    const parsedPaths = Object.values(modelStore.nodes).map((n) => n.source?.path)
    expect(parsedPaths).toContain('kNNowledge/Doc_NN.md')
  })
})
