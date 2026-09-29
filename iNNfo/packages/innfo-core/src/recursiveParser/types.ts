import type { ModelNode } from '../types/index.js'
import type { IdentityRegistry } from '../identity.js'
import type { TemplateSchema } from '../schema/index.js'

import type { DetectLegacyResult } from '../legacy/detect.js'

export interface ParseIssue {
  path: string
  message: string
  severity?: 'info' | 'warning' | 'error'
  /** Stable machine-readable discriminator. Additive; existing issues keep it undefined. */
  code?: 'CYCLE_DETECTED' | 'DEPTH_LIMIT' | 'MODEL_NOT_FOUND' | 'LEGACY_DOMAIN' | 'MISSING_ENTRYPOINT'
}

import type { ModelDagTopology } from './topology.js'

export interface RecursiveParseResult {
  nodes: Record<string, ModelNode>
  rootIds: string[]
  issues: ParseIssue[]
  /** Workspace-relative path of the resolved entrypoint. Undefined on the root-scan fallback. */
  entrypointPath?: string
  /** Computed DAG topology across models (in-degrees, out-degrees, edges, roots). */
  topology?: ModelDagTopology
  /** True when the domain was identified as legacy. */
  isLegacy?: boolean
  /** Full legacy detection report when isLegacy is true. */
  legacyResult?: DetectLegacyResult
}

export interface WorklistItem {
  path: string
  name: string
  referringPath: string
  depth: number
  author?: string
  /**
   * normalizePathKey chain from the entrypoint through `referringPath`, inclusive.
   * Membership => true cycle. Non-membership + already parsed => diamond.
   */
  ancestorKeys: string[]
}

export interface ParseContext {
  nodes: Record<string, ModelNode>
  identity: IdentityRegistry
  issues: ParseIssue[]
  visitedPaths?: Set<string>
}

/**
 * Host-supplied, SYNCHRONOUS resolver returning a node's level-2 template schema.
 * MUST return the COMPOSED schema (schema.ts `resolveTemplateSchema(...).schema`,
 * i.e. `includes`-merged), so `type:: knowledge` fields inherited through `includes`
 * are followed during traversal. Return `null` when the template is unknown.
 * Named `TemplateSchemaResolver` (not `resolveTemplateSchema`) to avoid colliding
 * with the exported function `resolveTemplateSchema` in schema.ts (AD-03).
 */
export type TemplateSchemaResolver = (node: {
  path: string
  name: string
  content: string
  frontmatter: Record<string, unknown>
}) => TemplateSchema | null

export interface RecursiveParseOptions {
  resolveTemplateSchema?: TemplateSchemaResolver
}

