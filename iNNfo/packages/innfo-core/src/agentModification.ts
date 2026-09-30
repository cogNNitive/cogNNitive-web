/**
 * Agent Modification block builder.
 *
 * A pure, side-effect-free function that turns an executed mutation `(op, args)`
 * plus caller-supplied context into the canonical **Agent Modification** block —
 * a Markdown string the `nn-innfo` skill instructs the agent to paste verbatim
 * under a `## NN Agent Modification: <slug>` heading, making the synthetic
 * reasoning addressable and citeable via `sources::`.
 *
 * The builder never performs I/O and never mutates a model or its `args`.
 * `scope`, `change` and the heading slug are derived deterministically from
 * `(op, args)`; `model`, `knowledge_version`, `timestamp`, `rationale` and
 * `approved_by` are caller inputs.
 */

import { slugifyHeading } from './sourceRef.js'

export interface AgentModificationContext {
  /** Knowledge identifier — the `id` passed to `applyChange`. */
  knowledge?: string
  /** @deprecated use knowledge */
  model?: string
  /** Knowledge version in effect AFTER the mutation. */
  knowledgeVersion?: string
  /** @deprecated use knowledgeVersion */
  modelVersion?: string
  /** ISO-8601 timestamp; defaults to `new Date().toISOString()`. */
  timestamp?: string
  /** Caller reasoning; when absent the block emits the explicit `rationale:: _` marker. */
  rationale?: string
  /** Authorization; defaults to `agent`. */
  approvedBy?: 'user' | 'agent'
  /** Created-by attribution; when absent the block emits the explicit `author:: _` marker. */
  author?: string
  /** Previous/resulting version — required for a meaningful `bump_version` block. */
  versionTransition?: { from: string; to: string }
}

const q = (v: unknown): string => `"${String(v ?? '')}"`

/** Ops that produce a block, mapped to their deterministic `scope::` string. */
function scopeFor(
  op: string,
  args: Record<string, unknown>,
  ctx: AgentModificationContext,
): string | null {
  const c = args.conceptName
  const e = args.elementName
  const f = args.fieldName
  switch (op) {
    case 'add_element':
      return `add_element concept ${q(c)} element ${q(e)}`
    case 'add_concept':
      return `add_concept concept ${q(c)}`
    case 'add_field':
      return `add_field concept ${q(c)} field ${q(f)}`
    case 'update_field':
      return `update_field concept ${q(c)} element ${q(e)} field ${q(f)}`
    case 'remove_element':
      return `remove_element concept ${q(c)} element ${q(e)}`
    case 'rename_concept':
      return `rename_concept ${q(c)} → ${q(args.newName)}`
    case 'rename_element':
      return `rename_element concept ${q(c)} element ${q(e)} → ${q(args.newName)}`
    case 'generate_index':
      return 'generate_index taxonomy'
    case 'set_marker':
      return `set_marker ${q(args.markerName)}`
    case 'bump_version': {
      const currentVer = ctx.knowledgeVersion ?? ctx.modelVersion ?? '0.1.0'
      const from = ctx.versionTransition?.from ?? currentVer
      const to = ctx.versionTransition?.to ?? String(args.version ?? currentVer)
      return `bump_version ${q(from)} → ${q(to)}`
    }
    // `add_marker` is not a real op (mutate.ts has only `set_marker`); anything
    // unrecognised produces no block.
    default:
      return null
  }
}

/** Deterministic `change::` description for a block-producing op. */
function changeFor(
  op: string,
  args: Record<string, unknown>,
  ctx: AgentModificationContext,
): string {
  const c = args.conceptName
  const e = args.elementName
  const f = args.fieldName
  switch (op) {
    case 'add_element':
      return `added element ${q(e)} to concept ${q(c)}`
    case 'add_concept':
      return `added concept ${q(c)}`
    case 'add_field':
      return `added field ${q(f)} to concept ${q(c)}`
    case 'update_field':
      return `updated field ${q(f)} on element ${q(e)}`
    case 'remove_element':
      return `removed element ${q(e)} from concept ${q(c)}`
    case 'rename_concept':
      return `renamed concept ${q(c)} to ${q(args.newName)}`
    case 'rename_element':
      return `renamed element ${q(e)} to ${q(args.newName)}`
    case 'generate_index':
      return 'regenerated the model index/taxonomy'
    case 'set_marker':
      return `set marker ${q(args.markerName)}`
    case 'bump_version': {
      const currentVer = ctx.knowledgeVersion ?? ctx.modelVersion ?? '0.1.0'
      const from = ctx.versionTransition?.from ?? currentVer
      const to = ctx.versionTransition?.to ?? String(args.version ?? currentVer)
      return `bumped model version from ${q(from)} to ${q(to)}`
    }
    default:
      return `ran ${op} on the model`
  }
}

/**
 * Build the canonical Agent Modification block for an executed mutation, or
 * `null` when `op` produces no block (`add_marker`, or any unknown op).
 */
export function buildAgentModificationBlock(
  op: string,
  args: Record<string, unknown>,
  ctx: AgentModificationContext,
): string | null {
  const scope = scopeFor(op, args, ctx)
  if (scope === null) return null

  const change = changeFor(op, args, ctx)
  const rationale = ctx.rationale && ctx.rationale.trim() ? ctx.rationale.trim() : '_'
  const approvedBy = ctx.approvedBy === 'user' ? 'user' : 'agent'
  const author = ctx.author && ctx.author.trim() ? ctx.author.trim() : '_'
  const timestamp = ctx.timestamp ?? new Date().toISOString()
  const headingSlug = slugifyHeading(scope)

  const targetId = ctx.knowledge ?? ctx.model ?? ''
  const currentVer = ctx.knowledgeVersion ?? ctx.modelVersion ?? '0.1.0'

  const lines = [
    `## NN Agent Modification: ${headingSlug}`,
    '',
    `scope:: ${scope}`,
    `change:: ${change}`,
    `rationale:: ${rationale}`,
    `approved_by:: ${approvedBy}`,
    `author:: ${author}`,
    `knowledge:: ${targetId}`,
  ]
  if (op === 'bump_version') {
    const from = ctx.versionTransition?.from ?? currentVer
    const to = ctx.versionTransition?.to ?? String(args.version ?? currentVer)
    lines.push(`version_transition:: ${from} → ${to}`)
  }
  lines.push(`knowledge_version:: ${currentVer}`)
  lines.push(`timestamp:: ${timestamp}`)

  return lines.join('\n') + '\n'
}
