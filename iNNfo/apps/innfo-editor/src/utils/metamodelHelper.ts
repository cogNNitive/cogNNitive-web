import type { KnowledgeNode } from '../model/types'

export interface FieldDefinition {
  name: string
  type: string
  options?: string[]
  target_concepts?: string[]
  default?: unknown
}

export function getConceptFieldsForNode(
  node: KnowledgeNode,
  getConceptFields: (
    type: string,
  ) => Array<{ name: string; type: string; [key: string]: any }> | undefined,
): FieldDefinition[] {
  const metamodelFields = getConceptFields(node.type) ?? []
  const fieldsMap = new Map<string, FieldDefinition>()

  for (const f of metamodelFields) {
    fieldsMap.set(f.name, { ...f })
  }
  if (node.fields) {
    for (const key of Object.keys(node.fields)) {
      if (!fieldsMap.has(key)) {
        fieldsMap.set(key, {
          name: key,
          type: typeof node.fields[key].value === 'boolean' ? 'boolean' : 'string',
        })
      }
    }
  }
  return Array.from(fieldsMap.values())
}

export function getMergedBlockFields(
  node: KnowledgeNode,
  getConceptFields: (
    type: string,
  ) => Array<{ name: string; type: string; [key: string]: any }> | undefined,
): Record<string, any> {
  const metamodelFields = getConceptFields(node.type) ?? []
  const fields: Record<string, any> = {}

  for (const f of metamodelFields) {
    fields[f.name] = f.type === 'boolean' ? false : ''
  }

  if (node.fields) {
    for (const [k, fv] of Object.entries(node.fields)) {
      fields[k] = fv.value
    }
  }

  return fields
}
