import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { validateBlueprint } from '../src/tools/mutate.js'
import { writeFile, rm, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

describe('validate_template Level 2 template validation', () => {
  const tmpDir = resolve('./test-tmp-validate-template')

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Level 1 parent spec
  const level1Path = join(tmpDir, 'iNNfo_V_1-0_NN.md')
  const level1Url = pathToFileURL(level1Path).href

  // Level 2 template
  const level2Path = join(tmpDir, 'custom_template_V_1-0_NN.md')

  beforeAll(async () => {
    await mkdir(tmpDir, { recursive: true })
    await writeFile(
      level1Path,
      `---
spec_version: V_1-0
level: 1
title: Level 1 Spec
---
# Level 1 Spec
`,
      'utf-8',
    )

    await writeFile(
      level2Path,
      `---
spec_version: V_1-0
level: 2
title: Custom Specialization Template
parent_spec:
  name: iNNfo_V_1-0
  url: ${level1Url}
---
# NN Concept Definition
## NN Concept Definition: CustomConcept
type:: text
`,
      'utf-8',
    )
  })

  afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('validates a valid Level 2 template with frontmatter auto-detection', async () => {
    const result = await validateBlueprint(tmpDir, 'custom_template_V_1-0')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('validates inline content declaring level === 2', async () => {
    const content = `---
spec_version: V_1-0
level: 2
title: Inline Level 2 Template
parent_spec:
  name: iNNfo_V_1-0
  url: ${level1Url}
---
# NN Concept Definition
## NN Concept Definition: TestConcept
type:: list
`
    const result = await validateBlueprint(tmpDir, undefined, content)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('emits [PARENT_RESOLUTION_FAILED] when parent spec URL is unresolvable', async () => {
    const content = `---
spec_version: V_1-0
level: 2
title: Template With Bad Parent
parent_spec:
  name: MissingParent
  url: file:///non/existent/path/spec.md
---
`
    const result = await validateBlueprint(tmpDir, undefined, content)
    expect(result.valid).toBe(false)
    const err = result.errors.find((e) => e.message.includes('[PARENT_RESOLUTION_FAILED]'))
    expect(err).toBeDefined()
  })
})
