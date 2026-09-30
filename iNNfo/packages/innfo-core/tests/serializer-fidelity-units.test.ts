import { describe, it, expect } from 'vitest'
import { parseKnowledge, serializeKnowledge } from '../src/parser/index.js'

/**
 * Focused unit coverage for each class of round-trip defect, so a regression
 * points at the specific rule that broke instead of at "some file in the
 * corpus differs".
 */

function doc(body: string): string {
  return [
    '---',
    'spec_version: "V_0-2-1"',
    'level: 3',
    'title: "Fidelity Fixture"',
    '---',
    '',
    '> [!NOTE]',
    '> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).',
    '',
    body,
  ].join('\n')
}

/** parse -> serialize must return the input unchanged. */
function expectRoundTrip(source: string) {
  expect(serializeKnowledge(parseKnowledge(source))).toBe(source)
}

describe('matrix axis labels (AD-4)', () => {
  it('preserves the header axis labels instead of emitting Row \\ Col', () => {
    const source = doc(
      [
        '# NN matrices: capability matrix',
        '| Metrics \\ Variables | Speed | Accuracy |',
        '| :--- | :---: | :---: |',
        '| Throughput | X | - |',
        '',
      ].join('\n'),
    )
    const serialized = serializeKnowledge(parseKnowledge(source))
    expect(serialized).toContain('| Metrics \\ Variables |')
    expect(serialized).not.toContain('| Row \\ Col |')
  })

  it('keeps a marker column whose cells are all empty', () => {
    const source = doc(
      [
        '# NN matrices: item-markers matrix',
        '| Item \\ Marker | is_variable | is_derived |',
        '| :--- | :---: | :---: |',
        '| Revenue | X | - |',
        '',
      ].join('\n'),
    )
    // `is_derived` is never set, so it exists only in the declared header.
    expect(serializeKnowledge(parseKnowledge(source))).toContain('is_derived')
  })
})

describe('section order (AD-2)', () => {
  it('keeps a text section authored above the element sections above them', () => {
    const source = doc(
      [
        '# NN Analysis',
        '',
        'Narrative written before the elements.',
        '',
        '# NN Stakeholders',
        '',
        '## NN Stakeholders: Alice',
        'role:: lead',
        '',
      ].join('\n'),
    )
    const serialized = serializeKnowledge(parseKnowledge(source))
    expect(serialized.indexOf('# NN Analysis')).toBeLessThan(serialized.indexOf('# NN Stakeholders'))
    expectRoundTrip(source)
  })
})

describe('property value form (AD-1)', () => {
  it('preserves the bracket list form rather than JSON-quoting it', () => {
    const source = doc(
      ['# NN Stakeholders', '', '## NN Stakeholders: Alice', 'needs:: [speed, accuracy]', ''].join(
        '\n',
      ),
    )
    const serialized = serializeKnowledge(parseKnowledge(source))
    expect(serialized).toContain('needs:: [speed, accuracy]')
    expect(serialized).not.toContain('["speed","accuracy"]')
  })

  it('writes properties at column 0', () => {
    const source = doc(
      ['# NN Stakeholders', '', '## NN Stakeholders: Alice', 'role:: lead', ''].join('\n'),
    )
    expect(serializeKnowledge(parseKnowledge(source))).toContain('\nrole:: lead')
  })

  it('preserves authored tag casing while parsing tags case-insensitively', () => {
    const source = doc(
      ['# NN Stakeholders', '', '## NN Stakeholders: Alice', 'tags:: [founder, PR]', ''].join('\n'),
    )
    const parsed = parseKnowledge(source)
    expect(parsed.elements.get('Stakeholders')![0].tags).toEqual(['founder', 'pr'])
    expect(serializeKnowledge(parsed)).toContain('tags:: [founder, PR]')
  })
})

