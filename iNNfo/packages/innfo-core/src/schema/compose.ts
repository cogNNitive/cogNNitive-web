import type {
  AliasMap,
  Concept,
  IncludedTemplateRef,
  Marker,
  MatrixDecl,
  ValidationError,
} from '../types/index.js'
import { parseKnowledge } from '../parser/index.js'
import { type BlueprintSchema, extractBlueprintSchema } from './extract.js'

/* ── Additive template composition (`includes`) ─────────────────
 *
 * A level-2 template MAY declare `includes: [{ name, url }, ...]` naming peer
 * templates whose Concept / Field / Marker / Matrix Definitions are merged
 * into its effective schema **additively** (iNNfo "Level 2 Template
 * Structure"). Resolution is depth-first, left to right; each included
 * template is itself composed through its own `includes`. Composition never
 * overrides or removes an inherited Definition.
 *
 * When two sources declare a Definition with the same name (case-insensitive):
 *   - AST-identical bodies  → the duplicate is silently merged (one entry).
 *   - bodies that differ    → a validation ERROR that names both sources.
 *
 * "AST-identical" is decided by `canonicalizeDefinition` (property order,
 * surrounding whitespace and the order of set-like arrays such as `applies_to`
 * / `options` / `target_concepts` do not count). `includes` is orthogonal to
 * the vertical `parent_spec` chain and to the inert `specializes` field.
 */

/** Resolve the raw content of an included template by name (and optionally
 *  URL). Returns null when it cannot be resolved. Supplied by the host
 *  (innfo-mcp / the editor) so this module stays I/O-free. */
export type IncludeResolver = (ref: IncludedTemplateRef) => string | null

export interface ResolvedBlueprintSchema {
  schema: BlueprintSchema
  /** Collisions, cycles and unresolved includes encountered while composing. */
  errors: ValidationError[]
}

/** Keys whose array values are sets (order carries no meaning). */
const SET_LIKE_KEYS = new Set(['applies_to', 'options', 'target_concepts'])

function canonicalValue(v: unknown, key?: string): unknown {
  if (Array.isArray(v)) {
    const items = v.map((x) => canonicalValue(x))
    if (key === 'fields') {
      return [...items]
        .map((x) => JSON.stringify(x))
        .sort()
        .map((s) => JSON.parse(s) as unknown)
    }
    if (key && SET_LIKE_KEYS.has(key)) {
      return [...items].map((x) => JSON.stringify(x)).sort()
    }
    return items
  }
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const val = (v as Record<string, unknown>)[k]
      if (val === undefined || val === null) continue
      out[k] = canonicalValue(val, k)
    }
    return out
  }
  if (typeof v === 'string') return v.trim()
  return v
}

/**
 * A stable string form of a Concept / Marker / Matrix Definition, used to decide
 * whether two same-named Definitions coming from different `includes` sources are
 * "the same". Insensitive to property order, surrounding whitespace and the order
 * of set-like arrays; sensitive to every actual value.
 */
export function canonicalizeDefinition(def: Concept | Marker | MatrixDecl): string {
  return JSON.stringify(canonicalValue(def))
}

/**
 * Applies frontmatter `alias` map to a BlueprintSchema, renaming concepts, field scopes,
 * matrix source/target concepts, marker applies_to concepts, and taxonomy edges.
 */
