import { describe, it, expect } from 'vitest'
import {
  CANONICAL_KNOWLEDGE_DIR,
  CANONICAL_BLUEPRINTS_DIR,
  CANONICAL_DOMAIN_ENTRYPOINT,
  CANONICAL_GLOBAL_BLUEPRINTS_DIR,
  isExactKnowledgeDir,
  isExactBlueprintsDir,
  isExactDomainEntrypoint,
  verifyCaseExactLayout,
} from '../src/layout.js'

describe('layout module & constants (Task 7.2)', () => {
  it('exports canonical constants with exact casing', () => {
    expect(CANONICAL_KNOWLEDGE_DIR).toBe('kNNowledge')
    expect(CANONICAL_BLUEPRINTS_DIR).toBe('specs/bluepriNNts')
    expect(CANONICAL_DOMAIN_ENTRYPOINT).toBe('domaiNN_NN.md')
    expect(CANONICAL_GLOBAL_BLUEPRINTS_DIR).toBe('~/.agents/bluepriNNts')
  })

  it('case-exact validators accept exact casing and reject mis-cased names', () => {
    expect(isExactKnowledgeDir('kNNowledge')).toBe(true)
    expect(isExactKnowledgeDir('knowledge')).toBe(false)
    expect(isExactKnowledgeDir('Knowledge')).toBe(false)
    expect(isExactKnowledgeDir('knnowledge')).toBe(false)

    expect(isExactBlueprintsDir('bluepriNNts')).toBe(true)
    expect(isExactBlueprintsDir('blueprints')).toBe(false)
    expect(isExactBlueprintsDir('Blueprints')).toBe(false)
    expect(isExactBlueprintsDir('bluepriNts')).toBe(false)

    expect(isExactDomainEntrypoint('domaiNN_NN.md')).toBe(true)
    expect(isExactDomainEntrypoint('domainn_nn.md')).toBe(false)
    expect(isExactDomainEntrypoint('domainn_NN.md')).toBe(false)
    expect(isExactDomainEntrypoint('workspace_NN.md')).toBe(false)
  })

  it('verifyCaseExactLayout returns errors for mis-cased items', () => {
    const valid = verifyCaseExactLayout(['domaiNN_NN.md', 'kNNowledge', 'specs'])
    expect(valid.errors).toHaveLength(0)

    const invalid = verifyCaseExactLayout(['domainn_nn.md', 'Knowledge', 'specs'])
    expect(invalid.errors.length).toBeGreaterThan(0)
    expect(invalid.errors.some((e) => e.includes('Knowledge'))).toBe(true)
    expect(invalid.errors.some((e) => e.includes('domainn_nn.md'))).toBe(true)
  })
})
