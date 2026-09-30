#!/usr/bin/env node

// check-spec-version.mjs â€” Scan the repo for files referencing a given spec version.
//
// Usage:
//   node scripts/check-spec-version.mjs --version V_0-1-2
//   node scripts/check-spec-version.mjs --version V_0-1-2 --by-type
//   node scripts/check-spec-version.mjs --version V_0-1-2 --check
//   node scripts/check-spec-version.mjs --version V_0-1-2 --check --by-type
//   node scripts/check-spec-version.mjs --version V_0-1-2 --include-archives
//   node scripts/check-spec-version.mjs --inventory
//   node scripts/check-spec-version.mjs --inventory --include-archives
//   node scripts/check-spec-version.mjs --check-urls
//   node scripts/check-spec-version.mjs --version V_0-1-2 --with-skills
//   node scripts/check-spec-version.mjs --check-urls --with-skills ../actioNN/skills
//
// Modes:
//   default         â€” Print all files referencing the given version
//   --by-type       â€” Group results by category
//   --check         â€” Exit code 1 if any references found (for CI/git hooks)
//   --include-archives â€” Include archive/ and openspec/changes/archive/ in scan
//   --inventory     â€” Print ALL spec versions found in the repo
//   --check-urls    — Verify canonical raw.githubusercontent.com URLs point to existing files and fail on any legacy cogNNitive/iNNfo reference
//   --with-skills [path] — Also scan a sibling skills tree (default: ../actioNN/skills,
//                          ../../actioNN/skills). Lets the scan cover bundled skill
//                          docs/templates that live in the cogNNitive/actioNN repo.
//                          Silently skipped when the path does not exist (e.g. CI
//                          checkouts that only contain iNNfo).

import { readFileSync, existsSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import gitVisible from './lib/git-visible.js'

const { collectGitVisible } = gitVisible

// ── Config ──────────────────────────────────────────────────────────

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = ROOT
const INNFO_DIR = join(ROOT, 'iNNfo')

const ARCHIVE_DIRS = new Set([
  'archive',
  'node_modules',
  '.git',
  '.playwright-mcp',
  'home-page',
  'temp',
  '.claude',
  'dist',
  '.agents',
  '.atl',
  '.cogNNitive',
  '.github',
  'openspec',
])
const ACTIVE_IGNORE = new Set([
  'node_modules',
  '.git',
  '.playwright-mcp',
  'home-page',
  'temp',
  '.claude',
  'dist',
  '.agents',
  '.atl',
  '.cogNNitive',
  '.github',
  'openspec',
])

const FORMAT_VERSION_RE = /V_\d+-\d+-\d+/g
const GITHUB_RAW_URL_RE =
  /https:\/\/raw\.githubusercontent\.com\/cogNNitive\/cogNNitive\/(?:main|v[\d.]+)\/iNNfo\/([^\s"')\]]+)/g

const LEGACY_SLUG_RE = /cogNNitive\/iNNfo(?![\w-])/g

const ALLOWLISTED_EXACT_PATHS = new Set(['scripts/check-spec-version.mjs'])

const URL_CHECK_EXTENSIONS = new Set([
  '.ts',
  '.vue',
  '.md',
  '.mjs',
  '.js',
  '.yaml',
  '.yml',
  '.json',
  '.html',
])

// â”€â”€ File Collection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function collectFiles(dir, includeArchives) {
  const files = []

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      if (!includeArchives && ARCHIVE_DIRS.has(entry)) continue
      if (ACTIVE_IGNORE.has(entry)) continue

      const full = join(dir, entry)
      const st = statSync(full)

      if (st.isDirectory()) {
        files.push(...collectFiles(full, includeArchives))
      } else {
        files.push(full)
      }
    }
  } catch {
    // permission denied or doesn't exist
  }
  return files
}

