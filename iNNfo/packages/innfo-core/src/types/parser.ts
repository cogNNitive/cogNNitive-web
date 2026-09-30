/** Concept `type::` values. The `as const` array is the single source of
 *  truth; `ConceptType` is derived from it so the two cannot drift. */
export const CONCEPT_TYPES = [
  'text',
  'list',
  'category',
  'weight',
  'steps',
  'sequence',
  'knowledge',
  'model',
] as const
export type ConceptType = (typeof CONCEPT_TYPES)[number]

/** Field Definition `type::` values (single source of truth for `FieldType`). */
export const FIELD_TYPES = [
  'string',
  'select',
  'reference',
  'image',
  'file',
  'video',
  'audio',
  'url',
  'markdown_inline',
  'markdown_file',
  'knowledge',
  'model',
  // A path PLUS an addressable knowledge unit, subject to the `KU_*` integrity
  // checks. Distinct from `file` ("a path") and `markdown_file` ("a content
  // body"): only `citation` asserts provenance, and only it is validated as
  // such. See AD-5 of `2026-09-13-document-fidelity-and-provenance-integrity`.
  'citation',
] as const
export type FieldType = (typeof FIELD_TYPES)[number]

export type SpecLevel = 0 | 1 | 2 | 3

export interface ParentRef {
  name: string
  url: string
}

export interface AliasMap {
  concepts?: Record<string, string>
  fields?: Record<string, string>
}

export interface IncludedBlueprintRef {
  name: string
  url: string
  alias?: AliasMap
}

export interface TemplateProcedure {
  id: string
  name: string
  path: string
  source_template?: string
}

export interface TemplateSkill {
  name: string
  repo: string
  path: string
  source_template?: string
}

export interface ResolvedBlueprintPackage {
  name: string
  version: string
  packagePath: string
  specFilePath: string
  isPackageDir: boolean
  tier: 'workspace-package' | 'workspace-flat' | 'global-cache' | 'installed-skill'
}

export interface ReachabilityGraph {
  /** Set of active spec identifiers using normalized '<name>@<version>' or '<name>' keys */
  activeSpecs: Set<string>
  referencedBy: Map<string, string[]>
  orphanedCandidates: string[]
}

export interface ConceptField {
  name: string
  type: FieldType
  options?: string[]
  target_concepts?: string[]
  target_blueprint?: string
}

export interface Concept {
  name: string
  parent?: string
  icon?: string
  type: ConceptType
  color?: string
  weight?: number
  fields?: ConceptField[]
  tags?: string[]
}

export interface Marker {
  name: string
  icon?: string
  symbol?: string
  color?: string
  weight?: number
  /** Which entities may be scored on this Marker. Defaults to ['Element']. */
  applies_to?: string[]
  /** Allowed scores (inline array). Omitted for a free numeric scale. */
  values?: string[]
  /** Cell interaction widget for the item-markers matrix column. */
  widgetType?: string
  /** Widget-specific configuration (inline JSON object). See iNNfo "Widget Configuration". */
  widgetConfig?: Record<string, unknown>
}

export interface MatrixDecl {
  name: string
  source: string
  target: string
  params: string
  /** Values array (V_0-1-0+). When `params` is present without `values`, it is auto-converted (reader tolerance). */
  values?: string[]
  /** Widget type for matrix cell interaction: 'boolean' | 'cycle' | 'scale' | 'set' | 'text'. */
  widgetType?: string
  /** Widget-specific configuration (inline JSON object). See iNNfo "Widget Configuration". */
  widgetConfig?: Record<string, unknown>
  /** Optional human-readable explanation of what the matrix represents. */
  description?: string
  /** Min heatmap color (CSS color) */
  min_color?: string
  /** Max heatmap color (CSS color) */
  max_color?: string
  /** Display label for the relationship */
  label?: string
}

export type RelationshipType = 'hierarchy' | 'evaluable_matrix' | 'graph_edge' | 'sequence'

export interface RelationshipDecl {
  enabled: boolean
  via?: string
}

export interface RelationshipTypeDef {
  name: RelationshipType
  description: string
  representation: string
}

