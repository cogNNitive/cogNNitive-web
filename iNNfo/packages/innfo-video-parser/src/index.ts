import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ScriptParser } from './parser/Parser.js'
import type { ParseResult } from './parser/Parser.js'
import { SemanticValidator } from './parser/SemanticValidator.js'
import type { ValidationIssue } from './parser/validation/types.js'
import type { Project } from './domain/types.js'

export * from './parser/Parser.js'
export * from './parser/Serializer.js'
export * from './parser/validation/types.js'
export * from './domain/types.js'
export { SemanticValidator } from './parser/SemanticValidator.js'
export { version } from './version.js'

/** The vendored VUS specification, hash-verified against the pinned digest. */
export interface VusSpec {
  /** Spec version, e.g. `V_0-3-3`. */
  version: string
  /** sha256 of the vendored file with line endings normalized to LF. */
  sha256: string
  /** Parsed spec content. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  spec: any
}

/** Pinned version of the vendored spec; changing it requires vendoring a new file. */
const VUS_SPEC_VERSION = 'V_0-3-3'

/**
 * Walks up from this module to the package root (the folder holding package.json).
 * The hash must be taken over the vendored file in the package's own `specs/`
 * folder, never over the copy `tsc` re-serializes into `dist/`.
 */
function packageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir)
    if (parent === dir) throw new Error('innfo-video-parser: package root not found')
    dir = parent
  }
  return dir
}

function loadVusSpec(): VusSpec {
  const file = join(packageRoot(), 'specs', `${VUS_SPEC_VERSION}.json`)
  let text = readFileSync(file, 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const normalized = text.replace(/\r\n/g, '\n')
  const sha256 = createHash('sha256').update(normalized, 'utf8').digest('hex')
  return { version: VUS_SPEC_VERSION, sha256, spec: JSON.parse(normalized) }
}

export const VUS_SPEC: VusSpec = loadVusSpec()

/**
 * Parses VUS script text into a Project and the issues found while parsing
 * (the semantic validator already runs as part of parsing).
 */
export function parse(text: string, title?: string): ParseResult {
  return ScriptParser.parse(text, title)
}

/** Runs the semantic validation rules over an already-parsed Project. */
export function validate(project: Project): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  SemanticValidator.validate(project, issues)
  return issues
}
