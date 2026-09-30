import { describe, it, expect } from 'vitest'
import { parseKnowledge, parseYaml, parseFrontmatter, serializeKnowledge, parseMarkdownTable, parseTableRow } from '../src/parser'

describe('Standardised Parser (TDD)', () => {
  it('parses complex nested frontmatter with standard YAML features', () => {
    const yamlStr = `
spec_version: "V_0-2-0"
nested:
  nested_list:
    - name: "Item 1"
      value: true
    - name: "Item 2"
      value: false
inline_array: [10, 20, 30]
inline_object: { key: "value", num: 42 }
multi_line: |
  Line 1
  Line 2
`
    const parsed = parseYaml(yamlStr)
    expect(parsed.nested).toEqual({
      nested_list: [
        { name: 'Item 1', value: true },
        { name: 'Item 2', value: false },
      ],
    })
    expect(parsed.inline_array).toEqual([10, 20, 30])
    expect(parsed.inline_object).toEqual({ key: 'value', num: 42 })
    expect(parsed.multi_line).toBe('Line 1\nLine 2\n')
  })

  it('parses a model with complex section boundaries and list syntax', () => {
    const modelContent = `---
spec_version: "V_0-2-0"
level: 3
knowledge_version: "V_1-0-0"
title: "Complex Model"
---

# NN Stakeholders

## NN Stakeholders: Customer

importance:: "high"
needs:: ["speed", "accuracy"]

  Customer description goes here.
  It can span multiple lines.

## NN Stakeholders: Partner

importance:: "medium"

  Partner description.
`
    const model = parseKnowledge(modelContent)
    const list = model.elements.get('Stakeholders')
    expect(list).toBeDefined()
    expect(list).toHaveLength(2)

    const customer = list![0]
    expect(customer.name).toBe('Customer')
    expect(customer.fields.importance).toBe('high')
    expect(customer.fields.needs).toEqual(['speed', 'accuracy'])
    expect(customer.description).toContain('Customer description goes here.')

    const partner = list![1]
    expect(partner.name).toBe('Partner')
    expect(partner.fields.importance).toBe('medium')
    expect(partner.description).toBe('Partner description.')
  })

  it('preserves free-form Markdown content of `text` concepts in rawSections', () => {
    const modelContent = `---
spec_version: "V_0-2-0"
level: 3
knowledge_version: "V_1-0-0"
title: "Text Concept Model"
---

# NN index

* [[Market size]]

# NN Market size

En España fallecieron 439.146 personas en 2024 (INE).

**TAM:** ~500.000 procesos de reparto anuales.

# NN Stakeholders

## NN Stakeholders: Customer
  Customer description.
`
    const model = parseKnowledge(modelContent)
    expect(model.rawSections).toBeDefined()
    // `text` concepts have no elements but their body IS the content.
    expect(model.elements.get('Market size')).toBeUndefined()
    expect(model.rawSections!['Market size']).toContain(
      'En España fallecieron 439.146 personas en 2024 (INE).',
    )
    expect(model.rawSections!['Market size']).toContain(
      '**TAM:** ~500.000 procesos de reparto anuales.',
    )
    // Element-bearing concepts are serialized from `elements`; their raw body
    // is not duplicated in rawSections.
    expect(model.rawSections!['Stakeholders']).toBeUndefined()
  })

  it('round-trips `text` concept content through serializer', () => {
    const modelContent = `---
spec_version: "V_0-2-0"
level: 3
knowledge_version: "V_1-0-0"
title: "Text Round Trip"
---

# NN index

* [[Market size]]

# NN Market size

En España fallecieron 439.146 personas en 2024 (INE).

**TAM:** ~500.000 procesos de reparto anuales.
`
    const model = parseKnowledge(modelContent)
    expect(model.rawSections!['Market size']).toContain('**TAM:**')

    const serialized = serializeKnowledge(model)
    expect(serialized).toContain('# NN Market size')
    expect(serialized).toContain('En España fallecieron 439.146 personas en 2024 (INE).')
    expect(serialized).toContain('**TAM:** ~500.000 procesos de reparto anuales.')
  })

  it('keeps bullet lines as element prose in `description` (C4)', () => {
    const modelContent = `---
spec_version: "V_0-2-0"
level: 3
knowledge_version: "V_1-0-0"
title: "Bullet Prose"
---

# NN Stakeholders

## NN Stakeholders: Customer

importance:: "high"

- one
- two
`
    const model = parseKnowledge(modelContent)
    const customer = model.elements.get('Stakeholders')![0]
    expect(customer.description).toContain('- one')
    expect(customer.description).toContain('- two')
    expect(customer.fields.importance).toBe('high')

    const serialized = serializeKnowledge(model)
    expect(serialized).toContain('- one')
    expect(serialized).toContain('- two')

    const reparsed = parseKnowledge(serialized)
    expect(reparsed.elements.get('Stakeholders')![0].description).toContain('- one')
  })

  it('keeps a `key:: value` line right after the header as a field, not prose (C4)', () => {
    const modelContent = `---
spec_version: "V_0-2-0"
level: 3
knowledge_version: "V_1-0-0"
title: "Field vs Prose"
---

# NN Stakeholders

## NN Stakeholders: Customer

category:: priority
- note
`
    const model = parseKnowledge(modelContent)
    const customer = model.elements.get('Stakeholders')![0]
    expect(customer.fields.category).toBe('priority')
    expect(customer.description).toContain('- note')
  })

  it('parses tags:: property correctly and normalizes them', () => {
    const modelContent = `---
spec_version: "V_0-2-0"
level: 3
title: "Tags Model"
---

# NN Some Concept
tags:: tag1, Tag2,   TAG3 , tag1 

## NN Some Concept: Some Element
tags:: el-tag1 , EL-tag2, , el-tag3

This is an element with tags.
`
    const parsed = parseKnowledge(modelContent)

    // Check Concept tags
    expect(parsed.conceptTags).toBeDefined()
    expect(parsed.conceptTags!['Some Concept']).toEqual(['tag1', 'tag2', 'tag3', 'tag1'])

    // Check Element tags
    const elements = parsed.elements.get('Some Concept')
    expect(elements).toBeDefined()
    expect(elements![0].tags).toEqual(['el-tag1', 'el-tag2', 'el-tag3'])

    // Check Serialization round-trip
    const serialized = serializeKnowledge(parsed)
    // Tag VALUES are normalized (lowercased, trimmed) — asserted above. The
    // tag SOURCE TEXT is preserved verbatim: re-emitting the author's own
    // line is what keeps a save byte-identical, and the canonical bracket
    // form is only produced for tags with no recorded source text.
    expect(serialized).toContain('tags:: tag1, Tag2,   TAG3 , tag1')
    expect(serialized).toContain('tags:: el-tag1 , EL-tag2, , el-tag3')

    const reParsed = parseKnowledge(serialized)
    expect(reParsed.conceptTags!['Some Concept']).toEqual(['tag1', 'tag2', 'tag3', 'tag1'])
    expect(reParsed.elements.get('Some Concept')![0].tags).toEqual([
      'el-tag1',
      'el-tag2',
      'el-tag3',
    ])
  })

  it('parses bracket-array tags:: syntax without leaking brackets', () => {
    const modelContent = `---
spec_version: "V_0-2-0"
level: 3
title: "Bracket Tags Model"
---

# NN Task
tags:: [management, priority]

## NN Task: Alpha
tags:: [frontend, core]

Alpha description.
`
    const parsed = parseKnowledge(modelContent)

    expect(parsed.conceptTags!['Task']).toEqual(['management', 'priority'])
    expect(parsed.elements.get('Task')![0].tags).toEqual(['frontend', 'core'])

    const serialized = serializeKnowledge(parsed)
    const reParsed = parseKnowledge(serialized)
    expect(reParsed.conceptTags!['Task']).toEqual(['management', 'priority'])
    expect(reParsed.elements.get('Task')![0].tags).toEqual(['frontend', 'core'])
  })

  it('parses tables with optional leading and trailing delimiters (PR7 / C6)', () => {
    const t1 = '| a | b |\n| :--- | :---: |\n| 1 | 2 |'
    const t2 = 'a | b\n:--- | :---:\n1 | 2'
    const t3 = '| a | b\n| :--- | :---:\n| 1 | 2'
    const t4 = 'a | b |\n:--- | :---: |\n1 | 2 |'

    const res1 = parseMarkdownTable(t1)
    const res2 = parseMarkdownTable(t2)
    const res3 = parseMarkdownTable(t3)
    const res4 = parseMarkdownTable(t4)

    expect(res1).toEqual([{ a: '1', b: '2' }])
    expect(res2).toEqual(res1)
    expect(res3).toEqual(res1)
    expect(res4).toEqual(res1)

    // parseTableRow direct checks
    expect(parseTableRow('| a | b |')).toEqual(['a', 'b'])
    expect(parseTableRow('a | b')).toEqual(['a', 'b'])
    expect(parseTableRow('| a | b')).toEqual(['a', 'b'])
    expect(parseTableRow('a | b |')).toEqual(['a', 'b'])
  })

  describe('normalizeLevel (F4 — coerce `level` to a number at the parse boundary)', () => {
    it('coerces a quoted numeric string to a number', () => {
      const fm = parseFrontmatter('---\nlevel: "2"\n---\n')
      expect(fm!.level).toBe(2)
    })

    it('leaves an unquoted number unchanged (corpus-dominant form)', () => {
      const fm = parseFrontmatter('---\nlevel: 2\n---\n')
      expect(fm!.level).toBe(2)
    })

    it('leaves a non-numeric string unchanged and does not throw', () => {
      const fm = parseFrontmatter('---\nlevel: "abc"\n---\n')
      expect(fm!.level).toBe('abc')
    })

    it('leaves an empty string unchanged, not coerced to 0', () => {
      const fm = parseFrontmatter('---\nlevel: ""\n---\n')
      expect(fm!.level).toBe('')
    })

    it('leaves a non-integer numeric string unchanged', () => {
      const fm = parseFrontmatter('---\nlevel: "2.5"\n---\n')
      expect(fm!.level).toBe('2.5')
    })

    it('does not add a level key when it is absent', () => {
      const fm = parseFrontmatter('---\nspec_version: "V_0-2-0"\n---\n')
      expect('level' in fm!).toBe(false)
    })
  })
})