// â”€â”€ Classification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function classifyFile(relPath) {
  const isFormatFile = relPath.endsWith('_FORMAT.md') || relPath.endsWith('_F.md') || relPath.endsWith('_NN.md')

  if (relPath.startsWith('specs') && isFormatFile && !relPath.includes('/samples/')) {
    if (relPath.includes('defiNNe') || relPath.includes('defiNNition') || relPath.includes('iNNfo_V') || relPath.includes('/FORMAT')) return 'spec'
    return 'template'
  }
  if (relPath.includes('/samples/') && isFormatFile) return 'model'
  if (isFormatFile) {
    if (relPath.includes('/fixtures/')) return 'fixture'
    if (relPath.startsWith('specs')) return 'model'
    if (relPath.startsWith('archive')) return 'model'
    return 'model'
  }
  if (relPath.includes('/fixtures/') && relPath.endsWith('.md')) return 'fixture'
  if (relPath.endsWith('.test.ts') || relPath.endsWith('.test.tsx') || relPath.endsWith('.spec.ts'))
    return 'test'
  if (
    (relPath.startsWith('apps') || relPath.startsWith('packages')) &&
    (relPath.endsWith('.ts') || relPath.endsWith('.vue')) &&
    !relPath.endsWith('.test.ts')
  )
    return 'source'
  if (relPath.startsWith('docs') && relPath.endsWith('.md')) return 'doc'
  if (relPath.startsWith('.agents') && relPath.endsWith('.md')) return 'skill'
  // Repo-local skills (`skills/`, since the actioNN consolidation) and the
  // legacy sibling tree scanned via --with-skills (e.g. ../actioNN/skills/...).
  const normalized = relPath.replace(/\\/g, '/')
  if (normalized.startsWith('skills/') && relPath.endsWith('.md')) return 'skill'
  if (normalized.includes('actioNN/skills/') && relPath.endsWith('.md')) return 'skill'
  // specs/CHANGELOG.md was removed by spec-versioning — root CHANGELOG.md is
  // now the only changelog.
  if (relPath === 'CHANGELOG.md') return 'doc'
  if (
    relPath.startsWith('specs') &&
    relPath.endsWith('.md') &&
    !relPath.endsWith('_FORMAT.md') &&
    !relPath.endsWith('_F.md')
  )
    return 'doc'
  if (relPath.startsWith('openspec')) return 'other'
  if (relPath.startsWith('archive')) return 'model'
  return 'other'
}

// â”€â”€ Frontmatter Scanning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function parseFrontmatterBlocks(content) {
  // Extract YAML frontmatter between --- markers
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) return null
  return fmMatch[1]
}

