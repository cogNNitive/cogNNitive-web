/**
 * S03 — Save/load fidelity on the shipped sample workspace.
 *
 * iNNfo's core promise is that a model is a plain-text file a human can read,
 * diff and hand-edit. That promise only holds if opening a file, touching one
 * field and saving gives back the same document plus that one change.
 *
 * This scenario feeds every shipped `_samples_nn` model through
 * `parseKnowledge -> serializeKnowledge` — the exact path `innfo-mcp`'s `apply_change`
 * takes on every agent write, and the path the editor takes for any file the
 * user has edited — and reports what the document loses.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createScenario, ROOT } from '../lib/harness.mjs'
import { loadCore } from '../lib/core.mjs'

const SAMPLES = join(ROOT, '_samples_nn', 'models')

export default async function run() {
  const { parseKnowledge, serializeKnowledge } = await loadCore()
  const s = createScenario('S03', 'Save/load fidelity of shipped models',
    'A user opens a shipped sample, changes nothing meaningful, saves — and expects a clean git diff.')

  try {
    const files = (await readdir(SAMPLES)).filter((f) => f.endsWith('.md')).sort()
    const results = []
    for (const f of files) {
      const before = await readFile(join(SAMPLES, f), 'utf-8')
      const after = serializeKnowledge(parseKnowledge(before))
      results.push({
        file: f,
        identical: before === after,
        linesBefore: before.split(/\r?\n/).length,
        linesAfter: after.split(/\r?\n/).length,
        matrixAxesLost: countAxisLabelLoss(before, after),
        sectionOrderChanged: sectionOrder(before).join('>') !== sectionOrder(after).join('>'),
        bracketListsUnwrapped: countBracketLoss(before, after),
      })
    }

    s.expect(
      'A no-op save leaves every shipped model byte-identical',
      results.map((r) => ({ file: r.file, identical: r.identical, lines: `${r.linesBefore}->${r.linesAfter}` })),
      (rs) => rs.every((r) => r.identical),
      'parse -> serialize is the identity on canonical, spec-conformant files',
    )

    s.expect(
      'Matrix axis labels survive a save',
      results.filter((r) => r.matrixAxesLost > 0).map((r) => ({ file: r.file, axesLost: r.matrixAxesLost })),
      (lost) => lost.length === 0,
      'a header reading `| Metrics \ Variables |` must not become `| Row \ Col |`',
    )

    s.expect(
      'Document section order survives a save',
      results.filter((r) => r.sectionOrderChanged).map((r) => r.file),
      (changed) => changed.length === 0,
      'the author chose the order of `# NN` sections; a save must not reshuffle it',
    )

    s.expect(
      'Bracketed list values survive a save',
      results.filter((r) => r.bracketListsUnwrapped > 0).map((r) => ({ file: r.file, unwrapped: r.bracketListsUnwrapped })),
      (lost) => lost.length === 0,
      '`tags:: [a, b]` must not silently become `tags:: a, b`',
    )

    s.observe(
      'Second-pass stability (is the canonical form at least a fixed point?)',
      files.slice(0, 5).map((f) => f),
    )
    const twice = []
    for (const f of files) {
      const before = await readFile(join(SAMPLES, f), 'utf-8')
      const once = serializeKnowledge(parseKnowledge(before))
      const again = serializeKnowledge(parseKnowledge(once))
      twice.push({ file: f, stableAfterFirstSave: once === again })
    }
    s.expect(
      'The canonical form is at least stable after the first save',
      twice.filter((t) => !t.stableAfterFirstSave),
      (unstable) => unstable.length === 0,
      'once degraded, further saves produce no further drift (bounded damage)',
    )
  } catch (err) {
    s.crash('scenario execution', err)
  }
  return s
}

const BACKSLASH = String.fromCharCode(92)

function axisHeaders(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => l.startsWith('|') && l.includes(BACKSLASH))
    .map((l) => l.split('|')[1]?.trim())
    .filter(Boolean)
}

function countAxisLabelLoss(before, after) {
  const b = axisHeaders(before)
  const a = axisHeaders(after)
  let lost = 0
  for (let i = 0; i < Math.min(b.length, a.length); i += 1) {
    if (b[i] !== a[i] && a[i] === `Row ${BACKSLASH} Col`) lost += 1
  }
  return lost
}

function sectionOrder(text) {
  return text.split(/\r?\n/).filter((l) => /^# NN /.test(l)).map((l) => l.trim())
}

function countBracketLoss(before, after) {
  const bracket = (t) => new Set(t.split(/\r?\n/).filter((l) => /^\s*\w[\w-]*::\s*\[/.test(l)).map((l) => l.trim()))
  const b = bracket(before)
  const a = bracket(after)
  let lost = 0
  for (const line of b) if (!a.has(line)) lost += 1
  return lost
}
