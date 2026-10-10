/**
 * scripts/console-views.mjs
 *
 * Exporter side of console view discovery and inlining (change
 * 2026-10-09-domain-console-views). A view is a classic script that calls the
 * `registerView` injected by the wrapper emitted here; its id is the file slug.
 *
 * Discovery by convention, no manifest:
 *   bluepriNNt views  <pkg>/assets/console-view-<slug>.js, one pkg per parent_spec base
 *   domaiNN views     <domainRoot>/consoles/views/<slug>.js
 * BluepriNNt views are FLAT under `assets/` (prefix `console-view-`) because the MCP
 * installer's fetchSubdir('assets') copies files only, never nested directories, so a
 * deeply nested `assets/consoles/views/` does not survive an install.
 * Everything here is trusted domain-owner code and runs with full page access;
 * the header comment written by `viewsHeader` lets a reviewer see what is included.
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { Script } from 'node:vm'

// Mirrors innfo-runtime.js (VIEW_ID_RE, RESERVED_VIEW_IDS); a test keeps them in step.
export const VIEW_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const RESERVED_VIEW_IDS = ['explorer', 'matrices', 'review']

const DOMAIN_VIEWS_SUBPATH = ['consoles', 'views']
const BLUEPRINT_VIEWS_SUBPATH = ['assets']
const BLUEPRINT_VIEW_PREFIX = 'console-view-'
const HASH_DISPLAY_LENGTH = 12

const SPEC_BASE_RE = /^[A-Za-z0-9_-]+$/

/** `metrics_V_0-4-1` -> `{ base: 'metrics', version: 'V_0-4-1' }`. */
export function parseSpecName(name) {
  const m = /^(.+?)_(V_\d+-\d+-\d+)$/.exec(name)
  return m ? { base: m[1], version: m[2] } : { base: name, version: null }
}

/** View directories for one parent_spec, in priority order; the first that holds views wins. */
export function viewRootCandidates({ domainRoot, specName, packagesDir }) {
  const { base, version } = parseSpecName(specName)
  // The base becomes a path segment: a name like `../../x` must never reach `join`.
  if (!SPEC_BASE_RE.test(base)) {
    throw new Error(`parent_spec "${specName}" is not a valid name: the part before the version may only use letters, digits, "_" and "-"`)
  }
  const tier1 = join(domainRoot, 'specs', 'bluepriNNts', base)
  return [
    ...(version ? [join(tier1, version, ...BLUEPRINT_VIEWS_SUBPATH)] : []),
    join(tier1, ...BLUEPRINT_VIEWS_SUBPATH),
    join(packagesDir, base, ...BLUEPRINT_VIEWS_SUBPATH),
  ]
}

async function dirExists(dir) {
  try {
    return (await stat(dir)).isDirectory()
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return false
    throw err
  }
}

const compareCodeUnits = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** Directory entries, or null when the folder is absent (never for a permission error). */
async function listEntries(dir) {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch (err) {
    // Only "there is nothing there" means "no views"; permission or I/O errors must surface.
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') return null
    throw err
  }
}

/**
 * `{ name, slug }` for every view file in a listing. BluepriNNt roots are flat `assets/`
 * folders, so only `console-view-<slug>.js` counts; domaiNN roots take every `*.js`.
 */
function viewFiles(dir, entries, blueprint) {
  const files = []
  for (const entry of entries) {
    if (!entry.name.endsWith('.js')) continue
    if (blueprint && !entry.name.startsWith(BLUEPRINT_VIEW_PREFIX)) continue
    if (entry.isSymbolicLink()) {
      throw new Error(`${join(dir, entry.name)} is a symbolic link; symlinked views are not supported, copy the file instead`)
    }
    if (entry.isFile()) {
      const slug = blueprint
        ? entry.name.slice(BLUEPRINT_VIEW_PREFIX.length, -'.js'.length)
        : entry.name.slice(0, -'.js'.length)
      files.push({ name: entry.name, slug })
    }
  }
  return files.sort((a, b) => compareCodeUnits(a.name, b.name))
}

async function readViews(dir, files, origin, sourcePrefix) {
  const views = []
  for (const { name, slug } of files) {
    const id = slug
    const source = `${sourcePrefix}/${name}`
    if (!VIEW_ID_RE.test(id)) {
      throw new Error(`invalid view id "${id}" from ${source}: the file name must be a slug of lowercase alphanumerics and hyphens`)
    }
    if (RESERVED_VIEW_IDS.includes(id)) throw new Error(`view id "${id}" is reserved (${source})`)
    const code = await readFile(join(dir, name), 'utf8')
    assertClassicScript(code, source)
    views.push({ id, origin, source, code, sha256: createHash('sha256').update(code, 'utf8').digest('hex') })
  }
  return views
}

