// legacy:nn-rename/language-map

import type { DomainReader } from './detect.js'
import { detectLegacy } from './detect.js'
import type { PlanDeps, PlanResult, Op, Problem, MigratedTree, MigrationReport } from './index.js'
import { readLegacyDomain } from './reader.js'
import { getSchemaMap, applySchemaMap } from './schema-maps/index.js'

const OVERVIEW_ROOT_RE = /_base_[a-z0-9]+\.md$/i

export function migratePath(filePath: string): string {
  const norm = filePath.replace(/\\/g, '/')
  const segments = norm.split('/')
  const fileName = segments[segments.length - 1]

  // Entrypoint rename
  if (segments.length === 1) {
    if (
      (fileName.toLowerCase().startsWith('workspace') && fileName.toLowerCase().endsWith('.md')) ||
      OVERVIEW_ROOT_RE.test(fileName)
    ) {
      return 'domaiNN_NN.md'
    }
  }

  // Folder renames
  if (segments[0] === 'models') {
    return ['kNNowledge', ...segments.slice(1)].join('/')
  }
  if (segments[0] === 'templates') {
    return ['specs', 'bluepriNNts', ...segments.slice(1)].join('/')
  }
  if (segments[0] === 'specs' && segments[1] === 'templates') {
    return ['specs', 'bluepriNNts', ...segments.slice(2)].join('/')
  }

  return norm
}

