import type { BlueprintSchema } from '../schema/index.js'
import type { SourceRef } from '../sourceRef.js'
import type { TaxonomyEdge } from './parser.js'
import type { ValidationError } from './validation.js'

/* ── Graph / App Model Types (moved from apps/innfo-editor/src/model/types.ts) ── */

/** Who/what produced a value change. */
export interface Author {
  kind: 'user' | 'ai' | 'system'
  id: string
}

/**
 * Edit-attribution stamp attached to every field write: who last set this
 * value, and when. An editor-session concern — not serialised to the
 * `*_NN.md` file and unrelated to the workspace Lineage record.
 */
export interface EditAttribution {
  author: Author
  timestamp: string // ISO-8601
}

/** A single field's value plus who set it and when. */
export interface FieldValue {
  value: unknown
  editAttribution: EditAttribution
}

export type RelationshipOrigin = 'matrix' | 'field' | 'mention' | 'graph_edge' | 'source'

/** A normalized relationship edge stored on a node. */
export interface ModelRelationship {
  targetId: string
  label: string
  value?: string | number
  origin: RelationshipOrigin
}

/** A single concept declaration, as declared in a document's frontmatter `concepts:` list. */
export interface MetamodelConcept {
  name: string
  icon?: string
  type: string
  color?: string
  weight?: number
  fields?: {
    name: string
    type: string
    options?: string[]
    target_concepts?: string[]
    target_blueprint?: string
  }[]
  tags?: string[]
}

/** A single marker declaration, as declared in a document's frontmatter `markers:` list. */
export interface MetamodelMarker {
  name: string
  icon?: string
  symbol?: string
  color?: string
  weight?: number
}

/**
 * The metamodel declared locally by a root node's own frontmatter
 * (`concepts`/`markers`). Nodes without their own file (nested elements)
 * declare no local metamodel (empty arrays); their effective metamodel is
 * resolved by walking up to their nearest ancestor (see `metamodel.ts`).
 */
export interface LocalMetamodel {
  concepts: MetamodelConcept[]
  markers: MetamodelMarker[]
  taxonomy: TaxonomyEdge[]
}

/**
 * Normalized graph node.
 */
export interface KnowledgeNode {
  id: string // qualifiedId, e.g. "Process/Phase/Task"
  name: string // unique among siblings
  parentId: string | null
  childIds: string[]
  type: string // resolved concept type
  fields: Record<string, FieldValue>
  markers: Record<string, number | string>
  tags?: string[]
  conceptTags?: Record<string, string[]>
  /**
   * Concept-scoped Marker scores (Markers whose `applies_to` includes
   * `Concept`), keyed by Concept name. Present only on the document root;
   * element-scoped scores live in `markers` on each element node.
   */
  conceptMarkers?: Record<string, Record<string, number | string>>
  /**
   * Schema-conformance result for this model against its resolved Template
   * (including everything the Template `includes`). Populated by the host's
   * spec resolver so a synchronous validation pass can surface it without
   * re-resolving. Present only on document roots.
   */
  schemaValidation?: { errors: ValidationError[]; warnings: ValidationError[] }
  /**
   * Composed (includes-merged) level-2 template schema for this model, stashed by
   * `recursiveParse` when a `resolveBlueprintSchema` option was supplied, so
   * `buildWorkspaceIndex` and the workspace validation pass never re-resolve.
   * Present only on document roots. Undefined when no resolver was supplied.
   */
  templateSchema?: BlueprintSchema
  relationships: ModelRelationship[]
  rawSections: Record<string, string> // round-trip fidelity
  /**
   * Full original source text for root nodes (the node whose own
   * `_NN.md` file was parsed via `parseKnowledge`). Undefined for
   * element nodes nested inside a document (they have no own file).
   * Used by the serializer for byte/structurally-equivalent no-edit
   * round-trip (R7) instead of re-deriving through `serializeKnowledge`'s
   * canonical reformatting, which is not guaranteed to match source bytes.
   */
  rawContent?: string
  /**
   * This node's own locally-declared metamodel (frontmatter `concepts`/
   * `markers`), present only on root nodes (undefined for nested element
   * nodes, which declare nothing locally). The effective metamodel is
   * resolved by walking up the ancestor chain merging these declarations,
   * closest subtree override wins (R9) — see `metamodel.ts`.
   */
  localMetamodel?: LocalMetamodel
  /**
   * Optional node-kind discriminator.
   * - 'root': the top-level node of a workspace (parentId === null).
   * - 'concept': a `# NN` section representing a type/group.
   * - 'element': an index-block instance.
   * Undefined means the node was created before this discriminator existed
   * (backward-compatible with existing graphs).
   */
  kind?: 'root' | 'concept' | 'element'
  /**
   * Optional metamodel binding for concept/group nodes.
   * - `source: 'metamodel'`: the concept name matched a declared concept in
   *    the resolved metamodel.
   * - `source: 'structural'`: no matching concept found; the node is a
   *    structural concept/group placeholder.
   * Undefined means the node is not a concept node or pre-dates this field.
   */
  conceptBinding?: { name: string; source: 'metamodel' | 'structural' }
  /** Optional slug derived from element YAML `slug` or auto-derived from name. */
  slug?: string
  source: { path: string } // FS location for write-back
  /**
   * Indicates how this node was produced:
   * - 'parsed': created from parsing a real _NN.md document
   * - 'structural': created as a structural placeholder (concept group)
   * Undefined means the node pre-dates this field (backward compatible).
   */
  sourceMode?: 'parsed' | 'structural'
  /** Relative paths of physical assets for this node. */
  assets?: string[]
  /**
   * Parsed source citations from this element's `sources::` field (a Citation
   * pointing at a Source section under `sources/nn/`). Populated by
   * `normalizeElementsIntoGraph` when the element declares a `sources`/`source`
   * field. Each ref also produces a `relationships` entry with
   * `origin: 'source'` whose `targetId` is the workspace-relative file path
   * (Sources are not graph nodes — id-based edge resolvers skip these).
   */
  sources?: SourceRef[]
  /**
   * Workspace-scoped author/owner of this model, propagated from the `author::`
   * field on the workspace manifest's `## NN Models:` entry. Not stored in the
   * model file itself — it is metadata of the workspace that references it.
   * Present only on root nodes reached through a workspace manifest.
   */
  author?: string
}
