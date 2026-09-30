import { describe, it, expect } from 'vitest'
import {
  slugify,
  deriveSuggestedSubmodelPath,
  type SuggestedSubmodelPathOptions,
} from '../../src/utils/submodelPath'

describe('submodelPath utility', () => {
  describe('slugify', () => {
    it('normalizes Unicode diacritics and accents', () => {
      expect(slugify('Iniciativas Estratégicas')).toBe('iniciativas-estrategicas')
      expect(slugify('José Luis Olmo Mora')).toBe('jose-luis-olmo-mora')
      expect(slugify('Área de I+D & Innovación')).toBe('area-de-id-innovacion')
    })

    it('lowercases and replaces spaces and underscores with hyphens', () => {
      expect(slugify('Projects')).toBe('projects')
      expect(slugify('Municipal Franchise Expansion')).toBe('municipal-franchise-expansion')
      expect(slugify('  __initiative_01__  ')).toBe('initiative-01')
      expect(slugify('some_field_name')).toBe('some-field-name')
    })

    it('removes special characters and symbols', () => {
      expect(slugify('C++ & Python / AI!')).toBe('c-python-ai')
      expect(slugify('Model (Level 3) [Draft]')).toBe('model-level-3-draft')
    })

    it('collapses multiple hyphens and trims boundary hyphens', () => {
      expect(slugify('---test---slug---')).toBe('test-slug')
      expect(slugify('a - - - b')).toBe('a-b')
    })

    it('handles empty, null, or undefined gracefully', () => {
      expect(slugify('')).toBe('')
      // @ts-expect-error test non-string runtime values
      expect(slugify(null)).toBe('')
      // @ts-expect-error test non-string runtime values
      expect(slugify(undefined)).toBe('')
    })
  })

  describe('deriveSuggestedSubmodelPath', () => {
    it('constructs hierarchical path for concept element with target template', () => {
      const path = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Company_V_0-1-0_NN.md',
        conceptSlug: 'Projects',
        elementSlug: 'Alpha',
        targetTemplate: 'business',
      })
      expect(path).toBe('kNNowledge/Company_V_0-1-0/projects/alpha/business_01.md')
    })

    it('generates distinct non-colliding paths for sibling elements under same concept', () => {
      const alphaPath = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Company_V_0-1-0_NN.md',
        conceptSlug: 'Projects',
        elementSlug: 'Alpha',
        targetTemplate: 'business',
      })
      const betaPath = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Company_V_0-1-0_NN.md',
        conceptSlug: 'Projects',
        elementSlug: 'Beta',
        targetTemplate: 'business',
      })
      expect(alphaPath).toBe('kNNowledge/Company_V_0-1-0/projects/alpha/business_01.md')
      expect(betaPath).toBe('kNNowledge/Company_V_0-1-0/projects/beta/business_01.md')
      expect(alphaPath).not.toBe(betaPath)
    })

    it('resolves parent stem with versioned template suffix', () => {
      const path = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Ghostbusters_V_0-2-0_innovation_NN.md',
        conceptSlug: 'initiatives',
        elementSlug: 'initiative-01',
        targetTemplate: 'business',
      })
      expect(path).toBe('kNNowledge/Ghostbusters_V_0-2-0/initiatives/initiative-01/business_01.md')
    })

    it('resolves parent stem with simple _NN.md suffix', () => {
      const path = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Company_NN.md',
        conceptSlug: 'Projects',
        elementSlug: 'Alpha',
        targetTemplate: 'business',
      })
      expect(path).toBe('kNNowledge/Company/projects/alpha/business_01.md')
    })

    it('resolves leaf stem fallback precedence: targetTemplate (if not base) -> fieldName -> submodel', () => {
      // 1. targetTemplate != base
      const path1 = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Company_NN.md',
        conceptSlug: 'Projects',
        elementSlug: 'Alpha',
        fieldName: 'custom_field',
        targetTemplate: 'architecture',
      })
      expect(path1).toBe('kNNowledge/Company/projects/alpha/architecture_01.md')

      // 2. targetTemplate == base, falls back to fieldName
      const path2 = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Company_NN.md',
        conceptSlug: 'Projects',
        elementSlug: 'Alpha',
        fieldName: 'architecture_model',
        targetTemplate: 'base',
      })
      expect(path2).toBe('kNNowledge/Company/projects/alpha/architecture-model_01.md')

      // 3. no targetTemplate, falls back to fieldName
      const path3 = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Company_NN.md',
        conceptSlug: 'Projects',
        elementSlug: 'Alpha',
        fieldName: 'my_submodel',
      })
      expect(path3).toBe('kNNowledge/Company/projects/alpha/my-submodel_01.md')

      // 4. no targetTemplate and no fieldName, defaults to 'submodel'
      const path4 = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Company_NN.md',
        conceptSlug: 'Projects',
        elementSlug: 'Alpha',
      })
      expect(path4).toBe('kNNowledge/Company/projects/alpha/submodel_01.md')
    })

    it('constructs partial hierarchy when only elementSlug is present', () => {
      const path = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Company_NN.md',
        elementSlug: 'Alpha',
        targetTemplate: 'business',
      })
      expect(path).toBe('kNNowledge/Company/alpha/business_01.md')
    })

    it('falls back to flat path when concept and element context are missing', () => {
      const path = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/System_NN.md',
        targetTemplate: 'architecture',
      })
      expect(path).toBe('kNNowledge/System_architecture_01.md')

      const versionedPath = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Ghostbusters_V_0-2-0_innovation_NN.md',
        targetTemplate: 'business',
      })
      expect(versionedPath).toBe('kNNowledge/Ghostbusters_V_0-2-0_business_01.md')
    })

    it('preserves path directory prefixes or lack thereof', () => {
      const noDir = deriveSuggestedSubmodelPath({
        parentPath: 'System_NN.md',
        targetTemplate: 'architecture',
      })
      expect(noDir).toBe('System_architecture_01.md')

      const deepDir = deriveSuggestedSubmodelPath({
        parentPath: 'workspace/kNNowledge/sub/System_NN.md',
        conceptSlug: 'nodes',
        elementSlug: 'gateway',
        targetTemplate: 'architecture',
      })
      expect(deepDir).toBe('workspace/kNNowledge/sub/System/nodes/gateway/architecture_01.md')
    })

    it('strips the embedded template version from the leaf stem', () => {
      const path = deriveSuggestedSubmodelPath({
        parentPath: 'kNNowledge/Company_V_0-1-0_innovation_NN.md',
        conceptSlug: 'Patente',
        elementSlug: 'Sombrero paraguas',
        targetTemplate: 'business_V_0-2-0',
      })
      expect(path).toBe('kNNowledge/Company_V_0-1-0/patente/sombrero-paraguas/business_01.md')
    })
  })
})
