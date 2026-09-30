import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import {
  resolveTemplatePath,
  getTemplateSearchPaths,
  UnresolvedTemplateError,
  validateModel,
  parseModel,
  resolveTemplateSchema,
} from './index.js'
import type { SpecDocument } from './types/index.js'

describe('Multi-Store Template Resolver (innfo-core)', () => {
  let tmpDir: string
  let workspaceDir: string
  let globalDir: string
  let skillsDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'innfo-resolver-test-'))
    workspaceDir = path.join(tmpDir, 'workspace')
    globalDir = path.join(tmpDir, 'global_templates')
    skillsDir = path.join(tmpDir, 'skills')

    fs.mkdirSync(path.join(workspaceDir, 'templates'), { recursive: true })
    fs.mkdirSync(globalDir, { recursive: true })
    fs.mkdirSync(path.join(skillsDir, 'nn-innfo', 'templates'), { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('resolves workspace-local template first (Precedence 1)', async () => {
    const tmplName = 'test_spec_NN'
    fs.writeFileSync(path.join(workspaceDir, 'templates', `${tmplName}.md`), '# NN concept: Local')
    fs.writeFileSync(path.join(globalDir, `${tmplName}.md`), '# NN concept: Global')
    fs.writeFileSync(
      path.join(skillsDir, 'nn-innfo', 'templates', `${tmplName}.md`),
      '# NN concept: Skill',
    )

    const loc = await resolveTemplatePath(tmplName, {
      workspaceDir,
      globalTemplatesDir: globalDir,
      skillsDir,
    })
    expect(loc).not.toBeNull()
    expect(loc?.source).toBe('workspace')
    expect(loc?.filePath).toBe(path.join(workspaceDir, 'templates', `${tmplName}.md`))
  })

  it('falls back to global templates when missing in workspace (Precedence 2)', async () => {
    const tmplName = 'global_only_spec'
    fs.writeFileSync(path.join(globalDir, `${tmplName}.md`), '# NN concept: Global')
    fs.writeFileSync(
      path.join(skillsDir, 'nn-innfo', 'templates', `${tmplName}.md`),
      '# NN concept: Skill',
    )

    const loc = await resolveTemplatePath(tmplName, {
      workspaceDir,
      globalTemplatesDir: globalDir,
      skillsDir,
    })
    expect(loc).not.toBeNull()
    expect(loc?.source).toBe('global')
    expect(loc?.filePath).toBe(path.join(globalDir, `${tmplName}.md`))
  })

  it('falls back to skill-bundled templates when missing in workspace and global (Precedence 3)', async () => {
    const tmplName = 'skill_only_spec'
    fs.writeFileSync(
      path.join(skillsDir, 'nn-innfo', 'templates', `${tmplName}.md`),
      '# NN concept: Skill',
    )

    const loc = await resolveTemplatePath(tmplName, {
      workspaceDir,
      globalTemplatesDir: globalDir,
      skillsDir,
    })
    expect(loc).not.toBeNull()
    expect(loc?.source).toBe('skill')
    expect(loc?.skillName).toBe('nn-innfo')
    expect(loc?.filePath).toBe(path.join(skillsDir, 'nn-innfo', 'templates', `${tmplName}.md`))
  })

  it('returns null and reports every searched tier when the template is missing everywhere', async () => {
    const missingName = 'non_existent_spec'
    const opts = { workspaceDir, globalTemplatesDir: globalDir, skillsDir }

    const loc = await resolveTemplatePath(missingName, opts)
    expect(loc).toBeNull()

    // The diagnostics must list the real precedence list, not an approximation:
    // every tier resolveTemplatePath walks has to appear in the searched paths.
    const checkedPaths = await getTemplateSearchPaths(missingName, opts)
    expect(checkedPaths).toContain(path.join(workspaceDir, 'templates', `${missingName}.md`))
    expect(checkedPaths).toContain(path.join(workspaceDir, `${missingName}.md`))
    expect(checkedPaths).toContain(path.join(workspaceDir, 'specs', `${missingName}.md`))
    expect(checkedPaths).toContain(path.join(globalDir, `${missingName}.md`))
    expect(checkedPaths).toContain(
      path.join(skillsDir, 'nn-innfo', 'templates', `${missingName}.md`),
    )
    expect(checkedPaths).toContain(path.join(skillsDir, 'nn-innfo', `${missingName}.md`))

    const err = new UnresolvedTemplateError(missingName, checkedPaths)
    expect(err.name).toBe('UnresolvedTemplateError')
    expect(err.message).toContain('Unresolved template "non_existent_spec"')
    expect(err.message).toContain('searched:')
    expect(err.checkedPaths).toEqual(checkedPaths)
  })

  it('validates model concepts against resolved Level 2 spec template from skill store', () => {
    const tmplContent = `---
spec_version: V_1-0-0
spec_level: 2
type: specification
id: projects_V_0-1-0_NN
name: Projects Template
---

# NN concept: Project
* type:: text
`
    const modelContent = `---
level: 3
knowledge_version: V_0-1-0
parent_spec:
  name: projects_V_0-1-0_NN
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/bluepriNNts/projects/projects_V_0-1-0_NN.md
---

# NN index
* [[Project]]

## NN Project: Alpha
* status:: active
`
    const parsed = parseModel(modelContent)
    const templateDoc: SpecDocument = {
      level: 2,
      name: 'projects_V_0-1-0_NN',
      rawContent: tmplContent,
      frontmatter: {
        level: 2,
        spec_version: 'V_1-0-0',
        spec_url: 'https://example.com/projects_V_0-1-0_NN.md',
      },
    }

    const res = validateModel(parsed, templateDoc, null)
    expect(res.valid).toBe(true)
    expect(res.errors.length).toBe(0)
  })
})