describe('indentation stripping (AD-3)', () => {
  it('converges a document damaged by the old indenting serializer in one pass', () => {
    // What the previous serializer wrote: two spaces before every property
    // and description line, growing by two on every further save.
    const damaged = doc(
      [
        '# NN Stakeholders',
        '',
        '## NN Stakeholders: Alice',
        '  role:: lead',
        '  Alice leads customer relationships.',
        '',
      ].join('\n'),
    )
    const once = serializeKnowledge(parseKnowledge(damaged))
    expect(once).toContain('\nrole:: lead')
    expect(once).not.toContain('\n  role:: lead')
    // And it stays converged: no residual drift on the next save.
    expect(serializeKnowledge(parseKnowledge(once))).toBe(once)
  })
})

describe('explicit slugs survive a save', () => {
  it('re-emits an authored slug:: line', () => {
    const source = doc(
      [
        '# NN Shareholders',
        '',
        '## NN Shareholders: Dr. Peter Venkman',
        'slug:: shareholders-dr-peter-venkman',
        'role:: founder',
        '',
      ].join('\n'),
    )
    expect(serializeKnowledge(parseKnowledge(source))).toContain('slug:: shareholders-dr-peter-venkman')
    expectRoundTrip(source)
  })

  it('does not invent a slug:: line for an element that never declared one', () => {
    // Every element gets a DERIVED slug after parsing; only an authored one
    // may be written back, or every document would grow a slug line per
    // element on its first save.
    const source = doc(
      ['# NN Shareholders', '', '## NN Shareholders: Alice', 'role:: founder', ''].join('\n'),
    )
    expect(serializeKnowledge(parseKnowledge(source))).not.toContain('slug::')
  })
})

describe('frontmatter and preamble fidelity', () => {
  it('keeps a frontmatter key outside the constructed allow-list', () => {
    const source = [
      '---',
      'spec_version: "V_0-2-1"',
      'level: 3',
      'title: "Fidelity Fixture"',
      'workspace_id: "ghostbusters"',
      '---',
      '',
      '> [!NOTE]',
      '> Short banner.',
      '',
      '# NN Stakeholders',
      '',
      '## NN Stakeholders: Alice',
      'role:: lead',
      '',
    ].join('\n')
    expect(serializeKnowledge(parseKnowledge(source))).toContain('workspace_id: "ghostbusters"')
    expectRoundTrip(source)
  })

  it('keeps banner content beyond the standard note', () => {
    const source = [
      '---',
      'spec_version: "V_0-2-1"',
      'level: 3',
      'title: "Fidelity Fixture"',
      '---',
      '',
      '> [!NOTE]',
      '> Standard note.',
      '>',
      '> **Experimental**: extra banner content the author added.',
      '',
      '# NN Stakeholders',
      '',
      '## NN Stakeholders: Alice',
      'role:: lead',
      '',
    ].join('\n')
    expect(serializeKnowledge(parseKnowledge(source))).toContain('**Experimental**')
    expectRoundTrip(source)
  })
})

describe('blank-line placement is replayed, not assumed', () => {
  it('keeps a concept heading with no blank line before its first element', () => {
    expectRoundTrip(
      doc(['# NN Stakeholders', '## NN Stakeholders: Alice', 'role:: lead', ''].join('\n')),
    )
  })

  it('keeps a blank line between an element’s fields and its prose', () => {
    expectRoundTrip(
      doc(
        [
          '# NN Stakeholders',
          '',
          '## NN Stakeholders: Alice',
          'role:: lead',
          '',
          'Alice leads customer relationships.',
          '',
        ].join('\n'),
      ),
    )
  })

  it('keeps an element whose prose follows its fields with no blank line', () => {
    expectRoundTrip(
      doc(
        [
          '# NN Stakeholders',
          '',
          '## NN Stakeholders: Alice',
          'role:: lead',
          'Alice leads customer relationships.',
          '',
        ].join('\n'),
      ),
    )
  })
})
