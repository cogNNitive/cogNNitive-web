import { createHash } from 'node:crypto'
import { readdir, readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises'
import { join, basename, isAbsolute } from 'node:path'
import { isInsideRoot, isDriveQualified, isDriveContained } from './path-guard.js'
import { fileURLToPath } from 'node:url'
import { homedir, tmpdir } from 'node:os'
import {
  parseFrontmatter,
  SpecResolutionError,
  findCanonicalTemplate,
} from '@cognnitive/innfo-core'
import type {
  SpecCache,
  SpecDocument,
  ResolverOptions,
  ResolvedTemplatePackage,
} from '@cognnitive/innfo-core'

export type FreshnessVerdict = 'fresh' | 'stale' | 'unknown'

export interface FreshnessResult {
  name: string
  url: string
  verdict: FreshnessVerdict
}

export type ResolverOptionsWithFreshness = ResolverOptions & {
  globalDir?: string
  skillsDir?: string
  checkFreshness?: boolean
  /**
   * Explicit cache directory for fetched specs/bluepriNNts. Defaults to
   * {@link defaultCacheDir} (OS temp dir). Reads check it after the
   * workspace tree; fetch-and-save paths write to it unless `inPlace`.
   */
  cacheDir?: string
  /**
   * When true, fetched content is written inside `<rootDir>/specs` (legacy
   * behavior). Default false — the workspace tree stays clean.
   */
  inPlace?: boolean
}

/**
 * Default on-disk location for fetched specs/bluepriNNts:
 * `join(os.tmpdir(), 'innfo-specs')`. Resolver *writes* (never reads alone)
 * go here by default so a default run creates no cache artifacts inside the
 * workspace or repository tree. Restored in-tree only via `inPlace: true`.
 * `INNFO_CACHE_DIR` overrides the location (test seam, mirroring
 * `INNFO_GLOBAL_DIR` / `INNFO_SKILLS_DIR`).
 */
export function defaultCacheDir(): string {
  return process.env.INNFO_CACHE_DIR ?? join(tmpdir(), 'innfo-specs')
}

export type ResolvedCache = SpecCache & { freshness?: Map<string, FreshnessResult> }

export function isLocalPath(url: string): boolean {
  if (!url) return false
  if (url.startsWith('http://') || url.startsWith('https://')) return false
  if (url.startsWith('file://')) return true
  if (isAbsolute(url)) return true
  if (/^[a-zA-Z]:[/\\]/.test(url)) return true
  if (url.startsWith('.') || url.endsWith('.md') || url.includes('/') || url.includes('\\'))
    return true
  return false
}

/**
 * Resolve a local `parent_spec.url` / `template_url` to a real file path,
 * confined to `rootDir`.
 *
 * The url comes from model frontmatter — document content, not a vetted caller
 * argument — so an absolute, drive-qualified, UNC or `..`-escaping value must
 * never be honoured verbatim. A UNC path is refused outright: on Windows even
 * a failed read of `\\host\share` leaks the local account's NTLM hash.
 *
 * Returns `null` when the url cannot be proven to stay inside `rootDir`;
 * callers treat that as "this resolution tier missed" and fall through.
 */
export function toLocalFilePath(url: string, rootDir?: string): string | null {
  if (/^[/\\]{2}/.test(url)) return null

  let candidate: string
  if (url.startsWith('file://')) {
    try {
      candidate = fileURLToPath(url)
    } catch {
      return null
    }
  } else {
    candidate = url
  }

  // A drive-qualified path is absolute on every host, so `isInsideRoot` (which
  // resolves against the host) cannot judge it: off Windows it reads `C:\x` as
  // a harmless relative name and hands back a path never proven contained.
  // Decide containment on the string form instead.
  if (isDriveQualified(candidate)) {
    return isDriveContained(rootDir, candidate) ? candidate : null
  }

  // Without a root there is nothing to contain against — refuse anything that
  // is not already a plain relative path.
  if (!rootDir) {
    return isAbsolute(candidate) ? null : candidate
  }

  const resolved = isAbsolute(candidate) ? candidate : join(rootDir, candidate)
  return isInsideRoot(rootDir, resolved) ? resolved : null
}

const MAX_DEPTH_DEFAULT = 10

export function normalizeVersion(versionStr: string): string {
  let v = versionStr.replace(/^[vV]_?/, '')
  v = v.replace(/[_-]/g, '.')
  return v.trim()
}

export function parseSpecName(name: string) {
  // Strip file extensions and NN/FORMAT suffixes
  const clean = name.replace(/\.(md|markdown)$/i, '').replace(/_(NN|FORMAT|F)$/i, '')
  // Split at _V_ to extract base and version
  const parts = clean.split(/_V_/i)
  const base = parts[0].toLowerCase()
  const rawVersion = parts[1]
  const version = rawVersion ? normalizeVersion(rawVersion) : undefined
  return { base, version }
}

async function getMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...(await getMarkdownFiles(fullPath)))
      } else if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) {
        files.push(fullPath)
      }
    }
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: a scan dir may legitimately not exist or be unreadable.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[resolver-node] Failed to scan dir ${dir}: ${err}`)
    }
    /* v8 ignore stop */
  }
  return files
}

async function download(url: string, timeout: number): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`)
    return await resp.text()
  } finally {
    clearTimeout(timer)
  }
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex')
}

