import { describe, it, expect } from 'vitest'
import { recursiveParse } from '../../src/model/recursiveParser'
import { buildFakeTree, type FakeTree } from '../helpers/fakeFs'

const validModelMd = `---
spec_version: "V_0-3-0"
spec_url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
level: 3
parent_spec:
  name: "business"
  url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
knowledge_version: "V_0-0-1"
title: "Valid Model"
---

# NN Business summary

A valid single-file model.
`

const validDomainMd = `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---

# NN index

* [[kNNowledge/modelA_NN.md]]
`

describe('recursiveParser: domaiNN_NN.md-driven parser', () => {
  it('parses a workspace with domaiNN_NN.md and model file into the graph', async () => {
    const tree: FakeTree = {
      'domaiNN_NN.md': validDomainMd,
      kNNowledge: {
        'modelA_NN.md': validModelMd,
      },
    }

    const root = buildFakeTree('workspace', tree)
    const result = await recursiveParse(root)

    expect(result.issues).toHaveLength(0)
    const names = Object.values(result.nodes).map((n) => n.name)
    expect(names).toContain('modelA')
  })

  it('reports an issue when entrypoint is missing', async () => {
    const tree: FakeTree = {
      'modelA_NN.md': validModelMd,
    }

    const root = buildFakeTree('workspace', tree)
    const result = await recursiveParse(root)

    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.issues[0].message).toContain('domaiNN_NN.md')
    expect(result.rootIds).toHaveLength(1)
  })

  it('reports a warning when a wikilink target does not exist', async () => {
    const domainMd = `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---

# NN index

* [[kNNowledge/exists_NN.md]]
* [[kNNowledge/missing_NN.md]]
`

    const tree: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: {
        'exists_NN.md': validModelMd,
      },
    }

    const root = buildFakeTree('workspace', tree)
    const result = await recursiveParse(root)

    expect(result.rootIds).toHaveLength(1)
    expect(result.nodes['exists']?.name).toBe('exists')

    const missingIssues = result.issues.filter((i) => i.message.includes('not found'))
    expect(missingIssues.length).toBeGreaterThan(0)
  })

  it('does NOT advise renaming when two models share the same element name — cross-model identity is legal (AD-7)', async () => {
    const modelWithElement = (title: string, elementName: string) => `---
spec_version: "V_0-3-0"
spec_url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
level: 3
parent_spec:
  name: "business"
  url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
knowledge_version: "V_0-0-1"
title: "${title}"
---

# NN index

* [[${elementName}]]

# NN Components

## NN Components: ${elementName}
Description of ${elementName}.
`

    const domainMd = `---
spec_version: "V_0-3-0"
level: 1
title: "DomaiNN Index"
---

# NN index

* [[kNNowledge/modelA_NN.md]]
* [[kNNowledge/modelB_NN.md]]
`

    const tree: FakeTree = {
      'domaiNN_NN.md': domainMd,
      kNNowledge: {
        'modelA_NN.md': modelWithElement('Model A', 'Database'),
        'modelB_NN.md': modelWithElement('Model B', 'Database'),
      },
    }

    const root = buildFakeTree('workspace', tree)
    const result = await recursiveParse(root)

    const renameAdvice = result.issues.filter(
      (i) => i.message.includes('appears in both') && i.message.includes('consider renaming'),
    )
    expect(renameAdvice).toHaveLength(0)
  })

  it('parses model elements into the normalized graph', async () => {
    const modelWithElements = `---
spec_version: "V_0-3-0"
spec_url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
level: 3
parent_spec:
  name: "business"
  url: "https://example.test/specs/business_V_0-1-1_FORMAT.md"
knowledge_version: "V_0-0-1"
title: "Full Model"
---

# NN index

* [[Problems]]
* [[Value propositions]]

# NN Problems

## NN Problems: Alpha
Description of Alpha.
## NN Problems: Beta
Description of Beta.

# NN Value propositions

## NN Value propositions: Gamma
Description of Gamma.
`

    const tree: FakeTree = {
      'domaiNN_NN.md': validDomainMd,
      kNNowledge: {
        'modelA_NN.md': modelWithElements,
      },
    }

    const root = buildFakeTree('workspace', tree)
    const result = await recursiveParse(root)

    expect(result.issues).toHaveLength(0)

    const names = Object.values(result.nodes).map((n) => n.name)
    expect(names).toContain('Alpha')
    expect(names).toContain('Beta')
    expect(names).toContain('Gamma')
  })
})
