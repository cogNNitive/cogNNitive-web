/**
 * Barrel for the model-mutation MCP tools. The implementations live in
 * focused modules; this file keeps the import path (`./tools/mutate.js`)
 * stable for `server.ts` and the specs.
 *
 *   ./knowledge-io.ts  load / save / blueprint resolution shared helpers
 *   ./validate.ts      validate_knowledge, validate_knowledge_url, validate_blueprint
 *   ./apply-change.ts  apply_change + bump_version
 *   ./init-knowledge.ts init_knowledge + body scaffolding
 *   ./reachability.ts  reachability graph + prune_orphaned_specs
 *   ./spec-backup.ts   specs backup zip
 */

export type { ApplyChangeResult } from './apply-change.js'
export { applyChange } from './apply-change.js'
export {
  validateKnowledge,
  validateKnowledgeUrl,
  validateBlueprint,
} from './validate.js'
export { initKnowledge } from './init-knowledge.js'
export { calculateSpecReachability, pruneOrphanedSpecs } from './reachability.js'
export type { PruneOrphanedSpecsResult } from './reachability.js'
export { createSpecsBackupZip } from './spec-backup.js'

