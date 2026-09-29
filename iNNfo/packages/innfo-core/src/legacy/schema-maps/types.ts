// legacy:nn-rename/schema-maps

export interface SchemaMap {
  blueprint: string
  from: {
    versions: string[]
    canonicalConcepts: string[]
  }
  to: {
    name: string
    version: string
  }
  concepts: {
    rename: Record<string, string>
    remove?: string[]
  }
  fields: {
    rename?: Record<string, string>
    retype?: Record<string, string>
  }
  knowledgeBump: 'minor' | 'patch' | 'none'
}
