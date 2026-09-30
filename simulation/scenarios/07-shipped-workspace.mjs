/**
 * S07 — Opening the workspace we ship to new users.
 *
 * `_samples_nn` is the single source of truth for every template sample and the
 * first thing a new user sees. It has to validate clean. Anything it reports is
 * something a first-time user will hit on day one.
 */
import { readFile, readdir } from 'node:fs/promises'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createNodeDirectoryHandle } from '../lib/nodeFs.mjs'
import { createScenario, ROOT } from '../lib/harness.mjs'
import { loadCore } from '../lib/core.mjs'

const WS = join(ROOT, '_samples_nn')
const TEMPLATES = join(ROOT, 'iNNfo', 'specs', 'templates')

export default async function run() {
  const {
    recursiveParse,
    validateWorkspaceSources,
    validateDocument,
    extractHeadings,
    SOURCE_FIELD_NAMES,
    resolveBlueprintSchema,
  } = await loadCore()
  const s = createScenario('S07', 'Opening the shipped sample workspace',
    'A new user opens the workspace we ship. Everything they see on day one is what this scenario measures.')

  try {
    // Mirror what the editor does (`modelStore.parseFromHandle`): warm a
    // synchronously-servable template cache and hand `recursiveParse` a
    // schema resolver. Without it every model parses schema-less, and the
    // citation check silently degrades to name matching — which is the very
    // behaviour this scenario is supposed to measure.
    const templateCache = warmBlueprintCache(resolveBlueprintSchema)
    const parsed = await recursiveParse(createNodeDirectoryHandle(WS), undefined, {
      resolveBlueprintSchema: ({ frontmatter }) => {
        const name = frontmatter?.parent_spec?.name
        if (!name) return null
        const key = name.toLowerCase()
        // Models declare `<slug>_V_x-y-z`; the cache is keyed by slug, so the
        // version suffix is stripped before the lookup.
        const slug = key.replace(/_v_\d+-\d+-\d+$/, '')
        return templateCache.get(key) ?? templateCache.get(slug) ?? null
      },
    })
    // `info` notes are deliberate (AD-7: an element name that resolves across
    // several models is legal, and the note names the qualified-reference form
    // for addressing a specific one). Only error/warning issues count here.
    const actionableIssues = parsed.issues.filter((i) => i.severity !== 'info')
    s.expect(
      'The shipped workspace parses without issues',
      {
        entrypoint: parsed.entrypointPath,
        models: Object.values(parsed.nodes).filter((n) => n.kind === 'root').length,
        actionableIssueCount: actionableIssues.length,
        infoNotes: parsed.issues.length - actionableIssues.length,
        issueKinds: summarizeIssues(actionableIssues),
      },
      (v) => v.actionableIssueCount === 0 && v.models >= 11,
      'all sample models load with no error or warning issues — this is the first thing a new user sees',
    )

    // Per-file document hygiene, the same pass the editor and MCP both run.
    const files = (await readdir(join(WS, 'models'))).filter((f) => f.endsWith('.md')).sort()
    const perFile = []
    for (const f of files) {
      const report = validateDocument(await readFile(join(WS, 'models', f), 'utf-8'), { fileName: f })
      perFile.push({ file: f, errors: report.errors.map((e) => e.code ?? e.path), warnings: report.warnings.length })
    }
    s.expect(
      'Every shipped sample passes document hygiene with no errors',
      perFile.filter((r) => r.errors.length > 0),
      (bad) => bad.length === 0,
      'zero hygiene errors across the eleven samples',
    )

    // Citation integrity across the shipped workspace.
    const resolver = (refPath) => {
      const full = join(WS, refPath)
      if (!existsSync(full)) return { exists: false }
      const content = readFileSync(full, 'utf-8')
      return { exists: true, content, headings: extractHeadings(content).map((h) => h.slug) }
    }
    const sourceDiags = validateWorkspaceSources(parsed, resolver)
    s.expect(
      'Every citation in the shipped workspace resolves',
      sourceDiags.map((d) => ({ code: d.code, severity: d.severity, path: d.path })),
      (d) => d.filter((x) => x.severity === 'error').length === 0,
      'a new user opening the sample sees no broken provenance',
    )

    // Does the flagship workspace actually demonstrate the flagship feature?
    const sourcesDir = join(WS, 'sources', 'nn')
    const sourceFiles = existsSync(sourcesDir) ? await readdir(sourcesDir) : []
    s.expect(
      'The shipped workspace contains the sources its models cite',
      { sourcesDir: 'sources/nn/', files: sourceFiles },
      (v) => v.files.length > 0,
      'source traceability is the headline capability — the demo must demonstrate it',
    )

    // The rule is "do not advertise what you do not ship", so read what the
    // workspace ACTUALLY declares rather than assuming a fixed artifact: a
    // workspace that declares none trivially satisfies it.
    const workspaceDoc = await readFile(join(WS, 'workspace_NN.md'), 'utf-8')
    const declaredArtifacts = [...workspaceDoc.matchAll(/^path:: (artifacts\/\S+)$/gm)].map((m) => m[1])
    const missingArtifacts = declaredArtifacts.filter((p) => !existsSync(join(WS, p)))
    s.expect(
      'Every artifact the shipped workspace declares actually exists',
      { declared: declaredArtifacts, missing: missingArtifacts },
      (v) => v.missing.length === 0,
      'the workspace must not advertise an artifact it does not ship',
    )

    // Field NAME vs field TYPE: the citation vocabulary is keyed on the name.
    const docSpec = await readFile(join(TEMPLATES, 'documentation', 'spec_NN.md'), 'utf-8')
    const declaredType = docSpec.match(/## NN Field Definition: source\n(?:.*\n)*?type:: (\S+)/)?.[1]
    s.expect(
      'A field named `source` that is declared as a content path is not treated as a citation',
      {
        template: 'documentation',
        declaredType,
        citationFieldNames: [...SOURCE_FIELD_NAMES],
        diagnosticsOnDocumentationSample: sourceDiags.filter((d) => d.path.includes('documentation')).map((d) => d.code),
      },
      (v) => v.diagnosticsOnDocumentationSample.length === 0,
      'the Citation vocabulary should key on the declared field TYPE, not on the field NAME',
    )
  } catch (err) {
    s.crash('scenario execution', err)
  }
  return s
}

/**
 * Compose every shipped template's schema, keyed by the `parent_spec.name`
 * a model declares. This is the Node equivalent of the editor's
 * `warmBlueprintCache`, and it must stay synchronous: `resolveBlueprintSchema`
 * is called from inside the parse.
 */
function warmBlueprintCache(resolveBlueprintSchema) {
  const cache = new Map()
  for (const dir of readdirSync(TEMPLATES, { withFileTypes: true })) {
    const spec = dir.isDirectory()
      ? join(TEMPLATES, dir.name, 'spec_NN.md')
      : join(TEMPLATES, dir.name)
    if (!spec.endsWith('_NN.md') || !existsSync(spec)) continue
    const content = readFileSync(spec, 'utf-8')
    const name = content.match(/^title:\s*"?([^"\n]+)"?$/m)?.[1]
    const slug = dir.isDirectory() ? dir.name : dir.name.replace(/_NN\.md$/, '')
    try {
      const { schema } = resolveBlueprintSchema(content, (ref) => {
        const inc = join(TEMPLATES, ref, 'spec_NN.md')
        return existsSync(inc) ? readFileSync(inc, 'utf-8') : null
      })
      for (const key of [slug, name].filter(Boolean)) cache.set(String(key).toLowerCase(), schema)
    } catch {
      // A template that fails to compose degrades that model to schema-less
      // parsing, exactly as a cold cache does in the editor.
    }
  }
  return cache
}

function summarizeIssues(issues) {
  const out = {}
  for (const i of issues) {
    const kind = /Slug collision/.test(i.message)
      ? 'slug-collision'
      : /appears in both/.test(i.message)
        ? 'cross-model-name-collision'
        : 'other'
    out[kind] = (out[kind] ?? 0) + 1
  }
  return out
}
