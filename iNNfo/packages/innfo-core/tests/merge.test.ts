import { describe, it, expect } from 'vitest'
import { parseKnowledge, serializeKnowledge } from '../src/parser/index.js'
import { mergeKnowledge } from '../src/merge.js'

describe('Semantic AST Merge (mergeKnowledge)', () => {
  it('merges an element added by agent on disk with memory model', () => {
    const diskContent = `---
spec_version: "V_0-2-1"
level: 3
parent_spec:
  name: "movies_V_0-1-0"
  url: "specs/movies_V_0-1-0_spec_NN.md"
title: "Sample"
---

# NN Movies

## NN Movies: Matrix
year:: 1999

# NN Scenes

## NN Scenes: Lobby Scene
movie:: [[Matrix]]

## NN Scenes: Rooftop Scene
movie:: [[Matrix]]
`

    const memoryContent = `---
spec_version: "V_0-2-1"
level: 3
parent_spec:
  name: "movies_V_0-1-0"
  url: "specs/movies_V_0-1-0_spec_NN.md"
title: "Sample"
---

# NN Movies

## NN Movies: Matrix
year:: 1999
director:: Wachowskis

# NN Scenes

## NN Scenes: Lobby Scene
movie:: [[Matrix]]
`

    const diskParsed = parseKnowledge(diskContent)
    const memParsed = parseKnowledge(memoryContent)

    const merged = mergeKnowledge(diskParsed, memParsed)
    const serialized = serializeKnowledge(merged)

    // The merged model should have:
    // 1. director field from memory
    expect(serialized).toContain('director:: Wachowskis')
    // 2. Rooftop Scene added on disk by agent
    expect(serialized).toContain('## NN Scenes: Rooftop Scene')
    // 3. Lobby Scene preserved
    expect(serialized).toContain('## NN Scenes: Lobby Scene')
  })

  it('merges element added in memory with disk model', () => {
    const diskContent = `---
spec_version: "V_0-2-1"
level: 3
parent_spec:
  name: "test"
  url: "specs/test.md"
title: "Test"
---

# NN Items

## NN Items: Item A
status:: active
`

    const memoryContent = `---
spec_version: "V_0-2-1"
level: 3
parent_spec:
  name: "test"
  url: "specs/test.md"
title: "Test"
---

# NN Items

## NN Items: Item A
status:: active

## NN Items: Item B
status:: pending
`

    const diskParsed = parseKnowledge(diskContent)
    const memParsed = parseKnowledge(memoryContent)

    const merged = mergeKnowledge(diskParsed, memParsed)
    const serialized = serializeKnowledge(merged)

    expect(serialized).toContain('## NN Items: Item A')
    expect(serialized).toContain('## NN Items: Item B')
  })

  it('merges matrices and item-markers correctly', () => {
    const diskContent = `---
spec_version: "V_0-2-1"
level: 3
parent_spec:
  name: "test"
  url: "specs/test.md"
title: "Test"
---

# NN Items

## NN Items: Item 1
## NN Items: Item 2

# NN matrices: item-markers matrix
| Item \\ Marker | score |
| :--- | :---: |
| Item 1 | 5 |
`

    const memoryContent = `---
spec_version: "V_0-2-1"
level: 3
parent_spec:
  name: "test"
  url: "specs/test.md"
title: "Test"
---

# NN Items

## NN Items: Item 1
## NN Items: Item 2

# NN matrices: item-markers matrix
| Item \\ Marker | score | priority |
| :--- | :---: | :---: |
| Item 2 | - | high |
`

    const diskParsed = parseKnowledge(diskContent)
    const memParsed = parseKnowledge(memoryContent)

    const merged = mergeKnowledge(diskParsed, memParsed)
    const serialized = serializeKnowledge(merged)

    expect(serialized).toContain('| Item 1 | 5 | - |')
    expect(serialized).toContain('| Item 2 | - | high |')
  })

  it('suppresses taxonomy index block for level 3 models', () => {
    const diskContent = `---
spec_version: "V_0-2-1"
level: 3
parent_spec:
  name: "test"
  url: "specs/test.md"
title: "Test"
---

# NN Items

## NN Items: Item 1
`

    const memoryContent = `---
spec_version: "V_0-2-1"
level: 3
parent_spec:
  name: "test"
  url: "specs/test.md"
title: "Test"
---

# NN Items

## NN Items: Item 1
`

    const diskParsed = parseKnowledge(diskContent)
    const memParsed = parseKnowledge(memoryContent)
    // simulate taxonomy added to memory model
    memParsed.taxonomy = [{ parent: 'Items', child: 'Item 1' }]

    const merged = mergeKnowledge(diskParsed, memParsed)
    const serialized = serializeKnowledge(merged)

    expect(serialized).not.toContain('# NN index')
  })
})
