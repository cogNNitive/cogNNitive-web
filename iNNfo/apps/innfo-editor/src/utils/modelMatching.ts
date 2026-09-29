import { parseFrontmatter } from '@cognnitive/innfo-core'
import type { ModelNode } from '../model/types'

/**
 * Returns true if the node represents a Level 2 template, Level 1 spec, or spec node.
 */
export function isTemplateNode(node: ModelNode | undefined): boolean {
  if (!node) return true
  if (node.id.startsWith('spec:')) return true
  if (node.rawContent) {
    try {
      const fm = parseFrontmatter(node.rawContent)
      if (Number(fm?.level) === 3 || fm?.knowledge_version) return false
      if (fm?.kind === 'template' || fm?.kind === 'spec') return true
      if (Array.isArray(fm?.concepts) && fm.concepts.length > 0 && !fm?.parent_spec) return true
    } catch {
      // silent
    }
  }
  const pathOrName = node.source?.path || node.name || ''
  if (/_template_NN\.md$/i.test(pathOrName) || /_spec_NN\.md$/i.test(pathOrName)) return true
  return false
}

/**
 * Normalizes a model path or reference by stripping enclosing double brackets,
 * trimming, and normalizing backslashes to forward slashes.
 */
export function normalizeModelPath(raw: string): string {
  if (!raw) return ''
  return raw
    .trim()
    .replace(/^\[{2}\s*/, '')
    .replace(/\s*\]{2}$/, '')
    .trim()
    .replace(/\\/g, '/')
}

/**
 * Extracts the model filename without extension from a path or identifier.
 */
export function extractModelBasename(raw: string): string {
  const norm = normalizeModelPath(raw)
  const filename = norm.split('/').pop() || norm
  return filename.replace(/\.md$/i, '')
}

/**
 * Finds a matching ModelNode in a collection of nodes by comparing ID, name,
 * source path, or basename, handling cross-platform slash differences and .md extensions.
 */
export function findMatchingModelNode(
  nodes: Record<string, ModelNode | undefined> | Array<ModelNode | undefined>,
  target: string | null | undefined,
): ModelNode | undefined {
  if (!target || typeof target !== 'string') return undefined

  const cleanTarget = normalizeModelPath(target).toLowerCase()
  if (!cleanTarget) return undefined
  const targetBase = extractModelBasename(cleanTarget).toLowerCase()

  const list = Array.isArray(nodes) ? nodes : Object.values(nodes)

  // 1. Exact ID, name, or normalized source path match
  for (const n of list) {
    if (!n) continue
    if (n.id.toLowerCase() === cleanTarget) return n
    if (n.name.toLowerCase() === cleanTarget) return n
    const nodePath = normalizeModelPath(n.source?.path || '').toLowerCase()
    if (nodePath && nodePath === cleanTarget) return n
  }

  // 2. Basename match (e.g. "rejas_rehabilitacion" matching "models/rejas_rehabilitacion_NN.md")
  if (targetBase) {
    for (const n of list) {
      if (!n) continue
      const nodePath = normalizeModelPath(n.source?.path || '').toLowerCase()
      const nodeBase = extractModelBasename(nodePath || n.name || n.id).toLowerCase()
      if (nodeBase && nodeBase === targetBase) return n
      if (n.name.toLowerCase() === targetBase) return n
      if (n.id.toLowerCase() === targetBase) return n
    }
  }

  // 3. Suffix match (e.g. target is "models/foo.md" and nodePath is "foo.md" or vice versa)
  for (const n of list) {
    if (!n) continue
    const nodePath = normalizeModelPath(n.source?.path || '').toLowerCase()
    if (
      nodePath &&
      (nodePath.endsWith('/' + cleanTarget) ||
        cleanTarget.endsWith('/' + nodePath) ||
        (targetBase && nodePath.replace(/\.md$/i, '').endsWith(targetBase)))
    ) {
      return n
    }
  }

  return undefined
}

/**
 * Returns true when a model file name corresponds to a model id under the
 * same basename/suffix semantics used by findMatchingModelNode. Used to
 * decide which workspace folder contains a model without parsing it
 * (deep-link workspace resolution).
 */
export function modelStemMatches(fileName: string, modelId: string): boolean {
  const fileStem = fileName
    .replace(/_NN\.md$/i, '')
    .replace(/\.md$/i, '')
    .toLowerCase()
  const target = extractModelBasename(modelId)
    .replace(/_NN\.md$/i, '')
    .replace(/\.md$/i, '')
    .toLowerCase()
  if (!fileStem || !target) return false
  if (fileStem === target) return true
  return fileStem.endsWith(`_${target}`)
}
