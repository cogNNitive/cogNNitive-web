/**
 * nn-conntent/scripts/lib/changes.mjs
 *
 * The only way the engine writes a document: a changeset written with
 * `writeProposedChangeset` and applied with `executeChangesetApply`, both reached
 * through the core mirror (design A10). The engine never edits a document in place.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseChangeset, writeProposedChangeset, executeChangesetApply } = require('./nn-core.generated.cjs');

export const ENGINE_AUTHOR = 'engine';

export class ChangesetError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ChangesetError';
    this.code = code;
    this.details = details;
  }
}

function firstProblem(result) {
  const errors = result?.errors || [];
  const first = errors[0];
  if (!first) return { code: 'changeset-rejected', message: 'The changeset was rejected without a reported error.' };
  return { code: first.code || 'changeset-rejected', message: first.message || String(first) };
}

/**
 * Writes one engine changeset and applies it. Throws `ChangesetError` when the apply
 * engine rejects it, so a caller never continues on a half-written document.
 * @param {string} rootDir
 * @param {Array<Record<string, unknown>>} changes
 * @param {{ title?: string, author?: string }} [meta]
 */
export async function applyChanges(rootDir, changes, meta = {}) {
  const written = await writeProposedChangeset(rootDir, {
    changes,
    title: meta.title || 'engine changeset',
    author: meta.author || ENGINE_AUTHOR,
  });
  const result = await executeChangesetApply(rootDir, written.absolutePath);
  if (!result.success) {
    const problem = firstProblem(result);
    throw new ChangesetError(problem.code, problem.message, { changesetPath: result.changesetPath });
  }
  return { changesetPath: result.changesetPath, appliedCount: result.appliedCount, result };
}

/**
 * Applies an existing changeset FILE (the agent's proposal). Throws `ChangesetError` on
 * rejection, so intake never continues on a half-written document.
 * @param {string} rootDir
 * @param {string} changesetPath
 */
export async function applyChangesetFile(rootDir, changesetPath) {
  const result = await executeChangesetApply(rootDir, changesetPath);
  if (!result.success) {
    const problem = firstProblem(result);
    throw new ChangesetError(problem.code, problem.message, { changesetPath: result.changesetPath });
  }
  return { changesetPath: result.changesetPath, appliedCount: result.appliedCount, result };
}

/** `update_field` op for one element field. */
export function fieldChange(modelSlug, elementSlug, field, to, from) {
  const change = { op: 'update_field', target: `${modelSlug}@${elementSlug}&${field}`, to };
  if (from !== undefined) change.from = from;
  return change;
}

/** `remove_element` op. */
export function removeElement(modelSlug, elementSlug, concept) {
  return { op: 'remove_element', target: `${modelSlug}@${elementSlug}`, concept };
}

/**
 * Apply every proposed HUMAN console changeset waiting under `changes/` (the console
 * download fallback). The engine uses the same writer/apply path, so the human-origin
 * policy of `executeChangesetApply` is the one that decides. A non-human or non-console
 * proposal is left untouched (an agent's proposal goes through review, never here).
 *
 * @param {string} rootDir
 * @returns {Promise<Array<{ changeset: string, changesetPath?: string, success: boolean, status?: string }>>}
 */
export async function applyPendingHumanChangesets(rootDir) {
  const dir = path.join(rootDir, 'changes');
  if (!fs.existsSync(dir)) return [];
  const applied = [];
  for (const entry of fs.readdirSync(dir).sort()) {
    if (!entry.endsWith('.md') || entry.endsWith('_spec_NN.md')) continue;
    let doc;
    try {
      doc = parseChangeset(fs.readFileSync(path.join(dir, entry), 'utf8'));
    } catch {
      continue;
    }
    if (doc.frontmatter?.status !== 'proposed') continue;
    if (doc.frontmatter.author_kind !== 'human' || doc.frontmatter.origin !== 'console') continue;
    const result = await executeChangesetApply(rootDir, path.join(dir, entry));
    applied.push({
      changeset: entry,
      changesetPath: result.changesetPath,
      success: Boolean(result.success),
      status: result.status,
      // The engine's reasons, so the intake can name them instead of only "(rejected)".
      errors: result.errors || [],
    });
  }
  return applied;
}

/** Only the workspace files a changeset apply needs, so a dry apply is cheap. */
function copyApplyScaffold(rootDir, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const name of ['domaiNN_NN.md', 'video-defaults_NN.md', 'model-catalog_NN.md']) {
    const src = path.join(rootDir, name);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dest, name));
  }
  const specs = path.join(rootDir, 'specs');
  if (fs.existsSync(specs)) fs.cpSync(specs, path.join(dest, 'specs'), { recursive: true });
  const series = path.join(rootDir, 'series');
  if (fs.existsSync(series)) fs.cpSync(series, path.join(dest, 'series'), { recursive: true });
  fs.mkdirSync(path.join(dest, 'changes'), { recursive: true });
}

/**
 * Applies a proposed changeset to a THROWAWAY copy of the workspace and reads the
 * result, so an invalid proposal changes nothing (capability video-produce-command
 * "Intake Applies The Proposed Changeset"). The caller validates the returned
 * document and only then applies for real.
 *
 * @param {{ rootDir: string, episodePath: string, changesetPath: string, tempDir?: string }} input
 * @returns {Promise<{ ok: boolean, text?: string, problem?: { code: string, message: string } }>}
 */
export async function dryApply({ rootDir, episodePath, changesetPath, tempDir }) {
  const sandbox = tempDir || fs.mkdtempSync(path.join(os.tmpdir(), 'nn-produce-dry-'));
  try {
    copyApplyScaffold(rootDir, sandbox);
    const innerEpisode = path.join(sandbox, path.relative(rootDir, episodePath));
    const innerChangeset = path.join(sandbox, 'changes', 'dry_engine_changes_NN.md');
    fs.writeFileSync(innerChangeset, fs.readFileSync(changesetPath, 'utf8'), 'utf8');
    const result = await executeChangesetApply(sandbox, innerChangeset);
    if (!result.success) return { ok: false, problem: firstProblem(result) };
    return { ok: true, text: fs.readFileSync(innerEpisode, 'utf8') };
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }
}
