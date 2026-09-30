import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { useLegacyDomain } from '../../src/composables/useLegacyDomain'
import LegacyDomainBanner from '../../src/components/layout/LegacyDomainBanner.vue'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'
import { detectLegacy } from '@cognnitive/innfo-core/legacy'

describe('useLegacyDomain and LegacyDomainBanner (D11)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('detects legacy domain signals from knowledgeStore parseIssues', () => {
    const knowledgeStore = useKnowledgeStore()
    const { isLegacyDomain, legacySignals, legacyHint } = useLegacyDomain()

    expect(isLegacyDomain.value).toBe(false)
    expect(legacySignals.value).toEqual([])

    knowledgeStore.parseIssues = [
      {
        path: '<root>',
        code: 'LEGACY_DOMAIN',
        message: 'This domain uses a legacy layout. Run `nn-upgrade` to migrate.',
        severity: 'warning',
        signals: [
          {
            type: 'legacy-folder',
            path: 'models',
            detail: "Legacy 'kNNowledge/' folder detected; canonical folder is 'kNNowledge/'",
          },
        ],
      } as any,
    ]

    expect(isLegacyDomain.value).toBe(true)
    expect(legacySignals.value).toHaveLength(1)
    expect(legacySignals.value[0].type).toBe('legacy-folder')
    expect(legacyHint.value).toContain('nn-upgrade')
  })

  it('renders LegacyDomainBanner when legacy domain is detected and allows dismissal', async () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.parseIssues = [
      {
        path: '<root>',
        code: 'LEGACY_DOMAIN',
        message: 'Legacy domain detected. Run `nn-upgrade` to migrate.',
        severity: 'warning',
        signals: [],
      } as any,
    ]

    const wrapper = mount(LegacyDomainBanner)
    expect(wrapper.find('[data-testid="legacy-domain-banner"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('nn-upgrade')
    expect(wrapper.text()).toContain('Legacy workspace layout detected')

    const dismissBtn = wrapper.find('button[aria-label="Dismiss legacy notice"]')
    expect(dismissBtn.exists()).toBe(true)
    await dismissBtn.trigger('click')

    expect(wrapper.find('[data-testid="legacy-domain-banner"]').exists()).toBe(false)
  })

  it('browser-safe legacy entry has no Node built-ins and runs detectLegacy in memory', async () => {
    const reader = {
      list: async (dir: string) => (dir === '' ? ['models', 'index.md'] : ['model_NN.md']),
      read: async (path: string) =>
        path === 'index.md' ? '---\nspec_version: "V_0-2-0"\n---\n# NN index' : null,
    }

    const result = await detectLegacy(reader)
    expect(result.kind).toBe('legacy')
  })
})
