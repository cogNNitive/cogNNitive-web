import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveBlueprintSchema,
  checkWidgetConfig,
  checkElementsAgainstSchema,
  scaleRangeFor,
  validateDocument,
  validateKnowledge,
  parseKnowledge,
  normalizeSingleKnowledge,
} from '../src/index'
import type { SpecDocument } from '../src/index'

const BASE_A = `---
level: 2
title: "Base A"
parent_spec:
  name: "iNNfo_V_0-1-0"
  url: "https://example.test/iNNfo_V_0-1-0_NN.md"
---

# NN Concept Definition
## NN Concept Definition: Alpha
type:: list

# NN Field Definition
## NN Field Definition: status
concept:: Alpha
type:: select
options:: [open, closed]

# NN Marker Definition
## NN Marker Definition: priority
applies_to:: [Element]
`

const BASE_B = `---
level: 2
title: "Base B"
parent_spec:
  name: "iNNfo_V_0-1-0"
  url: "https://example.test/iNNfo_V_0-1-0_NN.md"
---

# NN Concept Definition
## NN Concept Definition: Beta
type:: list
`

const COMPOSITE = `---
level: 2
title: "Composite"
parent_spec:
  name: "iNNfo_V_0-1-0"
  url: "https://example.test/iNNfo_V_0-1-0_NN.md"
includes:
  - name: "base_a"
    url: "https://example.test/base_a_NN.md"
  - name: "base_b"
    url: "https://example.test/base_b_NN.md"
---

# NN Concept Definition
## NN Concept Definition: Gamma
type:: list
`

const lookup = (name: string): string | null => {
  const m: Record<string, string> = { base_a: BASE_A, base_b: BASE_B, composite: COMPOSITE }
  return m[name.toLowerCase()] ?? null
}

describe('resolveBlueprintSchema — additive `includes` composition', () => {
  it('unions concepts / fields / markers from every included template plus the local ones', () => {
    const { schema, errors } = resolveBlueprintSchema(COMPOSITE, (ref) => lookup(ref.name))
    expect(errors).toEqual([])
    expect(schema.concepts.map((c) => c.name).sort()).toEqual(['Alpha', 'Beta', 'Gamma'])
    const alpha = schema.concepts.find((c) => c.name === 'Alpha')!
    expect(alpha.fields?.map((f) => f.name)).toEqual(['status'])
    expect(schema.markers.map((m) => m.name)).toEqual(['priority'])
  })

  it('no resolver → just the template’s own schema, no errors', () => {
    const { schema, errors } = resolveBlueprintSchema(COMPOSITE)
    expect(errors).toEqual([])
    expect(schema.concepts.map((c) => c.name)).toEqual(['Gamma'])
  })

  it('flags a name collision between two sources as an ERROR naming both', () => {
    const clash = COMPOSITE.replace(
      '## NN Concept Definition: Gamma',
      '## NN Concept Definition: Alpha',
    )
    const { errors } = resolveBlueprintSchema(clash, (ref) => lookup(ref.name))
    const collision = errors.find((e) => e.message.includes('Alpha'))
    expect(collision?.severity).toBe('error')
    expect(collision?.message).toMatch(/Base A/)
    expect(collision?.message).toMatch(/Composite/)
    // labels come from each source template's own `title`
  })

  it('flags an unresolvable include', () => {
    const { errors } = resolveBlueprintSchema(COMPOSITE, (ref) =>
      ref.name === 'base_a' ? null : lookup(ref.name),
    )
    expect(errors.some((e) => e.message.includes('base_a') && e.severity === 'error')).toBe(true)
  })

  it('detects an `includes` cycle', () => {
    const selfRef = BASE_B.replace(
      '---\n\n# NN Concept Definition',
      'includes:\n  - name: "composite"\n    url: "x"\n---\n\n# NN Concept Definition',
    )
    const cyc = (ref: { name: string; url: string }): string | null =>
      ref.name.toLowerCase() === 'base_b'
        ? selfRef
        : ref.name.toLowerCase() === 'composite'
          ? COMPOSITE
          : lookup(ref.name)
    const { errors } = resolveBlueprintSchema(COMPOSITE, cyc)
    expect(errors.some((e) => /cyclic/i.test(e.message))).toBe(true)
  })

  it('flags unresolvable matrix source or target concepts', () => {
    const brokenMatrixTpl = COMPOSITE + `
# NN Matrix Definition
## NN Matrix Definition: Broken Matrix
source:: NonExistentSource
target:: NonExistentTarget
values:: [X]
`
    const { errors } = resolveBlueprintSchema(brokenMatrixTpl, (ref) => lookup(ref.name))
    expect(errors.some((e) => e.message.includes('NonExistentSource') && e.severity === 'error')).toBe(true)
    expect(errors.some((e) => e.message.includes('NonExistentTarget') && e.severity === 'error')).toBe(true)
  })
})

