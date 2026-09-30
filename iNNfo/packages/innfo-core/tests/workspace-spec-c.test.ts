import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { recursiveParse, validateBlueprintAgainstMetaschema } from '../src/index'
import type { DirectoryHandleLike, FileHandleLike } from '../src/fs-types'

const specsRoot = join(import.meta.dirname!, '..', '..', '..', 'specs')
const readSpec = (p: string): string => readFileSync(join(specsRoot, p), 'utf-8')

const WORKSPACE_SPEC = readSpec('bluepriNNts/workspace_spec_NN.md')
const INNFO_V2 = readSpec('iNNfo_V_0-2-0_NN.md')

/** Minimal in-memory FS handle, mirroring workspace-taxonomy-submodels.test.ts. */
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

describe('Change C — workspace_V_0-3-0_spec_NN.md normalization', () => {
  it('validates green against the iNNfo_V_0-2-0 metaschema (canonical L2 form)', () => {
    const diags = validateBlueprintAgainstMetaschema(WORKSPACE_SPEC, INNFO_V2)
    const errors = diags.filter((d) => d.severity === 'error')
    expect(errors, JSON.stringify(errors)).toEqual([])
  })
})

describe('Change C — workspace-scoped author:: propagation', () => {
  it('attaches the manifest Models author:: to each referenced model root node', async () => {
    const files: Record<string, string> = {
      'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec
  url: https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/workspace_spec_NN.md
knowledge_version: V_0-1-0
title: Demo Workspace
---
> [!NOTE]
> Workspace manifest.

# NN Models

## NN Models: Alpha Model
path:: alpha_NN.md
status:: active
author:: Ada Lovelace

## NN Models: Beta Model
path:: beta_NN.md
status:: draft
author:: Grace Hopper
`,
      'alpha_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: some_spec
  url: https://example.com/some_spec.md
knowledge_version: V_0-1-0
title: Alpha Model
---
# NN Components
## NN Components: Engine
`,
      'beta_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: some_spec
  url: https://example.com/some_spec.md
knowledge_version: V_0-1-0
title: Beta Model
---
# NN Components
## NN Components: Widget
`,
    }

    const result = await recursiveParse(createFakeDirectoryHandle(files))

    const alpha = Object.values(result.nodes).find((n) => n.name === 'alpha')
    const beta = Object.values(result.nodes).find((n) => n.name === 'beta')
    expect(alpha, 'alpha model root node').toBeDefined()
    expect(beta, 'beta model root node').toBeDefined()
    expect(alpha!.author).toBe('Ada Lovelace')
    expect(beta!.author).toBe('Grace Hopper')
  })

  it('leaves author undefined when the Models entry carries none', async () => {
    const files: Record<string, string> = {
      'domaiNN_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: workspace_spec
  url: https://example.com/workspace_spec_NN.md
knowledge_version: V_0-1-0
title: No-Author Workspace
---
> [!NOTE]
> Workspace manifest.

# NN Models

## NN Models: Gamma Model
path:: gamma_NN.md
status:: active
`,
      'gamma_NN.md': `---
spec_version: V_1-0-0
level: 3
parent_spec:
  name: some_spec
  url: https://example.com/some_spec.md
knowledge_version: V_0-1-0
title: Gamma Model
---
# NN Components
## NN Components: Core
`,
    }

    const result = await recursiveParse(createFakeDirectoryHandle(files))
    const gamma = Object.values(result.nodes).find((n) => n.name === 'gamma')
    expect(gamma).toBeDefined()
    expect(gamma!.author).toBeUndefined()
  })
})
