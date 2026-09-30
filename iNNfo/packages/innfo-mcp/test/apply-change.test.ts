import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { applyChange } from '../src/tools/apply-change.js'

const rootDir = join(import.meta.dirname!, '..', 'temp-test-apply-change-cascade')

const STRATEGY_MODEL = `---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: business
  url: "business"
knowledge_version: "V_0-1-0"
title: "Strategy"
---

# NN index

* [[Vision]]

# NN Vision

## NN Vision: Core Purpose
description:: Our core purpose.
`

const EXECUTION_MODEL = `---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: business
  url: "business"
knowledge_version: "V_0-1-0"
title: "Execution"
---

# NN index

* [[Roadmap]]

# NN Roadmap

## NN Roadmap: Phase 1
derived_from_inputs:: [strategy_V_0-1-0_NN.md]
`

const MARKETING_MODEL = `---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: business
  url: "business"
knowledge_version: "V_0-1-0"
title: "Marketing"
---

# NN index

* [[Marketing]]

# NN Marketing

## NN Marketing: Launch
sources:: [kNNowledge/strategy_V_0-1-0_NN.md@## Vision]
description:: See details in [[strategy_V_0-1-0_NN]].
`

describe('bump_version cascading references and pre-mutation validation', () => {
  beforeEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    await mkdir(join(rootDir, 'models'), { recursive: true })
    await writeFile(join(rootDir, 'models', 'strategy_V_0-1-0_NN.md'), STRATEGY_MODEL, 'utf-8')
    await writeFile(join(rootDir, 'models', 'execution_V_0-1-0_NN.md'), EXECUTION_MODEL, 'utf-8')
    await writeFile(join(rootDir, 'models', 'marketing_V_0-1-0_NN.md'), MARKETING_MODEL, 'utf-8')
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('cascades version bump to dependent models derived_from_inputs and sources', async () => {
    const res = await applyChange(rootDir, 'strategy_V_0-1-0_NN', 'bump_version', {
      bump: 'minor',
    })

    if (!res.success) {
      console.log('RES ERRORS:', res.errors)
    }

    expect(res.success).toBe(true)
    expect(existsSync(join(rootDir, 'models', 'strategy_V_0-2-0_NN.md'))).toBe(true)
    expect(existsSync(join(rootDir, 'models', 'strategy_V_0-1-0_NN.md'))).toBe(false)

    // Check execution model updated derived_from_inputs
    const executionContent = await readFile(
      join(rootDir, 'models', 'execution_V_0-1-0_NN.md'),
      'utf-8',
    )
    expect(executionContent).toContain('strategy_V_0-2-0_NN.md')
    expect(executionContent).not.toContain('strategy_V_0-1-0_NN.md')

    // Check marketing model updated sources and wikilinks
    const marketingContent = await readFile(
      join(rootDir, 'models', 'marketing_V_0-1-0_NN.md'),
      'utf-8',
    )
    expect(marketingContent).toContain('kNNowledge/strategy_V_0-2-0_NN.md@## Vision')
    expect(marketingContent).toContain('[[strategy_V_0-2-0_NN]]')
    expect(marketingContent).not.toContain('strategy_V_0-1-0_NN.md')
  })

  it('aborts bump with zero disk changes when a referencing model fails validation', async () => {
    // Create a broken referencing model with invalid structure
    const brokenModel = `---
specification_version: "V_0-1-0"
level: 3
parent_spec:
  name: business
  url: "business"
knowledge_version: "V_0-1-0"
title: "Broken"
---

# NN InvalidConceptThatDoesNotExist

## NN InvalidConceptThatDoesNotExist: Invalid Element
derived_from_inputs:: [strategy_V_0-1-0_NN.md]
`
    await writeFile(join(rootDir, 'models', 'broken_V_0-1-0_NN.md'), brokenModel, 'utf-8')

    const res = await applyChange(rootDir, 'strategy_V_0-1-0_NN', 'bump_version', {
      bump: 'minor',
    })

    expect(res.success).toBe(false)
    expect(res.errors).toBeDefined()
    expect(res.errors!.length).toBeGreaterThan(0)

    // Ensure no files on disk were changed or renamed
    expect(existsSync(join(rootDir, 'models', 'strategy_V_0-1-0_NN.md'))).toBe(true)
    expect(existsSync(join(rootDir, 'models', 'strategy_V_0-2-0_NN.md'))).toBe(false)

    const executionContent = await readFile(
      join(rootDir, 'models', 'execution_V_0-1-0_NN.md'),
      'utf-8',
    )
    expect(executionContent).toContain('strategy_V_0-1-0_NN.md')
  })

  it('cascades patch version bump across models', async () => {
    const res = await applyChange(rootDir, 'strategy_V_0-1-0_NN', 'bump_version', {
      bump: 'patch',
    })

    expect(res.success).toBe(true)
    expect(existsSync(join(rootDir, 'models', 'strategy_V_0-1-1_NN.md'))).toBe(true)

    const marketingContent = await readFile(
      join(rootDir, 'models', 'marketing_V_0-1-0_NN.md'),
      'utf-8',
    )
    expect(marketingContent).toContain('kNNowledge/strategy_V_0-1-1_NN.md@## Vision')
  })
})
