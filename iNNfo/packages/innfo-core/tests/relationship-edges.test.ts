import { describe, it, expect } from 'vitest'
import { normalizeSingleModel } from '../src/recursiveParser/model'

describe('Relationship Edges & Origins (relationship-types)', () => {
  it('R1 & R2: tags matrix relationships with origin: "matrix"', () => {
    const md = `---
spec_version: "V_0-1-2"
level: 3
knowledge_version: "V_0-0-1"
title: "Matrix Test"
---

# NN Concept Definition
## NN Concept Definition: Task
type:: text

# NN Task
## NN Task: Review
description:: Initial review

# NN Task
## NN Task: Approve
description:: Final approval

# NN matrices: Dependencies
| Task | Review | Approve |
|------|--------|---------|
| Review | - | blocks |
| Approve | - | - |
`
    const { nodes, issues } = normalizeSingleModel(md, 'test_NN.md', 'test')
    expect(issues).toHaveLength(0)

    const reviewNode = Object.values(nodes).find((n) => n.name === 'Review')
    expect(reviewNode).toBeDefined()
    expect(reviewNode!.relationships).toHaveLength(1)
    expect(reviewNode!.relationships.every((r) => r.origin === 'matrix')).toBe(true)
    const approveRel = reviewNode!.relationships.find((r) => r.label === 'Dependencies' && r.value === 'blocks')
    expect(approveRel).toEqual({
      targetId: Object.values(nodes).find((n) => n.name === 'Approve')!.id,
      label: 'Dependencies',
      value: 'blocks',
      origin: 'matrix',
    })

    const approveNode = Object.values(nodes).find((n) => n.name === 'Approve')
    expect(approveNode).toBeDefined()
    expect(approveNode!.relationships).toHaveLength(0)
  })

  it('R3: derives field edges from reference fields and inline wikilinks', () => {
    const md = `---
spec_version: "V_0-1-2"
level: 3
knowledge_version: "V_0-0-1"
title: "Field Test"
---

# NN Concept Definition
## NN Concept Definition: Task
type:: text

# NN Field Definition
## NN Field Definition: depends_on
concept:: Task
type:: reference

# NN Task
## NN Task: Alpha
description:: Task Alpha

# NN Task
## NN Task: Beta
depends_on:: Alpha
note:: Follows [[Alpha]]

# NN Task
## NN Task: Gamma
depends_on:: [[Alpha]]
`
    const { nodes } = normalizeSingleModel(md, 'test_NN.md', 'test')

    const alpha = Object.values(nodes).find((n) => n.name === 'Alpha')!
    const beta = Object.values(nodes).find((n) => n.name === 'Beta')!
    const gamma = Object.values(nodes).find((n) => n.name === 'Gamma')!

    // Beta has: depends_on (bare 'Alpha') + note ('[[Alpha]]') -> both origin: 'field'
    expect(beta.relationships).toHaveLength(2)
    expect(beta.relationships).toContainEqual({
      targetId: alpha.id,
      label: 'depends_on',
      origin: 'field',
      value: undefined,
    })
    expect(beta.relationships).toContainEqual({
      targetId: alpha.id,
      label: 'note',
      origin: 'field',
      value: undefined,
    })

    // Gamma has: depends_on ('[[Alpha]]') -> origin: 'field'
    expect(gamma.relationships).toHaveLength(1)
    expect(gamma.relationships[0]).toEqual({
      targetId: alpha.id,
      label: 'depends_on',
      origin: 'field',
      value: undefined,
    })
  })

  it('R4: derives mention edges from element description and root description', () => {
    const md = `---
spec_version: "V_0-1-2"
level: 3
knowledge_version: "V_0-0-1"
title: "Mention Test"
---

# NN Concept Definition
## NN Concept Definition: Item
type:: text

# NN description
Workspace references [[First Item]] in its overview.

# NN Item
## NN Item: First Item
description:: The first element

# NN Item
## NN Item: Second Item
description:: See details in [[First Item]] for guidance.
`
    const { nodes } = normalizeSingleModel(md, 'test_NN.md', 'test')

    const first = Object.values(nodes).find((n) => n.name === 'First Item')!
    const second = Object.values(nodes).find((n) => n.name === 'Second Item')!
    const root = Object.values(nodes).find((n) => n.parentId === null)!

    // Second Item has mention edge to First Item
    expect(second.relationships).toContainEqual({
      targetId: first.id,
      label: 'mentions',
      origin: 'mention',
      value: undefined,
    })

    // Root node has mention edge to First Item
    expect(root.relationships).toContainEqual({
      targetId: first.id,
      label: 'mentions',
      origin: 'mention',
      value: undefined,
    })
  })

  it('R5: resolves targets case-insensitively', () => {
    const md = `---
spec_version: "V_0-1-2"
level: 3
knowledge_version: "V_0-0-1"
title: "Case Insensitive Test"
---

# NN Concept Definition
## NN Concept Definition: Item
type:: text

# NN Item
## NN Item: Passport
description:: Valid passport

# NN Item
## NN Item: Visa
note:: Requires [[passport]]
`
    const { nodes } = normalizeSingleModel(md, 'test_NN.md', 'test')

    const passport = Object.values(nodes).find((n) => n.name === 'Passport')!
    const visa = Object.values(nodes).find((n) => n.name === 'Visa')!

    expect(visa.relationships).toContainEqual({
      targetId: passport.id,
      label: 'note',
      origin: 'field',
      value: undefined,
    })
  })

  it('R6: skips dangling wikilinks and emits non-fatal warning issues', () => {
    const md = `---
spec_version: "V_0-1-2"
level: 3
knowledge_version: "V_0-0-1"
title: "Dangling Test"
---

# NN Concept Definition
## NN Concept Definition: Item
type:: text

# NN Item
## NN Item: Alpha
description:: Mentions [[NonExistentTarget]] and [[see [[Nested]] here]]
`
    const { nodes, issues } = normalizeSingleModel(md, 'model_NN.md', 'model')

    const alpha = Object.values(nodes).find((n) => n.name === 'Alpha')!
    expect(alpha.relationships).toHaveLength(0)

    // Check issues emitted
    const warnings = issues.filter((i) => i.path === 'model_NN.md#Alpha')
    expect(warnings.length).toBeGreaterThanOrEqual(1)
    expect(warnings.every((w) => w.severity === 'warning')).toBe(true)
  })

  it('R7: skips empty wikilinks silently without errors or edges', () => {
    const md = `---
spec_version: "V_0-1-2"
level: 3
knowledge_version: "V_0-0-1"
title: "Empty Wikilinks Test"
---

# NN Concept Definition
## NN Concept Definition: Item
type:: text

# NN Item
## NN Item: Alpha
note:: Text with [[]] and [[   ]] empty targets
description:: Clean text [[]]
`
    const { nodes, issues } = normalizeSingleModel(md, 'test_NN.md', 'test')

    const alpha = Object.values(nodes).find((n) => n.name === 'Alpha')!
    expect(alpha.relationships).toHaveLength(0)
    expect(issues).toHaveLength(0)
  })

  it('R8: deduplicates identical edges while keeping parallel origins', () => {
    const md = `---
spec_version: "V_0-1-2"
level: 3
knowledge_version: "V_0-0-1"
title: "Dedup Test"
---

# NN Concept Definition
## NN Concept Definition: Item
type:: text

# NN Item
## NN Item: Target

# NN Item
## NN Item: Source
fieldA:: [[Target]] and [[Target]]
description:: Also refers to [[Target]]

# NN matrices: Relations
| Item | Target |
|------|--------|
| Source | linked |
`
    const { nodes } = normalizeSingleModel(md, 'test_NN.md', 'test')

    const source = Object.values(nodes).find((n) => n.name === 'Source')!
    const target = Object.values(nodes).find((n) => n.name === 'Target')!

    // Source should have exactly 3 parallel relationships to Target (matrix, field, mention)
    expect(source.relationships).toHaveLength(3)

    const matrixRel = source.relationships.find((r) => r.origin === 'matrix')
    const fieldRel = source.relationships.find((r) => r.origin === 'field')
    const mentionRel = source.relationships.find((r) => r.origin === 'mention')

    expect(matrixRel).toEqual({
      targetId: target.id,
      label: 'Relations',
      value: 'linked',
      origin: 'matrix',
    })
    expect(fieldRel).toEqual({
      targetId: target.id,
      label: 'fieldA',
      value: undefined,
      origin: 'field',
    })
    expect(mentionRel).toEqual({
      targetId: target.id,
      label: 'mentions',
      value: undefined,
      origin: 'mention',
    })
  })

  it('R9: tags frontmatter graph_edges with origin: "graph_edge"', () => {
    const md = `---
spec_version: "V_0-1-2"
level: 3
knowledge_version: "V_0-0-1"
title: "Graph Edge Test"
graph_edges:
  - target: "TargetDoc"
    label: "depends"
    weight: 5
---

# NN Concept Definition
## NN Concept Definition: Item
type:: text

# NN Item
## NN Item: Dummy
`
    const { nodes } = normalizeSingleModel(md, 'source_NN.md', 'source')

    const root = Object.values(nodes).find((n) => n.parentId === null)!
    expect(root.relationships).toHaveLength(1)
    expect(root.relationships[0]).toEqual({
      targetId: 'source_NN.md/TargetDoc',
      label: 'depends',
      value: 5,
      origin: 'graph_edge',
    })
  })
})
