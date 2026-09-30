import { isIgnoredPath } from '../recursiveParser/workspace.js'
import { normalizePathKey, basename } from '../recursiveParser/paths.js'

/**
 * A file candidate for manifest reconciliation, described by its
 * workspace-relative path and parsed frontmatter (no body content needed).
 */
export interface CandidateFile {
  path: string
  frontmatter: Record<string, unknown>
}

/** `<name>_NN.md` (case-insensitive), the iNNfo model filename convention. */
export const NN_FILENAME_RE = /_NN\.md$/i

/** Reads `frontmatter.parent_spec.name`, tolerating a bare-string `parent_spec`. */
function parentSpecName(frontmatter: Record<string, unknown>): string | undefined {
  const parentSpec = frontmatter['parent_spec']
  if (!parentSpec) return undefined
  if (typeof parentSpec === 'string') return parentSpec
  if (typeof parentSpec === 'object') {
    const name = (parentSpec as { name?: unknown }).name
    return typeof name === 'string' ? name : undefined
  }
  return undefined
}

/**
 * Parent-spec names whose Level-3 documents must never surface as `## NN Models`
 * reconciliation candidates (any version, any suffix):
 *
 * - `cogNNitive` / `workspace` — workspace-conforming lineage records
 *   (non-navigation records; see openspec `lineage-version-status`).
 * - `procedures` / `sources` / `artifacts` — catalog apps that own their own
 *   workspace-manifest section (`# NN Procedures` / `# NN Sources` /
 *   `# NN Artifacts`). Their catalogs (e.g. `procedures/procedures_NN.md`) are
 *   already indexed by that section; adding them under `## NN Models` duplicate
 *   the same file in two sections.
 */
const NON_KNOWLEDGE_SPEC_RE = /^(cognnitive|workspace|procedures|sources|artifacts)(_|$)/i

function isNonModelSpec(name: string | undefined): boolean {
  return typeof name === 'string' && NON_KNOWLEDGE_SPEC_RE.test(name.trim())
}

/**
 * Structural predicate for "is this file an iNNfo model at all": a
 * level-3 document with a resolvable `parent_spec`, named `*_NN.md`, and not
 * sitting inside an ignored directory (`backups/`, `archive/`, `specs/`).
 *
 * This is the ONE shared discoverability rule for `collectModels()`
 * (`list_models`) and `isReconcilableModel()` (manifest reconciliation).
 * Manifest-specific exclusions (self-reference, non-model spec apps such as
 * lineage records and the procedures/sources/artifacts catalogs) do NOT belong
 * here — they are meaningless without a manifest and would incorrectly hide
 * legitimate workspace documents from `list_models` (see H6 design notes).
 */
export function isDiscoverableModel(file: CandidateFile): boolean {
  const { path, frontmatter } = file

  if (frontmatter['level'] !== 3) return false
  if (!frontmatter['parent_spec']) return false
  if (!NN_FILENAME_RE.test(basename(path))) return false
  if (isIgnoredPath(path)) return false

  return true
}

/**
 * Discovery predicate for candidate Level-3 model files eligible to become
 * (or remain) `## NN Models` entries in the workspace manifest.
 *
 * Host-agnostic: callers supply their own file enumeration (editor:
 * `DirectoryHandleLike` walk; MCP: Node `fs`) and frontmatter parse, then
 * filter candidates through this single shared predicate — one tested
 * implementation, not one per host.
 */
export function isReconcilableModel(file: CandidateFile, manifestPath: string): boolean {
  const { path, frontmatter } = file

  if (!isDiscoverableModel(file)) return false
  if (normalizePathKey(path) === normalizePathKey(manifestPath)) return false
  if (isNonModelSpec(parentSpecName(frontmatter))) return false

  return true
}
