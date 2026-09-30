import { readFile, writeFile, rm, stat, rename, readdir } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import {
  parseKnowledge,
  serializeKnowledge,
  validateKnowledge as coreValidate,
  applyMutation as coreApplyMutation,
  resolveBlueprintSchema,
  buildAgentModificationBlock,
} from '@cognnitive/innfo-core'
import type { SpecDocument, ParsedKnowledge, BlueprintSchema } from '@cognnitive/innfo-core'
import { findKnowledgeFile } from './spec.js'
import { isLocalPath, toLocalFilePath, saveSpecOnce } from './resolver-node.js'
import { createSpecsBackupZip } from './spec-backup.js'
import { loadKnowledge, saveKnowledge, resolveBlueprintForKnowledge } from './knowledge-io.js'
import { DEFAULT_WORKSPACE_IGNORE } from './validate.js'

export interface ApplyChangeResult {
  success: boolean
  model?: ParsedKnowledge
  newPath?: string
  errors?: Array<{ path: string; message: string }>
  warnings?: Array<{ path: string; message: string }>
  /**
   * Agent Modification provenance block for a SUCCESSFUL mutation — the
   * canonical `## NN Agent Modification` block the agent pastes verbatim into
   * its reply. Absent on every failure. Optional and backward-compatible.
   */
  modification?: string
}

/** Read the optional provenance context the caller threaded through `args`. */
function modificationContext(args: Record<string, unknown>): {
  rationale?: string
  approvedBy?: 'user' | 'agent'
  author?: string
} {
  const rationale = typeof args.rationale === 'string' ? args.rationale : undefined
  const approvedBy = args.approved_by === 'user' ? 'user' : undefined
  const author =
    typeof args.author === 'string' && args.author.trim() !== '' ? args.author.trim() : undefined
  return { rationale, approvedBy, author }
}

/** Matches the `_V_<major>-<minor>-<patch>_` segment in iNNfo filenames. */
const VERSION_FILENAME_RE = /_V_\d+-\d+-\d+_/

interface VersionParts {
  major: number
  minor: number
  patch: number
}

/** Parse `V_0-4-0`, `V_0.4.0`, `0-4-0`, ... into numeric parts. */
function parseVersion(v: string): VersionParts | null {
  const m = v.trim().match(/^V?_?(\d+)[-.](\d+)[-.](\d+)$/i)
  if (!m) return null
  return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), patch: parseInt(m[3], 10) }
}

function formatVersion(p: VersionParts): string {
  return `V_${p.major}-${p.minor}-${p.patch}`
}

/**
 * Compute the new model version from bump_version args.
 * Either an explicit `version` ("V_0-5-0") or a `bump` of
 * "major" | "minor" | "patch" (default patch) applied to the current
 * `knowledge_version` frontmatter. Returns null when the args are invalid.
 */
function computeNewVersion(
  current: string | undefined,
  args: Record<string, unknown>,
): { version: string } | null {
  if (typeof args.version === 'string' && args.version.trim() !== '') {
    const parsed = parseVersion(args.version)
    if (!parsed) return null
    return { version: formatVersion(parsed) }
  }

  const bump = typeof args.bump === 'string' && args.bump.trim() !== '' ? args.bump.trim() : 'patch'
  if (!['major', 'minor', 'patch'].includes(bump)) return null
  if (!current) return null
  const parts = parseVersion(current)
  if (!parts) return null
  if (bump === 'major') parts.major += 1
  else if (bump === 'minor') parts.minor += 1
  else parts.patch += 1
  return { version: formatVersion(parts) }
}

