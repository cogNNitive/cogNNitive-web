import {
  ParsedKnowledge,
  SpecDocument,
  ValidationCheck,
  ValidationError,
  ValidationResult,
  ValidationSummary,
} from '../types/index.js'
import { resolveBlueprintSchema } from '../schema/index.js'
import type { IncludeResolver } from '../schema/index.js'
import { Diagnostics } from '../diagnostics.js'
import { validateReferences, validateElementFieldReferences } from './references.js'
import type { SubmodelResolver } from './references.js'
import { validateTaxonomyHierarchy } from './hierarchy.js'
import { computeSha256 } from './crypto.js'
import {
  checkFrontmatterInvariants,
  checkBlueprintDocumentation,
  checkElementGroups,
  checkSchemaConformance,
  checkMatrixCells,
  checkNodeMarkers,
} from './knowledge-checks.js'

export interface ValidateKnowledgeOptions {
  resolveInclude?: IncludeResolver
  resolveSubmodel?: SubmodelResolver
  referringPath?: string
  checkFreshness?: boolean
  remoteContent?: string | null
  canonicalUrl?: string
  fetchRemoteTemplate?: (url: string) => Promise<string | null> | string | null
  freshness?: {
    verdict: 'fresh' | 'stale' | 'unknown'
    url?: string
    name?: string
    localHash?: string
    remoteHash?: string
  } | null
}

/**
 * Map one warnings-bucket diagnostic to its report check. `info` severity is
 * preserved so informational notices stay distinguishable downstream; they
 * never affect validity because they live outside the errors bucket.
 */
export function reportCheckFromWarning(w: ValidationError, templateName?: string): ValidationCheck {
  return {
    id:
      w.code === 'TEMPLATE_CACHE_STALE'
        ? `template-freshness-${templateName ?? 'spec'}`
        : w.code || w.path || 'warning',
    label:
      w.code === 'TEMPLATE_CACHE_STALE'
        ? 'Template Cache Freshness'
        : w.path || 'Validation warning',
    description:
      w.code === 'TEMPLATE_CACHE_STALE'
        ? 'Verifies that local cached template in specs/ matches canonical remote upstream.'
        : w.message,
    category: (w.code === 'TEMPLATE_CACHE_STALE' ? 'governance' : 'convention') as
      'governance' | 'convention',
    severity: w.severity === 'info' ? 'info' : 'warning',
    passed: false,
    message: w.message,
    code: w.code,
    promptHint: w.promptHint,
    meta: w.meta,
  }
}

function buildReportMetadata(
  res: { valid: boolean; errors: any[]; warnings: any[] },
  templateName?: string,
): { checks: ValidationCheck[]; summary: ValidationSummary } {
  const checks: ValidationCheck[] = [
    ...res.errors.map((e) => ({
      id: e.code || e.path || 'error',
      label: e.path || 'Validation error',
      description: e.message,
      category: (e.code === 'TEMPLATE_CACHE_STALE' ? 'governance' : 'convention') as
        'governance' | 'convention',
      severity: 'error' as const,
      passed: false,
      message: e.message,
      code: e.code,
      promptHint: e.promptHint,
      meta: e.meta,
    })),
    ...res.warnings.map((w) => reportCheckFromWarning(w, templateName)),
  ]
  return {
    checks,
    summary: {
      total: checks.length,
      passed: 0,
      errors: res.errors.length,
      warnings: res.warnings.length,
    },
  }
}

/**
 * Validates model contents against its template specification (level 2/3).
 *
 * Orchestrates the individual checks in `knowledge-checks.ts`, routing every
 * diagnostic through a single `Diagnostics` accumulator. `resolveInclude`
 * returns the raw content of a template named in the resolved template's
 * `includes` list (supplied by the host — innfo-mcp / the editor — which owns
 * spec I/O); when omitted, `includes` composition is skipped.
 *
 * `_formatSpec` is retained for call-site compatibility and unused; the
 * `resolveIncludeOrOptions` position accepts either a bare `IncludeResolver`
 * (legacy) or a `ValidateKnowledgeOptions` object.
 */
