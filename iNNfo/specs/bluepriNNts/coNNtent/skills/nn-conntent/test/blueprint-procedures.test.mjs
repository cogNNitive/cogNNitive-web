/**
 * nn-conntent/test/blueprint-procedures.test.mjs
 *
 * Guard for the procedures the coNNtent bluepriNNt declares and ships
 * (backlog `coNNtent-procedures`): the `procedures:` list of `spec_NN.md`
 * declares `draft-scene-visuals` and `produce-video`, every declared procedure
 * resolves through the same nn-core loader the procedure runner uses for a
 * bluepriNNt package (`loadDirProcedures` + `resolveProcedures`, the floor of
 * `list_blueprint_procedures` and `procedure_start`), and the two promoted
 * procedures are generic: no series, language, vendor or machine specifics.
 *
 * `select-news` is deliberately absent: source acquisition belongs to the
 * domaiNN that specializes in acquiring sources, not to this bluepriNNt.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const {
  parseKnowledge,
  loadDirProcedures,
  resolveProcedures,
} = require('../scripts/lib/nn-core.generated.cjs')

const here = path.dirname(fileURLToPath(import.meta.url))
const BLUEPRINT_DIR = path.resolve(here, '..', '..', '..')
const PROCEDURES_DIR = path.join(BLUEPRINT_DIR, 'procedures')
const spec = parseKnowledge(fs.readFileSync(path.join(BLUEPRINT_DIR, 'spec_NN.md'), 'utf8'))
const declared = Array.isArray(spec.frontmatter.procedures) ? spec.frontmatter.procedures : []

const PROMOTED = {
  'draft-scene-visuals': 'procedures/draft_scene_visuals_procedures_NN.md',
  'produce-video': 'procedures/produce_video_procedures_NN.md',
}

const TOOLS = new Set(['agent', 'engine', 'console', 'human'])
const TOOL_FIELD = { agent: 'produces', engine: 'command', console: 'section', human: 'decision' }
const ELEMENT_RE = /^#{2,6}\s+NN\s+([^:]+):\s*(.+?)\s*$/
const FIELD_RE = /^([a-z_]+)::\s*(.*)$/

/** The document as the console stepper reads it: `## NN Work:` elements and their fields. */
function parseWork(text) {
  const elements = []
  let current = null
  for (const raw of text.split(/\r?\n/)) {
    const heading = raw.match(ELEMENT_RE)
    if (heading) {
      current = { concept: heading[1].trim(), name: heading[2].trim(), fields: {}, lines: [] }
      elements.push(current)
      continue
    }
    if (/^#\s/.test(raw)) {
      current = null
      continue
    }
    if (!current) continue
    current.lines.push(raw)
    const field = raw.match(FIELD_RE)
    if (field) current.fields[field[1]] = field[2].trim()
  }
  const work = elements.filter((element) => element.concept === 'Work')
  const root = work.find((element) => !element.fields.parent)
  const bySlug = new Map(work.map((element) => [element.fields.slug, element]))
  const steps = work.filter((element) => element.fields.parent)
  const targets = new Set(steps.flatMap(nextOf))
  const starts = steps.filter((candidate) => !targets.has(candidate.fields.slug))
  // The default path: from the step no other step points at, through the first `next::`
  // target of each step (a decision lists its default branch first).
  const chain = []
  let step = starts[0]
  while (step && !chain.includes(step)) {
    chain.push(step)
    step = bySlug.get(nextOf(step)[0])
  }
  // Every step reachable from the start through any branch, each once.
  const reachable = []
  const todo = starts.slice(0, 1)
  for (let next = todo.shift(); next; next = todo.shift()) {
    if (reachable.includes(next)) continue
    reachable.push(next)
    todo.push(...nextOf(next).flatMap((slug) => (bySlug.has(slug) ? [bySlug.get(slug)] : [])))
  }
  return { elements, root, steps, starts, chain, reachable }
}

/** The `next::` targets of a step: `@a` or a branch list `[@a, @b]`, as slugs. */
function nextOf(step) {
  return String(step.fields.next || '')
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((target) => target.trim().replace(/^@/, ''))
    .filter((target) => target !== '')
}

const read = (rel) => fs.readFileSync(path.join(BLUEPRINT_DIR, rel), 'utf8')
const body = (element) => element.lines.join('\n')
const toolOf = (step) => (step.fields.tool || '').trim()

