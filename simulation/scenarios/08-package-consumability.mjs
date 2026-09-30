/**
 * S08 — Consuming the library the way an integrator would.
 *
 * `@cognnitive/innfo-core` is the contract every surface stands on: the editor,
 * innfo-mcp, and any third party embedding iNNfo. It declares itself an ESM
 * Node package. This scenario asks the simplest possible question: can a plain
 * Node program import it?
 */
import { createScenario } from '../lib/harness.mjs'
import { nodeEsmImportWorks, loadCore } from '../lib/core.mjs'

export default async function run() {
  const s = createScenario('S08', 'Consuming innfo-core from plain Node',
    'An integrator runs `npm i @cognnitive/innfo-core` and writes `import { parseKnowledge } from ...` in a Node script.')

  try {
    const direct = await nodeEsmImportWorks()
    s.expect(
      'The published package imports under plain Node ESM',
      direct,
      (v) => v.ok === true,
      'package.json declares "type":"module" and "main":"./dist/index.js" — Node must be able to load it',
    )

    const core = await loadCore()
    s.expect(
      'Once bundled, the public API surface is complete and usable',
      { exportCount: Object.keys(core).length, sample: ['parseKnowledge', 'serializeKnowledge', 'applyMutation', 'validateDocument'].filter((k) => k in core) },
      (v) => v.sample.length === 4,
      'the API itself is fine — only the module format blocks plain-Node consumption',
    )

    s.observe(
      'Why every existing consumer hides this',
      'innfo-editor resolves through Vite, the test suites through Vitest, innfo-mcp through tsup — all bundlers, all of which tolerate extensionless directory imports that Node rejects.',
    )
  } catch (err) {
    s.crash('scenario execution', err)
  }
  return s
}
