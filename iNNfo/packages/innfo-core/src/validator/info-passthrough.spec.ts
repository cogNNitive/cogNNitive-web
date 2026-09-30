import { describe, it, expect } from 'vitest'
import { formatCheckToDiagnostic } from './document.js'
import { reportCheckFromWarning } from './knowledge.js'

describe('info severity passthrough (validator-robustness Unit 1)', () => {
  it('maps a failed info format check to an info diagnostic preserving code and hint', () => {
    expect(
      formatCheckToDiagnostic({
        id: 'body-note',
        label: 'Document notice blockquote',
        description: 'Body should start with a notice',
        category: 'body',
        severity: 'info',
        passed: false,
        message: 'Missing notice',
        code: 'BODY_NOTICE',
        promptHint: 'Add a > [!NOTE] blockquote.',
        meta: { section: 'body' },
      }),
    ).toEqual({
      path: 'format.body-note',
      message: 'Missing notice',
      severity: 'info',
      code: 'BODY_NOTICE',
      promptHint: 'Add a > [!NOTE] blockquote.',
      meta: { section: 'body' },
    })
  })

  it('maps failed error and warning format checks preserving severity', () => {
    expect(
      formatCheckToDiagnostic({
        id: 'fm-level',
        label: 'Model level is 3',
        description: 'level must be 3',
        category: 'frontmatter',
        severity: 'error',
        passed: false,
        message: 'Missing level field',
      })?.severity,
    ).toBe('error')
    expect(
      formatCheckToDiagnostic({
        id: 'conv-file-naming',
        label: 'File naming convention',
        description: 'must end with _NN.md',
        category: 'convention',
        severity: 'warning',
        passed: false,
        message: '"x.md" does not end with _NN.md',
      })?.severity,
    ).toBe('warning')
  })

  it('drops passed checks of every severity including info', () => {
    for (const severity of ['error', 'warning', 'info'] as const) {
      expect(
        formatCheckToDiagnostic({
          id: 'fm-title',
          label: 'Title present',
          description: 'title must be present',
          category: 'frontmatter',
          severity,
          passed: true,
        }),
      ).toBeNull()
    }
  })

  it('maps an info warning-bucket diagnostic to an info report check', () => {
    const check = reportCheckFromWarning(
      {
        path: 'format.bom',
        message: 'BOM stripped',
        severity: 'info',
        code: 'BOM_WARNING',
        promptHint: 'Save as UTF-8 without BOM.',
        meta: { stripped: true },
      },
      'tpl',
    )
    expect(check).toMatchObject({
      severity: 'info',
      passed: false,
      code: 'BOM_WARNING',
      promptHint: 'Save as UTF-8 without BOM.',
    })
  })

  it('keeps warning severity for warning-bucket diagnostics without info', () => {
    const check = reportCheckFromWarning(
      { path: 'parent.concepts.Task', message: 'lacks guidance', severity: 'warning' },
      'tpl',
    )
    expect(check.severity).toBe('warning')
    expect(check.passed).toBe(false)
  })
})