test('spec_NN.md declares draft-scene-visuals and produce-video with their shipped paths', () => {
  for (const [id, rel] of Object.entries(PROMOTED)) {
    const entry = declared.find((procedure) => procedure.id === id)
    assert.ok(entry, `procedures: does not declare ${id}`)
    assert.equal(entry.path, rel, `${id} must be declared at ${rel}`)
    assert.ok(entry.name, `${id} has no name`)
  }
})

test('select-news is not declared or shipped by the bluepriNNt', () => {
  assert.equal(
    declared.some((procedure) => /select[-_]news/i.test(procedure.id)),
    false,
  )
  const files = fs.readdirSync(PROCEDURES_DIR)
  assert.equal(
    files.some((name) => /select[-_]news/i.test(name)),
    false,
    'a select-news procedure is shipped',
  )
})

test('every declared procedure resolves through the bluepriNNt floor loader', () => {
  const { procedures, diagnostics } = loadDirProcedures(PROCEDURES_DIR, 'coNNtent', 'procedures')
  assert.deepEqual(diagnostics, [], 'the procedures folder loads with no diagnostic')
  const loaded = new Map(procedures.map((def) => [def.id, def]))
  for (const entry of declared) {
    const def = loaded.get(entry.id)
    assert.ok(
      def,
      `declared procedure ${entry.id} is not found on disk under the id the runner derives from its file name`,
    )
    assert.equal(
      def.doc,
      entry.path,
      `declared ${entry.id} points at ${entry.path}, the loader resolved ${def.doc}`,
    )
  }

  const resolution = resolveProcedures({
    floor: null,
    nodes: [
      { id: 'coNNtent', kind: 'blueprint', doc: null, isolate: false, values: {}, procedures },
    ],
  })
  assert.deepEqual(
    resolution.diagnostics.filter((diagnostic) => diagnostic.severity === 'error'),
    [],
    'resolving the bluepriNNt procedures reports no error',
  )
  const selected = new Set(resolution.procedures.map((effective) => effective.def.id))
  for (const entry of declared) assert.ok(selected.has(entry.id), `${entry.id} is not selected`)
})

for (const [id, rel] of Object.entries(PROMOTED)) {
  test(`${id}: one procedure whose steps each declare exactly one tool and what it contributes`, () => {
    const { root, steps, starts, reachable } = parseWork(read(rel))
    assert.ok(root, `${rel} has no unparented Work element`)
    assert.equal(root.fields.slug, id, `the procedure slug must be ${id}`)
    for (const field of ['level', 'condition', 'output']) {
      assert.ok(root.fields[field], `${id} has no ${field}::`)
    }
    assert.ok(steps.length > 0, `${id} has no steps`)
    assert.equal(starts.length, 1, `${id}: more than one step has no incoming next::`)
    assert.equal(
      reachable.length,
      steps.length,
      `${id}: next:: does not reach every step exactly once`,
    )
    for (const step of steps) {
      assert.equal(step.fields.parent, `@${id}`, `step "${step.name}" is not addressed to @${id}`)
      const declarations = step.lines.filter((line) => /^tool::/.test(line))
      assert.equal(declarations.length, 1, `step "${step.name}" must declare exactly one tool::`)
      assert.ok(TOOLS.has(toolOf(step)), `step "${step.name}" declares tool "${toolOf(step)}"`)
      assert.ok(
        step.fields[TOOL_FIELD[toolOf(step)]],
        `step "${step.name}" has no ${TOOL_FIELD[toolOf(step)]}::`,
      )
    }
  })

  test(`${id}: generic, with no series, language, vendor or machine specifics`, () => {
    const text = read(rel)
    const forbidden = [
      /villabotijos|innteresante|cosicah|inntrevistas|neandentales/i, // series of one domaiNN
      /wavespeed|pruna|nano-banana|infinitetalk|youtube/i, // vendors and platforms
      /[A-Z]:\\|\/Users\/|\\Users\\|lucas/i, // machine paths and people
      /[áéíóúñ¿¡]/i, // the source procedures were Spanish: the shipped ones are English
      /select[-_ ]news|iNNbox/i, // source acquisition is another domaiNN's procedure
    ]
    for (const pattern of forbidden) assert.doesNotMatch(text, pattern, `${rel} carries ${pattern}`)
  })
}