/**
 * Finds every view for a domaiNN. `specNames` are the parent_spec names of the
 * exported models; each base resolves to one views folder, and models on several
 * versions of a base that resolve to different folders are an error. Throws before
 * returning on a bad id, a duplicate id, ES module syntax or such a conflict.
 * `onWarning` receives a message when a base has no bluepriNNt package anywhere it
 * looks, because its views (if it has any) cannot be found.
 * @param {{ domainRoot: string, specNames?: string[], packagesDir: string, onWarning?: (message: string) => void }} options
 */
export async function discoverViews({ domainRoot, specNames = [], packagesDir, onWarning = () => {} }) {
  // Plain code-unit order (not localeCompare) so the result and the messages never depend
  // on the machine's locale or on the order the models were found in.
  const sortedNames = [...new Set(specNames)].sort(compareCodeUnits)
  /** @type {Map<string, { specName: string, dir: string, files: {name: string, slug: string}[] }[]>} */
  const hitsByBase = new Map()
  for (const specName of sortedNames) {
    const { base } = parseSpecName(specName)
    for (const dir of viewRootCandidates({ domainRoot, specName, packagesDir })) {
      const entries = await listEntries(dir)
      const files = entries ? viewFiles(dir, entries, true) : null
      if (files === null || files.length === 0) continue // missing or empty: next tier
      hitsByBase.set(base, [...(hitsByBase.get(base) ?? []), { specName, dir, files }])
      break
    }
    if (!hitsByBase.has(base)) {
      const packageDirs = [join(domainRoot, 'specs', 'bluepriNNts', base), join(packagesDir, base)]
      const present = await Promise.all(packageDirs.map(dirExists))
      if (!present.some(Boolean)) {
        onWarning(
          `no bluepriNNt package for "${specName}" found in ${packageDirs.join(' or ')}; its console views, if any, are not included`,
        )
      }
    }
  }

  const found = []
  for (const base of [...hitsByBase.keys()].sort(compareCodeUnits)) {
    const hits = hitsByBase.get(base)
    const other = hits.find((h) => h.dir !== hits[0].dir)
    // Models on different versions of one blueprint may ship different views; picking one
    // silently would hide the other, so the domain owner has to resolve it.
    if (other) {
      throw new Error(
        `models on blueprint "${base}" resolve to different views: ${hits[0].specName} (${hits[0].dir}) and ${other.specName} (${other.dir}); keep views for one version, or move them to the shared folder`,
      )
    }
    found.push(...(await readViews(hits[0].dir, hits[0].files, 'bluepriNNt', `bluepriNNt:${base}/${BLUEPRINT_VIEWS_SUBPATH.join('/')}`)))
  }
  const domainDir = join(domainRoot, ...DOMAIN_VIEWS_SUBPATH)
  const domainEntries = await listEntries(domainDir)
  found.push(...(await readViews(domainDir, domainEntries ? viewFiles(domainDir, domainEntries, false) : [], 'domaiNN', 'domaiNN:consoles/views')))

  const bySlug = new Map()
  for (const v of found) {
    const first = bySlug.get(v.id)
    if (first) throw new Error(`duplicate view id "${v.id}": ${first.source} and ${v.source}`)
    bySlug.set(v.id, v)
  }
  return [...found].sort((a, b) => compareCodeUnits(a.id, b.id))
}

/** The exact text that runs, shared by the syntax check and the emitted script. */
function wrapperText(view) {
  return (
    ";(function (registerView) { 'use strict';\n" +
    view.code +
    `\n})(InnfoConsole.viewRegistrar(${JSON.stringify(view.id)}, ${JSON.stringify(view.source)}));`
  )
}