async function findAllWorkspaceModelFiles(dir: string, ignore: Set<string>): Promise<string[]> {
  const results: string[] = []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || ignore.has(entry.name.toLowerCase())) continue
      const sub = await findAllWorkspaceModelFiles(join(dir, entry.name), ignore)
      results.push(...sub)
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.md') &&
      entry.name.toLowerCase() !== 'index.md'
    ) {
      results.push(join(dir, entry.name))
    }
  }
  return results
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cascadeModelReferences(
  model: ParsedKnowledge,
  oldBase: string,
  newBase: string,
): boolean {
  const oldStem = oldBase.replace(/\.md$/i, '')
  const newStem = newBase.replace(/\.md$/i, '')
  const wikiLinkRe = new RegExp(`\\[\\[${escapeRegex(oldStem)}(\\s*(?:::|\\]\\]))`, 'g')

  let changed = false

  const updateStr = (val: string): string => {
    let next = val
    if (next.includes(oldBase)) {
      next = next.replaceAll(oldBase, newBase)
      changed = true
    }
    if (wikiLinkRe.test(next)) {
      next = next.replaceAll(wikiLinkRe, `[[${newStem}$1`)
      changed = true
    }
    if (next.trim() === oldStem) {
      next = newStem
      changed = true
    }
    return next
  }

  const updateValue = (v: unknown): unknown => {
    if (typeof v === 'string') return updateStr(v)
    if (Array.isArray(v)) return v.map(updateValue)
    if (v && typeof v === 'object') {
      const obj = { ...(v as Record<string, unknown>) }
      for (const [k, val] of Object.entries(obj)) {
        obj[k] = updateValue(val)
      }
      return obj
    }
    return v
  }

  // 1. Frontmatter
  if (model.frontmatter) {
    for (const [k, v] of Object.entries(model.frontmatter)) {
      const updated = updateValue(v)
      if (updated !== v) {
        ;(model.frontmatter as Record<string, unknown>)[k] = updated
        changed = true
      }
    }
  }

  // 2. Elements
  for (const [, elements] of model.elements.entries()) {
    for (const el of elements) {
      if (el.fields) {
        for (const [fKey, fVal] of Object.entries(el.fields)) {
          const updated = updateValue(fVal)
          if (updated !== fVal) {
            el.fields[fKey] = updated as any
            changed = true
          }
        }
      }
      if (el.description && typeof el.description === 'string') {
        const next = updateStr(el.description)
        if (next !== el.description) {
          el.description = next
          changed = true
        }
      }
      if (Array.isArray((el as any).relationships)) {
        for (const rel of (el as any).relationships) {
          if (rel && typeof rel.target === 'string') {
            const next = updateStr(rel.target)
            if (next !== rel.target) {
              rel.target = next
              changed = true
            }
          }
        }
      }
    }
  }

  // 3. Raw sections
  if (model.rawSections) {
    for (const [sKey, sVal] of Object.entries(model.rawSections)) {
      if (typeof sVal === 'string') {
        const next = updateStr(sVal)
        if (next !== sVal) {
          model.rawSections[sKey] = next
          changed = true
        }
      }
    }
  }

  return changed
}

/**
 * Apply the `bump_version` operation: set `frontmatter.knowledge_version`, rename
 * the file to the canonical `_V_<version>_` filename, validate BEFORE writing,
 * and reject-without-writing on any failure.
 */
