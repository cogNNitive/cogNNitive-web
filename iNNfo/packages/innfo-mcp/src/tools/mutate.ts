/**
 * Barrel for the model-mutation MCP tools. The implementations live in
 * focused modules; this file keeps the import path (`./tools/mutate.js`)
 * stable for `server.ts` and the specs.
 *
 *   ./model-io.ts      load / save / template resolution shared helpers
 *   ./validate.ts      validate_model, validate_model_url, validate_template
 *   ./apply-change.ts  apply_change + bump_version
 *   ./init-model.ts    init_model + body scaffolding
 *   ./reachability.ts  reachability graph + prune_orphaned_specs
 *   ./spec-backup.ts   specs backup zip
 */

export type { ApplyChangeResult } from './apply-change.js'
export { applyChange } from './apply-change.js'
export {
  validateKnowledge,
  validateKnowledgeUrl,
  validateTemplate,
  validateBlueprint,
} from './validate.js'
export { initModel, initKnowledge } from './init-model.js'
export { calculateSpecReachability, pruneOrphanedSpecs } from './reachability.js'
export type { PruneOrphanedSpecsResult } from './reachability.js'
export { createSpecsBackupZip } from './spec-backup.js'

