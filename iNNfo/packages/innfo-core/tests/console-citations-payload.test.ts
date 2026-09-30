import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * C2 — "Resolve Element Citations" / "Inject Data into Shell" steps of the new
 * `workspace/procedures/compile_model_console_NN.md` procedure.
 *
 * These steps are followed by an AI agent reading prose, not by a script in
 * this repo — there is no importable production module to call. Two things
 * are still verifiable without executing the procedure:
 *
 * 1. The procedure text itself documents the exact contract the design and
 *    spec require (elementId source, grouping, dropped `field` key, the
 *    resolution timestamp, and the `<` escaping rule) — scanned below.
 * 2. The escaping algorithm the procedure prose describes is sound. It is
 *    reproduced verbatim as `escapeForScriptInjection` below (mirroring the
 *    procedure's own wording) purely to prove the *documented* technique
 *    actually prevents a `</script>` sequence in a citation excerpt from
 *    breaking the shell, and that `JSON.parse` still recovers the original
 *    data losslessly. This is a fixture-based assertion of the documented
 *    algorithm, not a test of application code.
 */

const here = dirname(fileURLToPath(import.meta.url))
const procedurePath = join(
  here,
  '..',
  '..',
  '..',
  'specs',
  'bluepriNNts',
  'workspace',
  'procedures',
  'compile_model_console_NN.md',
)
const procedure = readFileSync(procedurePath, 'utf8')

describe('compile_model_console_NN.md — Resolve Element Citations step', () => {
  it('calls resolve_sources with the element name, not the slug id', () => {
    expect(procedure).toContain('resolve_sources({model, elementId: el.name})')
    expect(procedure).toContain('not its slug `id`')
  })

  it('groups entries by field and drops the field key from each entry', () => {
    expect(procedure).toContain('group the returned entries by their `field`')
    expect(procedure).toContain('dropping the `field` key from each entry')
  })

  it('embeds an empty-result element without a citations key', () => {
    expect(procedure).toContain('embed no `citations` for that element')
    expect(procedure).toContain('Omit `citations` entirely on an element when its grouped result is empty')
  })

  it('sets meta.citationsResolvedAt once resolution happens', () => {
    expect(procedure).toContain('set the document-level `meta.citationsResolvedAt`')
  })

  it('reports and omits both keys when resolve_sources is unavailable', () => {
    expect(procedure).toContain('If the `resolve_sources` tool is unavailable in this session, omit `citations` and `meta.citationsResolvedAt` entirely')
  })

  it('performs no citation resolution at console runtime', () => {
    expect(procedure).toContain('No citation resolution happens at console runtime')
  })
})

describe('compile_model_console_NN.md — Inject Data into Shell step', () => {
  it('documents escaping every literal < as \\u003c across the full payload, not only excerpts', () => {
    expect(procedure).toContain('escape every literal `<` character as the Unicode escape `\\u003c`')
    expect(procedure).toContain('not only inside citation excerpts')
  })

  it('documents that </script> can never prematurely close the shell', () => {
    expect(procedure).toContain('</script>` sequence occurring anywhere in the data')
  })
})

describe('compile_model_console_NN.md — asset seam', () => {
  it('points the reference shell at the workspace-level asset', () => {
    expect(procedure).toContain(
      'https://raw.githubusercontent.com/cogNNitive/cogNNitive-web/main/iNNfo/specs/bluepriNNts/workspace/assets/model_console.html',
    )
  })

  it('does not touch the business procedure or business/assets/model_viewer.html', () => {
    expect(procedure).not.toContain('business/procedures/compile_model_viewer_NN.md')
    expect(procedure).not.toContain('business/assets/model_viewer.html')
  })
})

/**
 * Reference reproduction of the procedure's documented escaping technique —
 * see the file-level comment above for why this lives inline instead of
 * importing a production module.
 */
function escapeForScriptInjection(json: string): string {
  return json.replace(/</g, '\\u003c')
}

describe('documented < -> \\u003c escaping technique (reference check)', () => {
  it('neutralizes a literal </script> inside a citation excerpt', () => {
    const payload = {
      elements: [
        {
          id: 'el-1',
          citations: {
            sources: [
              {
                path: 'sources/nn/conversations/s1_source.md',
                exists: true,
                field: 'sources',
                origin: 'document',
                excerpt: 'before </script><script>alert(1)</script> after',
              },
            ],
          },
        },
      ],
    }
    const raw = JSON.stringify(payload)
    expect(raw).toContain('</script>')

    const escaped = escapeForScriptInjection(raw)
    expect(escaped).not.toContain('</script>')
    expect(escaped).not.toContain('<script>')

    const shell = `<script type="application/json" id="innfo-model">${escaped}</script>`
    // The only "</script>" substring left in the shell is the real closing
    // tag itself, appended after injection — never an escaped one.
    expect(shell.indexOf('</script>')).toBe(shell.lastIndexOf('</script>'))

    const roundTripped = JSON.parse(escaped) as typeof payload
    expect(roundTripped.elements[0].citations.sources[0].excerpt).toBe(
      'before </script><script>alert(1)</script> after',
    )
  })

  it('leaves a payload with no < characters unchanged', () => {
    const raw = JSON.stringify({ a: 'no angle brackets here' })
    expect(escapeForScriptInjection(raw)).toBe(raw)
  })
})