test('draft-scene-visuals gates the draft on clean screenshots and rendered HyperFrames clips in media/', () => {
  const { chain } = parseWork(read(PROMOTED['draft-scene-visuals']))
  const gateIndex = chain.findIndex((step) => /media gate/i.test(step.name))
  assert.ok(gateIndex >= 0, 'no media gate step')
  const gate = body(chain[gateIndex])
  assert.match(gate, /clean screenshots?/i)
  assert.match(gate, /rendered HyperFrames clips?/i)
  assert.match(gate, /series\/<s>\/episodes\/<slug>\/media\//)
  assert.match(gate, /assets\/<slug>\/media\//)
  assert.match(gate, /draft JSON/)
  assert.match(gate, /build-draft-html\.mjs/)
  assert.match(gate, /stop/i, 'the gate does not stop on a missing file')

  const drafting = chain.findIndex((step) => /^draft the scenes/i.test(step.name))
  assert.ok(drafting > gateIndex, 'the scenes are drafted before the media gate')
  const capture = chain.findIndex((step) => /screenshot/i.test(step.name))
  const render = chain.findIndex((step) => /hyperframes/i.test(step.name))
  assert.ok(capture >= 0 && capture < gateIndex, 'screenshots are not captured before the gate')
  assert.ok(render >= 0 && render < gateIndex, 'clips are not rendered before the gate')
  const approval = chain.find((step) => step.fields.step_type === 'decision')
  assert.ok(approval, 'the draft is not approved by a decision step')
  assert.equal(toolOf(approval), 'human', 'the draft is not approved by a human')
})

test('draft-scene-visuals approves the draft or sends one scene back, in a bounded loop', () => {
  const { steps } = parseWork(read(PROMOTED['draft-scene-visuals']))
  const bySlug = new Map(steps.map((step) => [step.fields.slug, step]))
  const approval = bySlug.get('approve-the-draft')
  assert.ok(approval, 'no approve-the-draft step')
  assert.equal(approval.fields.step_type, 'decision')
  const [approve, sendBack] = nextOf(approval)
  assert.equal(bySlug.get(approve)?.fields.condition, 'outcome == approve')
  assert.equal(bySlug.get(sendBack)?.fields.condition, 'outcome == send-back')
  for (const token of ['approve', 'send-back'])
    assert.ok(
      approval.fields.decision.includes(`(${token})`),
      `the decision does not name ${token}`,
    )
  assert.deepEqual(nextOf(bySlug.get(approve)), [], `${approve} must end the procedure`)
  // The redraft goes back to the approval: the loop's back-edge, which the runner bounds by
  // the approval's attempts.
  assert.deepEqual(nextOf(bySlug.get(sendBack)), ['approve-the-draft'])
})

test('produce-video lists series through their scope documents and hands off to the declared procedure', () => {
  const text = read(PROMOTED['produce-video'])
  const { chain } = parseWork(text)
  const list = chain.find((step) => /list the series/i.test(step.name))
  assert.ok(list, 'no step lists the series')
  assert.match(body(list), /scope: true/)
  assert.match(body(list), /scope document/i)

  const declaredBy = chain.find((step) => /procedure the series declares/i.test(step.name))
  assert.ok(declaredBy, 'no step reads the procedure the series declares')
  assert.match(body(declaredBy), /list_blueprint_procedures/)
  assert.match(body(declaredBy), /fills/)

  const handOff = chain.at(-1)
  assert.match(handOff.name, /hand off/i)
  assert.match(body(handOff), /procedure_start/)
  assert.match(text, /spends nothing/i, 'the router does not state that it spends nothing')
})

test('produce-video branches the goal into a new episode, a new series or an existing episode', () => {
  const { steps } = parseWork(read(PROMOTED['produce-video']))
  const bySlug = new Map(steps.map((step) => [step.fields.slug, step]))
  const clarify = bySlug.get('clarify-the-goal')
  assert.ok(clarify, 'no clarify-the-goal step')
  assert.equal(clarify.fields.step_type, 'decision')
  const targets = nextOf(clarify)
  assert.equal(
    targets[0],
    'list-the-series',
    'the default branch (a new episode) is not listed first',
  )
  const guards = targets.map((slug) => bySlug.get(slug)?.fields.condition)
  assert.deepEqual(guards, [
    'outcome == new-episode',
    'outcome == new-series',
    'outcome == existing-episode',
  ])
  for (const token of ['new-episode', 'new-series', 'existing-episode'])
    assert.ok(clarify.fields.decision.includes(`(${token}`), `the decision does not name ${token}`)
  assert.match(body(bySlug.get(targets[1])), /Create a Series/)
  assert.match(body(bySlug.get(targets[2])), /Produce an Episode/)
  for (const slug of targets.slice(1))
    assert.deepEqual(nextOf(bySlug.get(slug)), [], `${slug} must end the router`)
})
