import type { SpecDocument, ValidationCheck, ValidationError, ValidationReport } from '../types/index.js'
import type { IncludeResolver } from '../schema/index.js'
import { parseKnowledge } from '../parser/index.js'
import { hasBom } from '../parser/markdown.js'
import { Diagnostics } from '../diagnostics.js'
import { validateFormatContent } from './content.js'
import { validateKnowledge } from './knowledge.js'
import type { SubmodelResolver } from './references.js'

/**
 * Map one hygiene check to a flat diagnostic. Passed checks (any severity)
 * produce no diagnostic; failed checks keep their severity — including
 * `info`, which is reported but never affects validity — plus any stable
 * code, fix hint, and metadata the check carries.
 */
export function formatCheckToDiagnostic(check: ValidationCheck): ValidationError | null {
  if (check.passed) return null
  return {
    path: `format.${check.id}`,
    message: check.message ?? check.label,
    severity: check.severity,
    code: check.code,
    promptHint: check.promptHint,
    meta: check.meta,
  }
}

export interface DocumentValidation {
  /** Document hygiene: frontmatter keys, body structure, naming conventions. */
  format: ValidationReport
  /** Schema conformance against the resolved template. Null when no template
   *  was supplied or the document is not a level-2/3 document. */
  schema: { valid: boolean; errors: ValidationError[]; warnings: ValidationError[] } | null
  /** Flat merged view over both passes. */
  errors: ValidationError[]
  warnings: ValidationError[]
  valid: boolean
}

/**
 * The single validation entry point for an iNNfo document. Runs BOTH the
 * document-hygiene linter (`validateFormatContent`) and, for level-2/3
 * documents with a resolved template, the schema-conformance validator
 * (`validateKnowledge`), then merges the results.
 *
 * Both the MCP (`validate_model`) and the editor call this so a document is
 * held to one set of rules everywhere. Previously the MCP ran only the schema
 * pass and the editor only the hygiene pass, so each surfaced problems the
 * other missed.
 */
export function validateDocument(
  content: string,
  opts: {
    fileName: string
    template?: SpecDocument | null
    formatSpec?: SpecDocument | null
    expectedSpecVersion?: string
    resolveInclude?: IncludeResolver
    resolveSubmodel?: SubmodelResolver
    referringPath?: string
  },
): DocumentValidation {
  const format = validateFormatContent(content, opts.fileName, opts.expectedSpecVersion)

  const d = new Diagnostics()

  // BOM tolerance (model-scaffold-robustness): the parser strips a leading
  // BOM before matching frontmatter, so parsing succeeds; surface a
  // non-blocking `info` notice so encoding rot stays visible. Never an error.
  if (hasBom(content)) {
    d.info('format.bom', 'File starts with a byte-order mark; stripped before parsing.', {
      code: 'BOM_WARNING',
      promptHint: 'Save the file as UTF-8 without BOM.',
      meta: { stripped: true },
    })
  }

  for (const check of format.checks) {
    const diag = formatCheckToDiagnostic(check)
    if (diag) d.add(diag)
  }

  let schema: DocumentValidation['schema'] = null
  const parsed = parseKnowledge(content)
  const level = parsed.frontmatter?.level
  if ((level === 2 || level === 3) && (opts.template !== undefined || opts.formatSpec !== undefined)) {
    const result = validateKnowledge(
      parsed,
      opts.template ?? null,
      opts.formatSpec ?? null,
      {
        resolveInclude: opts.resolveInclude,
        resolveSubmodel: opts.resolveSubmodel,
        referringPath: opts.referringPath ?? opts.fileName,
      },
    )
    schema = result
    d.errors.push(...result.errors)
    d.warnings.push(...result.warnings)
  }

  return { format, schema, errors: d.errors, warnings: d.warnings, valid: d.valid }
}
