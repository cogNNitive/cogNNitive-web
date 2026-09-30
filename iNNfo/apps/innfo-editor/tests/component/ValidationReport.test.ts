import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ValidationReport from '../../src/components/ValidationReport.vue'
import { useModelStore } from '../../src/stores/modelStore'
import type { ValidationReport as ValidationReportType } from '../../src/shared/validation-types'

describe('ValidationReport.vue', () => {
  let writeTextMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setActivePinia(createPinia())
    writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    })
  })

  const sampleReport: ValidationReportType = {
    checks: [
      {
        id: 'check-1',
        label: 'Valid Frontmatter Version',
        description: 'Ensures version field is present.',
        category: 'frontmatter',
        severity: 'warning',
        passed: false,
        message: 'Missing version field in frontmatter',
      },
      {
        id: 'check-2',
        label: 'Valid Concept Binding',
        description: 'Checks concept bindings.',
        category: 'body',
        severity: 'info',
        passed: true,
      },
    ],
    summary: {
      total: 2,
      passed: 1,
      errors: 0,
      warnings: 1,
    },
  }

  it('renders summary bar, copy log button and copy AI prompt button', () => {
    const wrapper = mount(ValidationReport, {
      props: { report: sampleReport },
    })

    expect(wrapper.text()).toContain('Validation Summary')
    expect(wrapper.find('[data-testid="copy-log-button"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="copy-ai-prompt-button"]').exists()).toBe(true)
  })

  it('copies raw log when Copy Log button is clicked', async () => {
    const wrapper = mount(ValidationReport, {
      props: { report: sampleReport },
    })

    const copyLogBtn = wrapper.find('[data-testid="copy-log-button"]')
    await copyLogBtn.trigger('click')

    expect(writeTextMock).toHaveBeenCalled()
    const copiedText = writeTextMock.mock.calls[0][0]
    expect(copiedText).toContain('VALIDATION REPORT')
    expect(copiedText).toContain('Missing version field in frontmatter')
  })

  it('copies AI prompt with workspace metadata when Copy Prompt for AI button is clicked', async () => {
    const modelStore = useModelStore()
    modelStore.rootIds = ['root-1']
    modelStore.nodes = {
      'root-1': {
        id: 'root-1',
        name: 'MyTestModel',
        parentId: null,
        childIds: [],
        type: 'document',
        fields: {
          version: {
            value: 'V_1-0-0',
            editAttribution: { author: { kind: 'system', id: 'p' }, timestamp: '' },
          },
          spec_version: {
            value: 'V_0-1-0',
            editAttribution: { author: { kind: 'system', id: 'p' }, timestamp: '' },
          },
          blueprint_name: 'TestTemplate',
          blueprint_version: {
            value: 'V_1-0',
            editAttribution: { author: { kind: 'system', id: 'p' }, timestamp: '' },
          },
        },
        markers: {},
        relationships: [],
        rawSections: {},
        source: { path: 'kNNowledge/my_test_model_NN.md' },
      },
    }

    const wrapper = mount(ValidationReport, {
      props: { report: sampleReport },
    })

    const copyAiPromptBtn = wrapper.find('[data-testid="copy-ai-prompt-button"]')
    await copyAiPromptBtn.trigger('click')

    expect(writeTextMock).toHaveBeenCalled()
    const copiedText = writeTextMock.mock.calls[0][0]
    expect(copiedText).toContain('# iNNfo Model Validation & Fix Request')
    expect(copiedText).toContain('MyTestModel')
    expect(copiedText).toContain('kNNowledge/my_test_model_NN.md')
    expect(copiedText).toContain('Detected Defects & Warnings')
    expect(copiedText).toContain('Missing version field in frontmatter')
    expect(copiedText).toContain('## AI Task & Instructions')
  })

  it('passes parser issue severity through or defaults to warning', () => {
    const modelStore = useModelStore()
    modelStore.rootIds = ['root-1']
    modelStore.nodes = {
      'root-1': {
        id: 'root-1',
        name: 'MyTestModel',
        parentId: null,
        childIds: [],
        type: 'document',
        fields: {},
        markers: {},
        relationships: [],
        rawSections: {},
        source: { path: 'kNNowledge/my_test_model_NN.md' },
      },
    }
    modelStore.parseIssues = [
      { path: 'kNNowledge/my_test_model_NN.md#Alpha', message: 'Warning message', severity: 'warning' },
      { path: 'kNNowledge/my_test_model_NN.md#Beta', message: 'Info message', severity: 'info' },
      { path: 'kNNowledge/my_test_model_NN.md#Gamma', message: 'Default message' },
    ]

    const wrapper = mount(ValidationReport, {
      props: { report: sampleReport },
    })

    const text = wrapper.text()
    expect(text).toContain('Warning message')
    expect(text).toContain('Info message')
    expect(text).toContain('Default message')
  })

  it('renders copy prompt button for checks with promptHint and copies on click', async () => {
    const reportWithPromptHint: ValidationReportType = {
      checks: [
        {
          id: 'check-governance-1',
          label: 'Template Cache Freshness',
          description: 'Checks if local template in specs/ is fresh.',
          category: 'governance',
          severity: 'warning',
          passed: false,
          code: 'TEMPLATE_CACHE_STALE',
          message: 'Template cache differs from remote',
          promptHint: 'Update the template under specs/ with the canonical remote version and re-validate',
        },
      ],
      summary: {
        total: 1,
        passed: 0,
        errors: 0,
        warnings: 1,
      },
    }

    const wrapper = mount(ValidationReport, {
      props: { report: reportWithPromptHint },
    })

    expect(wrapper.text()).toContain('Governance & Freshness')
    expect(wrapper.text()).toContain('Template Cache Freshness')

    const copyBtn = wrapper.find('[data-testid="copy-prompt-hint-button"]')
    expect(copyBtn.exists()).toBe(true)
    expect(copyBtn.text()).toContain('Copy prompt for AI Agent')

    await copyBtn.trigger('click')

    expect(writeTextMock).toHaveBeenCalledWith('Update the template under specs/ with the canonical remote version and re-validate')
    expect(copyBtn.text()).toContain('Copied!')
  })

  it('does not render copy prompt button when check has no promptHint', () => {
    const reportWithoutPromptHint: ValidationReportType = {
      checks: [
        {
          id: 'check-governance-2',
          label: 'Template Cache Freshness',
          description: 'Checks if local template in specs/ is fresh.',
          category: 'governance',
          severity: 'warning',
          passed: false,
          code: 'TEMPLATE_CACHE_STALE',
          message: 'Template cache differs from remote',
        },
      ],
      summary: {
        total: 1,
        passed: 0,
        errors: 0,
        warnings: 1,
      },
    }

    const wrapper = mount(ValidationReport, {
      props: { report: reportWithoutPromptHint },
    })

    const copyBtn = wrapper.find('[data-testid="copy-prompt-hint-button"]')
    expect(copyBtn.exists()).toBe(false)
  })
})
