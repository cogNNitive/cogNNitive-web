/**
 * Base URL for the demo sample models shown on the home page / setup wizard.
 *
 * - In dev, the vite dev server serves the repo's `specs` directory at
 *   `/specs` (see vite.config.ts `serveLocalSpecs`), so samples and
 *   templates reflect the CURRENT working tree.
 * - In production builds, samples are fetched from the published GitHub
 *   `main` branch.
 *
 * Callers build `${SAMPLE_BASE}/{templateName}/samples/{file}`, matching the
 * `specs/templates/{name}/samples/` layout (see `spec-versioning`, R-SV-01).
 */
export const REMOTE_SPEC_BASE = 'https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs'
const REMOTE_SAMPLE_BASE = `${REMOTE_SPEC_BASE}/templates`

export const SAMPLE_BASE: string = import.meta.env.DEV ? '/specs/templates' : REMOTE_SAMPLE_BASE

/**
 * Bundled fallback of each shipped L2 template's newest known
 * `template_version`, keyed by template slug (e.g. "business").
 *
 * Used by `useTemplateVersionNotice` (spec-versioning D3) as one half of the
 * union that decides whether a model's pinned template is stale — the other
 * half is a live scan of the connected workspace's local search dirs
 * (`specs/`, `.specs/`, `.spec-cache/`, see design.md A1). This map exists so
 * the badge can still fire for a workspace that has never locally cached a
 * newer template file (e.g. right after this app itself ships a bump).
 */
// GENERATED — DO NOT EDIT. Source: iNNfo/specs/templates/*/spec_NN.md and
// iNNfo/specs/templates/workspace_spec_NN.md.
// Regenerate with `npm run sync:versions` (scripts/sync-versions.mjs).
export const SHIPPED_TEMPLATE_VERSIONS: Record<string, string> = {
  analysis: 'V_0-2-1',
  artifacts: 'V_0-1-0',
  base: 'V_0-1-0',
  blank: 'V_0-2-0',
  business: 'V_0-2-5',
  'business-model': 'V_0-2-3',
  cogNNitive: 'V_0-2-0',
  'design-presets': 'V_0-1-0',
  documentation: 'V_0-2-1',
  innovation: 'V_0-2-1',
  metrics: 'V_0-2-1',
  organization: 'V_0-2-2',
  procedures: 'V_0-2-2',
  projects: 'V_0-2-2',
  repository: 'V_0-1-1',
  sources: 'V_0-1-0',
  video: 'V_0-3-2',
}