/**
 * Compare the content hash of a locally cached spec against its canonical
 * remote. Read-only: never writes back to `specs/`. Any failure (network,
 * timeout, HTTP error) degrades to `unknown` — freshness must never fail
 * resolution. Exported so the workspace integrity check can compute
 * per-template freshness for `check_workspace` (AD-5 step 6).
 */
export async function freshnessVerdict(
  url: string,
  localContent: string,
  timeout: number,
): Promise<FreshnessVerdict> {
  try {
    const remote = await download(url, timeout)
    return sha256(localContent) === sha256(remote) ? 'fresh' : 'stale'
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: freshness is advisory — an unreachable remote
    // records `unknown` and never fails resolution (documented contract).
    console.warn(`[resolver-node] Freshness check failed for ${url}: ${err}`)
    return 'unknown'
    /* v8 ignore stop */
  }
}

/** Normalized version (dots) declared by a spec document's own frontmatter, if any. */
function versionFromFrontmatter(content: string): string | undefined {
  const fm = parseFrontmatter(content)
  const v = fm?.spec_version ?? fm?.specification_version
  return v ? normalizeVersion(String(v)) : undefined
}

/**
 * Canonical local filename for a resolved document.
 *
 * The filename must reflect the document's OWN version, not the caller's
 * request name. A request for `business` (from a `latest/` URL) must save as
 * `business_V_0-1-0_NN.md`, so the same spec is never duplicated under a
 * versionless name and a versioned one. Falls back to the request name when
 * the document declares no version.
 */
export function canonicalSpecFilename(requestName: string, content: string): string {
  const fmVersion = versionFromFrontmatter(content)
  if (!fmVersion) return requestName
  // Preserve the request name's original case (iNNfo, defiNNe, cogNNitive...).
  const base = requestName
    .replace(/\.(md|markdown)$/i, '')
    .replace(/_(NN|FORMAT|F)$/i, '')
    .split(/_V_/i)[0]
  return `${base}_V_${fmVersion.replace(/\./g, '-')}`
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x - y
  }
  return 0
}

async function matchSpecPath(
  reqParsed: { base: string; version?: string },
  filePath: string,
): Promise<boolean> {
  const fileParsed = parseSpecName(basename(filePath))
  if (fileParsed.base !== reqParsed.base) return false
  if (!reqParsed.version) return true
  if (fileParsed.version) return fileParsed.version === reqParsed.version
  // Unversioned filename: match via the document's own frontmatter version.
  try {
    const content = await readFile(filePath, 'utf-8')
    const fmVersion = versionFromFrontmatter(content)
    return fmVersion !== undefined && fmVersion === reqParsed.version
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: an unreadable candidate does not match by version.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[resolver-node] Failed to read ${filePath} for version match: ${err}`)
    }
    return false
    /* v8 ignore stop */
  }
}

/** For unversioned requests, prefer the highest version among the matches. */
async function preferHighestVersion(matches: string[]): Promise<string | null> {
  if (matches.length === 0) return null
  let best = matches[0]
  let bestVersion: string | undefined
  for (const m of matches) {
    const nameVersion = parseSpecName(basename(m)).version
    const v = nameVersion ?? versionFromFrontmatter(await readFile(m, 'utf-8').catch(() => ''))
    if (!bestVersion && v) {
      best = m
      bestVersion = v
      continue
    }
    if (bestVersion && v && compareVersions(v, bestVersion) > 0) {
      best = m
      bestVersion = v
    }
  }
  return best
}

/**
 * Find a spec matching `reqName` (base + optional version) under `specsDir`,
 * searched recursively. This is the SINGLE local lookup: it covers both
 * hand-placed/vendored templates and anything a previous run already fetched
 * and saved here — there is no separate cache directory to check.
 */
async function findLocalSpec(specsDir: string, reqName: string): Promise<string | null> {
  const reqParsed = parseSpecName(reqName)
  const matches: string[] = []
  for (const filePath of await getMarkdownFiles(specsDir)) {
    if (await matchSpecPath(reqParsed, filePath)) matches.push(filePath)
  }
  if (reqParsed.version) return matches[0] ?? null
  return preferHighestVersion(matches)
}

/**
 * Helper to find a canonical spec markdown file inside a package directory.
 */
export async function findSpecInPackageDir(dir: string, base: string): Promise<string | null> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const files = entries
      .filter((e) => e.isFile() && /\.(md|markdown)$/i.test(e.name))
      .map((e) => e.name)
    if (files.length === 0) return null

    const specNN = files.find((f) => f.toLowerCase() === 'spec_nn.md')
    if (specNN) return join(dir, specNN)

    const baseV = files.find((f) => f.toLowerCase().startsWith(`${base.toLowerCase()}_v_`))
    if (baseV) return join(dir, baseV)

    const baseNN = files.find((f) => f.toLowerCase() === `${base.toLowerCase()}_nn.md`)
    if (baseNN) return join(dir, baseNN)

    const specMd = files.find((f) => f.toLowerCase() === 'spec.md')
    if (specMd) return join(dir, specMd)

    const baseMd = files.find((f) => f.toLowerCase() === `${base.toLowerCase()}.md`)
    if (baseMd) return join(dir, baseMd)

    return join(dir, files[0])
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: a package dir may legitimately not exist.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[resolver-node] Failed to scan package dir ${dir}: ${err}`)
    }
    return null
    /* v8 ignore stop */
  }
}

