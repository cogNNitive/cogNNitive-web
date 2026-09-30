/**
 * S06 — Adding a model file and keeping the workspace index honest.
 *
 * A user drops a new `*_NN.md` into `kNNowledge/`. The workspace manifest
 * (`domaiNN_NN.md`, `# NN Models`) must learn about it without the tool
 * rewriting entries the human owns.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createNodeDirectoryHandle } from '../lib/nodeFs.mjs'
import { createScenario, SIM } from '../lib/harness.mjs'
import { loadCore } from '../lib/core.mjs'

const WS = join(SIM, 'fixtures', 'acme')

export default async function run() {
  const {
    reconcileManifest,
    OWNERSHIP_MARKER,
    recursiveParse,
    buildWorkspaceIndex,
    validateWorkspaceReferences,
    extractBlueprintSchemaFromContent,
  } = await loadCore()
  const s = createScenario('S06', 'Workspace manifest reconciliation',
    'A user adds a model file by hand and expects the workspace index to notice — without losing their own edits.')

  try {
    const manifest = await readFile(join(WS, 'domaiNN_NN.md'), 'utf-8')

    // No change discovered => the manifest must come back untouched.
    const noop = reconcileManifest(manifest, [
      { path: 'kNNowledge/Acme_analysis_NN.md', name: 'Acme Operational Analysis', template: 'analysis' },
    ])
    s.expect(
      'Reconciling an already-correct manifest changes nothing',
      { changes: noop.changes, identical: noop.content === manifest },
      (v) => v.changes.length === 0 && v.identical,
      'no changes and a byte-identical document (the documented round-trip guarantee)',
    )

    // A newly added file is appended.
    const added = reconcileManifest(manifest, [
      { path: 'kNNowledge/Acme_analysis_NN.md', name: 'Acme Operational Analysis', template: 'analysis' },
      { path: 'kNNowledge/Acme_metrics_NN.md', name: 'Acme Operational Metrics', template: 'metrics' },
    ])
    s.expect(
      'A newly added model file is registered in the manifest',
      { changes: added.changes, containsNew: added.content.includes('Acme_metrics_NN.md') },
      (v) => v.changes.some((c) => c.kind === 'added') && v.containsNew,
      'one `added` change and a new `## NN Models:` entry',
    )

    s.expect(
      'Tool-written entries are explicitly marked as tool-owned',
      added.content.split(/\r?\n/).filter((l) => l.includes(OWNERSHIP_MARKER)),
      (lines) => lines.length >= 1,
      `the ownership marker ${OWNERSHIP_MARKER} appears on the generated entry`,
    )

    // A human-authored entry whose file disappeared must NOT be rewritten.
    const removed = reconcileManifest(added.content, [
      { path: 'kNNowledge/Acme_metrics_NN.md', name: 'Acme Operational Metrics', template: 'metrics' },
    ])
    s.expect(
      'A human-owned entry whose file is gone is reported, never silently deleted',
      removed.changes,
      (c) => c.some((x) => x.kind === 'skipped-not-owned' || x.kind === 'archived'),
      'the tool reports it rather than editing something it does not own',
    )

    // Cross-model reference integrity.
    const parsed = await recursiveParse(createNodeDirectoryHandle(WS))

    // The host supplies template schemas; here they come off disk.
    const analysisSchema = extractBlueprintSchemaFromContent(
      await readFile(join(WS, '..', '..', '..', 'iNNfo', 'specs', 'bluepriNNts', 'analysis', 'spec_NN.md'), 'utf-8'),
    )
    const index = buildWorkspaceIndex(parsed, (node) =>
      String(node?.frontmatter?.parent_spec?.name ?? '').startsWith('analysis') ? analysisSchema : null,
    )

    s.observe(
      'validateWorkspaceReferences requires a WorkspaceIndex the type surface does not make obvious',
      'calling it with the index omitted throws a raw TypeError on `index.nodeSchema` rather than a named error',
    )

    s.expect(
      'Workspace-wide reference validation runs clean on a coherent workspace',
      validateWorkspaceReferences(parsed, index).map((d) => ({ code: d.code, severity: d.severity, message: d.message })),
      (d) => d.filter((x) => x.severity === 'error').length === 0,
      'no dangling cross-model references',
    )

    s.observe(
      'Models the workspace scan discovered',
      Object.values(parsed.nodes).filter((n) => n.kind === 'model').map((n) => n.source?.path ?? n.name),
    )
  } catch (err) {
    s.crash('scenario execution', err)
  }
  return s
}
