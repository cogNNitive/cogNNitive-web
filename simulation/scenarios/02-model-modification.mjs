/**
 * S02 — Modifying a model.
 *
 * Simulates the everyday editing loop: add an element, fill a field, rename an
 * element that other elements point at, and remove one — then serialize and
 * re-parse to confirm the file on disk still says what the user meant.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createScenario, SIM, ROOT } from '../lib/harness.mjs'
import { loadCore } from '../lib/core.mjs'

const MODEL = join(SIM, 'fixtures', 'acme', 'models', 'Acme_analysis_NN.md')
const TEMPLATE = join(ROOT, 'iNNfo', 'specs', 'templates', 'analysis', 'spec_NN.md')

export default async function run() {
  const { parseKnowledge, serializeKnowledge, applyMutation, extractBlueprintSchemaFromContent } = await loadCore()
  const s = createScenario('S02', 'Modifying a model', 
    'A user adds a risk, edits it, renames an assumption other elements reference, and deletes a stale entry — expecting the file to stay coherent.')

  try {
    const original = await readFile(MODEL, 'utf-8')
    const schema = extractBlueprintSchemaFromContent(await readFile(TEMPLATE, 'utf-8'))
    let model = parseKnowledge(original)

    s.expect(
      'Model loads with its elements addressable by concept',
      { concepts: [...model.elements.keys()], assumptions: model.elements.get('Assumptions')?.map((n) => n.name) },
      (v) => v.assumptions?.includes('Demand Grows In Q4'),
      'concepts and elements are indexed the way the editor tree shows them',
    )

    // --- Add an element -----------------------------------------------------
    const added = applyMutation(model, 'add_element', {
      conceptName: 'Risks',
      elementName: 'Warehouse Overtime Cost',
      description: 'Peak-season throughput forces paid overtime beyond budget.',
    }, schema)
    s.expect(
      'Adding an element succeeds and lands under the right concept',
      { success: added.success, errors: added.errors, risks: model.elements.get('Risks')?.map((n) => n.name) },
      (v) => v.success && v.risks?.includes('Warehouse Overtime Cost'),
      'the new risk is present, no error',
    )

    // --- Duplicate names must be refused (R-IE-02) --------------------------
    const dup = applyMutation(model, 'add_element', {
      conceptName: 'Keys',
      elementName: 'Warehouse Overtime Cost',
      description: 'Same name under a different concept.',
    }, schema)
    s.expect(
      'A duplicate element name anywhere in the model is refused',
      { success: dup.success, errors: dup.errors },
      (v) => v.success === false,
      'model-wide element name uniqueness (R-IE-02) is enforced',
    )

    // --- Update a field -----------------------------------------------------
    const updated = applyMutation(model, 'update_field', {
      conceptName: 'Risks',
      elementName: 'Warehouse Overtime Cost',
      fieldName: 'tags',
      value: '[operations, cost]',
    }, schema)
    s.expect(
      'Updating a field on an existing element succeeds',
      { success: updated.success, errors: updated.errors },
      (v) => v.success,
      'no error; the field is written',
    )

    // --- Update a field on a NON-existent element ---------------------------
    const ghost = applyMutation(model, 'update_field', {
      conceptName: 'Risks', elementName: 'Does Not Exist', fieldName: 'tags', value: '[x]',
    }, schema)
    s.expect(
      'Editing a non-existent element fails loudly instead of silently creating one',
      { success: ghost.success, errors: ghost.errors },
      (v) => v.success === false && Array.isArray(v.errors) && v.errors.length > 0,
      'a clear error, and no phantom element',
    )

    // --- Rename an element that is referenced by a matrix -------------------
    const beforeMatrix = JSON.parse(JSON.stringify(model.matrices))
    const renamed = applyMutation(model, 'rename_element', {
      conceptName: 'Assumptions', elementName: 'Demand Grows In Q4', newName: 'Q4 Demand Growth',
    }, schema)
    s.expect(
      'Renaming an element also repoints the matrices that name it',
      {
        success: renamed.success,
        errors: renamed.errors,
        beforeRows: beforeMatrix?.[0]?.cells?.map((c) => c.row),
        afterRows: model.matrices?.[0]?.cells?.map((c) => c.row),
      },
      (v) => v.success && v.afterRows?.includes('Q4 Demand Growth'),
      'the matrix row label follows the rename — no dangling label',
    )

    s.expect(
      'The renamed element keeps its citations',
      model.elements.get('Assumptions')?.find((n) => n.name === 'Q4 Demand Growth')?.fields,
      (f) => Boolean(f && (f.sources || f.source)),
      'renaming must not drop the provenance attached to the element',
    )

    // --- A typo in the concept name --------------------------------------
    const typo = applyMutation(model, 'add_element', {
      conceptName: 'Rsiks',
      elementName: 'Typo Probe',
      description: 'Concept name deliberately misspelled.',
    }, schema)
    s.expect(
      'A misspelled concept name is refused rather than silently creating a new concept',
      { success: typo.success, errors: typo.errors, concepts: [...model.elements.keys()] },
      (v) => v.success === false,
      'the template declares the legal concepts; `Rsiks` is not one of them',
    )

    // --- Serialize and re-parse --------------------------------------------
    const out = serializeKnowledge(model)
    const reparsed = parseKnowledge(out)
    s.expect(
      'Serialized model re-parses with the same element inventory',
      {
        before: countElements(model),
        after: countElements(reparsed),
      },
      (v) => JSON.stringify(v.before) === JSON.stringify(v.after),
      'a save/load cycle loses nothing',
    )

    s.expect(
      'Citations survive the save/load cycle in the spec-correct bracket form',
      citationLines(out),
      (lines) => lines.length > 0 && lines.every((l) => !l.includes('"')),
      'sources:: lines are written unquoted as `[a, b]`, matching what the reader expects',
    )

    // --- Remove an element --------------------------------------------------
    const removed = applyMutation(model, 'remove_element', { conceptName: 'Risks', elementName: 'Warehouse Overtime Cost' }, schema)
    s.expect(
      'Removing an element succeeds and it disappears from the model',
      { success: removed.success, risks: model.elements.get('Risks')?.map((n) => n.name) },
      (v) => v.success && !v.risks?.includes('Warehouse Overtime Cost'),
      'the element is gone',
    )

    // --- A failed mutation must not corrupt the model -----------------------
    const snapshot = serializeKnowledge(model)
    const bad = applyMutation(model, 'not_a_real_op', {}, schema)
    s.expect(
      'An unknown operation is rejected and leaves the model untouched',
      { success: bad.success, errors: bad.errors, unchanged: serializeKnowledge(model) === snapshot },
      (v) => v.success === false && v.unchanged === true,
      'failed mutations are atomic — the document is byte-identical afterwards',
    )

    s.observe('Fixture file on disk was never written', 'the simulation mutates in memory only; fixtures/acme stays pristine')
  } catch (err) {
    s.crash('scenario execution', err)
  }
  return s
}

function countElements(model) {
  const out = {}
  for (const [concept, nodes] of model.elements.entries()) out[concept] = nodes.length
  return out
}

function citationLines(markdown) {
  return markdown.split(/\r?\n/).filter((l) => /^\s*(sources|source)::/i.test(l))
}
