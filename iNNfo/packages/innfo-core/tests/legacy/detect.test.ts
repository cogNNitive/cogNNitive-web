import { describe, it, expect } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { detectLegacy, type DomainReader } from '../../src/legacy/index.js'

// Helper Node DomainReader for reading on-disk fixtures
function createFsDomainReader(baseDir: string): DomainReader {
  return {
    async list(relDir: string): Promise<string[]> {
      const fullDir = relDir ? path.join(baseDir, relDir) : baseDir
      try {
        return await fs.readdir(fullDir)
      } catch {
        return []
      }
    },
    async read(relPath: string): Promise<string | null> {
      const fullPath = path.join(baseDir, relPath)
      try {
        return await fs.readFile(fullPath, 'utf8')
      } catch {
        return null
      }
    },
  }
}

// In-memory DomainReader for synthetic scenarios
function createMemoryDomainReader(files: Record<string, string>): DomainReader {
  return {
    async list(dir: string): Promise<string[]> {
      const normalizedDir = dir ? dir.replace(/\\/g, '/').replace(/\/$/, '') + '/' : ''
      const entries = new Set<string>()
      for (const filePath of Object.keys(files)) {
        const norm = filePath.replace(/\\/g, '/')
        if (norm.startsWith(normalizedDir)) {
          const rest = norm.slice(normalizedDir.length)
          const firstSegment = rest.split('/')[0]
          if (firstSegment) {
            entries.add(firstSegment)
          }
        }
      }
      return Array.from(entries)
    },
    async read(filePath: string): Promise<string | null> {
      const norm = filePath.replace(/\\/g, '/')
      return norm in files ? files[norm] : null
    },
  }
}

