// legacy:nn-rename/detector

export interface DomainReader {
  list(dir: string): Promise<string[]>
  read(path: string): Promise<string | null>
}

export type LegacySignalType =
  | 'legacy-folder'
  | 'legacy-entrypoint'
  | 'legacy-key'
  | 'legacy-keyword'
  | 'legacy-parent-spec'
  | 'legacy-l1-parent'
  | 'case-mismatch'

export interface LegacySignal {
  type: LegacySignalType
  path?: string
  detail: string
}

export type DetectLegacyResult =
  | { kind: 'current' }
  | { kind: 'legacy' | 'mixed'; signals: LegacySignal[]; hint: string }

const LEGACY_KEYS = [
  'model_version',
  'template_version',
  'template_name',
  'models_dir',
  'templates_dir',
  'target_template',
]

const OVERVIEW_ROOT_RE = /_base_[a-z0-9]+\.md$/i

export async function detectLegacy(r: DomainReader): Promise<DetectLegacyResult> {
  const signals: LegacySignal[] = []
  let hasCurrentSignal = false

  const rootEntries = await r.list('')

  // 1. Check entrypoint names and casing
  const hasDomainnExact = rootEntries.includes('domaiNN_NN.md')
  if (hasDomainnExact) {
    hasCurrentSignal = true
  }

  for (const entry of rootEntries) {
    // Case mismatch on domain entrypoint
    if (
      entry.toLowerCase().startsWith('domainn') &&
      entry.toLowerCase().endsWith('.md') &&
      entry !== 'domaiNN_NN.md'
    ) {
      signals.push({
        type: 'case-mismatch',
        path: entry,
        detail: `Entrypoint '${entry}' does not match canonical casing 'domaiNN_NN.md'`,
      })
    }

    // Legacy entrypoints
    if (entry.toLowerCase().startsWith('workspace') && entry.toLowerCase().endsWith('.md')) {
      signals.push({
        type: 'legacy-entrypoint',
        path: entry,
        detail: `Legacy entrypoint detected: '${entry}' (expected 'domaiNN_NN.md')`,
      })
    } else if (OVERVIEW_ROOT_RE.test(entry) && entry !== 'domaiNN_NN.md') {
      signals.push({
        type: 'legacy-entrypoint',
        path: entry,
        detail: `Legacy overview-root entrypoint detected: '${entry}' (expected 'domaiNN_NN.md')`,
      })
    }

    // Folder checks at root
    if (entry === 'models') {
      signals.push({
        type: 'legacy-folder',
        path: 'models',
        detail: `Legacy folder 'models/' detected (expected 'kNNowledge/')`,
      })
    } else if (entry === 'templates') {
      signals.push({
        type: 'legacy-folder',
        path: 'templates',
        detail: `Legacy folder 'templates/' detected (expected 'specs/bluepriNNts/')`,
      })
    } else if (entry === 'kNNowledge') {
      hasCurrentSignal = true
    } else if (/^k?n*owledge$/i.test(entry) && entry !== 'kNNowledge' && entry !== 'models') {
      signals.push({
        type: 'case-mismatch',
        path: entry,
        detail: `Folder '${entry}' does not match canonical casing 'kNNowledge'`,
      })
    } else if (/^bluepri*n*ts$/i.test(entry) && entry !== 'bluepriNNts' && entry !== 'templates') {
      signals.push({
        type: 'case-mismatch',
        path: entry,
        detail: `Folder '${entry}' does not match canonical casing 'bluepriNNts'`,
      })
    }
  }

  // Check specs/ directory
  if (rootEntries.includes('specs')) {
    const specsEntries = await r.list('specs')
    for (const specEntry of specsEntries) {
      if (specEntry === 'templates') {
        signals.push({
          type: 'legacy-folder',
          path: 'specs/templates',
          detail: `Legacy folder 'specs/templates/' detected (expected 'specs/bluepriNNts/')`,
        })
      } else if (specEntry === 'bluepriNNts') {
        hasCurrentSignal = true
      } else if (/^bluepri*n*ts$/i.test(specEntry) && specEntry !== 'bluepriNNts' && specEntry !== 'templates') {
        signals.push({
          type: 'case-mismatch',
          path: `specs/${specEntry}`,
          detail: `Folder 'specs/${specEntry}' does not match canonical casing 'specs/bluepriNNts'`,
        })
      }
    }
  }

  // 2. Scan files for frontmatter keys, keywords, parent_spec URLs and L1 parents
  const filesToScan: string[] = []

  // Check root markdown files
  for (const entry of rootEntries) {
    if (entry.toLowerCase().endsWith('.md')) {
      filesToScan.push(entry)
    }
  }

  // Helper to list subfiles recursively up to depth 3
  async function collectFiles(dir: string, depth = 0) {
    if (depth > 3) return
    const entries = await r.list(dir)
    for (const entry of entries) {
      const relPath = dir ? `${dir}/${entry}` : entry
      if (entry.toLowerCase().endsWith('.md')) {
        filesToScan.push(relPath)
      } else if (!entry.includes('.') && depth < 3) {
        // likely a subfolder
        await collectFiles(relPath, depth + 1)
      }
    }
  }

  for (const folder of ['models', 'kNNowledge', 'templates', 'specs/templates', 'specs/bluepriNNts']) {
    await collectFiles(folder)
  }

  const scannedPaths = new Set<string>()
  for (const filePath of filesToScan) {
    if (scannedPaths.has(filePath)) continue
    scannedPaths.add(filePath)

    const content = await r.read(filePath)
    if (!content) continue

    // Current signal indicators in content
    if (content.includes('knowledge_version:')) hasCurrentSignal = true
    if (/type::\s*knowledge\b/.test(content)) hasCurrentSignal = true
    if (content.includes('iNNfo_V_0-3-0')) hasCurrentSignal = true

    // Check legacy frontmatter keys
    for (const legacyKey of LEGACY_KEYS) {
      const keyPattern = new RegExp(`^\\s*${legacyKey}\\s*:`, 'm')
      if (keyPattern.test(content)) {
        signals.push({
          type: 'legacy-key',
          path: filePath,
          detail: `Legacy key '${legacyKey}' found in '${filePath}'`,
        })
      }
    }

    // Check legacy keyword: type:: model
    if (/type::\s*model\b/i.test(content)) {
      signals.push({
        type: 'legacy-keyword',
        path: filePath,
        detail: `Legacy keyword 'type:: model' found in '${filePath}' (expected 'type:: knowledge')`,
      })
    }

    // Check parent_spec URL containing /specs/templates/
    if (content.includes('/specs/templates/')) {
      signals.push({
        type: 'legacy-parent-spec',
        path: filePath,
        detail: `Legacy parent_spec URL containing '/specs/templates/' found in '${filePath}'`,
      })
    }

    // Check legacy L1 parent below V_0-3-0
    const l1Match = content.match(/iNNfo_V_0-[12]-[0-9]+|defiNNe_V_0-1-0/i)
    if (l1Match) {
      signals.push({
        type: 'legacy-l1-parent',
        path: filePath,
        detail: `Legacy L1/L0 specification parent '${l1Match[0]}' found in '${filePath}' (expected 'iNNfo_V_0-3-0' or 'defiNNition_V_0-1-0')`,
      })
    }
  }

  if (signals.length === 0) {
    return { kind: 'current' }
  }

  const kind = hasCurrentSignal ? 'mixed' : 'legacy'
  const hint =
    "Run 'nn-upgrade' (or 'node skills/nn-upgrade/scripts/migrate-domain.js') to migrate this domain to the canonical domaiNN/kNNowledge layout."

  return { kind, signals, hint }
}