export function applyAliasToSchema(schema: BlueprintSchema, alias?: AliasMap): BlueprintSchema {
  if (!alias || (!alias.concepts && !alias.fields)) {
    return schema
  }

  const conceptMap = alias.concepts ?? {}
  const fieldMap = alias.fields ?? {}

  const conceptRenameLookup = new Map<string, string>()
  for (const [oldName, newName] of Object.entries(conceptMap)) {
    conceptRenameLookup.set(oldName.toLowerCase(), newName)
  }

  const fieldRenameLookup = new Map<string, string>()
  for (const [oldKey, newKey] of Object.entries(fieldMap)) {
    fieldRenameLookup.set(oldKey.toLowerCase(), newKey)
  }

  const concepts: Concept[] = schema.concepts.map((c) => {
    const oldName = c.name
    const newConceptName = conceptRenameLookup.get(oldName.toLowerCase()) ?? oldName

    const fields = c.fields?.map((f) => {
      const oldFieldKey = `${oldName.toLowerCase()}.${f.name.toLowerCase()}`
      const aliasVal = fieldRenameLookup.get(oldFieldKey)
      let newFieldName = f.name
      if (aliasVal) {
        newFieldName = aliasVal.includes('.') ? aliasVal.split('.').pop()! : aliasVal
      }

      let target_concepts = f.target_concepts
      if (target_concepts) {
        target_concepts = target_concepts.map(
          (tc) => conceptRenameLookup.get(tc.toLowerCase()) ?? tc,
        )
      }

      return {
        ...f,
        name: newFieldName,
        ...(target_concepts ? { target_concepts } : {}),
      }
    })

    return {
      ...c,
      name: newConceptName,
      ...(fields ? { fields } : {}),
    }
  })

  const markers: Marker[] = schema.markers.map((m) => {
    let applies_to = m.applies_to
    if (applies_to) {
      applies_to = applies_to.map((ac) => conceptRenameLookup.get(ac.toLowerCase()) ?? ac)
    }
    return {
      ...m,
      ...(applies_to ? { applies_to } : {}),
    }
  })

  const matrices: MatrixDecl[] = schema.matrices.map((mx) => {
    const source = conceptRenameLookup.get(mx.source.toLowerCase()) ?? mx.source
    const target = conceptRenameLookup.get(mx.target.toLowerCase()) ?? mx.target
    return {
      ...mx,
      source,
      target,
    }
  })

  const taxonomy = schema.taxonomy.map((edge) => {
    const parent = conceptRenameLookup.get(edge.parent.toLowerCase()) ?? edge.parent
    const child = conceptRenameLookup.get(edge.child.toLowerCase()) ?? edge.child
    return { parent, child }
  })

  return { concepts, markers, matrices, taxonomy }
}

interface Provenanced<T> {
  source: string
  def: T
}

interface Provenance {
  concept: Map<string, Provenanced<Concept>>
  marker: Map<string, Provenanced<Marker>>
  matrix: Map<string, Provenanced<MatrixDecl>>
  field: Map<string, string>
}

/**
 * Merge one already-resolved schema into the accumulator. A same-named
 * Definition from a different source is silently dropped when its body is
 * AST-identical to the one already merged, and is an ERROR (naming both
 * sources) when the bodies differ or un-aliased collisions occur.
 */
function mergeDefinition<T extends Concept | Marker | MatrixDecl>(
  incoming: T,
  incomingSource: string,
  kindLabel: 'Concept' | 'Marker' | 'Matrix',
  seen: Map<string, Provenanced<T>>,
  target: T[],
  errors: ValidationError[],
  isHost: boolean = false,
): boolean {
  const key = incoming.name.toLowerCase()
  const prior = seen.get(key)
  if (prior) {
    if (canonicalizeDefinition(prior.def) !== canonicalizeDefinition(incoming)) {
      if (!isHost && prior.source !== incomingSource) {
        errors.push({
          path: `includes.${kindLabel}.${incoming.name}`,
          message: `[COMPOSITION_COLLISION] ${kindLabel} Definition "${incoming.name}" collision detected between included templates "${prior.source}" and "${incomingSource}". Use frontmatter \`alias\` to resolve collisions.`,
          severity: 'error',
        })
      } else {
        errors.push({
          path: `includes.${kindLabel}.${incoming.name}`,
          message: `${kindLabel} Definition "${incoming.name}" is declared with different bodies by both "${prior.source}" and "${incomingSource}" — \`includes\` composition is additive and MUST NOT redeclare a Definition differently`,
          severity: 'error',
        })
      }
    }
    // AST-identical → deduplicate silently
    return false
  }
  seen.set(key, { source: incomingSource, def: incoming })
  target.push(incoming)
  return true
}

function mergeSchemaInto(
  acc: BlueprintSchema,
  incoming: BlueprintSchema,
  incomingSource: string,
  provenance: Provenance,
  errors: ValidationError[],
  isHost: boolean = false,
): void {
  for (const c of incoming.concepts) {
    mergeDefinition(c, incomingSource, 'Concept', provenance.concept, acc.concepts, errors, isHost)
    for (const f of c.fields ?? []) {
      const fieldKey = `${c.name.toLowerCase()}.${f.name.toLowerCase()}`
      const priorFieldSource = provenance.field.get(fieldKey)
      if (priorFieldSource && priorFieldSource !== incomingSource && !isHost) {
        const existingConcept = acc.concepts.find(
          (ac) => ac.name.toLowerCase() === c.name.toLowerCase(),
        )
        const existingField = existingConcept?.fields?.find(
          (af) => af.name.toLowerCase() === f.name.toLowerCase(),
        )
        if (existingField && JSON.stringify(existingField) !== JSON.stringify(f)) {
          errors.push({
            path: `includes.Field.${c.name}.${f.name}`,
            message: `[COMPOSITION_COLLISION] Field "${c.name}.${f.name}" collision detected between included templates "${priorFieldSource}" and "${incomingSource}". Use frontmatter \`alias\` to resolve collisions.`,
            severity: 'error',
          })
        }
      } else {
        provenance.field.set(fieldKey, incomingSource)
      }
    }
  }
  for (const m of incoming.markers) {
    mergeDefinition(m, incomingSource, 'Marker', provenance.marker, acc.markers, errors, isHost)
  }
  for (const mx of incoming.matrices) {
    mergeDefinition(mx, incomingSource, 'Matrix', provenance.matrix, acc.matrices, errors, isHost)
  }
  for (const edge of incoming.taxonomy) {
    const existingIndex = acc.taxonomy.findIndex(
      (e) => e.child.toLowerCase() === edge.child.toLowerCase(),
    )
    if (existingIndex !== -1) {
      if (isHost) {
        acc.taxonomy[existingIndex] = edge
      }
    } else {
      acc.taxonomy.push(edge)
    }
  }
}

