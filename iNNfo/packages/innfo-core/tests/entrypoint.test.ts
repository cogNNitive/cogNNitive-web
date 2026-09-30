import { describe, it, expect } from 'vitest'
import type { DirectoryHandleLike, FileHandleLike } from '../src/fs-types.js'
import { recursiveParse } from '../src/recursiveParser/index.js'
import { CANONICAL_DOMAIN_ENTRYPOINT } from '../src/layout.js'

type DirEntries = Array<[string, FileHandleLike | DirectoryHandleLike]>

function fakeDir(name: string, entries: DirEntries): DirectoryHandleLike {
  const fileMap = new Map<string, FileHandleLike>()
  const dirMap = new Map<string, DirectoryHandleLike>()
  for (const [entryName, entry] of entries) {
    if (entry.kind === 'file') {
      fileMap.set(entryName, entry)
    } else {
      dirMap.set(entryName, entry)
    }
  }
  return {
    kind: 'directory',
    name,
    entries: async function* () {
      for (const e of entries) yield e
    },
    getFileHandle: async (fileName: string) => {
      const found = fileMap.get(fileName)
      if (!found) throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
      return found
    },
    getDirectoryHandle: async (dirName: string) => {
      const found = dirMap.get(dirName)
      if (!found) throw Object.assign(new Error('Directory not found'), { code: 'ENOENT' })
      return found
    },
  }
}

function fakeFile(name: string, content: string): FileHandleLike {
  return {
    kind: 'file',
    name,
    getFile: async () => ({ text: async () => content }),
  }
}

function md(frontmatter: Record<string, unknown>, body?: string): string {
  const fm = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')
  return `---\n${fm}\n---\n${body ?? ''}`
}

const CANONICAL_DOMAIN_FM = {
  spec_version: 'V_0-3-0',
  level: 3,
  knowledge_version: '0.1.0',
  parent_spec: { name: 'domaiNN_V_0-1-0_NN.md', url: 'https://cognnitive.com/innfo/specs/bluepriNNts/domaiNN/V_0-1-0/spec_NN.md' },
  title: 'Test DomaiNN',
}

describe('Task 7.3: Canonical DomaiNN Entrypoint Resolution', () => {
  it('loads exact-name domaiNN_NN.md as primary entrypoint with no legacy warnings', async () => {
    const entryContent = md(CANONICAL_DOMAIN_FM, '\n# NN domaiNN\n## NN domaiNN: Test\n')
    const dir = fakeDir('root', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', entryContent)],
    ])

    const result = await recursiveParse(dir)
    expect(result.entrypointPath).toBe(CANONICAL_DOMAIN_ENTRYPOINT)
    expect(result.isLegacy).toBeFalsy()
    expect(result.issues.some((i) => i.code === 'LEGACY_DOMAIN')).toBe(false)
  })

  it('rejects look-alike files as entrypoints and does not treat them as domain entrypoint', async () => {
    const glossaryContent = md({ title: 'Glossary' }, '\n# NN glossary\n')
    const notesContent = md({ title: 'Notes' }, '\n# NN notes\n')
    const dir = fakeDir('root', [
      ['Domain_Glossary_NN.md', fakeFile('Domain_Glossary_NN.md', glossaryContent)],
      ['knowledge_notes_NN.md', fakeFile('knowledge_notes_NN.md', notesContent)],
    ])

    const result = await recursiveParse(dir)
    expect(result.entrypointPath).toBeUndefined()
    expect(result.issues.some((i) => i.message.includes('No domaiNN_NN.md found') || i.message.includes('No domaiNN_NN.md found') || i.code === 'MISSING_ENTRYPOINT')).toBe(true)
  })

  it('detects legacy entrypoint workspace_01.md, reports legacy with hint, and does not parse it', async () => {
    const legacyContent = md({
      level: 3,
      knowledge_version: '0.1.0',
      parent_spec: { name: 'workspace_spec_NN.md', url: 'https://example.com' },
      title: 'Legacy Workspace',
    })
    const dir = fakeDir('root', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', legacyContent)],
    ])

    const result = await recursiveParse(dir)
    expect(result.isLegacy).toBe(true)
    expect(result.issues.some((i) => i.code === 'LEGACY_DOMAIN' || i.message.includes('nn-upgrade') || i.message.includes('legacy'))).toBe(true)
    expect(result.entrypointPath).not.toBe('domaiNN_NN.md')
  })

  it('detects legacy overview-root entrypoint acme_base_01.md, reports legacy, and does not parse it', async () => {
    const baseContent = md({
      level: 3,
      knowledge_version: '0.1.0',
      title: 'Acme Base',
    })
    const dir = fakeDir('root', [
      ['acme_base_01.md', fakeFile('acme_base_01.md', baseContent)],
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', baseContent)],
    ])

    const result = await recursiveParse(dir)
    expect(result.isLegacy).toBe(true)
    expect(result.issues.some((i) => i.code === 'LEGACY_DOMAIN' || i.message.includes('nn-upgrade'))).toBe(true)
    expect(result.entrypointPath).not.toBe('acme_base_01.md')
  })

  it('does NOT treat index.md as an entrypoint; scans root .md files with a missing-entrypoint warning issue', async () => {
    const indexContent = md({ title: 'Index' }, '\n# NN index\n* [[doc1_NN.md]]\n')
    const docContent = md({ title: 'Doc 1', level: 3, knowledge_version: '0.1.0', parent_spec: { name: 'custom', url: '' } }, '\n# NN custom\n')
    const dir = fakeDir('root', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', indexContent)],
      ['doc1_NN.md', fakeFile('doc1_NN.md', docContent)],
    ])

    const result = await recursiveParse(dir)
    expect(result.entrypointPath).not.toBe('domaiNN_NN.md')
    expect(result.issues.some((i) => i.message.includes('domaiNN_NN.md') || i.message.includes('Missing') || i.message.includes('standalone') || i.message.includes('No domaiNN_NN.md'))).toBe(true)
  })

  it('reports legacy when legacy entrypoint workspace_01.md and index.md coexist (legacy takes precedence over fallback)', async () => {
    const legacyContent = md({
      level: 3,
      knowledge_version: '0.1.0',
      title: 'Legacy Workspace',
    })
    const indexContent = md({ title: 'Index' })
    const dir = fakeDir('root', [
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', legacyContent)],
      ['domaiNN_NN.md', fakeFile('domaiNN_NN.md', indexContent)],
    ])

    const result = await recursiveParse(dir)
    expect(result.isLegacy).toBe(true)
    expect(result.issues.some((i) => i.code === 'LEGACY_DOMAIN' || i.message.includes('nn-upgrade'))).toBe(true)
    expect(result.entrypointPath).not.toBe('domaiNN_NN.md')
  })
})
