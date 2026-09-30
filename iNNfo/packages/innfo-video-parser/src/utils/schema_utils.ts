/**
 * @spec-source:V_0-3-3 | role: quality_check
 */

import rules from '../rules/index.js'

export interface DefaultValues {
  [key: string]: any
}

/**
 * Extracts default values from the master rules based on the provided scope.
 * @param scope 'video' | 'section' | 'template' | 'scene' | 'layer'
 * @returns An object with keys and their default values.
 */
export const getDefaultsFromSchema = (scope: string): DefaultValues => {
  const defaults: DefaultValues = {}
  const properties = rules.properties as any

  for (const key in properties) {
    const property = properties[key]
    const scopes = property.scopes || (property.scope ? [property.scope] : [])
    if (scopes.includes(scope)) {
      if ('default' in property) {
        defaults[key] = property.default
      }
    }
  }

  return defaults
}

/**
 * Gets the list of available categories from the schema.
 */
export const getCategories = () => {
  return rules.system.categories
}

/**
 * Gets metadata for a specific property including its category and label.
 */
export const getPropertyMetadata = (key: string) => {
  const properties = rules.properties as any
  const prop = properties[key]

  return prop
}

/**
 * Gets the ordered list of property keys from the schema.
 */
export const getPropertyOrder = (): string[] => {
  const properties = rules.properties as any
  return Object.keys(properties)
}
