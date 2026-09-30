export {
  resolveGraphEdgeTarget,
  resolveQualifiedIdToPath,
  normalizePathKey,
  resolveSubmodelPath,
} from './paths.js'
export {
  WIKILINK_RE,
  extractWikilinkTargets,
  buildLowerNameIndex,
  addFieldAndMentionEdges,
} from './relationships.js'
export type {
  ParseIssue,
  RecursiveParseResult,
  WorklistItem,
  ParseContext,
  BlueprintSchemaResolver,
  RecursiveParseOptions,
} from './types.js'
export { normalizeSingleKnowledge } from './knowledge.js'
export { recursiveParse, extractSubmodelRefs, MAX_DEPTH } from './workspace.js'
export type { ExtractedSubmodelRef } from './workspace.js'
export { buildWorkspaceIndex } from './workspaceIndex.js'
export type { WorkspaceIndex } from './workspaceIndex.js'
export { readWorkspaceId } from './workspaceId.js'
export { computeModelDagTopology } from './topology.js'
export type { ModelDagTopology, ModelDagEdge } from './topology.js'
