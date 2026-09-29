import { readFile, writeFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { resolveTemplateSchema, validateDocument } from '@cognnitive/innfo-core'
import type { SpecDocument, ValidationError } from '@cognnitive/innfo-core'
import { resolveTemplateWithCache, findModelFile, normalizeId } from './spec.js'
import { normalizeVersion } from './resolver-node.js'
import { isInsideRoot, isSafeRelativeId } from './path-guard.js'

/**
 * Build a starter level-3 body from a resolved template schema: an index
 * block, one `# NN <Concept>` section per concept (a prose stub for `text`
 * concepts, one placeholder Element with its declared fields for the rest),
 * a seeded `# NN matrices:` block per declared Matrix (example row/column
 * from the source/target Concepts), and an `item-markers matrix` seeded with
 * the declared Marker columns when any Marker is declared.
 */
function scaffoldBodyFromSchema(schema: {
  concepts: Array<{
    name: string
    type: string
    fields?: Array<{ name: string; type: string; options?: string[] }>
  }>
  markers?: Array<{ name: string }>
  matrices: Array<{ name: string; source?: string; target?: string }>
}): string {
  const lines: string[] = []
  const exampleFor = (concept?: string): string => (concept ? `Example ${concept}` : 'Example')
  const listConcepts = schema.concepts.filter((c) => c.type !== 'text')

  lines.push(
    '> [!NOTE]',
    '> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).',
    '',
  )
  if (schema.concepts.length > 0) {
    lines.push('# NN index')
    for (const c of schema.concepts) lines.push(`* [[${c.name}]]`)
    lines.push('')
  }
  for (const c of schema.concepts) {
    lines.push(`# NN ${c.name}`)
    if (c.type === 'text') {
      if (listConcepts.length === 0) {
        lines.push(`## NN ${c.name}: ${exampleFor(c.name)}`)
      }
      lines.push(`_Describe ${c.name} here._`, '')
      continue
    }
    lines.push(`## NN ${c.name}: ${exampleFor(c.name)}`)
    for (const f of c.fields ?? []) {
      if (f.type === 'reference') {
        continue
      }
      const hint =
        f.type === 'select' && f.options && f.options.length > 0
          ? f.options[0]
          : `<${f.type}>`
      lines.push(`${f.name}:: ${hint}`)
    }
    lines.push('')
  }
  for (const m of schema.matrices) {
    const row = exampleFor(m.source)
    const col = exampleFor(m.target)
    lines.push(
      `# NN matrices: ${m.name}`,
      `| ${m.source ?? 'Row'} \\ ${m.target ?? 'Col'} | ${col} |`,
      '| :--- | :---: |',
      `| ${row} | - |`,
      '',
    )
  }
  const markerNames = (schema.markers ?? []).map((mk) => mk.name)
  if (markerNames.length > 0 && listConcepts.length > 0) {
    lines.push(
      '# NN matrices: item-markers matrix',
      `| Item \\ Marker | ${markerNames.join(' | ')} |`,
      `| :--- | ${markerNames.map(() => ':---:').join(' | ')} |`,
      `| ${exampleFor(listConcepts[0].name)} | ${markerNames.map(() => '-').join(' | ')} |`,
      '',
    )
  }
  return lines.join('\n').trimEnd() + '\n'
}

export interface InitModelArgs {
  template_url?: string
  blueprint_url?: string
  blueprint_name?: string
  title?: string
  knowledge_version?: string
}

export async function initModel(
  rootDir: string,
  id: string,
  args: InitModelArgs,
  opts?: {
    cacheDir?: string
    inPlace?: boolean
  },
): Promise<{
  success: boolean
  filePath?: string
  content?: string
  templateResolved: boolean
  scaffolded: boolean
  warnings: string[]
  validation: { valid: boolean; errors: ValidationError[]; warnings: ValidationError[] }
}> {
  const cleanId = normalizeId(id)
  const warnings: string[] = []
  const blueprintName = args.blueprint_name || ''
  const blueprintUrl = args.blueprint_url || args.template_url || ''
  const requestedVersion = args.knowledge_version

  let filePath = await findModelFile(rootDir, id)

  if (!filePath) {
    const knowledgeDir = join(rootDir, 'kNNowledge')
    const modelsDir = join(rootDir, 'models')
    let targetDir = rootDir
    try {
      const stK = await stat(knowledgeDir)
      if (stK.isDirectory()) targetDir = knowledgeDir
    } catch {
      try {
        const stM = await stat(modelsDir)
        if (stM.isDirectory()) targetDir = modelsDir
      } catch {
        targetDir = rootDir
      }
    }
    const target = join(targetDir, `${cleanId}_NN.md`)
    // The scaffold branch creates a new file from an untrusted id — it must be
    // confined to the workspace just like the lookup branch above.
    if (!isSafeRelativeId(id) || !isInsideRoot(rootDir, target)) {
      throw new Error(`Invalid model id "${id}": resolves outside the workspace root`)
    }
    filePath = target
  }

  let body = ''
  try {
    const currentContent = await readFile(filePath, 'utf-8')
    body = currentContent.replace(/^---[\s\S]*?---\n?/, '').trim()
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: new file — no existing body to preserve.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[init-model] Failed to read existing body from ${filePath}: ${err}`)
    }
    /* v8 ignore stop */
  }

  // Resolve the template so we can (a) confirm it exists and (b) scaffold a
  // starter body when the file has none.
  let templateResolved = false
  let scaffolded = false
  let template: SpecDocument | null = null
  let resolveInclude: (ref: { name: string; url: string }) => string | null = () => null
  const templateErrors: string[] = []
  try {
    const resolved = await resolveTemplateWithCache(
      rootDir,
      blueprintUrl,
      blueprintName,
      opts,
    )
    template = resolved.template
    resolveInclude = resolved.resolveInclude
    if (resolved.template) {
      templateResolved = true
      const hasConceptSections = /^#\s+NN\s+(?!index\b)\S/im.test(body)
      if (!hasConceptSections) {
        const composed = resolveTemplateSchema(
          resolved.template.rawContent,
          resolved.resolveInclude,
        )
        for (const e of composed.errors) {
          templateErrors.push(`${e.path}: ${e.message}`)
          warnings.push(`${e.path}: ${e.message}`)
        }
        const scaffold = scaffoldBodyFromSchema(composed.schema)
        body = body ? `${scaffold}\n${body}` : scaffold
        scaffolded = true
      }
    } else {
      warnings.push(
        `Template "${blueprintName}" could not be resolved from "${blueprintUrl}" — frontmatter written, body not scaffolded.`,
      )
    }
  } catch (err) {
    warnings.push(`Template resolution failed: ${err instanceof Error ? err.message : String(err)}`)
  }

  const notice = `> [!NOTE]
> This is an **iNNfo document** — a plain-text Markdown file. Open it with any text editor or view and edit it with [cogNNitive](https://cognnitive.com/innfo/app/).`

  if (!body.includes('> [!NOTE]')) {
    body = body ? notice + '\n\n' + body : notice
  }

  // Version-aware frontmatter (model-scaffold-robustness): infer the version
  // from the resolved parent template's own `spec_version` or `blueprint_version`. An explicit
  // version wins only when there is nothing to contradict it (parent
  // unresolved, or exact match); when both exist and differ the scaffold
  // refuses with VERSION_MISMATCH rather than emit a differing version.
  const inferredVersion =
    template?.frontmatter && typeof (template.frontmatter.blueprint_version ?? template.frontmatter.spec_version) === 'string'
      ? String(template.frontmatter.blueprint_version ?? template.frontmatter.spec_version)
      : null
  if (
    requestedVersion &&
    inferredVersion &&
    normalizeVersion(requestedVersion) !== normalizeVersion(inferredVersion)
  ) {
    const message =
      `[VERSION_MISMATCH] Explicit version "${requestedVersion}" differs ` +
      `from the resolved parent blueprint spec_version "${inferredVersion}". ` +
      `Omit knowledge_version to inherit "${inferredVersion}".`
    return {
      success: false,
      templateResolved,
      scaffolded: false,
      warnings,
      validation: {
        valid: false,
        errors: [
          { path: 'knowledge_version', message, code: 'VERSION_MISMATCH', severity: 'error' as const },
        ],
        warnings: [],
      },
    }
  }

  const knowledgeVersion = requestedVersion || inferredVersion || 'V_0-1-0'
  const specVersion = 'V_0-3-0'
  const title = args.title || cleanId

  const esc = (s: string) => JSON.stringify(s)
  const frontmatter = [
    '---',
    `spec_version: ${esc(specVersion)}`,
    'spec_url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/iNNfo_V_0-3-0_NN.md"',
    'level: 3',
    'parent_spec:',
    `  name: ${esc(blueprintName)}`,
    `  url: ${esc(blueprintUrl)}`,
    `knowledge_version: ${esc(knowledgeVersion)}`,
    `title: ${esc(title)}`,
    '---',
  ].join('\n')

  const newContent = frontmatter + '\n\n' + body.trim() + '\n'

  // Validate before write (hygiene + schema) so invalid models are never written to disk.
  const doc = validateDocument(newContent, {
    fileName: basename(filePath),
    template,
    resolveInclude,
  })

  // If template is invalid or document validation fails, abort without touching disk.
  if (templateErrors.length > 0 || (templateResolved && !doc.valid)) {
    return {
      success: false,
      templateResolved,
      scaffolded: false,
      warnings,
      validation: {
        valid: false,
        errors: [
          ...doc.errors,
          ...templateErrors.map((m) => ({
            path: 'template',
            message: m,
            severity: 'error' as const,
          })),
        ],
        warnings: doc.warnings,
      },
    }
  }

  await writeFile(filePath, newContent, 'utf-8')

  return {
    success: true,
    templateResolved,
    scaffolded,
    warnings,
    filePath,
    content: newContent,
    validation: { valid: doc.valid, errors: doc.errors, warnings: doc.warnings },
  }
}

export const initKnowledge = initModel