describe('validateKnowledge — applies_to and marker value enforcement', () => {
  const template: SpecDocument = {
    name: 'markers_tpl',
    level: 2,
    frontmatter: { spec_version: 'V_0-1-0', level: 2, title: 'Markers Tpl' },
    rawContent: `---
level: 2
title: "Markers Tpl"
---

# NN Concept Definition
## NN Concept Definition: Task
type:: list

# NN Marker Definition
## NN Marker Definition: priority
applies_to:: [Element]
values:: [low, high]
`,
  }

  it('rejects a marker scored on a Concept when applies_to is [Element]', () => {
    const model = parseKnowledge(`---
level: 3
knowledge_version: "V_1-0-0"
title: "M"
parent_spec:
  name: "markers_tpl"
  url: "https://example.test/markers_tpl_NN.md"
---

# NN index
* [[Task]]

# NN Task
## NN Task: T1

# NN matrices: item-markers matrix
| Item \\ Marker | priority |
| :--- | :---: |
| Task | high |
| T1 | low |
`)
    const res = validateKnowledge(model, template, null)
    const err = res.errors.find((e) => e.message.includes('scored on Concept'))
    expect(err).toBeDefined()
    expect(res.valid).toBe(false)
  })

  it('warns on a marker score outside its declared value set', () => {
    const model = parseKnowledge(`---
level: 3
knowledge_version: "V_1-0-0"
title: "M"
parent_spec:
  name: "markers_tpl"
  url: "https://example.test/markers_tpl_NN.md"
---

# NN index
* [[Task]]

# NN Task
## NN Task: T1

# NN matrices: item-markers matrix
| Item \\ Marker | priority |
| :--- | :---: |
| T1 | urgent |
`)
    const res = validateKnowledge(model, template, null)
    expect(res.warnings.some((w) => w.message.includes('not in its declared value set'))).toBe(true)
  })
})

describe('checkWidgetConfig', () => {
  it('errors when widget:: scale is missing min/max, warns on stray keys', () => {
    const parsed = parseKnowledge(`---
level: 2
title: "T"
---

# NN Matrix Definition
## NN Matrix Definition: m1
source:: A
target:: B
widget:: scale
widget_config:: {"step": 2, "bogus": 1}
`)
    const diags = checkWidgetConfig([
      ['Matrix Definition', parsed.elements.get('Matrix Definition') ?? []],
    ])
    expect(
      diags.some((d) => d.severity === 'error' && d.message.includes('widget_config.min')),
    ).toBe(true)
    expect(
      diags.some((d) => d.severity === 'error' && d.message.includes('widget_config.max')),
    ).toBe(true)
    expect(diags.some((d) => d.severity === 'warning' && d.message.includes('bogus'))).toBe(true)
  })
})

describe('scaleRangeFor', () => {
  it('honors widget_config {min,max,step} first', () => {
    expect(scaleRangeFor({ widgetConfig: { min: 0, max: 10, step: 5 } })).toEqual([0, 5, 10])
  })
  it('falls back to a numeric values array', () => {
    expect(scaleRangeFor({ values: ['1', '2', '3'] })).toEqual([1, 2, 3])
  })
  it('falls back to the 1..5 default', () => {
    expect(scaleRangeFor({})).toEqual([1, 2, 3, 4, 5])
  })
})

describe('validateDocument — one door (hygiene + schema)', () => {
  it('flags an empty-body model that the schema pass alone would pass', () => {
    // What init_model used to emit: frontmatter + the NOTE line, no concepts.
    const content = `---
spec_version: "V_0-1-0"
level: 3
knowledge_version: "V_1-0-0"
title: "Empty"
parent_spec:
  name: "x"
  url: "https://example.test/x_NN.md"
---

> [!NOTE]
> This is an **iNNfo document**.
`
    const res = validateDocument(content, { fileName: 'empty_NN.md' })
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.path.startsWith('format.'))).toBe(true)
  })
})

