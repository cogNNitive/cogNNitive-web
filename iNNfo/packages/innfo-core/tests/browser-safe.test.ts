import { describe, it, expect } from 'vitest'
import * as browserExports from '../src/browser'

describe('Browser Entry Point', () => {
  it('exports pure spec resolver functions, interface and errors', () => {
    expect(browserExports).toHaveProperty('getSpecForLevel')
    expect(browserExports).toHaveProperty('getTemplate')
    expect(browserExports).toHaveProperty('getFormatSpec')
    expect(browserExports).toHaveProperty('getDefiNNe')
    // Interface is typescript-only, but let's check class/error type
    expect(browserExports).toHaveProperty('SpecResolutionError')
  })

  it('does NOT export resolveParentChain', () => {
    expect(browserExports).not.toHaveProperty('resolveParentChain')
  })

  it('exports normalizeSingleKnowledge', () => {
    expect(browserExports).toHaveProperty('normalizeSingleKnowledge')
  })
})
