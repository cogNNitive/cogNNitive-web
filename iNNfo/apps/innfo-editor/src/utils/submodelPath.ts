/**
 * Utility functions for submodel path derivation and slugification.
 */

export interface SuggestedSubmodelPathOptions {
  /** Relative or absolute source path of the parent model root (e.g., "models/Company_V_0-1-0_NN.md") */
  parentPath: string
  /** Concept slug or raw name (e.g., "projects" or "Projects") */
  conceptSlug?: string
  /** Element slug or raw name (e.g., "alpha" or "Alpha") */
  elementSlug?: string
  /** Field name/key declaring the submodel (e.g., "business_model") */
  fieldName?: string
  /** Target template constraint from field definition (e.g., "business") */
  targetBlueprint?: string
}

/**
 * Normalizes an arbitrary string into a URL- and filesystem-safe slug.
 */
export function slugify(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Determines leaf stem for the generated submodel filename.
 */
function templateLeafStem(targetBlueprint?: string, fieldName?: string): string {
  const raw = targetBlueprint && targetBlueprint !== 'base' ? targetBlueprint : fieldName
  if (!raw) return 'submodel'
  // Strip any embedded version suffix (e.g. "business_V_0-2-0" -> "business")
  // so the generated filename follows the iNNfo <Name>_V_x-y-z_<Template>_NN.md
  // convention instead of embedding the template version as part of the name.
  return slugify(raw.replace(/_V_\d+-\d+-\d+$/i, '')) || 'submodel'
}

/**
 * Derives a normalized, collision-resistant suggested path for an inline submodel.
 */
export function deriveSuggestedSubmodelPath(options: SuggestedSubmodelPathOptions): string {
  const { parentPath, conceptSlug, elementSlug, fieldName, targetBlueprint } = options

  const normalizedParentPath = (parentPath || '').replace(/\\/g, '/')
  const dir = normalizedParentPath.includes('/')
    ? normalizedParentPath.substring(0, normalizedParentPath.lastIndexOf('/') + 1)
    : ''
  const filename = normalizedParentPath.split('/').pop() || 'model_NN.md'

  // Versioned stem resolution
  let parentStem = filename.replace(/\.md$/i, '')
  const versionedBlueprintMatch = parentStem.match(/^(.*_V[_-][0-9.-]+)_[a-zA-Z0-9-]+(_NN)?$/i)
  if (versionedBlueprintMatch) {
    parentStem = versionedBlueprintMatch[1]
  } else {
    parentStem = parentStem.replace(/_NN$/i, '')
  }

  // Determine leaf stem
  const leafStem = templateLeafStem(targetBlueprint, fieldName)

  // Clean concept & element slugs
  const cSlug = conceptSlug ? slugify(conceptSlug) : ''
  const eSlug = elementSlug ? slugify(elementSlug) : ''

  // Hierarchical case: concept and element context present
  if (cSlug && eSlug) {
    return `${dir}${parentStem}/${cSlug}/${eSlug}/${leafStem}_01.md`
  }

  // Partial hierarchy: element context only
  if (eSlug) {
    return `${dir}${parentStem}/${eSlug}/${leafStem}_01.md`
  }

  // Fallback case: top-level or concept-less field
  return `${dir}${parentStem}_${leafStem}_01.md`
}