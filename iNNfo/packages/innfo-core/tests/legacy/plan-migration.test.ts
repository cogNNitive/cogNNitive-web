import { describe, it, expect } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import {
  planMigration,
  type DomainReader,
  type PlanDeps,
  type Problem,
  type MigratedTree,
} from '../../src/legacy/index.js'

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

describe('planMigration (Task 5.6)', () => {
  const stubDeps: PlanDeps = {
    targets: {
      domaiNN: {
        version: '0.1.0',
        spec: '# domaiNN Spec\n',
      },
    },
    validate(_tree: MigratedTree, _targets: PlanDeps['targets']): Problem[] {
      return []
    },
  }

  it('returns noop on an already migrated canonical domain', async () => {
    const reader = createMemoryDomainReader({
      'domaiNN_NN.md': '---\nblueprint_version: "0.1.0"\nblueprint_name: "domaiNN"\nknowledge_dir: "kNNowledge"\nblueprints_dir: "specs/bluepriNNts"\nparent_spec:\n  url: "https://raw.githubusercontent.com/cognnitive/innfo/main/iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md"\n---\n# domaiNN\n',
      'kNNowledge/item_NN.md': '---\nknowledge_version: "0.1.0"\nblueprint_name: "domaiNN"\n---\n# Item\n',
    })

    const result = await planMigration(reader, stubDeps)
    expect(result.status).toBe('noop')
    expect(result.ops).toHaveLength(0)
    expect(result.planHash).toBeDefined()
  })

  it('yields stable planHash across repeated runs on same input', async () => {
    const files = {
      'workspace_NN.md': '---\ntemplate_version: "0.1.0"\ntemplate_name: "workspace"\n---\n# Workspace\n',
      'models/sample_NN.md': '---\nmodel_version: "0.1.0"\n---\n# Sample\n',
    }
    const reader1 = createMemoryDomainReader(files)
    const reader2 = createMemoryDomainReader(files)

    const plan1 = await planMigration(reader1, stubDeps)
    const plan2 = await planMigration(reader2, stubDeps)

    expect(plan1.status).toBe('ready')
    expect(plan2.status).toBe('ready')
    expect(plan1.planHash).toBe(plan2.planHash)
  })

  it('returns status: blocked on invalid/malformed frontmatter', async () => {
    const reader = createMemoryDomainReader({
      'workspace_NN.md': '---invalid: [yaml: "broken\n---\n# Broken\n',
      'models/item_NN.md': '---\nmodel_version: "0.1.0"\n---\n',
    })

    const result = await planMigration(reader, stubDeps)
    expect(result.status).toBe('blocked')
    expect(result.problems.length).toBeGreaterThan(0)
    expect(result.problems.some((p) => p.severity === 'error')).toBe(true)
  })

  it('preserves custom headings on blueprints with no schema map (passthrough)', async () => {
    const reader = createMemoryDomainReader({
      'workspace_NN.md': '---\ntemplate_version: "0.1.0"\n---\n# Workspace\n',
      'models/custom_NN.md': '---\nmodel_version: "0.1.0"\nblueprint_name: "custom_app"\n---\n# Custom Heading Never Renamed\n\n- Custom Field:: value\n',
    })

    const result = await planMigration(reader, stubDeps)
    expect(result.status).toBe('ready')
    const customWrite = result.ops.find((op) => op.op === 'write' && op.path === 'kNNowledge/custom_NN.md')
    expect(customWrite).toBeDefined()
    if (customWrite && customWrite.op === 'write') {
      expect(customWrite.content).toContain('# Custom Heading Never Renamed')
      expect(customWrite.content).toContain('- Custom Field:: value')
      expect(customWrite.content).toContain('knowledge_version: "0.1.0"') // version value unchanged
    }
    expect(result.report.customBlueprints).toContain('custom_app')
  })
})
