/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
/**
 * Handles property normalization and business logic from the canonical spec.
 * Strict mode: no aliases. Every property key must match V_0-3-0 exactly.
 * Unknown keys are caught by UnknownPropertyRule at validation time.
 */
const slugify = (value: any) => String(value).toLowerCase().trim().replace(/[\s-]/g, '_')

/**
 * Value normalizers keyed by canonical V_0-3-0 property names.
 * These enforce ranges and formats on parsed values.
 */
export const VALUE_NORMALIZERS: Record<string, (value: any) => any> = {
  scene_duration_mode: slugify,
  scene_voice_emotion: slugify,
  layer_type: (value: any) => {
    const slug = slugify(value)
    if (slug === 'text') return 'text_static'
    return slug
  },
  layer_active: (value: any) => {
    if (typeof value === 'boolean') return value
    if (value === 'true' || value === '1') return true
    if (value === 'false' || value === '0') return false
    return true
  },

  scene_voice_volume: (value: any) => {
    const n = parseFloat(value)
    return isNaN(n) ? 1.0 : Math.max(0, Math.min(2.0, n))
  },
  scene_voice_speed: (value: any) => {
    const n = parseFloat(value)
    return isNaN(n) ? 1.0 : Math.max(0.5, Math.min(2.0, n))
  },
  scene_background_audio_volume: (value: any) => {
    const n = parseFloat(value)
    return isNaN(n) ? 0.2 : Math.max(0, Math.min(1.0, n))
  },
  scene_tts_model: (value: any) => {
    return String(value).trim()
  },

  scene_templates: (value: any) => {
    if (Array.isArray(value)) return value
    if (!value) return []
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        return trimmed
          .substring(1, trimmed.length - 1)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      }
      return [trimmed]
    }
    return [String(value)]
  },
  video_sources: (value: any) => {
    let parsed: any = {}
    if (typeof value === 'object' && value !== null) {
      parsed = value
    } else if (typeof value === 'string') {
      try {
        parsed = JSON.parse(value.trim())
      } catch (e) {
        parsed = parseSimpleYaml(value)
      }
    }

    if (parsed && typeof parsed === 'object') {
      const finalSources: Record<string, any> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (v && typeof v === 'object') {
          finalSources[k] = {
            citekey: k,
            ...v,
          }
        }
      }
      return finalSources
    }
    return {}
  },

  scene_sources: (value: any) => {
    if (Array.isArray(value)) return value
    if (!value) return []
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          return JSON.parse(trimmed)
        } catch (e) {
          return trimmed
            .substring(1, trimmed.length - 1)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        }
      }
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    }
    return [String(value)]
  },
}

/**
 * Normalizes a property key to canonical V_0-3-0 form (trim + lowercase only).
 * No aliases or prefix stripping — unrecognized keys are reported as errors by UnknownPropertyRule.
 */
export const normalizePropertyKey = (key: string): string => {
  let k = key.trim().toLowerCase()

  // Support hidden syntax: (key)
  if (k.startsWith('(') && k.endsWith(')')) {
    k = k.substring(1, k.length - 1).trim()
  }

  // Canonical mappings
  if (k === 'anydeo_specification' || k === 'anydeo-specification')
    return 'video_anydeo_specification'
  if (k === 'scene_effect') return 'scene_effects'
  if (k === 'layer_audio_volume') return 'layer_volume'
  if (k === 'scene_citations') return 'scene_sources'
  if (k === 'video_citations' || k === 'bibliography') return 'video_sources'

  return k
}

/**
 * Normalizes a property value using specialized normalizers.
 */
export const normalizePropertyValue = (key: string, value: any) => {
  const normalizer = (VALUE_NORMALIZERS as any)[key]
  return normalizer ? normalizer(value) : value
}

function parseSimpleYaml(yamlStr: string): Record<string, any> {
  const lines = yamlStr.split('\n')

  // Find the minimum indentation of all non-empty lines
  let minIndent = Infinity
  for (const line of lines) {
    if (line.trim().length === 0 || line.trim().startsWith('#')) continue
    const indent = line.length - line.trimStart().length
    if (indent < minIndent) {
      minIndent = indent
    }
  }

  // Dedent lines by minIndent if minIndent is finite
  const dedentedLines =
    minIndent !== Infinity && minIndent > 0
      ? lines.map((line) => {
          if (line.trim().length === 0) return ''
          const indent = line.length - line.trimStart().length
          return line.substring(Math.min(indent, minIndent))
        })
      : lines

  const result: Record<string, any> = {}
  let currentKey: string | null = null
  let currentObject: Record<string, any> | null = null

  for (const line of dedentedLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const indent = line.length - line.trimStart().length
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.substring(0, colonIdx).trim()
    let val = trimmed.substring(colonIdx + 1).trim()

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1).trim()
    }

    if (indent === 0) {
      if (val) {
        if (val.startsWith('[') && val.endsWith(']')) {
          try {
            result[key] = JSON.parse(val)
          } catch {
            result[key] = val
              .substring(1, val.length - 1)
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          }
        } else {
          result[key] = val
        }
        currentObject = null
        currentKey = null
      } else {
        currentKey = key
        currentObject = {}
        result[key] = currentObject
      }
    } else {
      if (currentObject) {
        if (val.startsWith('[') && val.endsWith(']')) {
          try {
            currentObject[key] = JSON.parse(val)
          } catch {
            currentObject[key] = val
              .substring(1, val.length - 1)
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          }
        } else {
          currentObject[key] = val
        }
      }
    }
  }
  return result
}