export interface SpecFrontmatter {
  spec_version: string
  spec_url: string
  level: SpecLevel
  parent?: string | ParentRef
  parent_spec?: ParentRef
  /**
   * Level-2 only. Names + URLs of peer templates whose Concept / Field /
   * Marker / Matrix Definitions are composed into this template's effective
   * schema **additively** (see iNNfo "Level 2 Template Structure"). Distinct
   * from `parent_spec` (the vertical conformance chain) and from the inert
   * `specializes` field. Bare-string entries are tolerated on read and
   * normalized to `{ name, url: '' }`.
   */
  includes?: IncludedBlueprintRef[]
  procedures?: TemplateProcedure[]
  skills?: TemplateSkill[]
  alias?: AliasMap
  /** Reserved, inert. Named base template for future structural inheritance. */
  specializes?: string
  title?: string
  description?: string
  author?: string
  status?: string
  concepts?: Concept[]
  markers?: Marker[]
  matrices?: MatrixDecl[]
  relationship_types?: RelationshipTypeDef[]
  relationship_declarations?: Partial<Record<RelationshipType, RelationshipDecl>>
  knowledge_version?: string
  blueprint_version?: string
  blueprint_name?: string
  knowledge_dir?: string
  blueprints_dir?: string
  mode?: string
  template?: string | Record<string, unknown>
  last_saved?: string
  last_updated?: string
  [key: string]: unknown
}

export interface ElementNode {
  type: string
  name: string
  description: string
  fields: Record<string, unknown>
  markers: Record<string, number | string>
  /** Optional slug derived from YAML `slug` field or auto-derived from name. */
  slug?: string
  tags?: string[]
  /**
   * Whether a blank line separated this element from the next one in the
   * source (undefined for a programmatically constructed element, which
   * `serializeKnowledge` treats as `true`). The shipped corpus is not uniform:
   * most concepts blank-separate every element, but some description-only
   * concepts pack `## NN` headings back-to-back with none. Not meaningful
   * for the last element of a concept — a blank line always follows it,
   * regardless of this flag.
   */
  trailingBlankLine?: boolean
  /**
   * Whether a blank line separated this element's last `key:: value` from its
   * prose description in the source. `description` is stored trimmed, so this
   * is the only record of that separation. The shipped corpus is split on it,
   * so `serializeKnowledge` replays what was there rather than assuming a rule.
   */
  descriptionBlankLine?: boolean
  /**
   * Exact source text of this element's `tags::` RHS. `parseTagList`
   * lowercases and trims, so the authored casing (`PR`, not `pr`) survives
   * only here. `serializeKnowledge` re-emits it verbatim when the current `tags`
   * still match what it parses to; tag semantics stay case-insensitive.
   */
  rawTags?: string
  /**
   * Whether `slug` was AUTHORED as a `slug::` line, rather than derived by
   * `deriveElementSlugs`. Only an authored slug is written back: every element
   * carries a derived `slug` after parsing, so emitting unconditionally would
   * grow a `slug::` line on every element of every document on its first save.
   */
  slugExplicit?: boolean
  /**
   * Exact source text (the RHS after `key:: `) for each field, as originally
   * authored — before `parsePropertyValue` normalizes it. `serializeKnowledge`
   * re-emits this verbatim when the field's current value still matches what
   * this raw text would parse to, so an untouched field keeps the author's
   * exact quoting/bracket choice (Requirement 5). A field whose value was
   * changed by a mutation has no matching raw text and falls through to
   * canonical serialization.
   */
  rawFields?: Record<string, string>
}

export interface MatrixCell {
  row: string
  col: string
  value: string
}

export interface MatrixData {
  name: string
  /** Left axis label, parsed from the table header's first cell
   *  (`| Source \ Target | ... |`). Empty for a label-less matrix, and
   *  written back empty — `serializeKnowledge` substitutes no placeholder. */
  source: string
  /** Right axis label, parsed and written back the same way. */
  target: string
  cells: MatrixCell[]
}

export interface TaxonomyEdge {
  parent: string
  child: string
}

