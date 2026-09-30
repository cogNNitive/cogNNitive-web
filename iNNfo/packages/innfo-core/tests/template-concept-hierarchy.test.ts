import { describe, expect, it } from 'vitest'
import { extractTemplateSchemaFromContent } from '../src/schema'
import { validateFormatContent, validateTaxonomyHierarchy } from '../src/validator'
import { parseModel } from '../src/parser'
import type { Concept, TaxonomyEdge } from '../src/types'

describe('Template Concept Hierarchy via parent:: field', () => {
  describe('extractTemplateSchema', () => {
    it('extracts parent field and constructs taxonomy dynamically from concept definitions', () => {
      const templateContent = `---
title: Sample Hierarchy Template
level: 2
spec_version: V_0-1-0
---

# NN Concept Definition
## NN Concept Definition: Solutions
type:: category
weight:: 10

# NN Concept Definition
## NN Concept Definition: Offerings
parent:: [[Solutions]]
type:: text
weight:: 20

# NN Concept Definition
## NN Concept Definition: Features
parent:: Offerings
type:: text
weight:: 30
`
      const schema = extractTemplateSchemaFromContent(templateContent)

      expect(schema.concepts).toHaveLength(3)
      const solutions = schema.concepts.find((c) => c.name === 'Solutions')
      const offerings = schema.concepts.find((c) => c.name === 'Offerings')
      const features = schema.concepts.find((c) => c.name === 'Features')

      expect(solutions?.parent).toBeUndefined()
      expect(offerings?.parent).toBe('Solutions')
      expect(features?.parent).toBe('Offerings')

      expect(schema.taxonomy).toEqual([
        { parent: '', child: 'Solutions' },
        { parent: 'Solutions', child: 'Offerings' },
        { parent: 'Offerings', child: 'Features' },
      ])
    })

    it('falls back to # NN index taxonomy when concepts do not declare parent::', () => {
      const legacyTemplate = `---
title: Legacy Template
level: 2
spec_version: V_0-1-0
---

# NN index
* [[Market]]
  * [[Segments]]

# NN Concept Definition
## NN Concept Definition: Market
type:: category

# NN Concept Definition
## NN Concept Definition: Segments
type:: text
`
      const schema = extractTemplateSchemaFromContent(legacyTemplate)

      expect(schema.concepts.every((c) => c.parent === undefined)).toBe(true)
      expect(schema.taxonomy).toEqual([
        { parent: '', child: 'Market' },
        { parent: 'Market', child: 'Segments' },
      ])
    })
  })

  describe('Validation: template parent integrity and cycle detection', () => {
    it('flags error when a concept references a non-existent parent', () => {
      const invalidTemplate = `---
title: Broken Template
level: 2
spec_version: V_0-1-0
---

# NN Concept Definition
## NN Concept Definition: Offerings
parent:: [[NonExistent]]
type:: text
`
      const report = validateFormatContent(invalidTemplate, 'Broken_V_0-1-0_spec_NN.md')
      const error = report.checks.find((c) => c.id === 'template-parent-not-found')

      expect(error).toBeDefined()
      expect(error?.passed).toBe(false)
      expect(error?.severity).toBe('error')
      expect(error?.message).toContain('NonExistent')
    })

    it('flags error when circular taxonomy is detected in template concepts', () => {
      const circularTemplate = `---
title: Circular Template
level: 2
spec_version: V_0-1-0
---

# NN Concept Definition
## NN Concept Definition: Alpha
parent:: [[Beta]]
type:: text

# NN Concept Definition
## NN Concept Definition: Beta
parent:: [[Alpha]]
type:: text
`
      const report = validateFormatContent(circularTemplate, 'Circular_V_0-1-0_spec_NN.md')
      const error = report.checks.find((c) => c.id === 'template-parent-cycle')

      expect(error).toBeDefined()
      expect(error?.passed).toBe(false)
      expect(error?.severity).toBe('error')
      expect(error?.message).toContain('Circular taxonomy detected')
    })

    it('passes without warning when a Level 2 template uses parent:: without an # NN index', () => {
      const validTemplate = `---
title: Modern Template
level: 2
spec_version: V_0-1-0
---

> [!NOTE]
> Document notice

# NN Concept Definition
## NN Concept Definition: Core
type:: category

# NN Concept Definition
## NN Concept Definition: Sub
parent:: [[Core]]
type:: text
`
      const report = validateFormatContent(validTemplate, 'Modern_V_0-1-0_spec_NN.md')
      const indexCheck = report.checks.find((c) => c.id === 'body-index')
      expect(indexCheck?.passed).toBe(true)
    })
  })

  describe('Validation: Level 3 model taxonomy enforcement', () => {
    it('emits warning when a Level 3 model declares an # NN index block', () => {
      const level3WithIndex = `---
title: My Model
level: 3
knowledge_version: V_1-0-0
spec_version: V_0-1-0
parent_spec:
  name: Business
  url: specs/business_V_0-1-0_NN.md
---

> [!NOTE]
> Instance model

# NN index
* [[Market]]
  * [[Competitors]]

# NN Market
## NN Market: Main
description:: text
`
      const report = validateFormatContent(level3WithIndex, 'MyModel_V_1-0-0_business_NN.md')
      const warning = report.checks.find((c) => c.id === 'l3-index-ignored')

      expect(warning).toBeDefined()
      expect(warning?.passed).toBe(false)
      expect(warning?.severity).toBe('warning')
      expect(warning?.message).toContain('owned by the parent template')
    })

    it('validateTaxonomyHierarchy prioritizes templateTaxonomy over model.taxonomy', () => {
      // Model index claims Features is child of Market (wrong hierarchy)
      const modelContent = `---
title: Test Model
level: 3
knowledge_version: V_1-0-0
---

# NN index
* [[Market]]
  * [[Features]]

# NN Solutions
## NN Solutions: CloudApp
description:: Our app

# NN Features
## NN Features: Auth
parent_component:: [[CloudApp]]
`
      const parsedModel = parseModel(modelContent)
      const templateConcepts: Concept[] = [
        { name: 'Solutions', type: 'category' },
        { name: 'Features', type: 'text', fields: [{ name: 'parent_component', type: 'reference' }] },
      ]
      // Template taxonomy says Features is child of Solutions
      const templateTaxonomy: TaxonomyEdge[] = [
        { parent: '', child: 'Solutions' },
        { parent: 'Solutions', child: 'Features' },
      ]

      // When templateTaxonomy is passed, it should recognize CloudApp (in Solutions)
      // as consistent with Features' parent concept (Solutions)
      const diagnostics = validateTaxonomyHierarchy(parsedModel, templateConcepts, templateTaxonomy)
      expect(diagnostics).toHaveLength(0)
    })
  })
})
