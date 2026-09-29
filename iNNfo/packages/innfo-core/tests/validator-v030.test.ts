import { describe, it, expect } from 'vitest'
import { parseModel, serializeModel } from '../src/parser/index.js'
import { extractTemplateSchema, extractTemplateSchemaFromContent } from '../src/schema/index.js'
import { validateFormatContent } from '../src/validator/content.js'
import { validateModel } from '../src/validator/model.js'

describe('Task 7.5: V_0-3-0 Language Validator and Parser Tests', () => {
  it('parses ConceptField.target_blueprint and type:: knowledge from Level 2 blueprint', () => {
    const bpContent = `---
spec_version: "V_0-3-0"
level: 2
blueprint_version: "0.1.0"
title: "Custom Domain Blueprint"
---

# NN Concept Definition
## NN Concept Definition: CoreEngine
type:: knowledge

# NN Field Definition
## NN Field Definition: engine_ref
concept:: CoreEngine
type:: knowledge
target_blueprint:: business_V_0-2-0
`
    const schema = extractTemplateSchemaFromContent(bpContent)
    expect(schema.concepts).toHaveLength(1)
    expect(schema.concepts[0].type).toBe('knowledge')
    expect(schema.concepts[0].fields).toHaveLength(1)
    expect(schema.concepts[0].fields![0].name).toBe('engine_ref')
    expect(schema.concepts[0].fields![0].type).toBe('knowledge')
    expect(schema.concepts[0].fields![0].target_blueprint).toBe('business_V_0-2-0')
  })

  it('validates a valid V_0-3-0 Level 3 kNNowledge document cleanly', () => {
    const docContent = `---
spec_version: "V_0-3-0"
level: 3
knowledge_version: "0.1.0"
parent_spec:
  name: "domaiNN_V_0-1-0_NN.md"
  url: "https://cognnitive.com/innfo/specs/bluepriNNts/domaiNN/V_0-1-0/spec_NN.md"
title: "Valid Knowledge Document"
---

> [!NOTE]
> This is an **iNNfo document**.

# NN domaiNN
## NN domaiNN: Main
path:: kNNowledge/core.md
`
    const report = validateFormatContent(docContent, 'main_NN.md')
    const errors = report.checks.filter((c) => !c.passed && c.severity === 'error')
    expect(errors).toHaveLength(0)
  })

  it('fails validation when V_0-3-0 document carries legacy key model_version instead of knowledge_version', () => {
    const legacyDoc = `---
spec_version: "V_0-3-0"
level: 3
model_version: "0.1.0"
parent_spec:
  name: "domaiNN_V_0-1-0_NN.md"
  url: "https://cognnitive.com/innfo/specs/bluepriNNts/domaiNN/V_0-1-0/spec_NN.md"
title: "Legacy Key Document"
---

# NN domaiNN
## NN domaiNN: Main
`
    const report = validateFormatContent(legacyDoc, 'main_NN.md')
    const versionCheck = report.checks.find((c) => c.id === 'fm-version' || c.id === 'fm-legacy-key')
    expect(versionCheck?.passed).toBe(false)
  })

  it('fails validation when blueprint carries retired keyword type:: model', () => {
    const legacyBp = `---
spec_version: "V_0-3-0"
level: 2
blueprint_version: "0.1.0"
title: "Legacy Keyword Blueprint"
---

# NN Concept Definition
## NN Concept Definition: OldEngine
type:: model
`
    const report = validateFormatContent(legacyBp, 'legacy_bp_NN.md')
    // In V_0-3-0, type:: model is retired
    const hasError = report.checks.some((c) => !c.passed && (c.message?.includes('model') || c.id.includes('type') || c.severity === 'error'))
    expect(hasError).toBe(true)
  })

  it('serializes a model with knowledge_version and no legacy keys', () => {
    const parsed = parseModel(`---
spec_version: "V_0-3-0"
level: 3
knowledge_version: "0.1.0"
parent_spec:
  name: "domaiNN_V_0-1-0_NN.md"
  url: "https://example.com"
title: "Serialized Knowledge"
---

# NN domaiNN
## NN domaiNN: Alpha
`)
    // Mutate title to force constructed serialization
    parsed.frontmatter.title = 'Mutated Knowledge'
    const serialized = serializeModel(parsed)
    expect(serialized).toContain('knowledge_version: "0.1.0"')
    expect(serialized).not.toContain('model_version:')
    expect(serialized).not.toContain('target_template:')
  })
})
