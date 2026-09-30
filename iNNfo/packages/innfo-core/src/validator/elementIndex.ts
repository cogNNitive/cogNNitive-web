import type { ParsedKnowledge } from '../types/index.js'

/**
 * Element fields treated as implicit references even when the template
 * doesn't declare them as `type: reference` (iNNfo convention).
 */
export const IMPLICIT_REF_FIELDS = new Set(['location', 'room', 'component', 'parent_component'])

/** Map from lowercased element name -> set of concept names containing it. */
export function conceptsByElementName(model: ParsedKnowledge): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const [conceptName, elements] of model.elements.entries()) {
    for (const el of elements) {
      const key = el.name.toLowerCase()
      const set = map.get(key) ?? new Set<string>()
      set.add(conceptName)
      map.set(key, set)
    }
  }
  return map
}