/** Case-insensitive wrapper around Map<string, ElementNode[]> */
export class ElementsMap {
  private _map = new Map<string, { key: string; nodes: ElementNode[] }>()
  set(key: string, nodes: ElementNode[]) {
    this._map.set(key.toLowerCase(), { key, nodes })
  }
  delete(key: string): boolean {
    return this._map.delete(key.toLowerCase())
  }
  has(key: string): boolean {
    return this._map.has(key.toLowerCase())
  }
  get(key: string): ElementNode[] | undefined {
    return this._map.get(key.toLowerCase())?.nodes
  }
  keys(): string[] {
    return Array.from(this._map.values()).map((e) => e.key)
  }
  entries(): Array<[string, ElementNode[]]> {
    return Array.from(this._map.values()).map((e) => [e.key, e.nodes])
  }
  forEach(fn: (nodes: ElementNode[], key: string) => void) {
    for (const { key, nodes } of this._map.values()) {
      fn(nodes, key)
    }
  }
  get size() {
    return this._map.size
  }
  [Symbol.iterator]() {
    return this.entries()[Symbol.iterator]()
  }
  /** JSON serialization support — serializes as a plain record */
  toJSON(): Record<string, ElementNode[]> {
    const obj: Record<string, ElementNode[]> = {}
    for (const [key, nodes] of this.entries()) {
      obj[key] = nodes
    }
    return obj
  }
}

/** Raw section content preserved for round-trip fidelity */
export interface RawSection {
  rawTitle: string
  body: string
}

export interface ParsedKnowledge {
  frontmatter: SpecFrontmatter
  taxonomy: TaxonomyEdge[]
  elements: ElementsMap
  matrices: MatrixData[]
  nodeMarkers: Record<string, Record<string, number | string>>
  rawContent: string
  /** Optional: raw body text per concept for round-trip fidelity */
  rawSections?: Record<string, string>
  /** Slug collisions detected during parsing (FR-002). */
  slugCollisions?: Array<{ slug: string; elements: string[]; concept: string }>
  /** Non-fatal parse warnings (e.g. deprecated features). */
  parseWarnings?: string[]
  /** Tags applied to Concept sections directly (not individual elements) */
  conceptTags?: Record<string, string[]>
  /** Exact source text of each concept-level `tags::` RHS. See
   *  `ElementNode.rawTags` for why this is kept separately. */
  rawConceptTags?: Record<string, string>
  /**
   * Document order of top-level `# NN` sections, as encountered by
   * `parseKnowledge`: `'index'` for `# NN index`, `<ConceptName>` for a concept
   * section (element-bearing or `text`), and `'matrices: <name>'` for a
   * `# NN matrices: <name>` section. `serializeKnowledge` walks this list first,
   * then appends any section not covered by it (created by a mutation after
   * parsing) in its current insertion order. Optional so a programmatically
   * constructed `ParsedKnowledge` (tests, `init_model` scaffolding) keeps
   * working unchanged.
   */
  sectionOrder?: string[]
  /**
   * Whether a blank line separated a top-level `# NN` heading from the first
   * line of its body, keyed by the lowercased `sectionOrder` entry
   * (`'index'`, `'<conceptname>'`, `'matrices: <name>'`). The shipped corpus
   * is inconsistent here — some documents put a blank line after the heading
   * and some do not — so `serializeKnowledge` replays what was actually there
   * instead of assuming a fixed rule. A missing entry falls back to the
   * per-section-kind default used for programmatically built models.
   */
  sectionBlankLine?: Record<string, boolean>
  /**
   * The exact frontmatter block `parseKnowledge` read, `---` fences included.
   * `serializeKnowledge` re-emits it byte-for-byte when re-parsing it still
   * yields the frontmatter currently held — i.e. nothing mutated it since.
   *
   * This exists because the constructed emit path is an ALLOW-LIST of known
   * keys: a document carrying anything else (`workspace_id`, a template's
   * own extension keys) silently loses it on save. Raw re-emission is what
   * makes byte-identity (Requirement 1) reachable for arbitrary frontmatter,
   * while the allow-list stays as the fallback for a mutated or
   * programmatically constructed model.
   */
  /**
   * Marker column names declared by the `# NN matrices: item-markers matrix`
   * table header, in source order. `nodeMarkers` only records markers that
   * are actually SET, so a column whose every cell is `-` leaves no trace
   * there and would be dropped on save. This is the declared column set.
   */
  nodeMarkerColumns?: string[]
  rawFrontmatter?: string
  /**
   * The exact text between the frontmatter block and the first `# NN`
   * section — in practice the `> [!NOTE]` banner, plus whatever else the
   * author put there. The constructed path hardcodes a single fixed banner,
   * so any additional blockquote content is otherwise dropped on save.
   */
  rawPreamble?: string
}

export interface SpecCache {
  specs: Map<string, SpecDocument>
  chain: string[]
}

export interface SpecDocument {
  name: string
  level: SpecLevel
  parentName?: string
  parentUrl?: string
  frontmatter: SpecFrontmatter
  rawContent: string
}
