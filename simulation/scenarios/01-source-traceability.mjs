/**
 * S01 — Source ingestion and citation traceability.
 *
 * Simulates the flagship user journey: an analyst imports a primary source
 * into `sources/nn/`, cites specific sections of it from model elements, and
 * expects the workspace to confirm every citation resolves — then expects a
 * broken citation to be reported precisely rather than silently ignored.
 */
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createNodeDirectoryHandle } from '../lib/nodeFs.mjs'
import { createScenario, SIM } from '../lib/harness.mjs'
import { loadCore } from '../lib/core.mjs'

const WS = join(SIM, 'fixtures', 'acme')

/** Node-side SourceResolver: the contract innfo-mcp implements against disk. */
function makeResolver(root, extractHeadings) {
  return (refPath) => {
    const full = join(root, refPath)
    if (!existsSync(full)) return { exists: false }
    const content = readFileSync(full, 'utf-8')
    return { exists: true, content, headings: extractHeadings(content).map((h) => h.slug) }
  }
}

export default async function run() {
  const s = createScenario('S01', 'Source ingestion & citation traceability', 
    'An analyst imports a primary source, cites its sections from model elements, and relies on the workspace to prove every citation resolves.')

  const {
    recursiveParse,
    validateWorkspaceSources,
    extractHeadings,
    parseKnowledgeUnitRef,
    serializeKnowledgeUnitRef,
    resolveHeadingSection,
  } = await loadCore()

  try {
    const parsed = await recursiveParse(createNodeDirectoryHandle(WS))
    s.expect(
      'Workspace parses from the canonical entrypoint',
      { entrypointPath: parsed.entrypointPath, nodes: Object.keys(parsed.nodes).length, issues: parsed.issues.length },
      (v) => v.nodes > 0 && v.issues === 0,
      'domaiNN_NN.md resolves as entrypoint, models load, no parse issues',
    )

    const diagnostics = validateWorkspaceSources(parsed, makeResolver(WS, extractHeadings))
    s.expect(
      'All citations in a well-formed workspace resolve cleanly',
      diagnostics,
      (d) => d.length === 0,
      'zero diagnostics — every `@` pointer resolves to a real file, heading and CSV row',
    )

    // --- The canonical `@` grammar, as a user would type it -----------------
    const ref = parseKnowledgeUnitRef('market-report-2026.md@## Q4 Outlook')
    s.expect(
      'A heading citation parses into an addressable knowledge unit',
      ref,
      (r) => r !== null && r.unit?.kind === 'header' && r.unit.level === 2,
      'parses to a header unit at level 2 under sources/nn/',
    )
    if (ref) {
      const written = serializeKnowledgeUnitRef(ref.filePath, ref.unit, ref.subunits)
      const reread = parseKnowledgeUnitRef(written)
      s.expect(
        'Citation is structurally stable across a write-back cycle',
        { authored: ref.raw, written, rereadSlug: reread?.unit?.slug },
        (v) => v.rereadSlug === 'q4-outlook',
        'the pointer still resolves to the same heading after the agent writes it back',
      )
      s.expect(
        'Citation keeps its human-readable heading text across a write-back cycle',
        { authoredText: ref.unit.text, writtenForm: written, rereadText: reread?.unit?.text },
        (v) => v.rereadText === v.authoredText,
        'a human wrote `@## Q4 Outlook`; after one save it should still read as `## Q4 Outlook`',
      )
    }

    // --- The cited section actually resolves to real text -------------------
    const srcText = await readFile(join(WS, 'sources', 'nn', 'market-report-2026.md'), 'utf-8')
    const section = resolveHeadingSection(srcText, 'q4-outlook')
    s.expect(
      'Cited section resolves to a concrete line range in the source',
      section,
      (v) => v !== null && v.endLine > v.startLine,
      'the pointer maps to real text the user can read back, not just a string',
    )

    // --- Now break it, the way a real user breaks it -------------------------
    const broken = structuredClone2(parsed)
    const target = Object.values(broken.nodes).find((n) => n.name === 'Demand Grows In Q4')
    s.observe('Element carrying the citation', target ? { name: target.name, fields: target.fields } : 'NOT FOUND')

    // Case A: the source file is renamed/deleted outside the app.
    const danglingDiags = validateWorkspaceSources(parsed, (refPath) =>
      refPath.includes('market-report') ? { exists: false } : makeResolver(WS, extractHeadings)(refPath),
    )
    s.expect(
      'Deleting the source file outside the app is reported, not silently ignored',
      danglingDiags.map((d) => ({ code: d.code, severity: d.severity, message: d.message })),
      (d) => d.some((x) => x.code === 'KU_DANGLING_FILE' && x.severity === 'error'),
      'KU_DANGLING_FILE error naming the missing file',
    )

    // Case B: the source is edited and the cited heading is renamed.
    const renamedHeadingDiags = validateWorkspaceSources(parsed, (refPath) => {
      const base = makeResolver(WS, extractHeadings)(refPath)
      if (!base?.exists || !refPath.endsWith('.md')) return base
      const edited = base.content.replace('## Q4 Outlook', '## Fourth Quarter Outlook')
      return { exists: true, content: edited, headings: extractHeadings(edited).map((h) => h.slug) }
    })
    s.expect(
      'Renaming a cited heading in the source surfaces a drift warning',
      renamedHeadingDiags.map((d) => ({ code: d.code, severity: d.severity, message: d.message })),
      (d) => d.some((x) => x.code === 'KU_UNKNOWN_SLUG'),
      'KU_UNKNOWN_SLUG — the file still exists but the cited unit moved',
    )

    // Case C: raw, un-normalized material must not be citable.
    s.expect(
      'Raw material under sources/original/ is refused as a citation target',
      parseKnowledgeUnitRef('sources/original/market-report-2026.txt@## Anything'),
      (r) => r === null,
      'null — only normalized sources under sources/nn/ carry provenance',
    )

    // Case D: a query is not provenance.
    const queryDiags = validateWorkspaceSources(
      injectFieldValue(parsed, 'Logistics Capacity', 'sources', ['sources/nn/market-report-2026.md?concept=Risk']),
      makeResolver(WS, extractHeadings),
    )
    s.expect(
      'A query string cannot stand in for a resolved citation',
      queryDiags.map((d) => ({ code: d.code, severity: d.severity })),
      (d) => d.some((x) => x.code === 'QU_NOT_PROVENANCE' && x.severity === 'error'),
      'QU_NOT_PROVENANCE error — queries must be resolved to pointers before being cited',
    )
  } catch (err) {
    s.crash('scenario execution', err)
  }
  return s
}

/** structuredClone chokes on class instances in the graph; shallow is enough here. */
function structuredClone2(v) {
  return v
}

/** Mutates a copy of the parse result so a diagnostic can be provoked. */
function injectFieldValue(parsed, elementName, field, value) {
  const clone = { ...parsed, nodes: { ...parsed.nodes } }
  for (const [id, node] of Object.entries(clone.nodes)) {
    if (node.name === elementName) {
      clone.nodes[id] = { ...node, fields: { ...node.fields, [field]: { value } } }
    }
  }
  return clone
}