/**
 * 4-Tier Template Package Resolver:
 *   Tier 1: Workspace package directory: ./specs/bluepriNNts/<name>/<version>/
 *   Tier 2: Workspace flat fallback: ./templates/<name>_V_<version>_NN.md or ./specs/
 *   Tier 3: Global user cache: ~/.agents/templates/<name>/<version>/
 *   Tier 4: Installed skills directory: ~/.agents/skills/<skill-name>/templates/<name>/<version>/
 */
export async function resolveTemplatePackage(
  rootDir: string,
  reqName: string,
  reqVersion?: string,
  options?: { globalDir?: string; skillsDir?: string },
): Promise<ResolvedTemplatePackage | null> {
  const globalDir =
    options?.globalDir ?? process.env.INNFO_GLOBAL_DIR ?? join(homedir(), '.agents', 'bluepriNNts')
  const skillsDir =
    options?.skillsDir ?? process.env.INNFO_SKILLS_DIR ?? join(homedir(), '.agents', 'skills')

  const parsed = parseSpecName(reqName)
  const base = parsed.base
  const targetVersion = reqVersion ? normalizeVersion(reqVersion) : parsed.version

  // Tier 1: Workspace Package Directory (./specs/bluepriNNts/<name>/<version>/)
  const wsPackageBaseDir = join(rootDir, 'specs', 'bluepriNNts', base)
  try {
    const entries = await readdir(wsPackageBaseDir, { withFileTypes: true })
    const verDirs = entries.filter((e) => e.isDirectory())
    let matchDir: string | null = null
    let matchVer: string | undefined

    if (targetVersion) {
      for (const d of verDirs) {
        if (normalizeVersion(d.name) === targetVersion) {
          matchDir = join(wsPackageBaseDir, d.name)
          matchVer = targetVersion
          break
        }
      }
    } else if (verDirs.length > 0) {
      let bestVer = ''
      for (const d of verDirs) {
        const v = normalizeVersion(d.name)
        if (!bestVer || compareVersions(v, bestVer) > 0) {
          bestVer = v
          matchDir = join(wsPackageBaseDir, d.name)
          matchVer = v
        }
      }
    }

    if (matchDir) {
      const specFile = await findSpecInPackageDir(matchDir, base)
      if (specFile) {
        return {
          name: base,
          version: matchVer || 'V_0-1-0',
          packagePath: matchDir,
          specFilePath: specFile,
          isPackageDir: true,
          tier: 'workspace-package',
        }
      }
    }
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: a tier directory may legitimately not exist.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[resolver-node] Failed to scan package tier dir: ${err}`)
    }
    /* v8 ignore stop */
  }

  // Tier 2: Workspace Flat Fallback (./specs/)
  const flatSearchDirs = [join(rootDir, 'specs')]
  for (const dir of flatSearchDirs) {
    const matchFile = await findLocalSpec(dir, reqName)
    if (matchFile) {
      const content = await readFile(matchFile, 'utf-8').catch(() => '')
      const v = targetVersion || versionFromFrontmatter(content) || '0.1.0'
      return {
        name: base,
        version: v,
        packagePath: matchFile,
        specFilePath: matchFile,
        isPackageDir: false,
        tier: 'workspace-flat',
      }
    }
  }

  // Tier 3: Global User Cache (~/.agents/bluepriNNts/<name>/<version>/)
  const globalBaseDir = join(globalDir, base)
  try {
    const entries = await readdir(globalBaseDir, { withFileTypes: true })
    const verDirs = entries.filter((e) => e.isDirectory())
    let matchDir: string | null = null
    let matchVer: string | undefined

    if (targetVersion) {
      for (const d of verDirs) {
        if (normalizeVersion(d.name) === targetVersion) {
          matchDir = join(globalBaseDir, d.name)
          matchVer = targetVersion
          break
        }
      }
    } else if (verDirs.length > 0) {
      let bestVer = ''
      for (const d of verDirs) {
        const v = normalizeVersion(d.name)
        if (!bestVer || compareVersions(v, bestVer) > 0) {
          bestVer = v
          matchDir = join(globalBaseDir, d.name)
          matchVer = v
        }
      }
    }

    if (matchDir) {
      const specFile = await findSpecInPackageDir(matchDir, base)
      if (specFile) {
        return {
          name: base,
          version: matchVer || 'V_0-1-0',
          packagePath: matchDir,
          specFilePath: specFile,
          isPackageDir: true,
          tier: 'global-cache',
        }
      }
    }
  } catch {
    // Check flat global file
    const matchFile = await findLocalSpec(globalDir, reqName)
    if (matchFile) {
      const content = await readFile(matchFile, 'utf-8').catch(() => '')
      const v = targetVersion || versionFromFrontmatter(content) || '0.1.0'
      return {
        name: base,
        version: v,
        packagePath: matchFile,
        specFilePath: matchFile,
        isPackageDir: false,
        tier: 'global-cache',
      }
    }
  }

  // Tier 4: Installed Skills Directory (~/.agents/skills/*/bluepriNNts/<name>/<version>/)
  try {
    const skillEntries = await readdir(skillsDir, { withFileTypes: true })
    const skillDirs = skillEntries.filter((e) => e.isDirectory()).map((e) => e.name)

    for (const skillName of skillDirs) {
      const skillPkgBase = join(skillsDir, skillName, 'bluepriNNts', base)
      try {
        const entries = await readdir(skillPkgBase, { withFileTypes: true })
        const verDirs = entries.filter((e) => e.isDirectory())
        let matchDir: string | null = null
        let matchVer: string | undefined

        if (targetVersion) {
          for (const d of verDirs) {
            if (normalizeVersion(d.name) === targetVersion) {
              matchDir = join(skillPkgBase, d.name)
              matchVer = targetVersion
              break
            }
          }
        } else if (verDirs.length > 0) {
          let bestVer = ''
          for (const d of verDirs) {
            const v = normalizeVersion(d.name)
            if (!bestVer || compareVersions(v, bestVer) > 0) {
              bestVer = v
              matchDir = join(skillPkgBase, d.name)
              matchVer = v
            }
          }
        }

        if (matchDir) {
          const specFile = await findSpecInPackageDir(matchDir, base)
          if (specFile) {
            return {
              name: base,
              version: matchVer || 'V_0-1-0',
              packagePath: matchDir,
              specFilePath: specFile,
              isPackageDir: true,
              tier: 'installed-skill',
            }
          }
        }
      } catch {
        const matchFile =
          (await findLocalSpec(join(skillsDir, skillName, 'bluepriNNts'), reqName)) ||
          (await findLocalSpec(join(skillsDir, skillName), reqName))
        if (matchFile) {
          const content = await readFile(matchFile, 'utf-8').catch(() => '')
          const v = targetVersion || versionFromFrontmatter(content) || '0.1.0'
          return {
            name: base,
            version: v,
            packagePath: matchFile,
            specFilePath: matchFile,
            isPackageDir: false,
            tier: 'installed-skill',
          }
        }
      }
    }
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: the skills dir may legitimately not exist.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[resolver-node] Failed to scan skills dir: ${err}`)
    }
    /* v8 ignore stop */
  }

  return null
}