function extractVersionRefs(relPath, content) {
  const refs = []

  // 1. Check file name for version
  const nameMatch = relPath.match(/V_(\d+-\d+-\d+)/)
  if (nameMatch) {
    refs.push({ field: 'filename', value: `V_${nameMatch[1]}`, location: relPath })
  }

  // 2. Parse frontmatter for version fields
  const fm = parseFrontmatterBlocks(content)
  if (fm) {
    // spec_version
    const sv = fm.match(/^spec_version\s*:\s*['"]?(V_\d+-\d+-\d+)['"]?\s*$/m)
    if (sv) refs.push({ field: 'spec_version', value: sv[1], location: relPath })

    // knowledge_version
    const mv = fm.match(/^knowledge_version\s*:\s*['"]?(V_\d+-\d+-\d+)['"]?\s*$/m)
    if (mv) refs.push({ field: 'knowledge_version', value: mv[1], location: relPath })

    // spec_url (extract version from URL)
    const su = fm.match(/^spec_url\s*:\s*['"](https?:\/\/[^'"]+)['"]\s*$/m)
    if (su) {
      const urlVer = su[1].match(/V_\d+-\d+-\d+/)
      if (urlVer) refs.push({ field: 'spec_url', value: urlVer[0], location: relPath })
    }

    // parent block â€” name
    const pn = fm.match(/^parent:\s*\n\s+name:\s*['"]?([^\s'"]+_V_\d+-\d+-\d+[^\s'"]*)['"]?\s*$/m)
    if (pn) {
      const parentVer = pn[1].match(/V_\d+-\d+-\d+/)
      if (parentVer) refs.push({ field: 'parent.name', value: parentVer[0], location: relPath })
    }

    // parent block â€” url
    const pu = fm.match(/^parent:\s*\n(?:\s+.*\n)*?\s+url:\s*['"](https?:\/\/[^'"]+)['"]\s*$/m)
    if (pu) {
      const urlVer = pu[1].match(/V_\d+-\d+-\d+/)
      if (urlVer) refs.push({ field: 'parent.url', value: urlVer[0], location: relPath })
    }

    // parent_spec block â€” name
    const psn = fm.match(
      /^parent_spec:\s*\n\s+name:\s*['"]?([^\s'"]+_V_\d+-\d+-\d+[^\s'"]*)['"]?\s*$/m,
    )
    if (psn) {
      const parentSpecVer = psn[1].match(/V_\d+-\d+-\d+/)
      if (parentSpecVer)
        refs.push({ field: 'parent_spec.name', value: parentSpecVer[0], location: relPath })
    }

    // parent_spec block â€” url
    const psu = fm.match(
      /^parent_spec:\s*\n(?:\s+.*\n)*?\s+url:\s*['"](https?:\/\/[^'"]+)['"]\s*$/m,
    )
    if (psu) {
      const urlVer = psu[1].match(/V_\d+-\d+-\d+/)
      if (urlVer) refs.push({ field: 'parent_spec.url', value: urlVer[0], location: relPath })
    }
  }

  return refs
}

// â”€â”€ Version Matching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function contentContainsVersion(content, version) {
  const re = new RegExp(`(?:^|[^V])${escapeRegex(version)}(?:[^\\d-]|$)`, 'gm')
  return re.test(content)
}

// ── Repo-Wide URL & Legacy Integrity Check ──────────────────────────

// Files visible to git (tracked + untracked-but-not-ignored). The scan walks the
// filesystem, so without this it also flags gitignored local artifacts (e.g. the
// `_NN/specs/**` resolver caches, .gitignore:30-36) that a fresh CI checkout never
// has — making a clean repo fail locally but pass in CI. Selection is centralized
// in scripts/lib/git-visible.js; null when git is unavailable, in which case no
// filtering is applied.
let gitVisibleFilesCache
function gitVisibleFiles() {
  if (gitVisibleFilesCache === undefined) {
    gitVisibleFilesCache = collectGitVisible(REPO_ROOT)
  }
  return gitVisibleFilesCache
}

function collectRepoFiles(dir, includeArchives) {
  const files = []
  const gitVisible = gitVisibleFiles()

  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const full = join(dir, entry)
      const st = statSync(full)
      const rel = relative(REPO_ROOT, full).replace(/\\/g, '/')

      if (st.isDirectory()) {
        if (!includeArchives && (entry === 'archive' || ARCHIVE_DIRS.has(entry))) continue
        if (rel === 'iNNfo/apps/innfo-editor/tests/fixtures/models') continue
        if (rel.startsWith('openspec/changes/')) continue
        // Quarantine: the frozen legacy-domain fixture intentionally keeps the
        // pre-rename template URLs (it is the migrator's input).
        if (rel.startsWith('iNNfo/packages/innfo-core/tests/legacy/fixtures/')) continue
        files.push(...collectRepoFiles(full, includeArchives))
      } else {
        if (full.endsWith('.bundle.js')) continue
        if (rel === 'scripts/migrate-spec-urls.mjs') continue
        // The write guard records the historical codemod string in its allowlist.
        if (rel === 'scripts/lib/legacy-write-guard.js') continue
        // Frozen write-once predecessors (permanent history, never migrated).
        if (rel === 'iNNfo/specs/defiNNe_V_0-1-0_NN.md') continue
        if (rel === 'iNNfo/specs/defiNNition_V_0-1-0_NN.md') continue
        // Generated mirror of the frozen specs (by-design embedded history).
        if (rel === 'iNNfo/packages/innfo-core/src/schema/canonical-registry.ts') continue
        if (rel === 'iNNfo/scripts/check-spec-version.mjs') continue
        if (gitVisible && !gitVisible.has(full.replace(/\\/g, '/'))) continue
        const ext = extname(entry)
        if (URL_CHECK_EXTENSIONS.has(ext)) {
          files.push(full)
        }
      }
    }
  } catch {
    // permission denied or doesn't exist
  }
  return files
}

function isUrlResolutionTarget(rel) {
  if (rel.endsWith('.test.ts') || rel.endsWith('.spec.ts') || rel.includes('/e2e/')) return false
  if (rel.startsWith('docs/') && !rel.endsWith('_NN.md')) return false
  if (rel.endsWith('.ts') || rel.endsWith('.vue')) return true
  if (rel.endsWith('_NN.md')) return true
  // Repo-local skills (`skills/`, since the actioNN consolidation) and the
  // legacy sibling tree scanned via --with-skills (`actioNN/skills/`).
  if (rel.startsWith('skills/') && rel.endsWith('.md')) return true
  if (rel.includes('actioNN/skills/') && rel.endsWith('.md')) return true
  return false
}

function scanUrls(files) {
  const broken = []

  for (const filePath of files) {
    const rel = relative(REPO_ROOT, filePath).replace(/\\/g, '/')
    if (!isUrlResolutionTarget(rel)) continue

    let content
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    const matches = [...content.matchAll(GITHUB_RAW_URL_RE)]
    if (matches.length === 0) continue

    for (const match of matches) {
      // Skip dynamic template-literal URLs (e.g. `.../${name}/${name}_${version}_NN.md`) and
      // placeholder URLs (e.g. `.../<name>/...`) - these are doc syntax templates.
      if (match[0].includes('${') || match[0].includes('<') || match[0].includes('>')) continue

      const repoPath = match[1].replace(/\/+$/, '')
      const localPath = join(INNFO_DIR, repoPath.replace(/\//g, '\\'))

      if (!existsSync(localPath)) {
        // For FOLDER-mode samples, the URL points to the directory _NN.md
        // Check if at least the parent directory exists
        const parentDir = dirname(localPath)
        if (!existsSync(parentDir)) {
          broken.push({ file: rel, url: match[0], missingPath: repoPath })
        }
      }
    }
  }

  return broken
}

function scanStrictLegacy(files) {
  const violations = []
  const warnings = []

  for (const filePath of files) {
    const rel = relative(REPO_ROOT, filePath).replace(/\\/g, '/')
    let content
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    if (!content.includes('cogNNitive/iNNfo')) continue

    const lines = content.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (LEGACY_SLUG_RE.test(line)) {
        const lineNum = i + 1
        if (ALLOWLISTED_EXACT_PATHS.has(rel)) {
          warnings.push({ file: rel, line: lineNum, text: line.trim() })
        } else {
          violations.push({ file: rel, line: lineNum, text: line.trim() })
        }
      }
    }
  }

  return { violations, warnings }
}

function printUrlResults(broken) {
  if (broken.length === 0) {
    console.log('  All hardcoded GitHub raw URLs point to existing files.\n')
    return
  }

  console.log(`  ${broken.length} broken URL(s):\n`)
  for (const b of broken) {
    console.log(`  \u00B7 ${b.file}`)
    console.log(`    URL: ${b.url}`)
    console.log(`    Missing: ${b.missingPath}`)
    console.log()
  }
}

// â”€â”€ Scan Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function categorizeByVersion(files) {
  const versionMap = new Map()

  for (const filePath of files) {
    const rel = relative(ROOT, filePath)
    let content
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    const matches = content.match(FORMAT_VERSION_RE)
    if (!matches) continue

    const uniqueVersions = [...new Set(matches)]
    for (const ver of uniqueVersions) {
      if (!versionMap.has(ver)) versionMap.set(ver, [])
      versionMap.get(ver).push(rel)
    }
  }
  return versionMap
}

function scanForVersion(version, files) {
  const results = []
  const seen = new Set()

  for (const filePath of files) {
    const rel = relative(ROOT, filePath)
    if (seen.has(rel)) continue

    let content
    try {
      content = readFileSync(filePath, 'utf-8')
    } catch {
      continue
    }

    if (!contentContainsVersion(content, version)) continue
    seen.add(rel)

    const refs = extractVersionRefs(rel, content)
    results.push({
      file: rel,
      category: classifyFile(rel),
      refs: refs.length > 0 ? refs : [{ field: 'text', value: version, location: rel }],
    })
  }

  return results
}

// â”€â”€ Output â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CATEGORY_LABELS = {
  spec: '\u{1F4C4} Specs',
  template: '\u{1F4CB} Templates',
  model: '\u{1F4E6} Models',
  fixture: '\u{1F9EA} Fixtures',
  test: '\u{1F9EA} Tests',
  source: '\u{2699}\u{FE0F}  Source',
  doc: '\u{1F4DD} Docs',
  skill: '\u{1F916} Skills',
  other: '\u{1F4C1} Other',
}
const CATEGORY_ORDER = [
  'spec',
  'template',
  'model',
  'fixture',
  'test',
  'source',
  'doc',
  'skill',
  'other',
]

function printResults(results, byType, version) {
  if (results.length === 0) {
    console.log(`  No files reference "${version}" \u2014 repo is clean.\n`)
    return
  }

  if (byType) {
    const grouped = {}
    for (const r of results) {
      if (!grouped[r.category]) grouped[r.category] = []
      grouped[r.category].push(r)
    }

    console.log(`  ${results.length} file(s) referencing "${version}":\n`)

    for (const cat of CATEGORY_ORDER) {
      const items = grouped[cat]
      if (!items || items.length === 0) continue
      const label = CATEGORY_LABELS[cat] || cat
      console.log(`  ${label}  (${items.length})`)
      for (const item of items) {
        const refSummary = item.refs.map((r) => `${r.field}=${r.value}`).join(', ')
        console.log(`    \u00B7 ${item.file}`)
        if (refSummary) console.log(`      \u2192 ${refSummary}`)
      }
      console.log()
    }
  } else {
    console.log(`  ${results.length} file(s) referencing "${version}":\n`)
    for (const item of results) {
      const refSummary = item.refs.map((r) => `${r.field}=${r.value}`).join(', ')
      console.log(`  \u00B7 ${item.file}`)
      if (refSummary) console.log(`    ${refSummary}`)
    }
    console.log()
  }
}

function printInventory(versionMap) {
  const sorted = [...versionMap.entries()].sort((a, b) => {
    const aParts = a[0].replace('V_', '').split('-').map(Number)
    const bParts = b[0].replace('V_', '').split('-').map(Number)
    for (let i = 0; i < 3; i++) {
      if (aParts[i] !== bParts[i]) return bParts[i] - aParts[i]
    }
    return 0
  })

  console.log('  Spec Version Inventory\n')
  for (const [ver, files] of sorted) {
    console.log(`  ${ver}  \u2014  ${files.length} file(s)`)
    for (const f of files.slice(0, 15)) {
      console.log(`    \u00B7 ${f}`)
    }
    if (files.length > 15) console.log(`    \u2026 and ${files.length - 15} more`)
    console.log()
  }
  console.log(`  Total: ${sorted.length} unique spec versions across the repo.\n`)
}

// â”€â”€ CLI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function parseArgs() {
  const args = process.argv.slice(2)
  let version = null
  let byType = false
  let checkMode = false
  let inventory = false
  let includeArchives = false
  let checkUrls = false
  let withSkills = null // null = off, true = auto-detect, string = explicit path

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--version':
        version = args[++i]
        break
      case '--by-type':
        byType = true
        break
      case '--check':
        checkMode = true
        break
      case '--inventory':
        inventory = true
        break
      case '--include-archives':
        includeArchives = true
        break
      case '--check-urls':
        checkUrls = true
        break
      case '--with-skills': {
        const next = args[i + 1]
        if (next && !next.startsWith('--')) {
          withSkills = next
          i++
        } else {
          withSkills = true
        }
        break
      }
    }
  }
  return { version, byType, checkMode, inventory, includeArchives, checkUrls, withSkills }
}

