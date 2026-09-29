// legacy:nn-rename/schema-maps

import type { SchemaMap } from './types.js'
import { workspaceSchemaMap } from './workspace.js'

export type { SchemaMap } from './types.js'

const SCHEMA_MAPS: Record<string, SchemaMap> = {
  workspace: workspaceSchemaMap,
}

export function getSchemaMap(blueprintName: string): SchemaMap | undefined {
  const normalized = blueprintName.toLowerCase().trim()
  return SCHEMA_MAPS[normalized]
}

export function bumpSemver(version: string, bump: 'minor' | 'patch' | 'none'): string {
  if (bump === 'none') return version
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/)
  if (!match) return version
  const major = parseInt(match[1], 10)
  const minor = parseInt(match[2], 10)
  const patch = parseInt(match[3], 10)
  const rest = match[4] || ''

  if (bump === 'minor') {
    return `${major}.${minor + 1}.0${rest}`
  } else if (bump === 'patch') {
    return `${major}.${minor}.${patch + 1}${rest}`
  }
  return version
}

export function applySchemaMap(
  content: string,
  map: SchemaMap,
  currentVersion?: string,
): { migratedContent: string; bumpedVersion?: string } {
  let result = content
  let bumpedVersion: string | undefined = undefined

  if (currentVersion) {
    bumpedVersion = bumpSemver(currentVersion, map.knowledgeBump)
    // Update knowledge_version in content if present
    result = result.replace(
      /^(\s*knowledge_version\s*:\s*["'])[^"']+(["'])/m,
      `$1${bumpedVersion}$2`,
    )
    result = result.replace(
      /^(\s*model_version\s*:\s*["'])[^"']+(["'])/m,
      `$1${bumpedVersion}$2`,
    )
  }

  // Rename canonical concepts only
  for (const canonicalConcept of map.from.canonicalConcepts) {
    const targetName = map.concepts.rename[canonicalConcept]
    if (targetName) {
      // Headings
      result = result.replace(
        new RegExp(`^(#{1,6}\\s+)${canonicalConcept}(\\s*)$`, 'gm'),
        `$1${targetName}$2`,
      )
      // List definition item headings: e.g. - Workspace Definition
      result = result.replace(
        new RegExp(`^(\\s*-\\s+)${canonicalConcept}(\\s+Definition|\\s+DefiNNition)`, 'gm'),
        `$1${targetName}$2`,
      )
      // Wikilinks
      result = result.replace(
        new RegExp(`\\[\\[#${canonicalConcept}\\]\\]`, 'g'),
        `[[#${targetName}]]`,
      )
    }
  }

  // Rename fields
  if (map.fields.rename) {
    for (const [oldField, newField] of Object.entries(map.fields.rename)) {
      result = result.replace(new RegExp(`^(\\s*)${oldField}(\\s*:)`, 'gm'), `$1${newField}$2`)
      result = result.replace(new RegExp(`^(\\s*-\\s*)${oldField}(::)`, 'gm'), `$1${newField}$2`)
    }
  }

  return { migratedContent: result, bumpedVersion }
}