/**
 * A complete template package: the primary Level 2 specification plus the
 * accompanying SOP procedures, sample models, and static layout assets, each as
 * a `relativeFilePath -> fileContent` dictionary.
 */
export interface TemplatePackagePayload {
  spec: string
  procedures?: Record<string, string>
  samples?: Record<string, string>
  assets?: Record<string, string>
}

async function writeStagedTree(
  stagingDir: string,
  subdir: string,
  files: Record<string, string> | undefined,
): Promise<void> {
  if (!files) return
  for (const [rel, content] of Object.entries(files)) {
    const dest = join(stagingDir, subdir, rel)
    await mkdir(join(dest, '..'), { recursive: true })
    await writeFile(dest, content, 'utf-8')
  }
}

/**
 * Process-unique suffix for staging/temp paths. `Date.now()` alone collides
 * when two workspaces resolve the same URL in the same millisecond — the
 * second writer must get its own staging dir / temp file, never the first
 * writer's path (concurrent-isolation scenario).
 */
let stagingCounter = 0
function uniqueSuffix(): string {
  return `${process.pid}-${Date.now()}-${stagingCounter++}`
}

/**
 * Write-once atomic package hydration.
 *
 * Creates a staging directory `specs/bluepriNNts/<base>/.staging-<pid>-<time>/`,
 * writes the canonical `spec_NN.md`, a backward-compatible alias
 * `<base>_V_<version>_NN.md`, and any `procedures/`, `samples/` and `assets/`
 * carried by a full package payload, then atomically renames the staging
 * directory to `specs/bluepriNNts/<base>/V_<version>/`. If the target package
 * directory already exists and is non-empty it is treated as immutable and left
 * untouched.
 *
 * `payload` accepts either a bare spec string (spec-only hydration) or a full
 * {@link TemplatePackagePayload}.
 */
