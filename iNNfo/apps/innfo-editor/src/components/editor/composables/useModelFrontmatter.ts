import { computed, type ComputedRef, type Ref } from 'vue'
import { parseFrontmatter } from '@cognnitive/innfo-core'
import type { SpecFrontmatter } from '@cognnitive/innfo-core'
import {
  DEFAULT_INNFO_VERSION,
  DEFAULT_blueprint_name,
  DEFAULT_blueprint_version,
} from '../../../utils/constants'

/**
 * Coerces a YAML-parsed value into a display string, trimming whitespace.
 *
 * `parseFrontmatter` returns real YAML types (numbers/booleans for unquoted
 * scalars), unlike the old regex-based extraction which always produced raw
 * strings. Every caller downstream (e.g. `parseVersionString`, which calls
 * `.match()`) requires a string, so this adapter must run before any such
 * value reaches them.
 */
export function readString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

/** Reads a dotted path (e.g. "template.version") out of a parsed frontmatter object. */
function readNested(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

export function useModelFrontmatter(rawContent: Ref<string>): {
  frontmatter: ComputedRef<SpecFrontmatter | null>
  formatVersion: ComputedRef<string>
  templateName: ComputedRef<string>
  templateVersion: ComputedRef<string>
  modelVersion: ComputedRef<string>
  rawModelVersion: ComputedRef<string>
  lastSaved: ComputedRef<string>
} {
  const frontmatter = computed<SpecFrontmatter | null>(() => {
    if (!rawContent.value) return null
    return parseFrontmatter(rawContent.value)
  })

  const formatVersion = computed(() => {
    return readString(frontmatter.value?.spec_version) || DEFAULT_INNFO_VERSION
  })

  const templateName = computed(() => {
    const fm = frontmatter.value
    if (!fm) return DEFAULT_blueprint_name
    return (
      readString(readNested(fm, 'template.name')) ??
      readString(readNested(fm, 'parent_spec.name')) ??
      readString(readNested(fm, 'parent.name')) ??
      DEFAULT_blueprint_name
    )
  })

  const templateVersion = computed(() => {
    const fm = frontmatter.value
    if (!fm) return DEFAULT_blueprint_version

    const explicit = readString(readNested(fm, 'template.version'))
    if (explicit) return explicit

    // Derive the version from the template name (e.g. "business_V_0-2-0")
    const tplName =
      readString(readNested(fm, 'template.name')) ??
      readString(readNested(fm, 'parent_spec.name')) ??
      readString(readNested(fm, 'parent.name'))
    const derived = tplName?.match(/V_\d+-\d+-\d+/i)
    return derived ? derived[0] : DEFAULT_blueprint_version
  })

  const modelVersion = computed(() => {
    const fm = frontmatter.value
    return readString(fm?.knowledge_version) || readString(fm?.version) || '1.0.0'
  })

  const rawModelVersion = computed(() => {
    const fm = frontmatter.value
    return readString(fm?.knowledge_version) || readString(fm?.version) || 'V_1-0-0'
  })

  const lastSaved = computed(() => {
    const raw = readString(frontmatter.value?.last_saved)
    if (!raw) return 'Unknown'
    try {
      return new Date(raw).toLocaleString()
    } catch {
      return raw
    }
  })

  return {
    frontmatter,
    formatVersion,
    templateName,
    templateVersion,
    modelVersion,
    rawModelVersion,
    lastSaved,
  }
}
