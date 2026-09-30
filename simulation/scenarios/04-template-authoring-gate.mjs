/**
 * S04 — Who is allowed to change the schema.
 *
 * iNNfo's central invariant: a template (level 2) declares the vocabulary, a
 * model (level 3) only instantiates it. An agent editing a user's model must
 * not be able to invent new Concepts or Fields inside that model.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createScenario, SIM, ROOT } from '../lib/harness.mjs'
import { loadCore } from '../lib/core.mjs'

const MODEL = join(SIM, 'fixtures', 'acme', 'models', 'Acme_analysis_NN.md')
const TEMPLATE = join(ROOT, 'iNNfo', 'specs', 'templates', 'analysis', 'spec_NN.md')

export default async function run() {
  const { parseKnowledge, applyMutation, validateDocument, serializeKnowledge } = await loadCore()
  const s = createScenario('S04', 'Template-authoring gate (level 2 vs level 3)',
    'An agent tries to extend the schema from inside a user model; the gate must hold.')

  try {
    const model = parseKnowledge(await readFile(MODEL, 'utf-8'))
    const template = parseKnowledge(await readFile(TEMPLATE, 'utf-8'))

    for (const [op, args] of [
      ['add_concept', { conceptName: 'Hypotheses' }],
      ['add_field', { conceptName: 'Risks', fieldName: 'severity' }],
      ['set_marker', { markerName: 'confidence' }],
    ]) {
      const r = applyMutation(model, op, args)
      s.expect(
        `Level-3 model refuses \`${op}\``,
        { success: r.success, errors: r.errors },
        (v) => v.success === false,
        'schema-authoring ops are gated to level-2 documents',
      )
    }

    const onBlueprint = applyMutation(template, 'add_concept', { conceptName: 'Hypotheses' })
    s.expect(
      'The same op succeeds on a level-2 template',
      { success: onBlueprint.success, errors: onBlueprint.errors },
      (v) => v.success === true,
      'the gate discriminates by level, it does not simply forbid the op',
    )

    // A level-3 model that smuggles schema in via frontmatter must be caught.
    const smuggled = (await readFile(MODEL, 'utf-8')).replace(
      'title: "Acme Operational Analysis"',
      'title: "Acme Operational Analysis"\nconcepts:\n  - name: "Hypotheses"',
    )
    const report = validateDocument(smuggled, { fileName: 'Acme_analysis_NN.md' })
    s.expect(
      'A level-3 model declaring inline schema is rejected by validation',
      report.errors.map((e) => ({ code: e.code, path: e.path, message: e.message })),
      (errs) => errs.length > 0,
      'an error naming the illegal frontmatter key',
    )

    s.observe(
      'What a level-3 model looks like after a refused mutation',
      serializeKnowledge(model).split(/\r?\n/).filter((l) => l.startsWith('# NN ')).join(' | '),
      'no `# NN Concept Definition` section should have appeared',
    )
  } catch (err) {
    s.crash('scenario execution', err)
  }
  return s
}