/**
 * Resolve a level-2 template's effective schema, composing every template it
 * `includes` (recursively, depth-first, left to right up to depth 10) on top of a base of
 * the included schemas. Returns the merged schema plus any composition
 * errors (name collisions, cycles, unresolved includes). When the template
 * declares no `includes`, or no resolver is supplied, this is just
 * `extractBlueprintSchema` with an empty error list.
 */
export function resolveBlueprintSchema(
  templateContent: string,
  resolveInclude?: IncludeResolver,
  _seen: Set<string> = new Set(),
  _depth: number = 0,
): ResolvedBlueprintSchema {
  const parsed = parseKnowledge(templateContent)
  const local = extractBlueprintSchema(parsed)
  const includes = parsed.frontmatter?.includes ?? []
  if (!resolveInclude || includes.length === 0) {
    return { schema: local, errors: [] }
  }

  if (_depth >= 10) {
    return {
      schema: local,
      errors: [
        {
          path: 'includes',
          message: 'Max inclusion depth of 10 exceeded',
          severity: 'error',
        },
      ],
    }
  }

  const selfLabel = String(parsed.frontmatter?.title ?? 'this template')
  const errors: ValidationError[] = []
  const base: BlueprintSchema = { concepts: [], markers: [], matrices: [], taxonomy: [] }
  const provenance: Provenance = {
    concept: new Map(),
    marker: new Map(),
    matrix: new Map(),
    field: new Map(),
  }

  for (const ref of includes) {
    const key = ref.name.toLowerCase()
    if (_seen.has(key)) {
      errors.push({
        path: `includes.${ref.name}`,
        message: `Cyclic \`includes\`: "${ref.name}" is already being composed further up the chain`,
        severity: 'error',
      })
      continue
    }
    const content = resolveInclude(ref)
    if (content === null) {
      errors.push({
        path: `includes.${ref.name}`,
        message: `Included template "${ref.name}" could not be resolved${ref.url ? ` from "${ref.url}"` : ''}`,
        severity: 'error',
      })
      continue
    }
    const nested = resolveBlueprintSchema(
      content,
      resolveInclude,
      new Set([..._seen, key]),
      _depth + 1,
    )
    errors.push(...nested.errors)
    const aliasedSchema = ref.alias ? applyAliasToSchema(nested.schema, ref.alias) : nested.schema
    const includedLabel = String(parseKnowledge(content).frontmatter?.title ?? ref.name)
    mergeSchemaInto(base, aliasedSchema, includedLabel, provenance, errors, false)
  }

  // The composite template's own definitions apply on top of the union.
  mergeSchemaInto(base, local, selfLabel, provenance, errors, true)

  // Validate matrix endpoints at top-level resolution
  if (_depth === 0) {
    const conceptNames = new Set(base.concepts.map((c) => c.name.toLowerCase()))
    const BUILTIN_TARGETS = new Set(['marker', 'element', 'item'])

    for (const mx of base.matrices) {
      const srcKey = mx.source.toLowerCase()
      const tgtKey = mx.target.toLowerCase()
      if (!conceptNames.has(srcKey) && !BUILTIN_TARGETS.has(srcKey)) {
        errors.push({
          path: `matrix.${mx.name}.source`,
          message: `Matrix "${mx.name}" source concept "${mx.source}" does not resolve to any concept in the composed template schema`,
          severity: 'error',
        })
      }
      if (!conceptNames.has(tgtKey) && !BUILTIN_TARGETS.has(tgtKey)) {
        errors.push({
          path: `matrix.${mx.name}.target`,
          message: `Matrix "${mx.name}" target concept "${mx.target}" does not resolve to any concept in the composed template schema`,
          severity: 'error',
        })
      }
    }
  }

  return { schema: base, errors }
}
