import { describe, it, expect } from 'vitest'
import { parseKnowledge, serializeKnowledge } from '../src/parser'
import { validateFormatContent } from '../src/validator'
import { validateDocument } from '../src/validator/document'
import { normalizeSingleKnowledge, recursiveParse } from '../src/recursiveParser'
import type { DirectoryHandleLike, FileHandleLike } from '../src/fs-types'

const BOM = '\uFEFF'

const modelContent = `---
spec_version: "V_0-2-0"
level: 3
knowledge_version: "V_1-0-0"
title: "BOM Model"
---
# NN Stakeholders

## NN Stakeholders: Customer

importance:: "high"

  Customer description goes here.
`

function expectEqualModels(bomInput: string, plainInput: string) {
  const bomModel = parseKnowledge(bomInput)
  const plainModel = parseKnowledge(plainInput)
  expect(bomModel.frontmatter).toEqual(plainModel.frontmatter)
  expect(bomModel.elements).toEqual(plainModel.elements)
  expect(bomModel.matrices).toEqual(plainModel.matrices)
  expect(bomModel.taxonomy).toEqual(plainModel.taxonomy)
  expect(serializeKnowledge(bomModel)).toBe(serializeKnowledge(plainModel))
}

function makeFakeFs(modelContent: string): DirectoryHandleLike {
  const fileHandle: FileHandleLike = {
    kind: 'file',
    name: 'Company_V_0-1-0_business_NN.md',
    async getFile() {
      return { text: async () => modelContent }
    },
  }
  return {
    kind: 'directory',
    name: 'workspace',
    async *entries() {
      yield ['Company_V_0-1-0_business_NN.md', fileHandle]
    },
    async getFileHandle(name: string) {
      if (name !== fileHandle.name) throw Object.assign(new Error('File not found'), { code: 'ENOENT' })
      return fileHandle
    },
    async getDirectoryHandle(name: string) {
      throw Object.assign(new Error('Directory not found'), { code: 'ENOENT' })
    },
  }
}

describe('UTF-8 BOM frontmatter tolerance (C1)', () => {
  it('parseKnowledge: BOM-prefixed input == no-BOM input', () => {
    expectEqualModels(BOM + modelContent, modelContent)
  })

  it('parseKnowledge: BOM without a following blank line still parses frontmatter', () => {
    const bomNoBlank = BOM + modelContent.replace(/^---/, '---')
    expect(parseKnowledge(bomNoBlank).frontmatter.title).toBe('BOM Model')
  })

  it('validateFormatContent: BOM input produces identical checks', () => {
    const plain = validateFormatContent(modelContent, 'Company_V_0-1-0_business_NN.md')
    const bom = validateFormatContent(BOM + modelContent, 'Company_V_0-1-0_business_NN.md')
    expect(bom.checks).toEqual(plain.checks)
    expect(bom.passed).toBe(plain.passed)
  })

  it('normalizeSingleKnowledge: BOM input yields identical nodes and issues', () => {
    const plain = normalizeSingleKnowledge(modelContent, 'Company_V_0-1-0_business_NN.md', 'Company')
    const bom = normalizeSingleKnowledge(BOM + modelContent, 'Company_V_0-1-0_business_NN.md', 'Company')
    expect(bom.issues).toEqual(plain.issues)
    expect(Object.keys(bom.nodes).sort()).toEqual(Object.keys(plain.nodes).sort())
    const bomRoot = Object.values(bom.nodes).find((n) => n.kind === 'root')
    const plainRoot = Object.values(plain.nodes).find((n) => n.kind === 'root')
    expect(bomRoot?.name).toBe(plainRoot?.name)
  })

  it('recursiveParse: BOM input yields identical diagnostics', async () => {
    const plain = await recursiveParse(makeFakeFs(modelContent))
    const bom = await recursiveParse(makeFakeFs(BOM + modelContent))
    expect(bom.issues).toEqual(plain.issues)
    expect(Object.keys(bom.nodes).sort()).toEqual(Object.keys(plain.nodes).sort())
  })
})

describe('BOM warning diagnostic (validator-robustness Unit 2)', () => {
  it('BOM warns with a stable info code without affecting validity', () => {
    const result = validateDocument(BOM + modelContent, {
      fileName: 'Company_V_0-1-0_business_NN.md',
    })
    const bomWarnings = [...result.errors, ...result.warnings].filter(
      (d) => d.code === 'BOM_WARNING',
    )
    expect(bomWarnings).toHaveLength(1)
    expect(bomWarnings[0].severity).toBe('info')
    expect(bomWarnings[0].promptHint).toContain('BOM')
    expect(result.valid).toBe(result.errors.length === 0)
  })

  it('No BOM, no warning', () => {
    const result = validateDocument(modelContent, {
      fileName: 'Company_V_0-1-0_business_NN.md',
    })
    expect([...result.errors, ...result.warnings].filter((d) => d.code === 'BOM_WARNING')).toEqual(
      [],
    )
  })
})