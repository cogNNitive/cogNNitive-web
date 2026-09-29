import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateModel } from '../src/tools/mutate.js'
import { isLocalPath, toLocalFilePath } from '../src/tools/resolver-node.js'
import { parseModel, validateFormatContent, validateModel as coreValidate } from '../../innfo-core/src/index.ts'

describe('Defects D1–D9 Regression Test Suite', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network unreachable'))
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('D1: validateModel auto-detects level-2 template content and delegates to validateTemplate', async () => {
    const templateContent = `---
specification_version: "V_0-1-0"
level: 2
parent_spec:
  name: iNNfo_NN
  url: "https://example.com/iNNfo_NN.md"
title: "Test Template"
---

# NN Concepts
## NN Concept Definition: Sources
### Summary
Sources concept
`
    const result = await validateModel(process.cwd(), undefined, templateContent)
    const levelErrors = result.errors.filter((e) => e.message.includes('Expected level 3'))
    expect(levelErrors.length).toBe(0)
  })

  it('D2: Spec Resolver identifies Windows local paths and file:// URIs correctly', () => {
    expect(isLocalPath('C:/Users/mock-user/specs/test_NN.md')).toBe(true)
    expect(isLocalPath('C:\\Users\\mock-user\\specs\\test_NN.md')).toBe(true)
    expect(isLocalPath('file:///C:/Users/mock-user/specs/test_NN.md')).toBe(true)
    // Conversion is allowed only when the target is contained by the root.
    expect(toLocalFilePath('file:///C:/specs/test_NN.md', 'C:/specs')).toContain('specs')
    // Without a root there is nothing to contain against, so it is refused.
    expect(toLocalFilePath('file:///C:/specs/test_NN.md')).toBeNull()
  })

  it('D3: Concept documentation warning provides actionable message', async () => {
    const parsedModel = parseModel(`---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: TestTemplate
  url: "https://example.com/template.md"
knowledge_version: "V_0-1-0"
title: "Test Model"
---

# NN Sources
## NN Sources: SourceA
`)

    const mockTemplate = {
      name: 'TestTemplate',
      level: 2,
      rawContent: `# NN Concept Definition
## NN Concept Definition: Sources
`,
      frontmatter: {
        specification_version: 'V_0-1-0',
        level: 2,
        title: 'Template',
      },
    }

    const result = coreValidate(parsedModel, mockTemplate as any, null)
    const warning = result.warnings.find((w) => w.path.startsWith('parent.concepts'))
    expect(warning).toBeDefined()
    expect(warning!.message).toContain('Sources')
    expect(warning!.message).toContain('lacks complete guidance section')
  })

  it('D4: Slug/name collisions are reported as validation ERRORs', async () => {
    const modelWithDuplicateNames = parseModel(`---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: TestTemplate
  url: "https://example.com/template.md"
knowledge_version: "V_0-1-0"
title: "Test Model"
---

# NN Sources
## NN Sources: source_ref
## NN Sources: source_ref
`)

    const mockTemplate = {
      name: 'TestTemplate',
      level: 2,
      rawContent: `# NN Concept Definition
## NN Concept Definition: Sources
`,
      frontmatter: {
        specification_version: 'V_0-1-0',
        level: 2,
        title: 'Template',
      },
    }

    const result = coreValidate(modelWithDuplicateNames, mockTemplate as any, null)
    const collisionError = result.errors.find((e) => e.message.includes('Slug collision'))
    expect(collisionError).toBeDefined()
    expect(collisionError!.severity).toBe('error')
  })

  it('D6: Prose section bullets are not flagged as misplaced element errors', () => {
    const docWithProseBullets = `---
specification_version: "V_0-1-0"
level: 2
parent_spec:
  name: iNNfo_NN
  url: "https://example.com/spec.md"
title: "Prose Test"
---

# NN Objectives
- Model the program as root entity
- Maintain backwards compatibility

# NN Sources
## NN Sources: ItemOne
`
    const report = validateFormatContent(docWithProseBullets, 'test_spec_NN.md')
    const elementMarkerCheck = report.checks.find((c) => c.id === 'body-element-markers')
    expect(elementMarkerCheck?.passed).toBe(true)
  })

  it('D7: Level 3 models do not trigger false positive OKF type warning', () => {
    const level3Model = `---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: Template
  url: "https://example.com/template.md"
knowledge_version: "V_0-1-0"
title: "Canonical Model"
---
`
    const report = validateFormatContent(level3Model, 'model_V_0-1-0_NN.md')
    const typeCheck = report.checks.find((c) => c.id === 'conv-type-field')
    expect(typeCheck).toBeUndefined()
  })

  it('D8: Diagnostic errors and warnings contain filePath property', async () => {
    const level3Model = `---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: MissingTemplate
  url: "https://example.com/missing.md"
knowledge_version: "V_0-1-0"
title: "Model"
---
`
    const result = await validateModel(process.cwd(), undefined, level3Model)
    expect(result.errors.length).toBeGreaterThan(0)
    for (const err of result.errors) {
      expect((err as any).filePath).toBeDefined()
    }
  })

  it('D9: NN index section with wikilinks is correctly parsed', () => {
    const docWithIndex = `---
specification_version: "V_0-1-0"
level: 2
parent_spec:
  name: Template
  url: "https://example.com/template.md"
blueprint_version: "V_0-1-0"
title: "Index Model"
---

# NN index
* [[Sources]]
  * [[Artifacts]]
`
    const report = validateFormatContent(docWithIndex, 'index_model_NN.md')
    const indexCheck = report.checks.find((c) => c.id === 'body-index')
    expect(indexCheck?.passed).toBe(true)
  })
})
