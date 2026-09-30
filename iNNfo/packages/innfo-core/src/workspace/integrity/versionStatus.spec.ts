import { describe, it, expect } from 'vitest'
import {
  parseSemVer,
  compareVersions,
  gapKind,
  parsePinnedUrl,
  classifyAgainstCatalog,
  type TemplateCatalog,
} from './versionStatus.js'

/**
 * Fixtures lifted verbatim from
 * `skills/nn-preflight/scripts/upgrade-check.test.js` so the ported
 * `innfo-core` primitives keep provable parity with the CLI classifier.
 */
const CATALOG: TemplateCatalog = {
  blueprints: {
    business: {
      name: 'business',
      adopted: 'V_0-2-0',
      versions: [{ blueprint_version: 'V_0-1-0' }, { blueprint_version: 'V_0-2-0' }],
    },
  },
}

const CANON = 'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts'

describe('parseSemVer', () => {
  it('extracts a triple from a V_x-y-z token', () => {
    expect(parseSemVer('V_1-2-3')).toEqual({ major: 1, minor: 2, patch: 3 })
  })

  it('finds the token embedded in a longer string', () => {
    expect(parseSemVer('business_V_0-10-4_NN.md')).toEqual({ major: 0, minor: 10, patch: 4 })
  })

  it('returns null when there is no version token', () => {
    expect(parseSemVer('workspace_spec_NN')).toBeNull()
  })
})

describe('compareVersions', () => {
  it('orders numerically, not lexically', () => {
    expect(compareVersions('V_0-10-0', 'V_0-9-0')).toBeGreaterThan(0)
  })

  it('returns a negative number when the first version is older', () => {
    expect(compareVersions('V_0-1-0', 'V_0-2-0')).toBeLessThan(0)
  })

  it('returns 0 for equal versions', () => {
    expect(compareVersions('V_0-2-0', 'V_0-2-0')).toBe(0)
  })

  it('returns 0 when either side is unparseable', () => {
    expect(compareVersions('V_0-2-0', 'nope')).toBe(0)
  })
})

describe('gapKind', () => {
  const cases: Array<[string, string, ReturnType<typeof gapKind>]> = [
    ['V_0-1-0', 'V_0-2-0', 'minor'],
    ['V_0-1-0', 'V_0-1-1', 'patch'],
    ['V_1-0-0', 'V_1-1-0', 'minor'],
    ['V_0-1-0', 'V_1-0-0', 'major'],
    ['V_0-2-0', 'V_0-2-0', 'same'],
  ]
  it.each(cases)('gapKind(%s, %s) === %s', (pinned, adopted, expected) => {
    expect(gapKind(pinned, adopted)).toBe(expected)
  })

  it('returns null when a version is unparseable', () => {
    expect(gapKind('V_0-1-0', 'garbage')).toBeNull()
  })
})

describe('parsePinnedUrl', () => {
  it('resolves the flat package layout', () => {
    expect(parsePinnedUrl(`${CANON}/business/business_V_0-2-0_NN.md`)).toEqual({
      name: 'business',
      version: 'V_0-2-0',
    })
  })

  it('resolves a flat root spec with the _spec_NN suffix', () => {
    expect(parsePinnedUrl(`${CANON}/workspace_V_0-3-0_spec_NN.md`)).toEqual({
      name: 'workspace',
      version: 'V_0-3-0',
    })
  })

  it('resolves the versioned-directory package layout', () => {
    expect(parsePinnedUrl(`${CANON}/documentation/V_0-2-0/spec_NN.md`)).toEqual({
      name: 'documentation',
      version: 'V_0-2-0',
    })
  })

  it('returns null for a non-canonical specialization URL', () => {
    expect(parsePinnedUrl('https://x/specs/Custom_V_0-1-0_my_spec_NN.md')).toBeNull()
  })

  it('returns null for an unversioned URL', () => {
    expect(parsePinnedUrl('https://x/specs/workspace_spec_NN.md')).toBeNull()
  })
})

describe('classifyAgainstCatalog', () => {
  it('classifies a model pinned to the adopted version as current', () => {
    const c = classifyAgainstCatalog(`${CANON}/business/business_V_0-2-0_NN.md`, CATALOG)
    expect(c.status).toBe('current')
    expect(c.gap).toBe('same')
    expect(c.template).toBe('business')
    expect(c.pinned).toBe('V_0-2-0')
    expect(c.adopted).toBe('V_0-2-0')
  })

  it('classifies an older pin as upgrade-available and reports the bump gap', () => {
    const c = classifyAgainstCatalog(`${CANON}/business/business_V_0-1-0_NN.md`, CATALOG)
    expect(c.status).toBe('upgrade-available')
    expect(c.gap).toBe('minor')
    expect(c.pinned).toBe('V_0-1-0')
    expect(c.adopted).toBe('V_0-2-0')
  })

  it('classifies a newer pin than the catalog adopted version as ahead', () => {
    const c = classifyAgainstCatalog(`${CANON}/business/business_V_0-3-0_NN.md`, CATALOG)
    expect(c.status).toBe('ahead')
  })

  it('classifies a template absent from the catalog as unlisted', () => {
    const c = classifyAgainstCatalog(`${CANON}/procedures/procedures_V_0-1-0_NN.md`, CATALOG)
    expect(c.status).toBe('unlisted')
    expect(c.template).toBe('procedures')
  })

  it('classifies a non-canonical specialization URL as unlisted', () => {
    const c = classifyAgainstCatalog('https://x/specs/Custom_V_0-1-0_my_spec_NN.md', CATALOG)
    expect(c.status).toBe('unlisted')
    expect(c.template).toBeNull()
  })

  it('classifies a model with no parent URL as unpinned', () => {
    const c = classifyAgainstCatalog(null, CATALOG)
    expect(c.status).toBe('unpinned')
    expect(c.template).toBeNull()
  })

  it('classifies an in-catalog version that is not the adopted one and not ahead as unlisted', () => {
    const catalog: TemplateCatalog = {
      blueprints: {
        business: {
          name: 'business',
          adopted: 'V_0-2-0',
          versions: [{ blueprint_version: 'V_0-2-0' }],
        },
      },
    }
    // V_0-1-5 is older than adopted but not a published version → unlisted
    const c = classifyAgainstCatalog(`${CANON}/business/business_V_0-1-5_NN.md`, catalog)
    expect(c.status).toBe('unlisted')
  })

  it('degrades every model to unknown when the catalog is offline (null)', () => {
    const c = classifyAgainstCatalog(`${CANON}/business/business_V_0-1-0_NN.md`, null)
    expect(c.status).toBe('unknown')
    expect(c.gap).toBe('none')
    // informational fields still parsed from the URL
    expect(c.template).toBe('business')
    expect(c.pinned).toBe('V_0-1-0')
  })

  it('reports unknown even for an unpinned model when offline', () => {
    const c = classifyAgainstCatalog(null, null)
    expect(c.status).toBe('unknown')
    expect(c.gap).toBe('none')
  })
})
