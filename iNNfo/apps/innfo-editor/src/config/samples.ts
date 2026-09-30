/**
 * Base URL for the demo sample models shown on the home page / setup wizard.
 *
 * - In dev, the vite dev server serves the repo's `specs` directory at
 *   `/specs` (see vite.config.ts `serveLocalSpecs`), so samples and
 *   templates reflect the CURRENT working tree.
 * - In production builds, samples are fetched from the published GitHub
 *   `main` branch.
 *
 * Callers build `${SAMPLE_BASE}/{blueprintName}/samples/{file}`, matching the
 * `specs/bluepriNNts/{name}/samples/` layout (see `spec-versioning`, R-SV-01).
 */
export const REMOTE_SPEC_BASE = 'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs'
const REMOTE_SAMPLE_BASE = `${REMOTE_SPEC_BASE}/bluepriNNts`

export const SAMPLE_BASE: string = import.meta.env.DEV ? '/specs/bluepriNNts' : REMOTE_SAMPLE_BASE

/**
 * Bundled fallback of each shipped L2 blueprint's newest known
 * `blueprint_version`, keyed by blueprint slug (e.g. "business").
 *
 * Used by `useBlueprintVersionNotice` (spec-versioning D3) as one half of the
 * union that decides whether a model's pinned template is stale — the other
 * half is a live scan of the connected workspace's local search dirs
 * (`specs/`, `.specs/`, `.spec-cache/`, see design.md A1). This map exists so
 * the badge can still fire for a workspace that has never locally cached a
 * newer template file (e.g. right after this app itself ships a bump).
 */
// GENERATED — DO NOT EDIT. Source: iNNfo/specs/bluepriNNts/*/spec_NN.md and
// iNNfo/specs/bluepriNNts/domaiNN/spec_NN.md.
// Regenerate with `npm run sync:versions` (scripts/sync-versions.mjs).
// GENERATED — DO NOT EDIT. Source: iNNfo/specs/bluepriNNts/*/spec_NN.md and
// iNNfo/specs/bluepriNNts/workspace_spec_NN.md.
// Regenerate with `npm run sync:versions` (scripts/sync-versions.mjs).
export const SHIPPED_BLUEPRINT_VERSIONS: Record<string, string> = {
  analysis: 'V_0-3-0',
  artifacts: 'V_0-3-0',
  blank: 'V_0-3-0',
  business: 'V_0-3-0',
  'business-model': 'V_0-3-0',
  'design-presets': 'V_0-2-0',
  documentation: 'V_0-3-0',
  domaiNN: 'V_0-1-0',
  innovation: 'V_0-3-0',
  metrics: 'V_0-3-0',
  organization: 'V_0-3-0',
  procedures: 'V_0-3-0',
  projects: 'V_0-3-0',
  repository: 'V_0-2-0',
  sources: 'V_0-2-0',
  video: 'V_0-5-0',
}
