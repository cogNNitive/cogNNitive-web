/**
 * Shared synthetic "decomposed templates" fixture for core tests.
 *
 * The canonical `business` Level-2 template is a composition shell: it
 * `includes` five decomposed templates (`business-model`, `analysis`,
 * `organization`, `projects`, `metrics`) and contributes no schema of its own.
 * Any test that validates against, or resolves, `business` must resolve those
 * `includes` identically. This fixture is the single source of truth — to add
 * or rename a decomposed template, edit it here once, not in N test files
 * (the failure mode this replaces: "N maps, N-1 updated").
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const specsRoot = join(import.meta.dirname!, '..', '..', '..', '..', 'specs')

/** Read a spec file relative to the iNNfo specs root (e.g. `templates/business/spec_NN.md`). */
export function readSpec(relPath: string): string {
  return readFileSync(join(specsRoot, relPath), 'utf-8')
}

/** The five decomposed templates `business` composes, mapped to their spec paths. */
const DECOMPOSED_TEMPLATE_FILES = {
  'business-model': 'bluepriNNts/business-model/spec_NN.md',
  analysis: 'bluepriNNts/analysis/spec_NN.md',
  organization: 'bluepriNNts/organization/spec_NN.md',
  projects: 'bluepriNNts/projects/spec_NN.md',
  metrics: 'bluepriNNts/metrics/spec_NN.md',
} as const

/** Sorted names of the decomposed templates (the `business.includes` expectation). */
export function decomposedTemplateNames(): string[] {
  return Object.keys(DECOMPOSED_TEMPLATE_FILES).sort()
}

/** Name → raw spec content for the decomposed templates. */
export function decomposedTemplates(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, rel] of Object.entries(DECOMPOSED_TEMPLATE_FILES)) {
    out[name] = readSpec(rel)
  }
  return out
}

/**
 * Resolve an `includes` entry by (lowercased) name from the decomposed
 * templates on disk — the resolver `business` composition/validation needs.
 */
export function decomposedResolver(): (ref: { name: string }) => string | null {
  const byName = decomposedTemplates()
  return (ref) => byName[ref.name.toLowerCase()] ?? null
}
