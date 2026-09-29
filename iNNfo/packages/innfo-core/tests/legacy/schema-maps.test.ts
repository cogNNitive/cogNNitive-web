import { describe, it, expect } from 'vitest'
import { getSchemaMap, applySchemaMap, type SchemaMap } from '../../src/legacy/schema-maps/index.js'

describe('schema-maps (Task 5.7)', () => {
  it('retrieves schema map for workspace blueprint', () => {
    const map = getSchemaMap('workspace')
    expect(map).toBeDefined()
    expect(map?.to.name).toBe('domaiNN')
    expect(map?.knowledgeBump).toBe('minor')
    expect(map?.from.canonicalConcepts).toContain('Workspace')
    expect(map?.from.canonicalConcepts).toContain('Models')
    expect(map?.from.canonicalConcepts).toContain('Templates')
  })

  it('renames only canonical concepts from canonicalConcepts, leaving custom headings untouched', () => {
    const map = getSchemaMap('workspace')!
    const content = `# Workspace\n\n- Custom Concept Heading\n  - custom_field:: value\n\n## Models\n\n## Templates\n`
    const { migratedContent, bumpedVersion } = applySchemaMap(content, map, '0.1.0')

    expect(migratedContent).toContain('# domaiNN')
    expect(migratedContent).toContain('## kNNowledge')
    expect(migratedContent).toContain('## bluepriNNts')
    expect(migratedContent).toContain('- Custom Concept Heading') // Untouched
    expect(bumpedVersion).toBe('0.2.0') // Minor bump for workspace
  })

  it('returns undefined for unmapped / custom blueprints', () => {
    const map = getSchemaMap('non_existent_custom_blueprint')
    expect(map).toBeUndefined()
  })
})
