export * from './types/index.js'
export {
  parseYaml,
  parseFrontmatter,
  parseKnowledge,
  serializeKnowledge,
  parseIndexBlock,
  parseMarkdownTable,
  getSectionType,
  normalizeSeparators,
} from './parser/index.js'
export {
  CONCEPT_DEFINITION,
  FIELD_DEFINITION,
  MARKER_DEFINITION,
  MATRIX_DEFINITION,
  extractBlueprintSchema,
  extractBlueprintSchemaFromContent,
  extractMetaschema,
  validateTemplateAgainstMetaschema,
  checkElementsAgainstSchema,
  checkWidgetConfig,
  resolveBlueprintSchema,
  CANONICAL_TEMPLATES,
  findCanonicalTemplate,
  getCanonicalSpecContent,
  listCanonicalTemplates,
} from './schema/index.js'
export type {
  BlueprintSchema,
  SchemaCheckOptions,
  IncludeResolver,
  ResolvedBlueprintSchema,
} from './schema/index.js'
export {
  validateKnowledge,
  validateDocument,
  validateFormatContent,
  validateFormatSyntax,
  validateWorkspaceReferences,
  validateWorkspaceSources,
} from './validator/index.js'
export type { DocumentValidation, ReferenceDiagnostic, SourceResolver } from './validator/index.js'

export { parseSourceRef, slugifyHeading, extractHeadings, resolveHeadingSection } from './sourceRef.js'
export type { SourceRef, HeadingInfo, ResolvedHeadingSection } from './sourceRef.js'
export {
  parseKnowledgeUnitRef,
  serializeKnowledgeUnitRef,
  slugifyUnitHeading,
  normalizeName,
} from './sourceRef.js'
export type { KnowledgeUnit, HeaderUnit, RowUnit } from './sourceRef.js'
export { parseCsvTable } from './csvTable.js'
export type { CsvTable, CsvTableOptions } from './csvTable.js'
export { resolveUnit } from './unitResolve.js'
export type { ResolvedUnit } from './unitResolve.js'
export { parseKnowledgeQuery, runQuery } from './queryUnits.js'
export type { KnowledgeQuery, KnowledgeQueryFilter, FileSnapshot, QueryResult } from './queryUnits.js'
export { scanSections } from './querySections.js'
export type { SectionFields } from './querySections.js'
export { applyMutation, updateReferenceString } from './mutate.js'
export type { MutationResult } from './mutate.js'
export { buildAgentModificationBlock } from './agentModification.js'
export type { AgentModificationContext } from './agentModification.js'
export { deriveMatrixWidgetType, normalizeMatrixDecl, scaleRangeFor } from './matrix.js'
export type { MatrixWidgetType } from './matrix.js'
export { mergeKnowledge } from './merge.js'
export * from './identity.js'
export * from './metamodel.js'
export * from './fs-types.js'
export * from './layout.js'
export * from './recursiveParser/index.js'
export {
  OWNERSHIP_MARKER,
  reconcileManifest,
  type DiscoveredModel,
  type ManifestChange,
} from './workspace/reconcileManifest.js'
export { isReconcilableModel, type CandidateFile } from './workspace/discoverModels.js'
export {
  parseSemVer,
  compareVersions,
  gapKind,
  parsePinnedUrl,
  classifyAgainstCatalog,
  type SemVerTriple,
  type VersionStatus,
  type VersionGap,
  type VersionClassification,
  type TemplateCatalog,
  type TemplateCatalogEntry,
  type TemplateCatalogVersion,
} from './workspace/integrity/versionStatus.js'
export {
  buildWorkspaceIntegrityReport,
  summarizeWorkspaceIntegrity,
  type WorkspaceIntegrityPorts,
  type WorkspaceModelRef,
  type IntegrityDiagnostic,
  type TemplateResolutionResult,
  type ModelIntegrityReport,
  type WorkspaceIntegrityReport,
  type WorkspaceIntegrityAggregate,
  type BuildWorkspaceIntegrityOptions,
  type CatalogSource,
  type FreshnessField,
  type TemplateResolution,
} from './workspace/integrity/report.js'
export {
  getSpecForLevel,
  getTemplate,
  getFormatSpec,
  getDefiNNe,
  SpecResolutionError,
} from './resolver.js'
export type { SpecResolver } from './resolver.js'
