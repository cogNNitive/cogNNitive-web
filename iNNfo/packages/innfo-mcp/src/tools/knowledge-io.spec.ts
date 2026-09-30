import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { rm, mkdir } from 'node:fs/promises'
import { parseKnowledge } from '@cognnitive/innfo-core'
import { resolveBlueprintForKnowledge, loadKnowledge, saveKnowledge } from './knowledge-io'

const dir = join(import.meta.dirname!, '..', '..', 'temp-test-knowledge-io')

describe('knowledge-io', () => {
  it('resolveBlueprintForKnowledge returns null when the model declares no parent', async () => {
    const model = parseKnowledge('---\ntitle: "No Parent"\nlevel: 3\n---\n')
    const r = await resolveBlueprintForKnowledge(dir, model)
    expect(r.template).toBeNull()
    expect(r.resolveInclude({ name: 'x', url: 'y' })).toBeNull()
  })

  it('saveKnowledge then loadKnowledge round-trips', async () => {
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    const p = join(dir, 'doc_NN.md')
    await saveKnowledge(p, parseKnowledge('---\ntitle: "Doc"\nlevel: 3\n---\n'))
    const loaded = await loadKnowledge(p)
    expect(loaded.frontmatter.title).toBe('Doc')
    await rm(dir, { recursive: true, force: true })
  })
})
