import { normalizePropertyKey, VALUE_NORMALIZERS } from '../config/propertyMappings.js'
export { normalizePropertyKey }

/**
 * Utility functions for property extraction, normalization, and prefix handling.
 * @spec-source:V_0-3-3 | role: syntax_orchestrator
 */
export function normalizeValue(value: any): any {
  if (typeof value !== 'string') return value
  let trimmed = value
  if (value.includes('\n')) {
    trimmed = value.replace(/^[\r\n]+|[\r\n\s]+$/g, '')
  } else {
    trimmed = value.trim()
  }
  if (trimmed === '' && value.length > 0) return value

  // Strip optional angle brackets (common for URLs/paths in Markdown)
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    trimmed = trimmed.substring(1, trimmed.length - 1).trim()
  }

  // Strip quotes
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.substring(1, trimmed.length - 1).trim()
  }

  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  // Strict numeric check
  if (
    trimmed !== '' &&
    !isNaN(Number(trimmed)) &&
    !trimmed.includes(' ') &&
    !trimmed.includes('\n')
  ) {
    const num = Number(trimmed)
    // Only return as number if it's not a ratio or a hex color or other special formats
    if (!trimmed.includes('x') && !trimmed.includes(':') && !trimmed.startsWith('#')) {
      return num
    }
  }

  // Handle Array notation [val1, val2, ...]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const content = trimmed.substring(1, trimmed.length - 1).trim()
    if (!content) return []
    return content.split(',').map((s) => normalizeValue(s.trim()))
  }

  return trimmed
}

/**
 * Parses a "key: value" or "key = value" pair
 * Supports hidden syntax: "(key): value"
 */
export function parsePropertyPair(
  pair: string,
): { key: string; value: any; isHidden?: boolean } | null {
  let workingLine = pair.trim()

  // STRICT: Must start with "- "
  if (!workingLine.startsWith('- ')) return null
  workingLine = workingLine.substring(2).trim()

  const colonIndex = workingLine.indexOf(':')
  if (colonIndex === -1) return null

  let rawKey = workingLine.substring(0, colonIndex).trim()
  let isHidden = false

  // Detect (key) for hidden/locked properties
  if (rawKey.startsWith('(') && rawKey.endsWith(')')) {
    isHidden = true
    rawKey = rawKey.substring(1, rawKey.length - 1).trim()
  }

  const key = normalizePropertyKey(rawKey)
  const rawValue = workingLine.substring(colonIndex + 1).trim()
  const value = normalizeValue(rawValue)

  return { key, value, isHidden }
}

/**
 * Parses inline properties like "(key1: val1, key2: val2)"
 * Returns both properties and their associated metadata (e.g. isHidden)
 */
export function extractInlineProperties(fields: string): {
  properties: Record<string, any>
  propertyMetadata: Record<string, any>
} {
  const properties: Record<string, any> = {}
  const propertyMetadata: Record<string, any> = {}
  if (!fields) return { properties, propertyMetadata }

  // Split by comma followed by optional space
  const fieldPairs = fields.split(/,\s*/)
  fieldPairs.forEach((pair) => {
    const result = parsePropertyPair(pair)
    if (result) {
      properties[result.key] = result.value
      if (result.isHidden) {
        if (!propertyMetadata[result.key]) propertyMetadata[result.key] = {}
        propertyMetadata[result.key].isHidden = true
      }
    }
  })

  return { properties, propertyMetadata }
}

/**
 * Extracts a media shortcut ![alt](url) from a line, returning the URL and the cleaned content.
 */
export function extractMediaShortcuts(content: string = ''): {
  media: string
  cleanContent: string
} {
  const REGEX_SHORTCUT_MEDIA = /!\[(.*?)\]\((.*?)\)/
  let media = ''
  let cleanContent = content

  const mediaMatch = content.match(REGEX_SHORTCUT_MEDIA)
  if (mediaMatch) {
    media = mediaMatch[2]
    cleanContent = content.replace(mediaMatch[0], '').trim()
  }

  return { media, cleanContent }
}

/**
 * Shared logic to determine if a layer or scene is AI-generated based on its properties.
 */
export function isAIAsset(props: Record<string, any>): boolean {
  if (!props) return false
  const aiTypes = ['ai_image', 'ai_video', 'talking_avatar']
  return aiTypes.includes(props.layer_type) || props.layer_asset_is_ai === true
}

/**
 * Normalizes properties using mappings and specialized normalizers
 */
export function processProperties(rawProps: Record<string, any>) {
  const processed: Record<string, any> = {}
  const normalizedRaw: Record<string, any> = {}

  // 1. Normalize all keys first to ensure we catch aliases and markdown_keys
  for (const [key, value] of Object.entries(rawProps)) {
    normalizedRaw[normalizePropertyKey(key)] = value
  }

  // 2. Process with value normalizers
  for (const [mappedKey, value] of Object.entries(normalizedRaw)) {
    let finalValue = value

    // Special mapping for templates (support space or comma separated lists)
    if (mappedKey === 'scene_templates' && typeof value === 'string') {
      finalValue = value
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    } else if ((VALUE_NORMALIZERS as any)[mappedKey]) {
      finalValue = (VALUE_NORMALIZERS as any)[mappedKey](value)
    }
    processed[mappedKey] = finalValue
  }
  return processed
}