// â”€â”€ Sibling skills tree (cogNNitive/actioNN) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DEFAULT_SKILL_DIRS = ['../actioNN/skills', '../../actioNN/skills']

// Resolve the sibling skills directory. `spec` is `true` (auto-detect the known
// relative locations) or an explicit path. Returns an absolute path or null.
function resolveSkillsDir(spec) {
  const candidates = spec === true ? DEFAULT_SKILL_DIRS : [spec]
  for (const c of candidates) {
    const abs = resolve(ROOT, c)
    if (existsSync(abs) && statSync(abs).isDirectory()) return abs
  }
  return null
}

// Recursively collect .md files under a skills directory (skips .git etc).
function collectSkillFiles(dir) {
  const files = []
  try {
    for (const entry of readdirSync(dir)) {
      if (ACTIVE_IGNORE.has(entry)) continue
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) files.push(...collectSkillFiles(full))
      else if (entry.endsWith('.md')) files.push(full)
    }
  } catch {
    /* unreadable */
  }
  return files
}

function main() {
  const { version, byType, checkMode, inventory, includeArchives, checkUrls, withSkills } =
    parseArgs()

  const allFiles = collectFiles(ROOT, includeArchives).filter(
    (f) => f.endsWith('.md') || f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.vue'),
  )

  if (withSkills) {
    const skillsDir = resolveSkillsDir(withSkills)
    if (skillsDir) {
      const skillFiles = collectSkillFiles(skillsDir)
      allFiles.push(...skillFiles)
      console.log(
        `  [+] Also scanning ${skillFiles.length} skill file(s) under ${relative(ROOT, skillsDir)}\n`,
      )
    } else if (withSkills !== true) {
      console.error(`  [!] --with-skills path not found: ${withSkills}`)
      process.exit(1)
    } else {
      console.log(
        '  [i] --with-skills: no sibling actioNN/skills tree found, scanning iNNfo only\n',
      )
    }
  }

  if (checkUrls) {
    console.log(`\n  Checking spec URLs & legacy references across repository (${REPO_ROOT})...\n`)
    const repoFiles = collectRepoFiles(REPO_ROOT, false)
    const broken = scanUrls(repoFiles)
    printUrlResults(broken)

    const { violations, warnings } = scanStrictLegacy(repoFiles)
    if (warnings.length > 0) {
      console.log(
        `  Allowlisted legacy references (${warnings.length} occurrences tracked for Change 2):`,
      )
      for (const w of warnings) {
        console.warn(`    [WARN] ${w.file}:${w.line}: ${w.text}`)
      }
      console.log()
    }

    if (violations.length > 0) {
      console.error(
        `  [ERROR] Found ${violations.length} forbidden residual cogNNitive/iNNfo reference(s):`,
      )
      for (const v of violations) {
        console.error(`    · ${v.file}:${v.line}: ${v.text}`)
      }
      console.log()
    }

    const failed = broken.length > 0 || violations.length > 0
    process.exit(failed ? 1 : 0)
  }

  if (inventory) {
    const versionMap = categorizeByVersion(allFiles)
    printInventory(versionMap)
    process.exit(0)
  }

  if (!version) {
    console.error('Required: --version V_x-y-z  --inventory  or  --check-urls')
    console.error('  e.g.  node scripts/check-spec-version.mjs --version V_0-1-2')
    process.exit(1)
  }

  if (!/^V_\d+-\d+-\d+$/.test(version)) {
    console.error(`Invalid version format: "${version}". Use V_x-y-z (e.g. V_0-1-2).`)
    process.exit(1)
  }

  const results = scanForVersion(version, allFiles)
  printResults(results, byType, version)

  if (checkMode && results.length > 0) {
    process.exit(1)
  }
}

main()