export async function hydrateTemplatePackageAtomically(
  rootDir: string,
  base: string,
  version: string,
  payload: string | TemplatePackagePayload,
  opts?: { baseDir?: string },
): Promise<string> {
  const pkg: TemplatePackagePayload = typeof payload === 'string' ? { spec: payload } : payload
  const verSegment = `V_${normalizeVersion(version).replace(/\./g, '-')}`
  const templatesBase = opts?.baseDir ?? join(rootDir, 'specs', 'bluepriNNts')
  const targetPkgDir = join(templatesBase, base, verSegment)

  // Write-once immutability check
  try {
    const existing = await readdir(targetPkgDir)
    if (existing.length > 0) {
      return targetPkgDir
    }
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: the target dir does not exist yet (write-once).
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[resolver-node] Failed to inspect package dir ${targetPkgDir}: ${err}`)
    }
    /* v8 ignore stop */
  }

  const baseTemplatesDir = join(templatesBase, base)
  await mkdir(baseTemplatesDir, { recursive: true })

  const stagingDir = join(baseTemplatesDir, `.staging-${uniqueSuffix()}`)
  await mkdir(stagingDir, { recursive: true })

  const specFileName = 'spec_NN.md'
  const namedFileName = `${base}_${verSegment}_NN.md`
  await writeFile(join(stagingDir, specFileName), pkg.spec, 'utf-8')
  await writeFile(join(stagingDir, namedFileName), pkg.spec, 'utf-8')
  await writeStagedTree(stagingDir, 'procedures', pkg.procedures)
  await writeStagedTree(stagingDir, 'samples', pkg.samples)
  await writeStagedTree(stagingDir, 'assets', pkg.assets)

  try {
    await rename(stagingDir, targetPkgDir)
  } catch (err) {
    /* v8 ignore start */
    // log + continue: cross-device rename fallback — copy + remove instead.
    console.warn(`[resolver-node] Staging rename failed (${err}); falling back to copy`)
    try {
      const { cp } = await import('node:fs/promises')
      await mkdir(targetPkgDir, { recursive: true })
      await cp(stagingDir, targetPkgDir, { recursive: true })
      await rm(stagingDir, { recursive: true, force: true }).catch(() => {})
    } catch (err) {
      // log + continue: copy fallback failed — return the staging dir as-is.
      console.warn(`[resolver-node] Copy fallback failed for ${targetPkgDir}: ${err}`)
    }
    /* v8 ignore stop */
  }

  return targetPkgDir
}

/**
 * Fetch a complete template package from a tag-pinned GitHub release.
 *
 * `spec_NN.md` is fetched from the raw host at `<ref>`; `procedures/`,
 * `samples/` and `assets/` are enumerated via the GitHub contents API at the
 * same `ref` and each entry raw-fetched. Any missing subdirectory is simply
 * absent from the returned payload; a failure to fetch the primary spec throws.
 *
 * `ref` is required and must match `^blueprints-v\d+\.\d+\.\d+$`.
 */
export async function fetchTemplatePackageFromRemote(
  base: string,
  version: string,
  options: { repo?: string; ref?: string; timeout?: number } = {},
): Promise<TemplatePackagePayload> {
  if (!options.ref) {
    throw new Error('ref is required for fetchTemplatePackageFromRemote')
  }
  if (!/^blueprints-v\d+\.\d+\.\d+$/.test(options.ref)) {
    throw new Error(`Invalid blueprint ref "${options.ref}": must match ^blueprints-v\\d+\\.\\d+\\.\\d+$`)
  }
  const ref = options.ref
  const repo = options.repo ?? 'cogNNitive/cogNNitive'
  const timeout = options.timeout ?? 10000
  const dirInRepo = `iNNfo/specs/bluepriNNts/${base}`
  const specName = 'spec_NN.md'
  const rawBase = `https://raw.githubusercontent.com/${repo}/${ref}/${dirInRepo}`

  const spec = await download(`${rawBase}/${specName}`, timeout)

  const fetchSubdir = async (name: string): Promise<Record<string, string> | undefined> => {
    let entries: Array<{ name: string; type: string; path: string }>
    try {
      const apiUrl = `https://api.github.com/repos/${repo}/contents/${dirInRepo}/${name}?ref=${encodeURIComponent(ref)}`
      const listing = JSON.parse(await download(apiUrl, timeout))
      entries = Array.isArray(listing) ? listing : []
    } catch (err) {
      /* v8 ignore start */
      // log + continue: fetchSubdir is best effort — a missing subdirectory is
      // simply absent from the payload.
      console.warn(`[resolver-node] Failed to list subdir ${dirInRepo}/${name}: ${err}`)
      return undefined
      /* v8 ignore stop */
    }
    const out: Record<string, string> = {}
    for (const entry of entries) {
      if (entry.type !== 'file') continue
      try {
        out[entry.name] = await download(`${rawBase}/${name}/${entry.name}`, timeout)
      } catch (err) {
        /* v8 ignore start */
        // log + continue: an unfetchable asset is skipped — the package
        // hydrates without it.
        console.warn(`[resolver-node] Failed to fetch asset ${name}/${entry.name}: ${err}`)
        /* v8 ignore stop */
      }
    }
    return Object.keys(out).length > 0 ? out : undefined
  }

  return {
    spec,
    procedures: await fetchSubdir('procedures'),
    samples: await fetchSubdir('samples'),
    assets: await fetchSubdir('assets'),
  }
}

/**
 * Write `content` to `path` atomically: write to a sibling temp file, then
 * rename over the destination. Never leaves a partially-written file at
 * `path` for a concurrent reader to observe.
 */
async function atomicWriteFile(path: string, content: string): Promise<void> {
  const tmpPath = `${path}.tmp-${uniqueSuffix()}`
  await writeFile(tmpPath, content, 'utf-8')
  await rename(tmpPath, path)
}

/**
 * Save a resolved spec into `specs/`, once. `specs/` content is immutable by
 * convention in this project — a version bump always produces a new
 * filename, never an in-place edit — so an existing file is simply never
 * overwritten. That write-once rule is the entire integrity guarantee: there
 * is nothing to hash-verify because nothing is ever silently replaced.
 */
export async function saveSpecOnce(
  specsDir: string,
  filename: string,
  content: string,
): Promise<void> {
  await mkdir(specsDir, { recursive: true })
  const path = join(specsDir, filename)
  try {
    await readFile(path, 'utf-8')
    return // already present — leave the existing file as authoritative
  } catch (err) {
    /* v8 ignore start */
    // swallow deliberately: file doesn't exist yet — fall through to write it.
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn(`[resolver-node] Failed to probe write-once spec ${path}: ${err}`)
    }
    /* v8 ignore stop */
  }
  await atomicWriteFile(path, content)
}

