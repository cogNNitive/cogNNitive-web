import { describe, it, expect } from 'vitest'
import { validateKnowledge, parseKnowledge } from './index.js'
import type { SpecDocument } from './types/index.js'

describe('Validator Composition Collision Diagnostic Reporting (validator.spec.ts)', () => {
  it('surfaces [COMPOSITION_COLLISION] errors when validating a model against a composite template', () => {
    const baseA = `---
level: 2
title: "Base A"
---

# NN Concept Definition
## NN Concept Definition: Task
type:: list
`

    const baseB = `---
level: 2
title: "Base B"
---

# NN Concept Definition
## NN Concept Definition: Task
type:: text
`

    const compositeTplContent = `---
level: 2
title: "Composite Template"
includes:
  - name: "base_a"
    url: "https://example.com/base_a.md"
  - name: "base_b"
    url: "https://example.com/base_b.md"
---
`

    const modelContent = `---
level: 3
knowledge_version: "V_1-0-0"
title: "Sample Model"
parent_spec:
  name: "composite_tpl"
  url: "https://example.com/composite_tpl.md"
---

# NN index
* [[Task]]

## NN Task: T1
`

    const parsedModel = parseKnowledge(modelContent)
    const compositeDoc: SpecDocument = {
      name: 'composite_tpl',
      level: 2,
      rawContent: compositeTplContent,
      frontmatter: {
        level: 2,
        spec_version: 'V_0-2-0',
        spec_url: 'https://example.com/composite_tpl.md',
      },
    }

    const result = validateKnowledge(parsedModel, compositeDoc, null, (ref) => {
      if (ref.name === 'base_a') return baseA
      if (ref.name === 'base_b') return baseB
      return null
    })

    expect(result.valid).toBe(false)
    const collisionErr = result.errors.find((e) => e.message.includes('[COMPOSITION_COLLISION]'))
    expect(collisionErr).toBeDefined()
    expect(collisionErr?.message).toMatch(/Task/)
    expect(collisionErr?.message).toMatch(/Base A/)
    expect(collisionErr?.message).toMatch(/Base B/)
  })

  it('validates successfully when concept collisions are resolved using explicit frontmatter alias', () => {
    const baseA = `---
level: 2
title: "Base A"
---

# NN Concept Definition
## NN Concept Definition: Task
type:: list
`

    const baseB = `---
level: 2
title: "Base B"
---

# NN Concept Definition
## NN Concept Definition: Task
type:: list
`

    const compositeTplContent = `---
level: 2
title: "Composite Template"
includes:
  - name: "base_a"
    url: "https://example.com/base_a.md"
    alias:
      concepts:
        "Task": "BusinessTask"
  - name: "base_b"
    url: "https://example.com/base_b.md"
    alias:
      concepts:
        "Task": "ProjectTask"
---
`

    const modelContent = `---
level: 3
knowledge_version: "V_1-0-0"
title: "Sample Model"
parent_spec:
  name: "composite_tpl"
  url: "https://example.com/composite_tpl.md"
---

# NN index
* [[BusinessTask]]
* [[ProjectTask]]

## NN BusinessTask: BT1

## NN ProjectTask: PT1
`

    const parsedModel = parseKnowledge(modelContent)
    const compositeDoc: SpecDocument = {
      name: 'composite_tpl',
      level: 2,
      rawContent: compositeTplContent,
      frontmatter: {
        level: 2,
        spec_version: 'V_0-2-0',
        spec_url: 'https://example.com/composite_tpl.md',
      },
    }

    const result = validateKnowledge(parsedModel, compositeDoc, null, (ref) => {
      if (ref.name === 'base_a') return baseA
      if (ref.name === 'base_b') return baseB
      return null
    })

    const collisionErr = result.errors.find((e) => e.message.includes('[COMPOSITION_COLLISION]'))
    expect(collisionErr).toBeUndefined()
    expect(result.valid).toBe(true)
  })
})
