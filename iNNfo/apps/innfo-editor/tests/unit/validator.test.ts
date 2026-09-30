import { describe, it, expect } from 'vitest'
import { validateFormatContent } from '../../src/shared/validator'

const validModel = `---
spec_version: "V_0-2-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-0_NN.md"
level: 3
parent_spec:
  name: "business_V_0-1-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/business_V_0-1-1_FORMAT.md"
knowledge_version: "V_0-1-2"
title: "Ghostbusters"
type: "BusinessModel"
---

> [!NOTE] This is an iNNfo business model.

# NN Stakeholders
## NN Stakeholders: Ghostbusters Inc.
`

const validModelNoType = `---
spec_version: "V_0-2-0"
spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-2-0_NN.md"
level: 2
parent_spec:
  name: "business_V_0-1-1"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/business_V_0-1-1_FORMAT.md"
knowledge_version: "V_0-1-2"
title: "Ghostbusters"
---

> [!NOTE] This is an iNNfo business model.

# NN index
* [[Stakeholders]]

# NN Stakeholders
## NN Stakeholders: Ghostbusters Inc.
`

describe('validateFormatContent', () => {
  it('returns all expected check IDs', () => {
    const report = validateFormatContent(
      validModel,
      'Ghostbusters_V_0-1-2_business_NN.md',
      'V_0-2-0',
    )
    const ids = report.checks.map((c) => c.id).sort()
    // 15+ checks: 8-9 frontmatter + 7 body + 3-4 convention
    expect(ids).toContain('fm-level')
    expect(ids).toContain('fm-parent')
    expect(ids).toContain('fm-version')
    expect(ids).toContain('fm-version-format')
    expect(ids).toContain('fm-title')
    expect(ids).toContain('fm-spec-version')
    expect(ids).toContain('fm-spec-version-match')
    expect(ids).toContain('body-note')
    expect(ids).toContain('body-index')
    expect(ids).toContain('body-concept-sections')
    expect(ids).toContain('body-element-markers')
    expect(ids).toContain('conv-file-naming')
    // conv-type-field applies to level 2 files
    const level2Report = validateFormatContent(validModelNoType, 'template_NN.md')
    expect(level2Report.checks.map((c) => c.id)).toContain('conv-type-field')
    // conv-wikilinks only fires when index has [[wikilinks]], which our test model doesn't use
    // body-numbered-list-markers fires when numbered lists are used
    // body-invalid-bullet-chars fires when invalid bullet chars are used
    expect(ids.length).toBeGreaterThanOrEqual(12)
  })

  it('passes frontmatter checks for valid model', () => {
    const report = validateFormatContent(validModel, 'test_NN.md', 'V_0-2-0')
    const frontmatterChecks = report.checks.filter((c) => c.category === 'frontmatter')
    expect(frontmatterChecks.every((c) => c.passed)).toBe(true)
  })

  it('detects missing frontmatter fields', () => {
    const noTitle = validModel.replace(/^title:.*$/m, '')
    const report = validateFormatContent(noTitle, 'test_NN.md')
    const titleCheck = report.checks.find((c) => c.id === 'fm-title')
    expect(titleCheck?.passed).toBe(false)
    expect(titleCheck?.message).toContain('Missing title')
  })

  it('detects invalid version format', () => {
    const badVersion = validModel.replace(/^knowledge_version:.*$/m, 'knowledge_version: "bad"')
    const report = validateFormatContent(badVersion, 'test_NN.md')
    const versionCheck = report.checks.find((c) => c.id === 'fm-version-format')
    expect(versionCheck?.passed).toBe(false)
  })

  it('flags bullet elements that are not ## NN headings', () => {
    const noMarkers = validModel.replace(
      '## NN Stakeholders: Ghostbusters Inc.',
      '* Stakeholders: Ghostbusters Inc.',
    )
    const report = validateFormatContent(noMarkers, 'test_NN.md')
    const markerCheck = report.checks.find((c) => c.id === 'body-element-markers')
    expect(markerCheck?.passed).toBe(false)
  })

  it('flags numbered headings that are not ## NN element headings', () => {
    const numbered = validModel.replace(
      '## NN Stakeholders: Ghostbusters Inc.',
      '## 1. Stakeholders: Ghostbusters Inc.',
    )
    const report = validateFormatContent(numbered, 'test_NN.md')
    const markerCheck = report.checks.find((c) => c.id === 'body-element-markers')
    expect(markerCheck).toBeDefined()
    expect(markerCheck!.passed).toBe(false)
  })

  it('rejects concept sections without the NN marker', () => {
    const badSection = validModel.replace('# NN Stakeholders', '# Stakeholders')
    const report = validateFormatContent(badSection, 'test_NN.md')
    const sectionsCheck = report.checks.find((c) => c.id === 'body-concept-sections')
    expect(sectionsCheck).toBeDefined()
    expect(sectionsCheck!.passed).toBe(false)
  })

  it('warns on mismatched spec_version', () => {
    const report = validateFormatContent(validModel, 'test_NN.md', 'V_0-1-6')
    const specMatchCheck = report.checks.find((c) => c.id === 'fm-spec-version-match')
    expect(specMatchCheck).toBeDefined()
    expect(specMatchCheck!.passed).toBe(false)
    expect(specMatchCheck!.message).toContain('V_0-1-6')
  })

  it('warns on missing type field for _NN.md files', () => {
    const report = validateFormatContent(validModelNoType, 'test_NN.md')
    const typeCheck = report.checks.find((c) => c.id === 'conv-type-field')
    expect(typeCheck).toBeDefined()
    expect(typeCheck!.passed).toBe(false)
    expect(typeCheck!.message).toContain('Missing type field')
  })

  it('returns structured summary with totals', () => {
    const report = validateFormatContent(validModel, 'test_NN.md')
    expect(report.summary).toHaveProperty('total')
    expect(report.summary).toHaveProperty('passed')
    expect(report.summary).toHaveProperty('errors')
    expect(report.summary).toHaveProperty('warnings')
    expect(report.summary.total).toBeGreaterThan(0)
  })
})
