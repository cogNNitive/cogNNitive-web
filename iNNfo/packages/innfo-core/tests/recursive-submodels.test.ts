import { describe, it, expect } from 'vitest'
import {
  recursiveParse,
  validateDocument,
  normalizePathKey,
  resolveSubmodelPath,
  MAX_DEPTH,
} from '../src/index'
import type { DirectoryHandleLike, FileHandleLike } from '../src/fs-types'
import type { SubmodelResolver } from '../src/validator'
import type { TemplateSchemaResolver } from '../src/recursiveParser/types'
import type { TemplateSchema } from '../src/schema'

function createFakeDirectoryHandle(files: Record<string, string>): DirectoryHandleLike {
  const fileHandles = new Map<string, FileHandleLike>()
  for (const [path, content] of Object.entries(files)) {
    const handle: FileHandleLike = {
      kind: 'file',
      name: path.split('/').pop()!,
      getFile: async () => ({ text: async () => content }) as File,
    }
    fileHandles.set(path, handle)
  }

  const handle: DirectoryHandleLike = {
    kind: 'directory',
    name: 'root',
    async getFileHandle(name: string) {
      if (fileHandles.has(name)) return fileHandles.get(name)!
      throw Object.assign(new Error(`file not found: ${name}`), { name: 'NotFoundError' })
    },
    async getDirectoryHandle(name: string) {
      const prefix = name + '/'
      const subFiles: Record<string, string> = {}
      let found = false
      for (const [k, v] of Object.entries(files)) {
        if (k.startsWith(prefix)) {
          found = true
          subFiles[k.slice(prefix.length)] = v
        }
      }
      if (found) return createFakeDirectoryHandle(subFiles)
      throw Object.assign(new Error(`directory not found: ${name}`), { name: 'NotFoundError' })
    },
    async *entries() {
      for (const [name] of Object.entries(files)) {
        if (!name.includes('/')) {
          yield [name, { kind: 'file', name }] as [string, FileHandleLike]
        }
      }
    },
  }
  return handle
}

