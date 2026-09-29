import { describe, it, expect } from 'vitest'
import {
  DEFAULT_INNFO_VERSION,
  DEFAULT_TEMPLATE_VERSION,
  buildSpecificationUrl,
  buildTemplateUrl,
  buildSubmodelTemplateUrl,
} from '../../src/utils/constants'

/**
 * TDD gate for design.md D3 — the V_0-2-1 adoption of the editor's
 * single-source-of-truth version constants. `DEFAULT_TEMPLATE_VERSION`
 * stays a scalar scaffolding fallback (it names no template); the
 * per-template registry lives in `SHIPPED_TEMPLATE_VERSIONS`.
 */
describe('constants — V_0-3-0 adoption', () => {
  it('DEFAULT_INNFO_VERSION is the current L1 spec version V_0-3-0', () => {
    expect(DEFAULT_INNFO_VERSION).toBe('V_0-3-0')
  })

  it('buildSpecificationUrl() defaults to the V_0-3-0 L1 spec file', () => {
    expect(buildSpecificationUrl()).toMatch(/iNNfo_V_0-3-0_NN\.md$/)
  })

  it('DEFAULT_TEMPLATE_VERSION is the current scaffolding fallback V_0-2-0', () => {
    expect(DEFAULT_TEMPLATE_VERSION).toBe('V_0-2-0')
  })

  it('buildTemplateUrl() defaults to the V_0-2-0 template file', () => {
    expect(buildTemplateUrl('procedures')).toMatch(/procedures_V_0-2-0_NN\.md$/)
  })

  describe('buildSubmodelTemplateUrl', () => {
    it('accepts a bare template name and maps to the canonical spec_NN.md template URL', () => {
      expect(buildSubmodelTemplateUrl('business')).toBe(
        'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/spec_NN.md',
      )
    })

    it('honors an embedded template version suffix', () => {
      expect(buildSubmodelTemplateUrl('business_V_0-2-0')).toBe(
        'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/business/spec_NN.md',
      )
    })

    it('falls back to the versioned template URL for unknown templates', () => {
      expect(buildSubmodelTemplateUrl('acme-custom')).toBe(
        'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/acme-custom/acme-custom_V_0-2-0_NN.md',
      )
    })

    it('maps a version-suffixed known template to its canonical spec_NN.md URL', () => {
      expect(buildSubmodelTemplateUrl('procedures_V_0-2-0')).toBe(
        'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/templates/procedures/spec_NN.md',
      )
    })
  })
})
