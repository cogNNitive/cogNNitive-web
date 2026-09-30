import { describe, it, expect } from 'vitest'
import { parseKnowledge } from '../src/parser/index'
import { validateKnowledge } from '../src/validator/knowledge'
import type { SpecDocument } from '../src/types'

describe('Template Freshness Diagnostic in innfo-core validateKnowledge (Phase 1)', () => {
  const sampleModelContent = [
    '---',
    'spec_version: "V_0-2-0"',
    'level: 3',
    'knowledge_version: "V_0-1-0"',
    'title: "Freshness Test Model"',
    'parent_spec:',
    '  name: "business_V_0-2-0"',
    '  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/spec_NN.md"',
    '---',
    '',
    '# NN index',
    '* [[ConceptOne]]',
    '',
    '# NN ConceptOne',
    '## NN ConceptOne: Element1',
    '',
  ].join('\n')

  const localTemplateRawContent = [
    '---',
    'spec_version: "V_0-2-0"',
    'level: 2',
    'title: "Local Business Template"',
    '---',
    '# NN Concept Definition',
    '## NN Concept Definition: ConceptOne',
    'type:: text',
    '',
    '### ConceptOne',
    'Documentation for ConceptOne.',
    '',
  ].join('\n')

  const localTemplate: SpecDocument = {
    name: 'business_V_0-2-0',
    level: 2,
    frontmatter: {
      spec_version: 'V_0-2-0',
      level: 2,
      title: 'Local Business Template',
    },
    rawContent: localTemplateRawContent,
  }

  it('produces a ValidationCheck with code TEMPLATE_CACHE_STALE and promptHint when template mismatch is detected', () => {
    const model = parseKnowledge(sampleModelContent)
    const remoteUpstreamContent = localTemplateRawContent + '\n# Remote update with new features\n'

    const result = validateKnowledge(model, localTemplate, null, {
      checkFreshness: true,
      remoteContent: remoteUpstreamContent,
    })

    // ValidationCheck assertions
    expect(result.checks).toBeDefined()
    const stalenessCheck = result.checks?.find((c) => c.code === 'TEMPLATE_CACHE_STALE')
    expect(stalenessCheck).toBeDefined()
    expect(stalenessCheck?.category).toBe('governance')
    expect(stalenessCheck?.severity).toBe('warning')
    expect(stalenessCheck?.passed).toBe(false)
    expect(stalenessCheck?.promptHint).toBeDefined()
    expect(stalenessCheck?.promptHint).toContain('specs/')
    expect(stalenessCheck?.meta?.canonicalUrl).toBe(
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/business/spec_NN.md',
    )
    expect(stalenessCheck?.meta?.localHash).toBeDefined()
    expect(stalenessCheck?.meta?.remoteHash).toBeDefined()
    expect(stalenessCheck?.meta?.localHash).not.toEqual(stalenessCheck?.meta?.remoteHash)

    // Non-blocking warning assertions
    expect(result.valid).toBe(true)
    expect(result.summary?.errors).toBe(0)
    expect(result.summary?.warnings).toBeGreaterThanOrEqual(1)
  })

  it('verifies summary.errors remains 0 when template cache is stale (non-blocking warning)', () => {
    const model = parseKnowledge(sampleModelContent)
    const remoteUpstreamContent = localTemplateRawContent + '\n# Additional remote notes\n'

    const result = validateKnowledge(model, localTemplate, null, {
      checkFreshness: true,
      remoteContent: remoteUpstreamContent,
    })

    expect(result.summary?.errors).toBe(0)
    const errorChecks = result.checks?.filter((c) => c.severity === 'error' && !c.passed)
    expect(errorChecks).toHaveLength(0)
  })

  it('falls back gracefully without failing validation when network is offline/unreachable', () => {
    const model = parseKnowledge(sampleModelContent)

    // Simulate network error / offline fetch returning null or throwing
    const result = validateKnowledge(model, localTemplate, null, {
      checkFreshness: true,
      remoteContent: null,
      fetchRemoteBlueprint: () => {
        throw new Error('ENOTFOUND raw.githubusercontent.com')
      },
    })

    expect(result.valid).toBe(true)
    expect(result.summary?.errors).toBe(0)
    const stalenessCheck = result.checks?.find((c) => c.code === 'TEMPLATE_CACHE_STALE')
    expect(stalenessCheck).toBeUndefined()
  })

  it('emits no staleness warning when remote content matches local cached content', () => {
    const model = parseKnowledge(sampleModelContent)

    const result = validateKnowledge(model, localTemplate, null, {
      checkFreshness: true,
      remoteContent: localTemplateRawContent,
    })

    expect(result.valid).toBe(true)
    expect(result.summary?.errors).toBe(0)
    const stalenessWarning = result.warnings.find((w) => w.code === 'TEMPLATE_CACHE_STALE')
    expect(stalenessWarning).toBeUndefined()
    const stalenessCheck = result.checks?.find((c) => c.code === 'TEMPLATE_CACHE_STALE')
    expect(stalenessCheck).toBeUndefined()
  })

  it('supports explicit freshness result with verdict stale', () => {
    const model = parseKnowledge(sampleModelContent)

    const result = validateKnowledge(model, localTemplate, null, {
      checkFreshness: true,
      freshness: {
        verdict: 'stale',
        name: 'business_V_0-2-0',
        url: 'https://example.com/canonical.md',
        localHash: 'hash-local-123',
        remoteHash: 'hash-remote-456',
      },
    })

    expect(result.valid).toBe(true)
    expect(result.summary?.errors).toBe(0)
    expect(result.summary?.warnings).toBeGreaterThanOrEqual(1)
    expect(result.warnings.filter((w) => w.code === 'TEMPLATE_CACHE_STALE')).toHaveLength(1)
    const check = result.checks?.find((c) => c.code === 'TEMPLATE_CACHE_STALE')
    expect(check).toBeDefined()
    expect(check?.meta?.localHash).toBe('hash-local-123')
    expect(check?.meta?.remoteHash).toBe('hash-remote-456')
  })

  it('ignores freshness comparison when checkFreshness is false', () => {
    const model = parseKnowledge(sampleModelContent)
    const remoteUpstreamContent = localTemplateRawContent + '\n# Some remote diff\n'

    const result = validateKnowledge(model, localTemplate, null, {
      checkFreshness: false,
      remoteContent: remoteUpstreamContent,
    })

    expect(result.valid).toBe(true)
    expect(result.summary?.errors).toBe(0)
    expect(result.warnings.filter((w) => w.code === 'TEMPLATE_CACHE_STALE')).toHaveLength(0)
  })
})