describe('Recursive Submodels & Specification Alignment (Phase 4 innfo-core)', () => {
  describe('Path Resolution & Normalization', () => {
    it('normalizes Windows backslashes, collapses slashes and strips leading ./', () => {
      expect(normalizePathKey('.\\models\\subsystems\\auth_NN.md')).toBe(
        'models/subsystems/auth_nn.md',
      )
      expect(normalizePathKey('models//subsystems///auth_NN.md')).toBe(
        'models/subsystems/auth_nn.md',
      )
      expect(normalizePathKey('./auth_NN.md')).toBe('auth_nn.md')
    })

    it('resolves relative paths with ./ and ../ relative to referring path directory', () => {
      expect(resolveSubmodelPath('./tokens_NN.md', 'models/subsystems/auth_NN.md')).toBe(
        'models/subsystems/tokens_NN.md',
      )
      expect(resolveSubmodelPath('../common/logger_NN.md', 'models/subsystems/auth_NN.md')).toBe(
        'models/common/logger_NN.md',
      )
      expect(resolveSubmodelPath('[[../shared/config_NN.md]]', 'models/system_NN.md')).toBe(
        'shared/config_NN.md',
      )
    })

    it('resolves canonical workspace-relative paths', () => {
      expect(resolveSubmodelPath('models/auth_NN.md', 'workspace_NN.md')).toBe('models/auth_NN.md')
      expect(resolveSubmodelPath('[[models/auth_NN.md]]')).toBe('models/auth_NN.md')
    })
  })

  describe('Multi-Level Nested Traversal (Task 4.1)', () => {
    it('parses a 3-level model hierarchy and establishes parent links', async () => {
      const files: Record<string, string> = {
        'workspace_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec_01
  url: https://example.com/workspace_spec_01.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models
## NN Models: System Service
path:: models/system_01.md
author:: architect@example.com
`,
        'models/system_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: system_spec_01
  url: https://example.com/system_spec_01.md
knowledge_version: V_0-1-0
title: System Service
---
# NN Subsystems
## NN Subsystems: Auth Subsystem
path:: ./subsystems/auth_01.md
`,
        'models/subsystems/auth_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: auth_spec_01
  url: https://example.com/auth_spec_01.md
knowledge_version: V_0-1-0
title: Auth Subsystem
---
# NN Roles
## NN Roles: Admin
description:: Administrator role.
`,
      }

      const root = createFakeDirectoryHandle(files)
      const result = await recursiveParse(root)

      expect(result.issues).toHaveLength(0)

      const wsNode = Object.values(result.nodes).find((n) => n.name === 'workspace_01')
      const sysNode = Object.values(result.nodes).find((n) => n.name === 'system_01')
      const authNode = Object.values(result.nodes).find((n) => n.name === 'auth_01')

      expect(wsNode).toBeDefined()
      expect(sysNode).toBeDefined()
      expect(authNode).toBeDefined()

      // Parent links
      expect(wsNode!.parentId).toBeNull()
      expect(sysNode!.parentId).toBe(wsNode!.id)
      expect(authNode!.parentId).toBe(sysNode!.id)

      // Child IDs
      expect(wsNode!.childIds).toContain(sysNode!.id)
      expect(sysNode!.childIds).toContain(authNode!.id)

      // Workspace author propagation
      expect(sysNode!.author).toBe('architect@example.com')
    })
  })

  describe('Cycle Detection', () => {
    it('detects circular references (A -> B -> A) and terminates without infinite loop', async () => {
      const files: Record<string, string> = {
        'workspace_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Root
---
# NN Models
## NN Models: Service A
path:: models/service_a_01.md
`,
        'models/service_a_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: service_spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Service A
---
# NN Models
## NN Models: Service B
path:: ./service_b_01.md
`,
        'models/service_b_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: service_spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Service B
---
# NN Models
## NN Models: Back to Service A
path:: ./service_a_01.md
`,
      }

      const root = createFakeDirectoryHandle(files)
      const result = await recursiveParse(root)

      const cycleIssue = result.issues.find((i) => i.message.includes('Cycle detected'))
      expect(cycleIssue).toBeDefined()
      expect(cycleIssue!.message).toContain('is an ancestor on this branch')

      const nodeA = Object.values(result.nodes).find((n) => n.name === 'service_a_01')
      const nodeB = Object.values(result.nodes).find((n) => n.name === 'service_b_01')
      expect(nodeA).toBeDefined()
      expect(nodeB).toBeDefined()
    })

    it('handles diamond dependencies (DAG) by parsing shared submodel once without duplicate errors', async () => {
      const files: Record<string, string> = {
        'workspace_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Root
---
# NN Models
## NN Models: Service 1
path:: ./service_1_01.md
## NN Models: Service 2
path:: ./service_2_01.md
`,
        'service_1_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Service 1
---
# NN Models
## NN Models: Shared DB
path:: ./shared_db_01.md
`,
        'service_2_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Service 2
---
# NN Models
## NN Models: Shared DB
path:: ./shared_db_01.md
`,
        'shared_db_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Shared Database
---
# NN Tables
## NN Tables: Users
`,
      }

      const root = createFakeDirectoryHandle(files)
      const result = await recursiveParse(root)

      // Shared DB is in nodes, parsed exactly once
      const sharedNode = Object.values(result.nodes).find((n) => n.name === 'shared_db_01')
      expect(sharedNode).toBeDefined()
      expect(Object.values(result.nodes).filter((n) => n.name === 'shared_db_01')).toHaveLength(1)

      // A diamond (two independent parents referencing one child) is not a cycle:
      // no issue is emitted for the second incoming edge.
      const cycleIssue = result.issues.find(
        (i) => i.message.includes('Cycle detected') || i.message.includes('already loaded'),
      )
      expect(cycleIssue).toBeUndefined()

      // Both parents link to the shared child (second edge is preserved, not dropped).
      const service1 = Object.values(result.nodes).find((n) => n.name === 'service_1_01')
      const service2 = Object.values(result.nodes).find((n) => n.name === 'service_2_01')
      expect(service1!.childIds).toContain(sharedNode!.id)
      expect(service2!.childIds).toContain(sharedNode!.id)

      // parentId still single-valued: the first parent to reach it wins.
      expect(sharedNode!.parentId).toBe(service1!.id)
    })
  })

  describe('Depth Capping (MAX_DEPTH = 10)', () => {
    it('caps traversal when depth exceeds MAX_DEPTH and records a warning issue', async () => {
      const files: Record<string, string> = {}

      // Create 12-level deep chain: workspace_01.md -> level_1_01.md -> ... -> level_12_01.md
      files['workspace_01.md'] = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Level 0
---
# NN Models
## NN Models: Next
path:: level_1_01.md
`
      for (let i = 1; i <= 12; i++) {
        files[`level_${i}_01.md`] = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Level ${i}
---
# NN Models
## NN Models: Next
path:: level_${i + 1}_01.md
`
      }

      const root = createFakeDirectoryHandle(files)
      const result = await recursiveParse(root)

      const depthIssue = result.issues.find((i) =>
        i.message.includes('Traversal depth limit exceeded'),
      )
      expect(depthIssue).toBeDefined()
      expect(depthIssue!.message).toContain(`MAX_DEPTH = ${MAX_DEPTH}`)

      // Level 10 should be parsed, but Level 11 should exceed MAX_DEPTH limit
      const node10 = Object.values(result.nodes).find((n) => n.name === 'level_10_01')
      expect(node10).toBeDefined()
      const node11 = Object.values(result.nodes).find((n) => n.name === 'level_11_01')
      expect(node11).toBeUndefined()
    })
  })

  describe('SubmodelResolver & Template Conformance Warnings', () => {
    const templateContent = `---
spec_version: V_1-0-0
level: 2
parent_spec:
  name: iNNfo_V_0-1-0
  url: https://example.com/iNNfo_V_0-1-0_NN.md
knowledge_version: V_0-1-0
title: Architecture Template
---

# NN Concept Definition
## NN Concept Definition: Services
type:: list

# NN Field Definition
## NN Field Definition: submodel_file
concept:: Services
type:: knowledge
target_blueprint:: service_template_01
`

    const templateWithSubmodelField = {
      spec_version: 'V_1-0-0',
      level: 2 as const,
      knowledge_version: 'V_0-1-0',
      title: 'Architecture Template',
      rawContent: templateContent,
      concepts: [
        {
          name: 'Services',
          fields: [
            {
              name: 'submodel_file',
              type: 'model' as const,
              target_blueprint: 'service_template_01',
            },
          ],
        },
      ],
    }

    it('emits a warning diagnostic for dangling submodel references without failing validation', () => {
      const content = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: architecture_template
  url: https://example.com/arch.md
knowledge_version: V_0-1-0
title: Architecture Model
---
# NN Services
## NN Services: Payment Service
submodel_file:: [[models/nonexistent_payment_01.md]]
`

      const mockResolver: SubmodelResolver = (refPath: string) => {
        if (refPath.includes('nonexistent')) {
          return { exists: false }
        }
        return { exists: true, templateName: 'service_template_01' }
      }

      const validation = validateDocument(content, {
        fileName: 'Architecture_V_0-1-0_arch_NN.md',
        template: templateWithSubmodelField as any,
        resolveSubmodel: mockResolver,
      })

      // Validation is non-breaking (valid: true because warnings don't fail)
      expect(validation.valid).toBe(true)
      const warning = validation.warnings.find((w) =>
        w.message.includes('Dangling submodel reference'),
      )
      expect(warning).toBeDefined()
      expect(warning!.message).toContain('nonexistent_payment_01.md')
    })

    it('emits a warning diagnostic when referenced submodel has mismatched template', () => {
      const content = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: architecture_template
  url: https://example.com/arch.md
knowledge_version: V_0-1-0
title: Architecture Model
---
# NN Services
## NN Services: Payment Service
submodel_file:: models/legacy_payment_01.md
`

      const mockResolver: SubmodelResolver = () => {
        return {
          exists: true,
          templateName: 'legacy_template_99',
          templateUrl: 'https://example.com/legacy.md',
        }
      }

      const validation = validateDocument(content, {
        fileName: 'Architecture_V_0-1-0_arch_NN.md',
        template: templateWithSubmodelField as any,
        resolveSubmodel: mockResolver,
      })

      expect(validation.valid).toBe(true)
      const warning = validation.warnings.find((w) =>
        w.message.includes('Submodel template mismatch'),
      )
      expect(warning).toBeDefined()
      expect(warning!.message).toContain('expects template "service_template_01"')
      expect(warning!.message).toContain('uses template "legacy_template_99"')
    })

    it('passes cleanly with no submodel warnings when submodel exists and matches target_blueprint', () => {
      const content = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: architecture_template
  url: https://example.com/arch.md
knowledge_version: V_0-1-0
title: Architecture Model
---
# NN Services
## NN Services: Payment Service
submodel_file:: [[models/payment_01.md]]
`

      const mockResolver: SubmodelResolver = () => {
        return { exists: true, templateName: 'service_template_01' }
      }

      const validation = validateDocument(content, {
        fileName: 'Architecture_V_0-1-0_arch_NN.md',
        template: templateWithSubmodelField as any,
        resolveSubmodel: mockResolver,
      })

      expect(validation.valid).toBe(true)
      const submodelWarnings = validation.warnings.filter(
        (w) => w.message.includes('submodel') || w.message.includes('Submodel'),
      )
      expect(submodelWarnings).toHaveLength(0)
    })
  })

  describe('C1 — type:: knowledge field traversal (RecursiveParseOptions.resolveTemplateSchema)', () => {
    const startupSchema: TemplateSchema = {
      concepts: [
        {
          name: 'Startup',
          type: 'text',
          fields: [{ name: 'business_model', type: 'model', target_blueprint: 'business_V_0-1-0' }],
        },
      ],
      markers: [],
      matrices: [],
      taxonomy: [],
    }

    /** Simulates the POST-includes composed schema: `business_model` is only
     *  present because it was merged in from an included peer template — the
     *  template's OWN concept declares no fields of its own. */
    const composedStartupSchema: TemplateSchema = {
      concepts: [
        {
          name: 'Startup',
          type: 'text',
          fields: [{ name: 'business_model', type: 'model', target_blueprint: 'business_V_0-1-0' }],
        },
      ],
      markers: [],
      matrices: [],
      taxonomy: [],
    }

    function makeResolver(templatesByName: Record<string, TemplateSchema>): TemplateSchemaResolver {
      return ({ frontmatter }) => {
        const name = (frontmatter as { parent_spec?: { name?: string } } | undefined)?.parent_spec
          ?.name
        if (!name) return null
        return templatesByName[name] ?? null
      }
    }

    const workspaceContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models
## NN Models: Acme Startup
path:: startups/acme_startup_01.md
`

    const startupContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: startup_V_0-1-0
  url: https://example.com/startup.md
knowledge_version: V_0-1-0
title: Acme Startup
---
# NN Startup
## NN Startup: Acme
business_model:: startups/acme_business_01.md
`

    const businessContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: business_V_0-1-0
  url: https://example.com/business.md
knowledge_version: V_0-1-0
title: Acme Business Model
---
# NN Business
## NN Business: Overview
`

    const files: Record<string, string> = {
      'workspace_01.md': workspaceContent,
      'startups/acme_startup_01.md': startupContent,
      'startups/acme_business_01.md': businessContent,
    }

    it('c1-model-field-followed: a type:: knowledge field is extracted and enqueued when a resolver is supplied', async () => {
      const root = createFakeDirectoryHandle(files)
      const result = await recursiveParse(root, undefined, {
        resolveTemplateSchema: makeResolver({ 'startup_V_0-1-0': startupSchema }),
      })

      const startupNode = Object.values(result.nodes).find((n) => n.name === 'acme_startup_01')
      const businessNode = Object.values(result.nodes).find((n) => n.name === 'acme_business_01')
      expect(startupNode).toBeDefined()
      expect(businessNode).toBeDefined()
      expect(startupNode!.childIds).toContain(businessNode!.id)
      expect(businessNode!.parentId).toBe(startupNode!.id)
      expect(result.issues.filter((i) => i.code === 'CYCLE_DETECTED')).toHaveLength(0)
    })

    it('c1-included-model-field-followed: a model field inherited via the composed (includes-merged) schema is still followed', async () => {
      const root = createFakeDirectoryHandle(files)
      const result = await recursiveParse(root, undefined, {
        resolveTemplateSchema: makeResolver({ 'startup_V_0-1-0': composedStartupSchema }),
      })

      const startupNode = Object.values(result.nodes).find((n) => n.name === 'acme_startup_01')
      const businessNode = Object.values(result.nodes).find((n) => n.name === 'acme_business_01')
      expect(businessNode).toBeDefined()
      expect(startupNode!.childIds).toContain(businessNode!.id)
    })

    it('c1-no-callback-is-today: without a resolver, the type:: knowledge field is NOT followed (backward-compatible)', async () => {
      const root = createFakeDirectoryHandle(files)
      const result = await recursiveParse(root)

      const startupNode = Object.values(result.nodes).find((n) => n.name === 'acme_startup_01')
      const businessNode = Object.values(result.nodes).find((n) => n.name === 'acme_business_01')
      expect(startupNode).toBeDefined()
      expect(businessNode).toBeUndefined()
      // childIds still holds the model's own element node(s) — only the
      // submodel-graph edge (a second root node) is what stays absent.
      expect(startupNode!.childIds.every((id) => !id.endsWith('acme_business_01'))).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('c1-schema-stashed-on-node: the composed schema is stashed on ModelNode.templateSchema only when a resolver is supplied', async () => {
      const withResolver = await recursiveParse(createFakeDirectoryHandle(files), undefined, {
        resolveTemplateSchema: makeResolver({ 'startup_V_0-1-0': startupSchema }),
      })
      const startupNodeWith = Object.values(withResolver.nodes).find(
        (n) => n.name === 'acme_startup_01',
      )
      expect(startupNodeWith!.templateSchema).toBeDefined()
      expect(startupNodeWith!.templateSchema!.concepts[0]!.name).toBe('Startup')
      expect(startupNodeWith!.templateSchema!.concepts[0]!.fields?.[0]!.name).toBe('business_model')

      const withoutResolver = await recursiveParse(createFakeDirectoryHandle(files))
      const startupNodeWithout = Object.values(withoutResolver.nodes).find(
        (n) => n.name === 'acme_startup_01',
      )
      expect(startupNodeWithout!.templateSchema).toBeUndefined()
    })

    it("c1-resolver-throws-degrades: a throwing resolver degrades that node to today's behavior instead of aborting the parse", async () => {
      const startupContentWithNotes = `${startupContent}
## NN Startup: Notes
path:: startups/notes_01.md
`
      const throwingFiles: Record<string, string> = {
        ...files,
        'startups/acme_startup_01.md': startupContentWithNotes,
        'startups/notes_01.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: notes_V_0-1-0
  url: https://example.com/notes.md
knowledge_version: V_0-1-0
title: Notes
---
# NN Notes
## NN Notes: Entry
`,
      }
      const throwingResolver: TemplateSchemaResolver = () => {
        throw new Error('host resolver boom')
      }

      const root = createFakeDirectoryHandle(throwingFiles)
      const result = await recursiveParse(root, undefined, {
        resolveTemplateSchema: throwingResolver,
      })

      // bare path:: field extraction is unaffected by the throwing resolver
      const notesNode = Object.values(result.nodes).find((n) => n.name === 'notes_01')
      expect(notesNode).toBeDefined()

      // the type:: knowledge field was not followed — schema resolution failed for that node
      const businessNode = Object.values(result.nodes).find((n) => n.name === 'acme_business_01')
      expect(businessNode).toBeUndefined()

      // the parse completed without escalating the resolver failure into an issue
      expect(
        result.issues.filter(
          (i) =>
            i.code === 'CYCLE_DETECTED' || i.code === 'DEPTH_LIMIT' || i.code === 'MODEL_NOT_FOUND',
        ),
      ).toHaveLength(0)
    })

    it('c1-diamond-from-model-field: a model reached both directly and via a type:: knowledge field is one node with two parent edges, not a cycle', async () => {
      const diamondWorkspaceContent = `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec
  url: https://example.com/spec.md
knowledge_version: V_0-1-0
title: Root Workspace
---
# NN Models
## NN Models: Acme Startup
path:: startups/acme_startup_01.md
## NN Models: Acme Business
path:: startups/acme_business_01.md
`
      const diamondFiles: Record<string, string> = {
        ...files,
        'workspace_01.md': diamondWorkspaceContent,
      }
      const root = createFakeDirectoryHandle(diamondFiles)
      const result = await recursiveParse(root, undefined, {
        resolveTemplateSchema: makeResolver({ 'startup_V_0-1-0': startupSchema }),
      })

      const businessNodes = Object.values(result.nodes).filter((n) => n.name === 'acme_business_01')
      expect(businessNodes).toHaveLength(1)
      const businessNode = businessNodes[0]!

      const workspaceNode = Object.values(result.nodes).find((n) => n.name === 'workspace_01')
      const startupNode = Object.values(result.nodes).find((n) => n.name === 'acme_startup_01')
      expect(workspaceNode!.childIds).toContain(businessNode.id)
      expect(startupNode!.childIds).toContain(businessNode.id)
      expect(businessNode.parentId).toBe(workspaceNode!.id)
      expect(result.issues.filter((i) => i.code === 'CYCLE_DETECTED')).toHaveLength(0)
    })
  })
})