describe('recursiveParser — concept-scoped Marker scores', () => {
  it('preserves an item-markers row keyed by a Concept name on the document root', () => {
    const content = `---
level: 3
knowledge_version: "V_1-0-0"
title: "M"
parent_spec:
  name: "t"
  url: "https://example.test/t_NN.md"
---

# NN index
* [[Task]]

# NN Task
## NN Task: T1

# NN matrices: item-markers matrix
| Item \\ Marker | complexity |
| :--- | :---: |
| Task | high |
| T1 | low |
`
    const { nodes } = normalizeSingleKnowledge(content, 'm_NN.md', 'm')
    const root = Object.values(nodes).find((n) => n.parentId === null)!
    expect(root.conceptMarkers).toBeDefined()
    expect(root.conceptMarkers!['Task']).toEqual({ complexity: 'high' })
    // the element-scoped row still lands on the element
    const t1 = Object.values(nodes).find((n) => n.name === 'T1')!
    expect(t1.markers).toEqual({ complexity: 'low' })
  })
})

describe('base_V_0-1-0 — composite template composition (PR6)', () => {
  const specsRoot = join(import.meta.dirname!, '..', '..', '..', 'specs')
  const readSpec = (p: string): string => readFileSync(join(specsRoot, p), 'utf-8')

  // SKIPPED under canonical blueprints: `base` is a frozen/retired composite
  // pinned to the workspace + cogNNitive vocabularies as they stood at V_0-2-0.
  // Canonical `workspace` is now V_0-3-0 (it absorbed Sources/Artifacts/
  // Procedures/lineage from the provenance consolidation), so composing the
  // frozen `base` shell over it legitimately reports COMPOSITION_COLLISIONs.
  // The live composition contract is covered by business-decomposition-v2.test.ts.
  it.skip('base-composes-workspace-and-cognnitive: resolving base_V_0-1-0 unions both peers with no collisions', () => {
    const baseContent = readSpec('bluepriNNts/base/spec_NN.md')
    const workspaceContent = readSpec('bluepriNNts/workspace_spec_NN.md')
    const cognnitiveContent = readSpec('bluepriNNts/cogNNitive/spec_NN.md')

    const lookup = (name: string): string | null => {
      const m: Record<string, string> = {
        'workspace_v_0-2-0': workspaceContent,
        'cognnitive_v_0-2-0': cognnitiveContent,
      }
      return m[name.toLowerCase()] ?? null
    }

    const { schema, errors } = resolveBlueprintSchema(baseContent, (ref) => lookup(ref.name))

    expect(errors.filter((e) => e.message.includes('COMPOSITION_COLLISION'))).toEqual([])
    expect(errors).toEqual([])
    expect(schema.concepts.map((c) => c.name).sort()).toEqual([
      'Artifacts',
      'Asset',
      'Folder',
      'ModelRecords',
      'Models',
      'Overview',
      'Procedures',
      'Sources',
      'Tag',
      'Workspace',
    ])

    const overview = schema.concepts.find((c) => c.name === 'Overview')!
    expect(overview.fields?.map((f) => f.name).sort()).toEqual(['manifest', 'provenance'])
    expect(overview.fields?.find((f) => f.name === 'manifest')?.type).toBe('model')
    expect(overview.fields?.find((f) => f.name === 'provenance')?.type).toBe('model')
  })
})

describe('checkElementsAgainstSchema — shared property/enum pass', () => {
  it('warns on an undeclared property and errors on a bad enum value', () => {
    const concepts = [
      {
        name: 'Task',
        type: 'list' as const,
        fields: [{ name: 'state', type: 'select' as const, options: ['a', 'b'] }],
      },
    ]
    const diags = checkElementsAgainstSchema(
      [['Task', [{ name: 'T1', fields: { state: 'zzz', bogus: 1 } }]]],
      concepts,
    )
    expect(
      diags.some((d) => d.severity === 'error' && d.message.includes('Invalid value "zzz"')),
    ).toBe(true)
    expect(diags.some((d) => d.severity === 'warning' && d.message.includes('bogus'))).toBe(true)
  })
})