async function bumpVersion(
  rootDir: string,
  filePath: string,
  model: ParsedKnowledge,
  args: Record<string, unknown>,
  id: string,
): Promise<ApplyChangeResult> {
  const prevVersion = String(model.frontmatter.knowledge_version ?? model.frontmatter.blueprint_version ?? '')
  const next = computeNewVersion(prevVersion, args)
  if (!next) {
    return {
      success: false,
      errors: [
        {
          path: 'frontmatter.knowledge_version',
          message:
            'Invalid version args for bump_version: provide { version: "V_x-y-z" } or { bump: "major" | "minor" | "patch" } against a valid version frontmatter',
        },
      ],
    }
  }

  if (model.frontmatter.knowledge_version === undefined && model.frontmatter.blueprint_version !== undefined) {
    model.frontmatter.blueprint_version = next.version
  } else {
    model.frontmatter.knowledge_version = next.version
  }

  // A pre-write backup is taken when the caller asked for one, or when the
  // `specs/` tree has uncommitted changes. If a backup was judged necessary
  // and then fails, abort the bump — do NOT rename/delete spec files without
  // the safety net that was deemed required.
  let backupNeeded = args.backup === true || args.prompt_backup === true
  if (!backupNeeded) {
    try {
      const { execSync } = await import('node:child_process')
      const gitStatus = execSync('git status --porcelain specs', {
        cwd: rootDir,
        encoding: 'utf-8',
      })
      backupNeeded = gitStatus.trim() !== ''
    } catch (err) {
      // log + continue: git unavailable — no dirty-tree signal, so no auto-backup.
      console.warn(`[apply-change] git status probe failed; skipping dirty-tree backup: ${err}`)
    }
  }
  if (backupNeeded) {
    try {
      await createSpecsBackupZip(rootDir)
    } catch (err) {
      return {
        success: false,
        errors: [
          {
            path: '',
            message: `Pre-write specs backup failed — bump_version aborted before any file was changed: ${
              err instanceof Error ? err.message : String(err)
            }`,
          },
        ],
      }
    }
  }

  const dir = dirname(filePath)
  const base = basename(filePath)
  const versionSegment = next.version.replace(/^V_/i, '')
  const newBase = base.replace(VERSION_FILENAME_RE, `_V_${versionSegment}_`)
  const newPath = join(dir, newBase)

  // If parent_version is provided, rename/bump the parent spec (template) as well!
  let oldParentPath: string | null = null
  let newParentPath: string | null = null
  let parentContent: string | null = null
  let newParentName: string | null = null
  // SpecDocument view of the just-bumped local parent, built once the new
  // frontmatter is serialized below. Used as the validation `template` when
  // resolveBlueprintForKnowledge can't yet see the bump (the new file hasn't been
  // written to disk at this point in the flow).
  let localParentBlueprint: SpecDocument | null = null

  if (model.frontmatter.parent_spec && typeof args.parent_version === 'string') {
    const parentVer = args.parent_version.trim()
    const parentVerSegment = parentVer.replace(/^V_/i, '').replace(/\./g, '-')
    const parentVerString = `V_${parentVerSegment}`

    const currentParentUrl = model.frontmatter.parent_spec.url
    const localParentPath =
      currentParentUrl && isLocalPath(currentParentUrl)
        ? toLocalFilePath(currentParentUrl, rootDir)
        : null
    if (localParentPath) {
      try {
        await stat(localParentPath)
        oldParentPath = localParentPath

        // Compute new parent file name and path
        const parentDir = dirname(localParentPath)
        const parentBase = basename(localParentPath)
        const newParentBase = parentBase.replace(VERSION_FILENAME_RE, `_V_${parentVerSegment}_`)
        newParentPath = join(parentDir, newParentBase)

        // Compute new parent spec name
        const currentParentName = model.frontmatter.parent_spec.name
        newParentName = currentParentName.replace(/_V_\d+-\d+-\d+$/, `_V_${parentVerSegment}`)

        // Read and update the template file's frontmatter
        const rawParentContent = await readFile(localParentPath, 'utf-8')
        const parentModel = parseKnowledge(rawParentContent)
        if (parentModel.frontmatter.level === 2) {
          parentModel.frontmatter.spec_version = parentVerString
        }
        parentContent = serializeKnowledge(parentModel)
        localParentBlueprint = {
          name: newParentName,
          level: parentModel.frontmatter.level ?? 0,
          parentName: parentModel.frontmatter.parent_spec?.name,
          parentUrl: parentModel.frontmatter.parent_spec?.url,
          frontmatter: parentModel.frontmatter,
          rawContent: parentContent,
        }
      } catch (err) {
        // log + continue: parent spec not found locally — skip template
        // renaming but still update references.
        console.warn(`[apply-change] Local parent spec not found; template rename skipped: ${err}`)
      }
    }

    // Update parent_spec in model frontmatter
    if (model.frontmatter.parent_spec.name && newParentName) {
      model.frontmatter.parent_spec.name = newParentName
    }
    if (model.frontmatter.parent_spec.url) {
      model.frontmatter.parent_spec.url = model.frontmatter.parent_spec.url.replace(
        VERSION_FILENAME_RE,
        `_V_${parentVerSegment}_`,
      )
    }
  }

  // Validate BEFORE writing/deleting anything.
  let template: SpecDocument | null
  let resolveInclude: (ref: { name: string; url: string }) => string | null = () => null
  try {
    if (parentContent && newParentName) {
      template = localParentBlueprint
      const r = await resolveBlueprintForKnowledge(rootDir, model).catch(() => ({
        template: localParentBlueprint,
        resolveInclude: () => null,
      }))
      template = r.template ?? localParentBlueprint
      resolveInclude = r.resolveInclude
    } else {
      const r = await resolveBlueprintForKnowledge(rootDir, model)
      template = r.template
      resolveInclude = r.resolveInclude
    }
  } catch (err) {
    return {
      success: false,
      errors: [{ path: 'parent_spec', message: err instanceof Error ? err.message : String(err) }],
    }
  }
  const validationResult = coreValidate(model, template, null, resolveInclude)
  if (!validationResult.valid) {
    return {
      success: false,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
    }
  }

  // 4. Pre-mutation validation of referencing workspace models
  const affectedModels: Array<{ filePath: string; model: ParsedKnowledge }> = []
  const oldBaseResolved = resolve(filePath)
  const oldStem = base.replace(/\.md$/i, '')
  const allModelFiles = await findAllWorkspaceModelFiles(rootDir, DEFAULT_WORKSPACE_IGNORE)

  for (const mFile of allModelFiles) {
    if (resolve(mFile) === oldBaseResolved) continue
    try {
      const raw = await readFile(mFile, 'utf-8')
      if (!raw.includes(base) && !raw.includes(oldStem)) continue
      const parsed = parseKnowledge(raw)
      const changed = cascadeModelReferences(parsed, base, newBase)
      if (changed) {
        let depBlueprint: SpecDocument | null = null
        let depResolveInclude: (ref: { name: string; url: string }) => string | null = () => null
        try {
          const r = await resolveBlueprintForKnowledge(rootDir, parsed)
          depBlueprint = r.template
          depResolveInclude = r.resolveInclude
        } catch (err) {
          return {
            success: false,
            errors: [
              {
                path: relative(rootDir, mFile).replace(/\\/g, '/'),
                message: `Failed to resolve template for referencing model ${basename(mFile)}: ${
                  err instanceof Error ? err.message : String(err)
                }`,
              },
            ],
          }
        }
        const check = coreValidate(parsed, depBlueprint, null, depResolveInclude)
        if (!check.valid) {
          return {
            success: false,
            errors: check.errors.map((e) => ({
              ...e,
              path: `${relative(rootDir, mFile).replace(/\\/g, '/')}${e.path ? '#' + e.path : ''}`,
            })),
            warnings: check.warnings,
          }
        }
        affectedModels.push({ filePath: mFile, model: parsed })
      }
    } catch (err) {
      return {
        success: false,
        errors: [
          {
            path: relative(rootDir, mFile).replace(/\\/g, '/'),
            message: `Failed to process referencing model ${basename(mFile)}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          },
        ],
      }
    }
  }

  // Write the new versioned files (or rewrite in place), then remove the old.
  try {
    // 1. If parent template was bumped:
    if (oldParentPath && newParentPath && parentContent && newParentName) {
      if (newParentPath === oldParentPath) {
        await writeFile(oldParentPath, parentContent, 'utf-8')
      } else {
        await writeFile(newParentPath, parentContent, 'utf-8')
        await rm(oldParentPath, { force: true })
      }

      // Mirror into specs/ too (write-once, atomic — see resolver-node.ts),
      // so later resolutions find the bumped template without a re-fetch.
      const specsDir = join(rootDir, 'specs')
      await saveSpecOnce(specsDir, `${newParentName}_NN.md`, parentContent)
    }

    // 2. Write target model file
    if (newPath === filePath) {
      await saveKnowledge(filePath, model)
    } else {
      await saveKnowledge(newPath, model)
      await rm(filePath, { force: true })
    }

    // 3. Write all affected referencing models
    for (const affected of affectedModels) {
      await saveKnowledge(affected.filePath, affected.model)
    }

    // 4. Update references in workspace index.md
    const indexPath = join(rootDir, 'index.md')
    try {
      let indexContent = await readFile(indexPath, 'utf-8')
      const oldRelPath = basename(filePath)
      const newRelPath = basename(newPath)

      const oldModelRel = join('models', oldRelPath).replace(/\\/g, '/')
      const newModelRel = join('models', newRelPath).replace(/\\/g, '/')

      let replaced = false
      if (indexContent.includes(oldRelPath)) {
        indexContent = indexContent.replaceAll(oldRelPath, newRelPath)
        replaced = true
      }
      if (indexContent.includes(oldModelRel)) {
        indexContent = indexContent.replaceAll(oldModelRel, newModelRel)
        replaced = true
      }

      if (replaced) {
        await writeFile(indexPath, indexContent, 'utf-8')
      }
    } catch (err) {
      // swallow deliberately: index.md might not exist or be readable.
      if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        console.warn(`[apply-change] Failed to update index.md: ${err}`)
      }
    }
  } catch (err) {
    return { success: false, errors: [{ path: '', message: `Failed to write model: ${err}` }] }
  }

  return {
    success: true,
    model,
    newPath,
    warnings: validationResult.warnings,
    modification:
      buildAgentModificationBlock('bump_version', args, {
        model: id,
        knowledge: id,
        knowledgeVersion: next.version,
        modelVersion: next.version,
        versionTransition: { from: prevVersion, to: next.version },
        ...modificationContext(args),
      }) ?? undefined,
  }
}

/**
 * Apply an intent-level change to a model.
 * Semantics: parse → mutate → serialize → validate.
 * On failure: reject-without-writing (file unchanged, errors returned).
 */
export async function applyChange(
  rootDir: string,
  id: string,
  op: string,
  args: Record<string, unknown>,
): Promise<ApplyChangeResult> {
  const filePath = await findKnowledgeFile(rootDir, id)
  if (!filePath) {
    return { success: false, errors: [{ path: '', message: `Model not found: ${id}` }] }
  }

  let model: ParsedKnowledge
  try {
    model = await loadKnowledge(filePath)
  } catch (err) {
    return { success: false, errors: [{ path: '', message: `Failed to load model: ${err}` }] }
  }

  if (op === 'bump_version') {
    return bumpVersion(rootDir, filePath, model, args, id)
  }

  if (op === 'generate_index') {
    try {
      const { template: idxBlueprint, resolveInclude: idxInclude } = await resolveBlueprintForKnowledge(
        rootDir,
        model,
      )
      if (idxBlueprint) {
        // Compose the taxonomy across `includes` too, not just the composite.
        const { schema } = resolveBlueprintSchema(idxBlueprint.rawContent, idxInclude)
        args.taxonomy = schema.taxonomy.length
          ? schema.taxonomy
          : parseKnowledge(idxBlueprint.rawContent).taxonomy
      }
    } catch (err) {
      // log + continue: template not resolvable — generate_index falls back to
      // the model taxonomy.
      console.warn(`[apply-change] Index template resolution failed; using model taxonomy: ${err}`)
    }
  }

  // Apply the mutation via the core enforcement engine (R-IE-01). For
  // `rename_element`, pass the resolved parent-template schema so the
  // reference rewrite is gated on `type:: reference` fields (C3): plain
  // string fields are never rewritten as bare scalars.
  let renameSchema: BlueprintSchema | undefined
  if (op === 'rename_element') {
    try {
      const { template: schemaBlueprint, resolveInclude: schemaInclude } =
        await resolveBlueprintForKnowledge(rootDir, model)
      if (schemaBlueprint) {
        renameSchema = resolveBlueprintSchema(schemaBlueprint.rawContent, schemaInclude).schema
      }
    } catch (err) {
      // log + continue: without the resolved schema the rename runs untyped
      // (no reference-field gating), never aborts.
      console.warn(`[apply-change] Schema resolution failed for rename; untyped rename: ${err}`)
      renameSchema = undefined
    }
  }
  const mutationResult = coreApplyMutation(
    model,
    op,
    args as unknown as Record<string, unknown>,
    renameSchema,
  )
  if (!mutationResult.success) {
    return mutationResult
  }

  // Validate after mutation — template resolved only from parent_spec.url.
  // Schema + structural conformance only (mutations are structurally enforced
  // by the core engine above); document-hygiene is the job of `validate_model`
  // / `init_model` on the resulting file, not of every intermediate mutation.
  let template: SpecDocument | null
  let resolveInclude: (ref: { name: string; url: string }) => string | null = () => null
  try {
    const r = await resolveBlueprintForKnowledge(rootDir, model)
    template = r.template
    resolveInclude = r.resolveInclude
  } catch (err) {
    return {
      success: false,
      errors: [{ path: 'parent_spec', message: err instanceof Error ? err.message : String(err) }],
    }
  }
  const validationResult = coreValidate(model, template, null, resolveInclude)

  if (!validationResult.valid) {
    // Reject without writing
    return {
      success: false,
      errors: validationResult.errors,
      warnings: validationResult.warnings,
    }
  }

  // Write updated model
  try {
    await saveKnowledge(filePath, model)
    if (
      op === 'rename_element' &&
      typeof args.elementName === 'string' &&
      typeof args.newName === 'string'
    ) {
      try {
        const modelDir = dirname(filePath)
        const oldSlug = args.elementName.toLowerCase().replace(/[^a-z0-9-]/g, '_')
        const newSlug = args.newName.toLowerCase().replace(/[^a-z0-9-]/g, '_')
        const oldAssetDir = join(modelDir, 'assets', oldSlug)
        const newAssetDir = join(modelDir, 'assets', newSlug)
        const st = await stat(oldAssetDir).catch(() => null)
        if (st && st.isDirectory()) {
          await rename(oldAssetDir, newAssetDir)
        }
      } catch (err) {
        // log + continue: asset directory rename is best effort.
        console.warn(`[apply-change] Asset dir rename failed: ${err}`)
      }
    }
  } catch (err) {
    return { success: false, errors: [{ path: '', message: `Failed to write model: ${err}` }] }
  }

  return {
    success: true,
    model,
    warnings: validationResult.warnings,
    modification:
      buildAgentModificationBlock(op, args, {
        model: id,
        knowledge: id,
    knowledgeVersion: String(model.frontmatter.knowledge_version ?? model.frontmatter.blueprint_version ?? ''),
        ...modificationContext(args),
      }) ?? undefined,
  }
}
