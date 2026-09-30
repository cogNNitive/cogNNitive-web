/**
 * Public schema surface, split into focused modules and re-exported as a
 * barrel so every existing `from './schema'` / `from '../schema'` import
 * keeps working:
 *   - `./schema/extract`     — root-primitive extraction (Concept/Field/Marker/Matrix Definitions)
 *   - `./schema/compose`     — additive template composition (`includes`)
 *   - `./schema/metaschema`  — level-1 metaschema self-description checks
 */
export {
  CONCEPT_DEFINITION,
  FIELD_DEFINITION,
  MARKER_DEFINITION,
  MATRIX_DEFINITION,
  extractBlueprintSchema,
  extractBlueprintSchemaFromContent,
} from './extract.js'
export type { BlueprintSchema } from './extract.js'

export { resolveBlueprintSchema, canonicalizeDefinition, applyAliasToSchema } from './compose.js'
export type { IncludeResolver, ResolvedBlueprintSchema } from './compose.js'

export { findDeclaredField } from './declaredField.js'

export {
  extractMetaschema,
  validateTemplateAgainstMetaschema,
  checkElementsAgainstSchema,
  checkWidgetConfig,
} from './metaschema.js'
export type { SchemaCheckOptions } from './metaschema.js'

export {
  CANONICAL_TEMPLATES,
  findCanonicalTemplate,
  getCanonicalSpecContent,
  listCanonicalTemplates,
} from './canonical-registry.js'
export type { CanonicalTemplate } from './canonical-registry.js'

