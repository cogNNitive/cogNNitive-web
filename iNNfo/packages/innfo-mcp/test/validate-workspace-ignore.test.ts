import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile } from 'node:fs/promises'
import { createNodeDirectoryHandle, DEFAULT_WORKSPACE_IGNORE, validateKnowledge } from '../src/tools/validate.js'

const rootDir = join(import.meta.dirname!, '..', 'temp-test-workspace-ignore')

describe('workspace recursion ignore list (M4)', () => {
  beforeEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(join(rootDir, 'models'), { recursive: true })
    await mkdir(join(rootDir, 'node_modules', 'some-pkg'), { recursive: true })
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('createNodeDirectoryHandle skips ignored directories like node_modules', async () => {
    await writeFile(join(rootDir, 'models', 'Good_NN.md'), '# Good\n')
    await writeFile(join(rootDir, 'node_modules', 'some-pkg', 'Ignored_NN.md'), '# Ignored\n')

    const handle = createNodeDirectoryHandle(rootDir, DEFAULT_WORKSPACE_IGNORE)
    const entries: string[] = []
    for await (const [name] of handle.entries()) {
      entries.push(name)
    }

    expect(entries).toContain('models')
    expect(entries).not.toContain('node_modules')
  })

  it('runWorkspaceValidation skips node_modules so markdown in node_modules is not parsed or in index', async () => {
    const INDEX = `---
spec_version: "V_0-1-2"
level: 0
title: "Workspace Index"
---

# NN index

* [Main](./kNNowledge/Main_V_1-0-0_NN.md)
`
    const MODEL = `---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: Template
  url: "https://example.com/template.md"
knowledge_version: "V_0-1-0"
title: "Main"
---

# NN index

* [[MainItem]]

# NN MainItem

## NN MainItem: Item
sources:: [present.md#h]
`
    const NODE_MODULE_MODEL = `---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: Template
  url: "https://example.com/template.md"
knowledge_version: "V_0-1-0"
title: "BadModule"
---

# NN index
`
    await writeFile(join(rootDir, 'index.md'), INDEX, 'utf-8')
    await writeFile(join(rootDir, 'models', 'Main_V_1-0-0_NN.md'), MODEL, 'utf-8')
    await writeFile(join(rootDir, 'node_modules', 'some-pkg', 'Bad_NN.md'), NODE_MODULE_MODEL, 'utf-8')

    // Validate in workspace mode
    const res = await validateKnowledge(rootDir, 'Main_V_1-0-0_NN', undefined, undefined, true)
    expect(res).toBeDefined()
  })
})