describe('detectLegacy (Task 5.1)', () => {
  it('detects legacy domain from frozen legacy fixture', async () => {
    const fixtureDir = path.resolve(__dirname, 'fixtures/legacy-domain')
    const reader = createFsDomainReader(fixtureDir)
    const result = await detectLegacy(reader)

    expect(result.kind).toBe('legacy')
    if (result.kind === 'legacy') {
      expect(result.signals.length).toBeGreaterThan(0)
      expect(result.hint).toContain('nn-upgrade')
      const types = result.signals.map((s) => s.type)
      expect(types).toContain('legacy-entrypoint')
      expect(types).toContain('legacy-folder')
    }
  })

  it('detects legacy entrypoint: workspace_NN.md', async () => {
    const reader = createMemoryDomainReader({
      'workspace_NN.md': '---\nblueprint_version: "0.1.0"\n---\n# Workspace\n',
      'kNNowledge/sample_NN.md': '---\nknowledge_version: "0.1.0"\n---\n',
    })
    const result = await detectLegacy(reader)
    expect(result.kind).toBe('legacy')
    if (result.kind === 'legacy') {
      const entrypointSignal = result.signals.find((s) => s.type === 'legacy-entrypoint')
      expect(entrypointSignal).toBeDefined()
      expect(entrypointSignal?.detail).toContain('workspace_NN.md')
    }
  })

  it('detects legacy entrypoint: overview-root *_base_NN.md (OVERVIEW_ROOT_RE)', async () => {
    const reader = createMemoryDomainReader({
      'Ghostbusters_V_0-1-0_base_NN.md': '---\nblueprint_version: "0.1.0"\n---\n# Overview\n',
      'kNNowledge/sample_NN.md': '---\nknowledge_version: "0.1.0"\n---\n',
    })
    const result = await detectLegacy(reader)
    expect(result.kind).toBe('legacy')
    if (result.kind === 'legacy') {
      const entrypointSignal = result.signals.find((s) => s.type === 'legacy-entrypoint')
      expect(entrypointSignal).toBeDefined()
      expect(entrypointSignal?.detail).toContain('Ghostbusters_V_0-1-0_base_NN.md')
    }
  })

  it('detects legacy folders: kNNowledge/ and specs/bluepriNNts/', async () => {
    const reader = createMemoryDomainReader({
      'workspace_NN.md': '---\nblueprint_version: "0.1.0"\n---\n',
      'kNNowledge/core_NN.md': '# Core\n',
      'specs/bluepriNNts/base/spec_NN.md': '# Base Spec\n',
    })
    const result = await detectLegacy(reader)
    expect(result.kind).toBe('legacy')
    if (result.kind === 'legacy') {
      const folderSignals = result.signals.filter((s) => s.type === 'legacy-folder')
      const details = folderSignals.map((s) => s.detail)
      expect(details.some((d) => d.includes('kNNowledge/'))).toBe(true)
      expect(details.some((d) => d.includes('specs/bluepriNNts/'))).toBe(true)
    }
  })

  it('detects legacy frontmatter keys (knowledge_version, blueprint_version, target_blueprint, etc.)', async () => {
    const reader = createMemoryDomainReader({
      'workspace_NN.md': '---\nblueprint_version: "0.1.0"\ntemplate_name: "domaiNN"\nmodels_dir: "models"\ntemplates_dir: "templates"\n---\n',
      'kNNowledge/item_NN.md': '---\nknowledge_version: "0.1.0"\n---\n',
    })
    const result = await detectLegacy(reader)
    expect(result.kind).toBe('legacy')
    if (result.kind === 'legacy') {
      const keySignals = result.signals.filter((s) => s.type === 'legacy-key')
      expect(keySignals.length).toBeGreaterThan(0)
    }
  })

  it('detects legacy keyword: type:: knowledge', async () => {
    const reader = createMemoryDomainReader({
      'workspace_NN.md': '---\nblueprint_version: "0.1.0"\n---\n',
      'specs/bluepriNNts/custom/spec_NN.md': '# Spec\n\n- Model Definition\n  - type:: knowledge\n',
    })
    const result = await detectLegacy(reader)
    expect(result.kind).toBe('legacy')
    if (result.kind === 'legacy') {
      const keywordSignal = result.signals.find((s) => s.type === 'legacy-keyword')
      expect(keywordSignal).toBeDefined()
      expect(keywordSignal?.detail).toContain('type:: knowledge')
    }
  })

  it('detects legacy parent_spec url containing /specs/bluepriNNts/', async () => {
    const reader = createMemoryDomainReader({
      'workspace_NN.md': '---\nblueprint_version: "0.1.0"\nparent_spec:\n  url: "https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/bluepriNNts/workspace/spec_NN.md"\n---\n',
    })
    const result = await detectLegacy(reader)
    expect(result.kind).toBe('legacy')
    if (result.kind === 'legacy') {
      const parentSignal = result.signals.find((s) => s.type === 'legacy-parent-spec')
      expect(parentSignal).toBeDefined()
      expect(parentSignal?.detail).toContain('/specs/bluepriNNts/')
    }
  })

  it('detects legacy L1 parent below V_0-3-0', async () => {
    const reader = createMemoryDomainReader({
      'workspace_NN.md': '---\nblueprint_version: "0.1.0"\nparent_spec:\n  url: "https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/iNNfo_V_0-2-2_NN.md"\n---\n',
    })
    const result = await detectLegacy(reader)
    expect(result.kind).toBe('legacy')
    if (result.kind === 'legacy') {
      const l1Signal = result.signals.find((s) => s.type === 'legacy-l1-parent')
      expect(l1Signal).toBeDefined()
    }
  })

  it('returns current for a canonical V_0-3-0 domain', async () => {
    const reader = createMemoryDomainReader({
      'domaiNN_NN.md': '---\nblueprint_version: "0.1.0"\nblueprint_name: "domaiNN"\nknowledge_dir: "kNNowledge"\nblueprints_dir: "specs/bluepriNNts"\nparent_spec:\n  url: "https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md"\n---\n# domaiNN\n',
      'kNNowledge/item_NN.md': '---\nknowledge_version: "0.1.0"\nblueprint_name: "domaiNN"\n---\n# Item\n',
      'specs/bluepriNNts/domaiNN/spec_NN.md': '---\nparent: "https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"\n---\n- Concept\n  - type:: knowledge\n',
    })
    const result = await detectLegacy(reader)
    expect(result.kind).toBe('current')
  })

  it('detects mixed domain when both legacy and canonical elements coexist', async () => {
    const reader = createMemoryDomainReader({
      'domaiNN_NN.md': '---\nblueprint_version: "0.1.0"\n---\n',
      'kNNowledge/legacy_NN.md': '---\nknowledge_version: "0.1.0"\n---\n',
      'kNNowledge/current_NN.md': '---\nknowledge_version: "0.1.0"\n---\n',
    })
    const result = await detectLegacy(reader)
    expect(result.kind).toBe('mixed')
    if (result.kind === 'mixed') {
      expect(result.signals.length).toBeGreaterThan(0)
      expect(result.hint).toContain('nn-upgrade')
    }
  })

  it('case-exact probe rejects mis-cased folders/files (e.g. knnowledge, Knowledge, Blueprints)', async () => {
    const reader = createMemoryDomainReader({
      'domaiNN_NN.md': '---\nblueprint_version: "0.1.0"\n---\n',
      'Knowledge/item_NN.md': '---\nknowledge_version: "0.1.0"\n---\n',
    })
    const result = await detectLegacy(reader)
    expect(result.kind).toBe('mixed')
    if (result.kind === 'mixed' || result.kind === 'legacy') {
      const caseSignal = result.signals.find((s) => s.type === 'case-mismatch')
      expect(caseSignal).toBeDefined()
      expect(caseSignal?.detail).toContain('Knowledge')
    }
  })
})
