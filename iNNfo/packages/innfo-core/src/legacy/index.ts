// legacy:nn-rename/quarantine

export type {
  DomainReader,
  LegacySignal,
  LegacySignalType,
  DetectLegacyResult,
} from './detect.js'
export { detectLegacy } from './detect.js'

export type Op =
  | { op: 'move'; from: string; to: string }
  | { op: 'write'; path: string; content: string }
  | { op: 'delete'; path: string }

export interface Problem {
  path?: string
  message: string
  severity: 'error' | 'warning'
}

export interface MigratedTree {
  files: Record<string, string> // path -> content
}

export interface MigrationReport {
  renamedFiles: Array<{ from: string; to: string }>
  rewrittenFiles: string[]
  customBlueprints: string[]
  unmappedBlueprints: string[]
  problems: Problem[]
  summary: string
}

export interface PlanDeps {
  targets: Record<string, { version: string; spec: string }>
  validate(tree: MigratedTree, targets: PlanDeps['targets']): Problem[]
}

export interface PlanResult {
  status: 'ready' | 'noop' | 'blocked'
  ops: Op[]
  problems: Problem[]
  report: MigrationReport
  planHash: string
}

export { planMigration } from './language-map.js'