export async function resolveParentChainNode(
  rootDir: string,
  parentUrl: string,
  parentName: string,
  options: ResolverOptionsWithFreshness = {},
): Promise<ResolvedCache> {
  const maxDepth = options.maxDepth ?? MAX_DEPTH_DEFAULT
  const timeout = options.timeout ?? 10000
  const specsDir = join(rootDir, 'specs')
  // Effective cache dir: `inPlace` restores pure legacy behavior (the temp
  // cache is neither read nor written — every `cacheDir !== specsDir` guard
  // below goes quiet); otherwise the OS temp cache (or an explicit
  // `cacheDir`) takes all fetch-and-save writes while reads still prefer the
  // workspace tree (vendored specs win over cached fetches).
  const cacheDir = options.inPlace === true ? specsDir : (options.cacheDir ?? defaultCacheDir())
  const writeDir = cacheDir
  const blueprintsBaseDir = join(cacheDir, 'bluepriNNts')
  const specs = new Map<string, SpecDocument>()
  const chain: string[] = []
  const freshness = new Map<string, FreshnessResult>()

  let currentUrl: string | undefined = parentUrl
  let currentName: string | undefined = parentName
  let depth = 0

  await mkdir(writeDir, { recursive: true })

  while (currentUrl && currentName && depth < maxDepth) {
    let content: string | null = null
    let resolvedFromLocalTier = false
    const attempted: string[] = []

    // 0. If currentUrl is a local file path or file:// URI, read directly via readFile
    const localPath = isLocalPath(currentUrl) ? toLocalFilePath(currentUrl, rootDir) : null
    if (localPath) {
      attempted.push(`local path "${localPath}"`)
      try {
        content = await readFile(localPath, 'utf-8')
        const specName = canonicalSpecFilename(currentName, content)
        await saveSpecOnce(writeDir, `${specName}_NN.md`, content).catch(() => {})
      } catch (err) {
        /* v8 ignore start */
        // log + continue: this tier missed — fall through to the next tier.
        console.warn(`[resolver-node] Local tier missed for ${currentName}: ${err}`)
        content = null
        /* v8 ignore stop */
      }
    }

    // 1. 4-tier blueprint package resolution (workspace package -> workspace flat -> global -> skill)
    if (content === null && !isLocalPath(currentUrl)) {
      attempted.push(`4-tier package resolver for "${currentName}" in "${specsDir}"`)
      const pkg = await resolveTemplatePackage(rootDir, currentName, undefined, options)
      if (pkg) {
        content = await readFile(pkg.specFilePath, 'utf-8')
        resolvedFromLocalTier = true
      }
    }

    // 1b. OS temp cache reuse: a previous default run already fetched this spec.
    if (content === null && cacheDir !== specsDir && !isLocalPath(currentUrl)) {
      attempted.push(`temp cache dir "${cacheDir}"`)
      const hit = await findLocalSpec(cacheDir, currentName)
      if (hit) {
        content = await readFile(hit, 'utf-8').catch(() => null)
      }
    }

    // 2. Download from network and hydrate into specs/bluepriNNts/<name>/<version>/
    if (content === null && /^https?:\/\//i.test(currentUrl)) {
      attempted.push(`network url "${currentUrl}"`)
      try {
        content = await download(currentUrl, timeout)
        const fmVer = versionFromFrontmatter(content) || '0.1.0'
        const baseName = parseSpecName(currentName).base
        // Best-effort: pull the full package (procedures/samples/assets) from the
        // tag-pinned release so agents have execution context offline. Falls
        // back to spec-only hydration if the tag/API is unreachable.
        let payload: string | TemplatePackagePayload = content
        const tagMatch = currentUrl.match(/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/([^/]+)\//)
        if (tagMatch && /^blueprints-v\d+\.\d+\.\d+$/.test(tagMatch[2])) {
          payload = await fetchTemplatePackageFromRemote(baseName, fmVer, {
            repo: tagMatch[1],
            ref: tagMatch[2],
            timeout,
          }).catch(() => content as string)
        }
        await hydrateTemplatePackageAtomically(rootDir, baseName, fmVer, payload, {
          baseDir: blueprintsBaseDir,
        })
        const specName = canonicalSpecFilename(currentName, content)
        await saveSpecOnce(writeDir, `${specName}_NN.md`, content)
      } catch (err) {
        /* v8 ignore start */
        // log + continue: network/hydration tier missed — report unresolved.
        console.warn(`[resolver-node] Network tier missed for ${currentName}: ${err}`)
        content = null
        /* v8 ignore stop */
      }
    }

    // 3. Built-in Canonical Fallback Registry (Tier 4 / Offline fallback)
    if (content === null && !isLocalPath(currentUrl)) {
      const isRemote = /^https?:\/\//i.test(currentUrl)
      const isCanonicalRemote =
        isRemote && /raw\.githubusercontent\.com\/cogNNitive\/cogNNitive\//i.test(currentUrl)
      if (!isRemote || isCanonicalRemote) {
        attempted.push(`canonical fallback registry for "${currentName}"`)
        const canonical =
          findCanonicalTemplate(currentName) ||
          (currentUrl ? findCanonicalTemplate(currentUrl) : null)
        if (canonical) {
          content = canonical.specContent
          resolvedFromLocalTier = true
        }
      }
    }

    if (content === null) {
      throw new SpecResolutionError(
        `Failed to resolve parent "${currentName}" from "${currentUrl}". Attempted: ${attempted.join('; ')}`,
        currentUrl,
      )
    }

    // Every resolved source is held to the same standard: unparseable
    // content is always a hard error, never silently treated as a valid
    // empty-parent leaf.
    const fm = parseFrontmatter(content)
    if (fm === null) {
      throw new SpecResolutionError(
        `Unparseable frontmatter in resolved spec "${currentName}" (${attempted[attempted.length - 1]})`,
        currentUrl,
      )
    }
    const doc: SpecDocument = {
      name: currentName,
      level: fm.level ?? 0,
      parentName: fm.parent_spec?.name,
      parentUrl: fm.parent_spec?.url,
      frontmatter: fm,
      rawContent: content,
    }
    specs.set(currentName, doc)
    chain.push(currentName)

    // Opt-in freshness: compare the requested template (depth 0) that came
    // from a LOCAL tier against its canonical remote. Chain parents are never
    // checked; network-resolved and local-path docs are not compared.
    if (
      options.checkFreshness === true &&
      depth === 0 &&
      resolvedFromLocalTier &&
      /^https?:\/\//i.test(currentUrl)
    ) {
      freshness.set(currentName, {
        name: currentName,
        url: currentUrl,
        verdict: await freshnessVerdict(currentUrl, content, timeout),
      })
    }

    currentName = doc.parentName
    currentUrl = doc.parentUrl
    depth++
  }

  if (depth >= maxDepth && currentUrl) {
    throw new Error(`Circular parent chain detected at depth ${maxDepth}`)
  }

  // Additive composition: pull in every template named by a resolved level-2
  // template's `includes` list (recursively), so `resolveTemplateSchema` in
  // innfo-core can compose their schemas offline. Best-effort — an
  // unresolvable include is left out and surfaces later as a validation error.
  await resolveIncludesInto(specs, specsDir, timeout, undefined, cacheDir)

  const result: ResolvedCache = { specs, chain }
  if (options.checkFreshness === true) result.freshness = freshness
  return result
}

/** Resolve one spec's raw content: local specs dir first, temp cache second, 4-tier package resolver third, then network. */
export async function fetchSpecContent(
  name: string,
  url: string | undefined,
  specsDir: string,
  timeout: number,
  cacheDir?: string,
): Promise<string | null> {
  const localPath =
    url && isLocalPath(url)
      ? toLocalFilePath(url, specsDir.replace(/[/\\]specs[/\\]?$/, ''))
      : null
  if (localPath) {
    const direct = await readFile(localPath, 'utf-8').catch(() => null)
    if (direct !== null) return direct
  }
  const local = await findLocalSpec(specsDir, name)
  if (local) return readFile(local, 'utf-8').catch(() => null)
  if (cacheDir && cacheDir !== specsDir) {
    const hit = await findLocalSpec(cacheDir, name)
    if (hit) return readFile(hit, 'utf-8').catch(() => null)
  }
  const rootDir = specsDir.replace(/[/\\]specs[/\\]?$/, '')
  const pkg = await resolveTemplatePackage(rootDir, name).catch(() => null)
  if (pkg) return readFile(pkg.specFilePath, 'utf-8').catch(() => null)
  if (url && /^https?:\/\//i.test(url)) {
    try {
      const content = await download(url, timeout)
      await saveSpecOnce(
        cacheDir ?? specsDir,
        `${canonicalSpecFilename(name, content)}_NN.md`,
        content,
      ).catch(() => {})
      return content
    } catch (err) {
      /* v8 ignore start */
      // log + continue: network resolution failed — report unresolved.
      console.warn(`[resolver-node] Network fetch failed for ${name}: ${err}`)
      /* v8 ignore stop */
    }
  }
  const isRemote = url && /^https?:\/\//i.test(url)
  const isCanonicalRemote =
    isRemote && /raw\.githubusercontent\.com\/cogNNitive\/cogNNitive\//i.test(url)
  if (!isRemote || isCanonicalRemote) {
    const canonical = findCanonicalTemplate(name) || (url ? findCanonicalTemplate(url) : null)
    if (canonical) return canonical.specContent
  }
  return null
}

/**
 * Resolve a set of `includes` refs (recursively following nested `includes`)
 * into a `name → raw content` map, for building an innfo-core `IncludeResolver`.
 * `specsBaseDir` is the repo root; templates are looked up under its `specs/`.
 * Keys are stored in both original name and lowercase name for case-insensitive lookup (Fix W-01).
 */
export async function buildIncludeContentMap(
  specsBaseDir: string,
  refs: Array<{ name: string; url: string }>,
  timeout = 10000,
  cacheDir?: string,
): Promise<Map<string, string>> {
  const specsDir = join(specsBaseDir, 'specs')
  const out = new Map<string, string>()
  const seen = new Set<string>()
  const queue = [...refs]
  while (queue.length > 0) {
    const ref = queue.shift()!
    const key = ref.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    const content = await fetchSpecContent(
      ref.name,
      ref.url || undefined,
      specsDir,
      timeout,
      cacheDir,
    )
    if (content === null) continue
    out.set(ref.name, content)
    out.set(key, content)
    const fm = parseFrontmatter(content)
    for (const nested of fm?.includes ?? []) queue.push(nested)
  }
  return out
}

/**
 * Walk every resolved level-2 template's `includes` and add the referenced
 * templates to `specs` (keyed by include name), recursively. Mutates `specs`.
 */
export async function resolveIncludesInto(
  specs: Map<string, SpecDocument>,
  specsDir: string,
  timeout: number,
  seen: Set<string> = new Set(),
  cacheDir?: string,
): Promise<void> {
  const queue: SpecDocument[] = [...specs.values()]
  while (queue.length > 0) {
    const doc = queue.shift()!
    const includes = doc.frontmatter?.includes ?? []
    for (const ref of includes) {
      const key = ref.name.toLowerCase()
      if (seen.has(key) || specs.has(ref.name)) continue
      seen.add(key)
      const content = await fetchSpecContent(
        ref.name,
        ref.url || undefined,
        specsDir,
        timeout,
        cacheDir,
      )
      if (content === null) continue
      const fm = parseFrontmatter(content)
      if (fm === null) continue
      const included: SpecDocument = {
        name: ref.name,
        level: fm.level ?? 2,
        parentName: fm.parent_spec?.name,
        parentUrl: fm.parent_spec?.url,
        frontmatter: fm,
        rawContent: content,
      }
      specs.set(ref.name, included)
      queue.push(included)
    }
  }
}
