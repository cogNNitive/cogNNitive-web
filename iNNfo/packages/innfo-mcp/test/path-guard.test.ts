import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isInsideRoot, isSafeRelativeId } from '../src/tools/path-guard.js'
import { findKnowledgeFile } from '../src/tools/spec.js'
import { toLocalFilePath } from '../src/tools/resolver-node.js'

describe('isSafeRelativeId', () => {
  it('accepts plain and nested model ids', () => {
    expect(isSafeRelativeId('defiNNe_V_1-0')).toBe(true)
    expect(isSafeRelativeId('sub/dir/model')).toBe(true)
  })

  it('rejects parent-directory traversal in either separator', () => {
    expect(isSafeRelativeId('../secrets')).toBe(false)
    expect(isSafeRelativeId('..\\secrets')).toBe(false)
    expect(isSafeRelativeId('kNNowledge/../../etc/passwd')).toBe(false)
  })

  it('rejects absolute, drive-qualified and UNC paths', () => {
    expect(isSafeRelativeId('/etc/passwd')).toBe(false)
    expect(isSafeRelativeId('C:\\Windows\\win.ini')).toBe(false)
    expect(isSafeRelativeId('\\\\attacker\\share\\x')).toBe(false)
  })

  it('rejects the empty id', () => {
    expect(isSafeRelativeId('')).toBe(false)
  })
})

describe('isInsideRoot', () => {
  it('accepts a path within the root', () => {
    expect(isInsideRoot('/ws', '/ws/kNNowledge/a_NN.md')).toBe(true)
  })

  it('rejects the root itself', () => {
    expect(isInsideRoot('/ws', '/ws')).toBe(false)
  })

  it('rejects a joined path that escapes via ..', () => {
    // join() does not confine — this is the exact primitive being guarded.
    expect(isInsideRoot('/ws', join('/ws/models', '../../etc/passwd'))).toBe(false)
  })

  it('rejects a sibling directory sharing the root prefix', () => {
    expect(isInsideRoot('/ws', '/ws-other/a_NN.md')).toBe(false)
  })
})

describe('findKnowledgeFile containment', () => {
  let root: string
  let outside: string

  beforeEach(async () => {
    const base = await mkdtemp(join(tmpdir(), 'innfo-guard-'))
    root = join(base, 'workspace')
    outside = join(base, 'outside')
    await mkdir(join(root, 'models'), { recursive: true })
    await mkdir(outside, { recursive: true })
    await writeFile(join(root, 'models', 'legit_NN.md'), '---\n---\n', 'utf-8')
    await writeFile(join(outside, 'secret_NN.md'), 'TOP SECRET', 'utf-8')
  })

  afterEach(async () => {
    await rm(join(root, '..'), { recursive: true, force: true })
  })

  it('still resolves a legitimate model inside the workspace', async () => {
    const found = await findKnowledgeFile(root, 'legit')
    expect(found).not.toBeNull()
    await expect(stat(found as string)).resolves.toBeDefined()
  })

  it('refuses to resolve a model outside the workspace root', async () => {
    expect(await findKnowledgeFile(root, '../outside/secret')).toBeNull()
    expect(await findKnowledgeFile(root, '..\\outside\\secret')).toBeNull()
    expect(await findKnowledgeFile(root, join(outside, 'secret'))).toBeNull()
  })
})

describe('toLocalFilePath containment', () => {
  const root = process.platform === 'win32' ? 'D:\\ws' : '/ws'

  it('resolves a workspace-relative spec url', () => {
    expect(toLocalFilePath('specs/templates/a_NN.md', root)).toBe(
      join(root, 'specs/templates/a_NN.md'),
    )
  })

  it('refuses a relative url that escapes the root', () => {
    expect(toLocalFilePath('../../etc/passwd', root)).toBeNull()
    expect(toLocalFilePath('..\\..\\Windows\\win.ini', root)).toBeNull()
  })

  it('refuses an absolute path outside the root', () => {
    expect(toLocalFilePath('/etc/passwd', root)).toBeNull()
    expect(toLocalFilePath('C:\\Users\\mock-user\\.ssh\\id_rsa', root)).toBeNull()
  })

  it('refuses a UNC path outright (NTLM hash leak on Windows)', () => {
    expect(toLocalFilePath('\\\\attacker\\share\\x', root)).toBeNull()
    expect(toLocalFilePath('//attacker/share/x', root)).toBeNull()
  })

  it('refuses a file:// URI pointing outside the root', () => {
    expect(toLocalFilePath('file:///etc/passwd', root)).toBeNull()
  })

  it('refuses absolute forms when no root is available to contain against', () => {
    expect(toLocalFilePath('/etc/passwd')).toBeNull()
    expect(toLocalFilePath('C:\\Windows\\win.ini')).toBeNull()
  })
})