const WORDS_BEFORE_REGEX = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await',
])
const IMPORT_DECLARATION = /^\s*[A-Za-z_$*{'"]/
const EXPORT_DECLARATION = /^\s*(?:default\b|const\b|let\b|var\b|function\b|class\b|async\b|[{*])/
const TOP_LEVEL_AWAIT = /^\s*[A-Za-z_$([{'"`0-9]/

/**
 * Which ES-module-only construct `code` uses, or null. A small token scanner (strings,
 * template literals with nested `${}`, regex literals, comments) so look-alike text inside
 * them is not mistaken for syntax, and so the answer never depends on the engine's message
 * wording. It only runs after the script already failed to compile, to explain why.
 * @returns {'import' | 'export' | 'import.meta' | 'top-level await' | null}
 */
export function findModuleSyntax(code) {
  const n = code.length
  const templateDepths = [] // brace depth at which each open `${` sits
  let i = 0
  let depth = 0
  let prev = '' // kind of the last token: '' start, 'o' operator/punctuation, 'w' word or number, ')' ']' '}' closers, 's' literal
  let prevChar = ''
  let prevWord = ''

  const skipTemplate = () => {
    while (i < n) {
      const c = code[i]
      if (c === '\\') i += 2
      else if (c === '`') return void i++
      else if (c === '$' && code[i + 1] === '{') {
        i += 2
        templateDepths.push(depth++)
        return
      } else i++
    }
  }
  const skipRegex = () => {
    let inClass = false
    i++
    while (i < n && code[i] !== '\n') {
      const c = code[i]
      if (c === '\\') i++
      else if (c === '[') inClass = true
      else if (c === ']') inClass = false
      else if (c === '/' && !inClass) break
      i++
    }
    i++
    while (i < n && /[a-z]/i.test(code[i])) i++
  }

  while (i < n) {
    const c = code[i]
    const next = code[i + 1]
    if (/\s/.test(c)) {
      i++
    } else if (c === '/' && next === '/') {
      while (i < n && code[i] !== '\n') i++
    } else if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2)
      i = end < 0 ? n : end + 2
    } else if (c === '"' || c === "'") {
      i++
      while (i < n && code[i] !== c && code[i] !== '\n') i += code[i] === '\\' ? 2 : 1
      i++
      prev = 's'
      prevChar = c
    } else if (c === '`') {
      i++
      skipTemplate()
      prev = 's'
      prevChar = c
    } else if (c === '/' && (prev === '' || prev === 'o' || prev === '}' || (prev === 'w' && WORDS_BEFORE_REGEX.has(prevWord)))) {
      skipRegex()
      prev = 's'
      prevChar = '/'
    } else if (/[A-Za-z_$]/.test(c)) {
      let j = i
      while (j < n && /[\w$]/.test(code[j])) j++
      const word = code.slice(i, j)
      const rest = code.slice(j)
      if (prevChar !== '.') {
        if (word === 'import' && /^\s*\./.test(rest)) return 'import.meta'
        if (word === 'import' && depth === 0 && IMPORT_DECLARATION.test(rest)) return 'import'
        if (word === 'export' && depth === 0 && EXPORT_DECLARATION.test(rest)) return 'export'
        if (word === 'await' && depth === 0 && prevChar !== '>' && TOP_LEVEL_AWAIT.test(rest)) return 'top-level await'
      }
      i = j
      prev = 'w'
      prevChar = word.at(-1)
      prevWord = word
    } else if (/[0-9]/.test(c)) {
      while (i < n && /[\w.]/.test(code[i])) i++
      prev = 'w'
      prevChar = '0'
      prevWord = ''
    } else if (c === '}' && templateDepths.at(-1) === depth - 1) {
      templateDepths.pop()
      depth--
      i++
      skipTemplate()
      prev = 's'
      prevChar = '`'
    } else {
      if (c === '{') depth++
      else if (c === '}') depth--
      prev = c === ')' || c === ']' || c === '}' ? c : 'o'
      prevChar = c
      i++
    }
  }
  return null
}

/**
 * Views are classic scripts: compile them so module syntax and other syntax errors fail the
 * export. The compiled text is the real wrapper, which starts with `'use strict'`, so sloppy-only
 * code (`with`, legacy octals, ...) is rejected here as an ordinary syntax error, exactly as it
 * would fail in the page.
 */
export function assertClassicScript(code, source) {
  try {
    new Script(wrapperText({ id: 'x', source, code }), { filename: source })
  } catch (err) {
    const module = err instanceof SyntaxError ? findModuleSyntax(code) : null
    throw new Error(
      module
        ? `${source}: ES module syntax (${module}) is not supported; a view is a classic script`
        : `${source}: syntax error: ${err.message}`,
    )
  }
}

// `</script` ends the element; `<script` + whitespace, `/` or `>` after a `<!--` puts the HTML
// tokenizer into the "script data double escaped" state, where `</script>` no longer ends it
// and the rest of the page is swallowed. `<!--` alone is harmless once `<script` is neutralized
// (it needs both), and rewriting it is not safe: in code position it is a comment, and `\!` is
// an error in a `u`-flag regex. `\x3C` is the same character in a string, template (cooked
// value), regex (also with `u`) and a comment, so the program does not change.
const SCRIPT_TAG_OPEN = /<(?=\/script|script[\s/>])/gi

/** Keeps embedded text from closing or double-escaping its host `<script>`. */
export function escapeScript(text) {
  return text.replace(SCRIPT_TAG_OPEN, '\\x3C')
}

/** `escapeScript` for code that is compiled afterwards, so a sequence in code position fails loudly. */
function escapeChecked(text, label) {
  const out = escapeScript(text)
  if (out !== text) {
    try {
      new Script(out, { filename: label })
    } catch {
      throw new Error(
        `${label}: "<script" or "</script" outside a string, regex, template or comment cannot be embedded in an HTML script`,
      )
    }
  }
  return out
}

const escapeStyle = (text) => text.replace(/<\/(style)/gi, '<\\/$1')
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function wrapView(view) {
  return (
    `<script data-innfo-view="${escapeAttr(view.id)}" data-innfo-view-source="${escapeAttr(view.source)}">\n` +
    `${escapeChecked(wrapperText(view), view.source)}\n</script>`
  )
}

/** HTML comment listing what runs in the page: `<id> <origin> <source> sha256:<12 hex>`. */
export function viewsHeader(views) {
  if (views.length === 0) return ''
  const clean = (s) => s.replace(/\s+/g, '_').replace(/-{2,}/g, '-')
  const lines = views.map(
    (v) => `${clean(v.id)} ${v.origin} ${clean(v.source)} sha256:${v.sha256.slice(0, HASH_DISPLAY_LENGTH)}`,
  )
  return `<!-- innfo-views (trusted code, full page access)\n${lines.join('\n')}\n-->`
}

const CSS_LINK = /<link rel="stylesheet" href="\.\/innfo-ui\.css" ?\/>/
const VIEWPORT = /<meta name="viewport"[^>]*>/
// The local bundle tag plus the generated CDN/mirror block that follows it.
const BUNDLE_TAGS =
  /<script src="\.\/innfo-console\.bundle\.js"><\/script>\s*<!-- nn:console-shell:start -->[\s\S]*?<!-- nn:console-shell:end -->/

const STRAY_BUNDLE_TAG = /<script[^>]*\ssrc="[^"]*innfo-console\.bundle[^"]*"/

const PREPARED = Symbol('prepared console assets')

/**
 * Validates the assets and does the expensive work once: the bundle and every view are
 * escaped and compiled here, so a caller that checks before writing and inlines after
 * passes the result to both and pays for it a single time. Throws on a missing bundle or
 * CSS, or a view or bundle that cannot be embedded.
 */
export function prepareAssets({ bundle, css, views }) {
  if (typeof bundle !== 'string' || bundle === '') throw new Error('console bundle is missing or empty')
  if (typeof css !== 'string') throw new Error('console stylesheet is missing')
  return {
    [PREPARED]: true,
    css,
    header: viewsHeader(views),
    bundleScript: `<script>\n${escapeChecked(bundle, 'console bundle')}\n</script>`,
    viewScripts: views.map(wrapView),
  }
}

const prepared = (assets) => (assets[PREPARED] ? assets : prepareAssets(assets))

function assertShell(shell) {
  /** @type {[string, RegExp][]} */
  const anchors = [['stylesheet link', CSS_LINK], ['viewport meta', VIEWPORT], ['bundle script tags', BUNDLE_TAGS]]
  for (const [name, re] of anchors) {
    if (!re.test(shell)) throw new Error(`console shell has no ${name} to replace (anchor missing)`)
  }
  // Every block is replaced by a full copy of the bundle, and a second copy would replace
  // `window.InnfoConsole`; so exactly one block, and no stray bundle tag next to it.
  const blocks = [...shell.matchAll(new RegExp(BUNDLE_TAGS.source, 'g'))].length
  if (blocks !== 1) throw new Error(`console shell has ${blocks} bundle script blocks; exactly 1 is expected`)
  if (STRAY_BUNDLE_TAG.test(shell.replace(BUNDLE_TAGS, ''))) {
    throw new Error('console shell has a bundle script tag outside the shell block, which would stay external')
  }
}

/**
 * Everything `inlineConsoleAssets` needs to succeed, checked without producing output, so a
 * caller can call it before its first write. Returns the prepared assets; pass them to
 * `inlineConsoleAssets` to skip the repeated escaping and compiling.
 */
export function assertInlinable(shell, assets) {
  assertShell(shell)
  return prepared(assets)
}

/**
 * One self-contained page: the bundle appears once (the vendored, CDN and raw
 * mirror tags collapse into it, because each extra copy would replace
 * `window.InnfoConsole`), then the views, whose scripts run after it.
 */
export function inlineConsoleAssets(shell, assets) {
  assertShell(shell)
  const { css, header, bundleScript, viewScripts } = prepared(assets)
  return shell
    .replace(CSS_LINK, () => `<style>${escapeStyle(css)}</style>`)
    .replace(VIEWPORT, (meta) => (header ? `${meta}\n${header}` : meta))
    .replace(BUNDLE_TAGS, () => [bundleScript, ...viewScripts].join('\n'))
}

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const n = Number(String(value == null ? '' : value).trim())
  return Number.isFinite(n) ? n : null
}

/**
 * Projects one model's elements onto a timeline: the metric and variable rows the
 * `renderTimelineGrid` runtime consumes, plus the forecast horizon taken from the
 * widest Scenario. Returns null when the model carries no Scenario horizon, so a
 * non-metrics model simply has no projection. Rows keep the element id so a view
 * can open the shared edit modal for the underlying element (D13).
 * @param {Array<{ id?: string, concept?: string, name?: string, fields?: Record<string, unknown>, relations?: Array<{ field: string, target: string, targetLabel: string }> }>} elements
 */
export function deriveProjection(elements) {
  if (!Array.isArray(elements)) return null
  const byId = new Map()
  for (const e of elements) {
    if (e && e.id) byId.set(String(e.id).toLowerCase(), e)
  }
  const scenarioMonths = []
  for (const e of elements) {
    if (e && e.concept === 'Scenario') {
      const m = finiteNumber(e.fields && e.fields.scenarioMonths)
      if (m != null) scenarioMonths.push(m)
    }
  }
  if (scenarioMonths.length === 0) return null
  const months = Math.max(...scenarioMonths)

  const growthOf = (e) => {
    const rel = (e.relations || []).filter((r) => r.field === 'evolution')[0]
    const target = rel ? byId.get(String(rel.target).toLowerCase()) : null
    const type = target && target.fields ? target.fields.evolutionType : null
    const factor = target && target.fields ? finiteNumber(target.fields.evolutionFactor) : null
    return { mode: typeof type === 'string' && type.trim() ? type.trim() : 'fixed', factor: factor != null ? factor : 0 }
  }

  const rows = []
  for (const e of elements) {
    if (!e) continue
    const f = e.fields || {}
    if (e.concept === 'Metrics') {
      const raw = typeof f.metricFormula === 'string' ? f.metricFormula.trim() : ''
      const formula = raw && !/^<.*>$/.test(raw) ? raw : ''
      const row = {
        id: e.id,
        label: e.name,
        grp: 'Metrics',
        metricType: typeof f.metricType === 'string' ? f.metricType : '',
        metricUnit: typeof f.metricUnit === 'string' ? f.metricUnit : '',
        growth: growthOf(e),
      }
      if (formula) row.formula = formula
      else row.variable = true
      const base = finiteNumber(f.metricValue)
      if (base != null) row.base = base
      rows.push(row)
    } else if (e.concept === 'Variables') {
      const row = {
        id: e.id,
        label: e.name,
        grp: 'Variables',
        variable: true,
        metricType: typeof f.variableType === 'string' ? f.variableType : '',
        metricUnit: typeof f.variableUnit === 'string' ? f.variableUnit : '',
        growth: { mode: 'fixed', factor: 0 },
      }
      const base = finiteNumber(f.variableValue)
      if (base != null) row.base = base
      rows.push(row)
    }
  }
  if (rows.length === 0) return null
  return { rows, months }
}

/** The only place the size thresholds live (bytes of the final HTML). */
export const CONSOLE_SIZE_BUDGET = Object.freeze({ warnBytes: 5_000_000, failBytes: 15_000_000 })/**
 * Pure size gate. Inputs are UTF-8 byte counts: bundle = inlined bundle + CSS, models =
 * schema + model slots, views = wrapped view scripts, total = the final HTML.
 */
export function evaluateSizeBudget({ bundle, models, views, total }) {
  const breakdown = `size: total ${total} B (bundle ${bundle} B, models ${models} B, views ${views} B)`
  const { warnBytes, failBytes } = CONSOLE_SIZE_BUDGET
  const status = total > failBytes ? 'fail' : total > warnBytes ? 'warn' : 'ok'
  const limit = status === 'fail' ? failBytes : warnBytes
  const message =
    status === 'ok'
      ? breakdown
      : `console is larger than ${limit} B; ${breakdown}` +
        (status === 'fail' ? '. Views are not split lazily: remove or slim what is inlined.' : '')
  return { status, total, breakdown, message }
}
