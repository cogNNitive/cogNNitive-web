import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { findModelFile } from '../src/tools/spec.js'
import { readModel } from '../src/tools/list-read.js'
import { validateModel } from '../src/tools/mutate.js'

describe('MCP Submodel Discovery & Resolver (Task 4.2)', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'innfo-mcp-submodel-'))
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  describe('findModelFile & readModel with nested subdirectories', () => {
    it('discovers and reads submodels located in nested subdirectories', async () => {
      const nestedDir = join(tempDir, 'models', 'subsystems', 'auth')
      await mkdir(nestedDir, { recursive: true })

      const filePath = join(nestedDir, 'Tokens_V_0-1-0_security_NN.md')
      const content = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: security_spec
  url: https://example.com/sec.md
knowledge_version: V_0-1-0
title: Security Tokens
---
# NN Index
* [[TokenList]]
`
      await writeFile(filePath, content, 'utf-8')

      // Test findModelFile by clean stem
      const foundPath = await findModelFile(tempDir, 'Tokens_V_0-1-0_security')
      expect(foundPath).toBe(filePath)

      // Test findModelFile by raw filename
      const foundByFilename = await findModelFile(tempDir, 'Tokens_V_0-1-0_security_NN.md')
      expect(foundByFilename).toBe(filePath)

      // Test readModel by clean stem
      const model = await readModel(tempDir, 'Tokens_V_0-1-0_security')
      expect(model).toBeDefined()
      expect(model?.frontmatter.title).toBe('Security Tokens')
    })
  })

  describe('validateModel with SubmodelResolver warnings', () => {
    beforeEach(async () => {
      // Create specs directory with parent template declaring a model-typed field
      const specsDir = join(tempDir, 'specs')
      await mkdir(specsDir, { recursive: true })

      const templateContent = `---
spec_version: V_1-0-0
level: 2
knowledge_version: V_0-1-0
title: App Architecture Template
---
# NN Concept Definition
## NN Concept Definition: Components
type:: list

# NN Field Definition
## NN Field Definition: submodel_link
concept:: Components
type:: knowledge
target_blueprint:: subcomponent_template
`
      await writeFile(join(specsDir, 'app_template_NN.md'), templateContent, 'utf-8')

      // Create a matching submodel
      const modelsDir = join(tempDir, 'models')
      await mkdir(modelsDir, { recursive: true })

      const subcomponentTemplateContent = `---
spec_version: V_1-0-0
level: 2
knowledge_version: V_0-1-0
title: Subcomponent Template
---
# NN Concept Definition
## NN Concept Definition: Sub
type:: list
`
      await writeFile(join(specsDir, 'subcomponent_template_NN.md'), subcomponentTemplateContent, 'utf-8')

      const validSubmodelContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: subcomponent_template
  url: https://example.com/subcomponent_template_NN.md
knowledge_version: V_0-1-0
title: Valid Subcomponent
---
# NN Sub
## NN Sub: Child
`
      await writeFile(join(modelsDir, 'valid_subcomponent_NN.md'), validSubmodelContent, 'utf-8')

      const mismatchedSubmodelContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: other_template
  url: https://example.com/other_template_NN.md
knowledge_version: V_0-1-0
title: Mismatched Subcomponent
---
# NN Sub
## NN Sub: Child
`
      await writeFile(join(modelsDir, 'mismatched_subcomponent_NN.md'), mismatchedSubmodelContent, 'utf-8')
    })

    it('surfaces a warning diagnostic for dangling submodel reference without failing valid', async () => {
      const modelContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: app_template
  url: https://example.com/app_template_NN.md
knowledge_version: V_0-1-0
title: App Model
---
# NN Components
## NN Components: Engine
submodel_link:: [[kNNowledge/missing_subcomponent_NN.md]]
`

      const res = await validateModel(
        tempDir,
        undefined,
        modelContent,
        `file://${join(tempDir, 'specs', 'app_template_NN.md')}`,
      )

      expect(res.valid).toBe(true)
      const warning = res.warnings.find((w) => w.message.includes('Dangling submodel reference'))
      expect(warning).toBeDefined()
      expect(warning?.message).toContain('missing_subcomponent_NN.md')
    })

    it('surfaces a warning diagnostic for submodel template mismatch', async () => {
      const modelContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: app_template
  url: https://example.com/app_template_NN.md
knowledge_version: V_0-1-0
title: App Model
---
# NN Components
## NN Components: Engine
submodel_link:: [[kNNowledge/mismatched_subcomponent_NN.md]]
`

      const res = await validateModel(
        tempDir,
        undefined,
        modelContent,
        `file://${join(tempDir, 'specs', 'app_template_NN.md')}`,
      )

      expect(res.valid).toBe(true)
      const warning = res.warnings.find((w) => w.message.includes('Submodel template mismatch'))
      expect(warning).toBeDefined()
      expect(warning?.message).toContain('subcomponent_template')
    })

    it('validates cleanly when submodel exists and matches target_template', async () => {
      const modelContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: app_template
  url: https://example.com/app_template_NN.md
knowledge_version: V_0-1-0
title: App Model
---
# NN Components
## NN Components: Engine
submodel_link:: [[kNNowledge/valid_subcomponent_NN.md]]
`

      const res = await validateModel(
        tempDir,
        undefined,
        modelContent,
        `file://${join(tempDir, 'specs', 'app_template_NN.md')}`,
      )

      expect(res.valid).toBe(true)
      const submodelWarnings = res.warnings.filter(
        (w) => w.message.includes('submodel') || w.message.includes('Submodel'),
      )
      expect(submodelWarnings).toHaveLength(0)
    })
  })
})
