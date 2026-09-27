import type { TemplateSchema } from './extract.js'

/**
 * Looks up a field's declared type on the template schema, by concept and
 * field name (case-insensitive on both).
 *
 * Shared by `validator/workspaceSources.ts` (`isCitationField`) and
 * `recursiveParser/normalize.ts` (`attachSchemaTypedCitations`) /
 * `innfo-mcp`'s `resolve_sources` tool, so the declared-type resolution rule
 * lives in exactly one place instead of being duplicated or imported across
 * a private module boundary.
 */
export function findDeclaredField(
  schema: TemplateSchema | undefined,
  conceptType: string | undefined,
  fieldName: string,
): { name: string; type: string } | undefined {
  const concept = schema?.concepts.find(
    (c) => c.name.toLowerCase() === (conceptType ?? '').toLowerCase(),
  )
  const field = concept?.fields?.find((f) => f.name.toLowerCase() === fieldName.toLowerCase())
  if (!field) return undefined
  return { name: field.name, type: field.type }
}