export function migrateContent(content: string, filePath: string): string {
  const normPath = filePath.replace(/\\/g, '/')

  // JSON handling (feedback files, export-meta, etc.)
  if (normPath.endsWith('.json')) {
    try {
      const obj = JSON.parse(content)
      const migratedObj = migrateJsonObject(obj)
      return JSON.stringify(migratedObj, null, 2) + '\n'
    } catch {
      // Fall through to plain text replacement if not valid JSON
    }
  }

  let result = content

  // 1. Key renames in frontmatter and prose
  result = result.replace(/^(\s*)model_version(\s*:)/gm, '$1knowledge_version$2')
  result = result.replace(/^(\s*)template_version(\s*:)/gm, '$1blueprint_version$2')
  result = result.replace(/^(\s*)template_name(\s*:)/gm, '$1blueprint_name$2')
  result = result.replace(/^(\s*)target_template(\s*:)/gm, '$1target_blueprint$2')

  // Directory keys
  result = result.replace(
    /^(\s*)models_dir(\s*:\s*["']?)(?:models|\.\/models)(["']?)/gm,
    '$1knowledge_dir$2kNNowledge$3',
  )
  result = result.replace(/^(\s*)models_dir(\s*:)/gm, '$1knowledge_dir$2')

  result = result.replace(
    /^(\s*)templates_dir(\s*:\s*["']?)(?:templates|specs\/templates|\.\/templates)(["']?)/gm,
    '$1blueprints_dir$2specs/bluepriNNts$3',
  )
  result = result.replace(/^(\s*)templates_dir(\s*:)/gm, '$1blueprints_dir$2')

  // 2. Keyword replacement
  result = result.replace(/(\btype::\s*)model\b/gi, '$1knowledge')

  // 3. Headings and list definitions
  result = result.replace(/^(#{1,6}\s+)Workspace(\s*)$/gm, '$1domaiNN$2')
  result = result.replace(/^(#{1,6}\s+)Models(\s*)$/gm, '$1kNNowledge$2')
  result = result.replace(/^(#{1,6}\s+)Templates(\s*)$/gm, '$1bluepriNNts$2')

  result = result.replace(/^(\s*-\s+)Workspace(\s+Definition|\s+DefiNNition)/gm, '$1domaiNN$2')
  result = result.replace(/^(\s*-\s+)Models(\s+Definition|\s+DefiNNition)/gm, '$1kNNowledge$2')
  result = result.replace(/^(\s*-\s+)Templates(\s+Definition|\s+DefiNNition)/gm, '$1bluepriNNts$2')

  // Wikilinks
  result = result.replace(/\[\[#Workspace\]\]/g, '[[#domaiNN]]')
  result = result.replace(/\[\[#Models\]\]/g, '[[#kNNowledge]]')
  result = result.replace(/\[\[#Templates\]\]/g, '[[#bluepriNNts]]')

  // 4. Path references (path::, relative links, markdown links)
  result = result.replace(/(\bpath::\s*)models\//g, '$1kNNowledge/')
  result = result.replace(/(\bpath::\s*)specs\/templates\//g, '$1specs/bluepriNNts/')
  result = result.replace(/(\bpath::\s*)templates\//g, '$1specs/bluepriNNts/')
  result = result.replace(/(\bpath::\s*)workspace_NN\.md/g, '$1domaiNN_NN.md')
  result = result.replace(/(\bpath::\s*)workspace\.md/g, '$1domaiNN_NN.md')

  result = result.replace(/(\]\(\.\/|\()models\//g, '$1kNNowledge/')
  result = result.replace(/(\]\(\.\/|\()specs\/templates\//g, '$1specs/bluepriNNts/')
  result = result.replace(/(\]\(\.\/|\()templates\//g, '$1specs/bluepriNNts/')

  result = result.replace(/(\[\[(?:\.\/)?)models\//g, '$1kNNowledge/')
  result = result.replace(/(\[\[(?:\.\/)?)specs\/templates\//g, '$1specs/bluepriNNts/')
  result = result.replace(/(\[\[(?:\.\/)?)templates\//g, '$1specs/bluepriNNts/')

  // 5. Parent spec and L1/L0 URL rewrites
  result = result.replace(
    /\/specs\/templates\/workspace\/spec_NN\.md/g,
    '/specs/bluepriNNts/domaiNN/spec_NN.md',
  )
  result = result.replace(/\/specs\/templates\//g, '/specs/bluepriNNts/')
  result = result.replace(/\/specs\/iNNfo_V_0-[12]-[0-9]+_NN\.md/g, '/specs/iNNfo_V_0-3-0_NN.md')
  result = result.replace(/\/specs\/defiNNe_V_0-1-0_NN\.md/g, '/specs/defiNNition_V_0-1-0_NN.md')

  return result
}

function migrateJsonObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(migrateJsonObject)
  }
  if (value && typeof value === 'object') {
    const res: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      let targetKey = k
      if (k === 'source_model') targetKey = 'source_knowledge'
      else if (k === 'source_model_version') targetKey = 'source_knowledge_version'
      else if (k === 'model') targetKey = 'knowledge'
      else if (k === 'model_version') targetKey = 'knowledge_version'
      else if (k === 'target_template') targetKey = 'target_blueprint'
      else if (k === 'template_version') targetKey = 'blueprint_version'
      else if (k === 'template_name') targetKey = 'blueprint_name'
      res[targetKey] = migrateJsonObject(v)
    }
    return res
  }
  return value
}

// Pure 64-bit deterministic hash for planHash (browser-safe, zero dependencies)
function computePlanHash(ops: Op[]): string {
  const serialized = JSON.stringify(ops)
  let h1 = 0xdeadbeef ^ 0
  let h2 = 0x41c6ce57 ^ 0
  for (let i = 0; i < serialized.length; i++) {
    const ch = serialized.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0')
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0')
  return `${hex1}${hex2}`
}

function extractBlueprintName(content: string, filePath: string): string | null {
  const normPath = filePath.replace(/\\/g, '/')
  if (normPath === 'workspace_NN.md' || normPath === 'domaiNN_NN.md' || OVERVIEW_ROOT_RE.test(normPath)) {
    return 'workspace'
  }
  const match = content.match(/^\s*(?:blueprint_name|template_name)\s*:\s*["']?([a-zA-Z0-9_-]+)["']?/m)
  if (match) {
    return match[1]
  }
  return null
}

function extractVersion(content: string): string | undefined {
  const match = content.match(/^\s*(?:knowledge_version|model_version|blueprint_version|template_version)\s*:\s*["']?([0-9.]+)["']?/m)
  return match ? match[1] : undefined
}

export async function planMigration(r: DomainReader, deps: PlanDeps): Promise<PlanResult> {
  const detection = await detectLegacy(r)
  if (detection.kind === 'current') {
    return {
      status: 'noop',
      ops: [],
      problems: [],
      report: {
        renamedFiles: [],
        rewrittenFiles: [],
        customBlueprints: [],
        unmappedBlueprints: [],
        problems: [],
        summary: 'Domain is already up to date with the canonical layout.',
      },
      planHash: computePlanHash([]),
    }
  }

  const legacyDomain = await readLegacyDomain(r)
  const problems: Problem[] = []
  const renamedFiles: Array<{ from: string; to: string }> = []
  const rewrittenFiles: string[] = []
  const customBlueprints = new Set<string>()
  const unmappedBlueprints = new Set<string>()

  // Check for broken frontmatter in files
  for (const [filePath, content] of Object.entries(legacyDomain.files)) {
    if (content.startsWith('---')) {
      const secondDashes = content.indexOf('\n---', 3)
      if (secondDashes === -1) {
        problems.push({
          path: filePath,
          message: `Malformed frontmatter in '${filePath}': missing closing '---'`,
          severity: 'error',
        })
      } else {
        const fm = content.slice(3, secondDashes)
        // Check for common broken YAML patterns like unclosed brackets or mismatched quotes
        const openBrackets = (fm.match(/\[/g) || []).length
        const closeBrackets = (fm.match(/\]/g) || []).length
        const quotes = (fm.match(/"/g) || []).length
        if (openBrackets !== closeBrackets || quotes % 2 !== 0) {
          problems.push({
            path: filePath,
            message: `Malformed YAML frontmatter in '${filePath}'`,
            severity: 'error',
          })
        }
      }
    }
  }

  if (problems.some((p) => p.severity === 'error')) {
    return {
      status: 'blocked',
      ops: [],
      problems,
      report: {
        renamedFiles: [],
        rewrittenFiles: [],
        customBlueprints: [],
        unmappedBlueprints: [],
        problems,
        summary: 'Migration blocked due to malformed file syntax.',
      },
      planHash: computePlanHash([]),
    }
  }

  const migratedFiles: Record<string, string> = {}
  const ops: Op[] = []

  for (const [origPath, origContent] of Object.entries(legacyDomain.files)) {
    const targetPath = migratePath(origPath)
    let content = migrateContent(origContent, origPath)

    const bpName = extractBlueprintName(origContent, origPath)
    if (bpName) {
      const schemaMap = getSchemaMap(bpName)
      if (schemaMap) {
        const curVersion = extractVersion(origContent)
        const schemaApplied = applySchemaMap(content, schemaMap, curVersion)
        content = schemaApplied.migratedContent
      } else if (bpName !== 'workspace') {
        customBlueprints.add(bpName)
      }
    }

    migratedFiles[targetPath] = content

    if (targetPath !== origPath) {
      renamedFiles.push({ from: origPath, to: targetPath })
      ops.push({ op: 'move', from: origPath, to: targetPath })
    }
    if (content !== origContent || targetPath !== origPath) {
      rewrittenFiles.push(targetPath)
      ops.push({ op: 'write', path: targetPath, content })
    }
  }

  // Validate migrated tree with injected validator
  const migratedTree: MigratedTree = { files: migratedFiles }
  const validationProblems = deps.validate(migratedTree, deps.targets)
  problems.push(...validationProblems)

  const isBlocked = problems.some((p) => p.severity === 'error')

  const report: MigrationReport = {
    renamedFiles,
    rewrittenFiles,
    customBlueprints: Array.from(customBlueprints),
    unmappedBlueprints: Array.from(unmappedBlueprints),
    problems,
    summary: isBlocked
      ? `Migration blocked with ${problems.length} problem(s).`
      : `Migration planned: ${renamedFiles.length} moves, ${rewrittenFiles.length} writes.`,
  }

  // Stable sort ops for deterministic planHash
  ops.sort((a, b) => {
    const keyA = a.op === 'move' ? `move:${a.from}->${a.to}` : `write:${a.path}`
    const keyB = b.op === 'move' ? `move:${b.from}->${b.to}` : `write:${b.path}`
    return keyA.localeCompare(keyB)
  })

  const planHash = computePlanHash(ops)

  return {
    status: isBlocked ? 'blocked' : 'ready',
    ops,
    problems,
    report,
    planHash,
  }
}