describe('Composition & Alias Engine (resolver / resolveTemplateSchema)', () => {
  it('applies concept and field aliases during template composition', () => {
    const baseA = `---
level: 2
title: "Base A"
---

# NN Concept Definition
## NN Concept Definition: Task
type:: list

# NN Field Definition
## NN Field Definition: status
concept:: Task
type:: string

# NN Matrix Definition
## NN Matrix Definition: TaskDep
source:: Task
target:: Task
`

    const composite = `---
level: 2
title: "Composite"
includes:
  - name: "base_a"
    url: "https://example.com/base_a.md"
    alias:
      concepts:
        "Task": "BusinessTask"
      fields:
        "Task.status": "Task.business_status"
---
`

    const { schema, errors } = resolveTemplateSchema(composite, (ref) =>
      ref.name === 'base_a' ? baseA : null,
    )

    expect(errors).toEqual([])
    expect(schema.concepts.map((c) => c.name)).toEqual(['BusinessTask'])
    const bTask = schema.concepts.find((c) => c.name === 'BusinessTask')!
    expect(bTask.fields?.map((f) => f.name)).toEqual(['business_status'])
    expect(schema.matrices[0].source).toBe('BusinessTask')
    expect(schema.matrices[0].target).toBe('BusinessTask')
  })

  it('detects un-aliased concept collision across base templates and emits [COMPOSITION_COLLISION]', () => {
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

    const composite = `---
level: 2
title: "Composite"
includes:
  - name: "base_a"
    url: "https://example.com/base_a.md"
  - name: "base_b"
    url: "https://example.com/base_b.md"
---
`

    const { errors } = resolveTemplateSchema(composite, (ref) => {
      if (ref.name === 'base_a') return baseA
      if (ref.name === 'base_b') return baseB
      return null
    })

    const collision = errors.find((e) => e.message.includes('[COMPOSITION_COLLISION]'))
    expect(collision).toBeDefined()
    expect(collision?.message).toMatch(/Base A/)
    expect(collision?.message).toMatch(/Base B/)
    expect(collision?.message).toMatch(/Task/)
  })

  it('detects un-aliased field collision across base templates', () => {
    const baseA = `---
level: 2
title: "Base A"
---

# NN Concept Definition
## NN Concept Definition: ItemA
type:: list

# NN Field Definition
## NN Field Definition: status
concept:: ItemA
type:: string
`

    const baseBWithField = `---
level: 2
title: "Base B"
---

# NN Concept Definition
## NN Concept Definition: ItemB
type:: list

# NN Field Definition
## NN Field Definition: status
concept:: ItemB
type:: select
options:: [open, closed]
`

    const composite = `---
level: 2
title: "Composite"
includes:
  - name: "base_a"
    url: "https://example.com/base_a.md"
  - name: "base_b"
    url: "https://example.com/base_b.md"
    alias:
      concepts:
        "ItemB": "ItemA"
---
`

    const { errors } = resolveTemplateSchema(composite, (ref) => {
      if (ref.name === 'base_a') return baseA
      if (ref.name === 'base_b') return baseBWithField
      return null
    })

    const collision = errors.find((e) => e.message.includes('[COMPOSITION_COLLISION]'))
    expect(collision).toBeDefined()
    expect(collision?.message).toMatch(/ItemA/)
  })

  it('handles multi-level inheritance resolution up to depth 10 and rejects cycle', () => {
    const tplA = `---
level: 2
title: "Tpl A"
includes:
  - name: "tpl_b"
    url: "b"
---
`
    const tplB = `---
level: 2
title: "Tpl B"
includes:
  - name: "tpl_a"
    url: "a"
---
`

    const { errors } = resolveTemplateSchema(tplA, (ref) => {
      if (ref.name === 'tpl_b') return tplB
      if (ref.name === 'tpl_a') return tplA
      return null
    })

    expect(errors.some((e) => /cyclic/i.test(e.message))).toBe(true)
  })

  it('enforces maximum inclusion depth of 10', () => {
    // Construct a chain of 11 templates: T1 -> T2 -> ... -> T11
    const getTpl = (n: number) => `---
level: 2
title: "Tpl ${n}"
includes:
  - name: "tpl_${n + 1}"
    url: "x"
---
`
    const { errors } = resolveTemplateSchema(getTpl(1), (ref) => {
      const match = ref.name.match(/^tpl_(\d+)$/)
      if (match) {
        return getTpl(parseInt(match[1], 10))
      }
      return null
    })

    expect(errors.some((e) => e.message.includes('Max inclusion depth of 10 exceeded'))).toBe(true)
  })
})