export function validateKnowledge(
  model: ParsedKnowledge,
  template: SpecDocument | null,
  _formatSpec: SpecDocument | null,
  resolveIncludeOrOptions?: IncludeResolver | ValidateKnowledgeOptions,
  options?: ValidateKnowledgeOptions,
): ValidationResult {
  const opts: ValidateKnowledgeOptions =
    typeof resolveIncludeOrOptions === 'function'
      ? { resolveInclude: resolveIncludeOrOptions, ...options }
      : (resolveIncludeOrOptions ?? options ?? {})

  const d = new Diagnostics()

  checkFrontmatterInvariants(model, d)

  if (!template) {
    d.error(
      'parent',
      '[PARENT_RESOLUTION_FAILED] Parent specification template could not be resolved or loaded',
    )
    const res = d.result()
    const { checks, summary } = buildReportMetadata(res)
    return { ...res, checks, summary }
  }

  // Level-2 templates declare their schema as `… Definition` body elements;
  // when the template declares `includes`, the effective schema is the
  // additive union of every composed template plus its own definitions.
  const composed = resolveBlueprintSchema(template.rawContent, opts.resolveInclude)
  for (const diag of composed.errors) {
    d.add({ ...diag, path: `parent.${diag.path}` })
  }
  const {
    concepts: templateConcepts,
    markers: templateMarkers,
    matrices: templateMatrices,
  } = composed.schema

  checkBlueprintDocumentation(templateConcepts, template.rawContent || '', d)

  const knownConceptGroups = checkElementGroups(model, templateConcepts, d)
  checkSchemaConformance(knownConceptGroups, templateConcepts, d)

  checkMatrixCells(model, templateMatrices, d)
  checkNodeMarkers(model, templateConcepts, templateMarkers, d)

  // R-IE-04: reference-typed element fields must resolve to element names
  // model-wide, respecting each field's `target_concepts` when declared.
  d.addAll(
    validateElementFieldReferences(model, templateConcepts, {
      resolveSubmodel: opts.resolveSubmodel,
      referringPath: opts.referringPath,
    }),
  )

  // R-IE-04: matrix cell row/col labels. WARNING only (never blocking) — real
  // published fixtures use numbered/abbreviated label variants; field-level
  // references above are the hard errors. See hierarchy.ts / references.ts.
  for (const diag of validateReferences(model)) d.addAsWarning(diag)
  for (const diag of validateTaxonomyHierarchy(model, templateConcepts, composed.schema.taxonomy)) {
    d.addAsWarning(diag)
  }

  // Template freshness diagnostic (governance)
  if (opts.checkFreshness) {
    const parentRef = model.frontmatter?.parent_spec
    const canonicalUrl =
      opts.canonicalUrl ||
      (typeof parentRef === 'object' && parentRef ? parentRef.url : undefined) ||
      ''
    const templateName =
      (typeof parentRef === 'object' && parentRef ? parentRef.name : undefined) ||
      template.name ||
      'template'

    let isStale = false
    let localHash = ''
    let remoteHash = ''

    if (opts.freshness) {
      if (opts.freshness.verdict === 'stale') {
        isStale = true
        localHash = opts.freshness.localHash || ''
        remoteHash = opts.freshness.remoteHash || ''
      }
    } else if (opts.remoteContent !== undefined) {
      if (opts.remoteContent !== null) {
        localHash = computeSha256(template.rawContent || '')
        remoteHash = computeSha256(opts.remoteContent)
        if (localHash !== remoteHash) {
          isStale = true
        }
      }
    } else if (opts.fetchRemoteTemplate && canonicalUrl) {
      try {
        const fetched = opts.fetchRemoteTemplate(canonicalUrl)
        if (typeof fetched === 'string') {
          localHash = computeSha256(template.rawContent || '')
          remoteHash = computeSha256(fetched)
          if (localHash !== remoteHash) {
            isStale = true
          }
        }
      } catch (err) {
        /* v8 ignore start */
        // swallow deliberately: offline / unreachable network falls back
        // gracefully without failing validation (freshness is advisory).
        console.warn(`[validator] Remote template freshness check skipped: ${err}`)
        /* v8 ignore stop */
      }
    }

    if (isStale) {
      d.warn(
        'parent_spec',
        `Cached template specs/bluepriNNts/${templateName}_NN.md differs from canonical remote upstream.`,
        {
          code: 'TEMPLATE_CACHE_STALE',
          promptHint: `Update the template under specs/ with the canonical remote version "${canonicalUrl}" and re-validate the model.`,
          meta: {
            canonicalUrl,
            localHash,
            remoteHash,
            templateName,
          },
        },
      )
    }
  }

  const res = d.result()
  const { checks, summary } = buildReportMetadata(res, template.name)
  return { ...res, checks, summary }
}
