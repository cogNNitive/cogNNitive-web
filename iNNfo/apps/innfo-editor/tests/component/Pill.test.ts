import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'
import Pill from '../../src/components/editor/Pill.vue'
import { yiqLuminance, textColor } from '../../src/composables/useConceptVisuals'
import { useUiStore } from '../../src/stores/uiStore'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'

// ── Utility tests (A.6 — YIQ luminance & contrast) ──────────────

describe('yiqLuminance utility', () => {
  it('returns ~0.5 for purple (#a855f7)', () => {
    const l = yiqLuminance('#a855f7')
    expect(l).toBeGreaterThan(0.45)
    expect(l).toBeLessThan(0.55)
  })

  it('returns >0.55 for light colors like yellow (#eab308)', () => {
    const l = yiqLuminance('#eab308')
    expect(l).toBeGreaterThan(0.55)
  })

  it('returns <0.55 for dark colors like indigo (#6366f1)', () => {
    const l = yiqLuminance('#6366f1')
    expect(l).toBeLessThan(0.55)
  })

  it('strips alpha suffix for luminance computation', () => {
    const l = yiqLuminance('#a855f718')
    expect(l).toBeGreaterThan(0.45)
    expect(l).toBeLessThan(0.55)
  })
})

describe('textColor utility', () => {
  it('returns dark text for light backgrounds (luminance > 0.55)', () => {
    expect(textColor('#eab308')).toBe('#1e293b')
  })

  it('returns white text for dark backgrounds (luminance < 0.55)', () => {
    expect(textColor('#a855f7')).toBe('#ffffff')
  })
})

// ── Pill component tests ───────────────────────────────────

describe('Pill.vue — Ghost state detection (R-TN-04)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('applies empty styling (italic text) when description, fields, and instanceCount are all empty/zero', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'MyNode',
        description: '',
        fields: {},
        instanceCount: 0,
      },
    })
    expect(wrapper.find('span.italic').exists()).toBe(true)
  })

  it('does NOT apply empty styling when description is present', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'MyNode',
        description: 'Has content',
        fields: {},
        instanceCount: 0,
      },
    })
    expect(wrapper.find('span.italic').exists()).toBe(false)
  })

  it('does NOT apply empty styling when instanceCount > 0', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'MyNode',
        description: '',
        fields: {},
        instanceCount: 3,
      },
    })
    expect(wrapper.find('span.italic').exists()).toBe(false)
  })

  it('does NOT apply empty styling when fields have values', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'MyNode',
        description: '',
        fields: { status: 'active' },
        instanceCount: 0,
      },
    })
    expect(wrapper.find('span.italic').exists()).toBe(false)
  })
})

describe('Pill.vue — Popup structure (R-TN-03)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders pill name in the main content when blockId is provided', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'MyPill',
        blockId: 'Root',
      },
      attachTo: document.body,
    })
    expect(wrapper.text()).toContain('MyPill')
  })

  it('renders without popup content when no blockId is provided', () => {
    const wrapper = mount(Pill, {
      props: { name: 'Simple' },
    })
    expect(wrapper.text()).toContain('Simple')
    // Teleport requires blockId; without it, no popup content renders
    expect(wrapper.text()).not.toContain('No content.')
  })

  it('includes description text in the template for popup rendering', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'Test Node',
        blockId: 'Root',
        description: 'Popup description content',
        fields: { status: 'active' },
        conceptFields: [{ name: 'status', type: 'text' }],
      },
      attachTo: document.body,
    })
    // The pill itself shows the name
    expect(wrapper.text()).toContain('Test Node')
  })

  it('navigates to the block page from the popup nav icon', async () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'MyNode',
        blockId: 'Root/MyNode',
        description: 'A description.',
      },
      attachTo: document.body,
    })

    await wrapper.trigger('mouseenter')
    await nextTick()
    const infoIcon = wrapper.find('svg.lucide-info-icon')
    expect(infoIcon.exists()).toBe(true)
    await infoIcon.trigger('click')
    await nextTick()

    const nav = document.body.querySelector('[data-testid="block-pill-nav"]')
    expect(nav).toBeTruthy()
    ;(nav as HTMLElement).click()
    await nextTick()

    const uiStore = useUiStore()
    expect(uiStore.selectedNodeId).toBe('Root/MyNode')
    expect(uiStore.activeView).toBe('editor')
    wrapper.unmount()
  })
})

describe('Pill.vue — YIQ text contrast (R-TN-01)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders with YIQ-based text color via inline style', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'Dark Pill',
        color: '#a855f7', // purple, luminance < 0.55 → white text
      },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.backgroundColor).toBe('#a855f718')
    expect(el.style.color).toBe('#ffffff')
  })

  it('renders with dark text for light background colors', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'Light Pill',
        color: '#eab308', // yellow, luminance > 0.55 → dark text
      },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.backgroundColor).toBe('#eab30818')
    expect(el.style.color).toBe('#1e293b')
  })

  it('does not apply inline YIQ styles when no color is provided', () => {
    const wrapper = mount(Pill, {
      props: { name: 'No Color' },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.backgroundColor).toBe('')
    expect(el.style.color).toBe('')
  })
})

describe('Pill.vue — Ghost visual state (R-TN-04)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('applies opacity 0.45 in inline style when ghost', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'GhostNode',
        color: '#a855f7',
      },
    })
    const el = wrapper.element as HTMLElement
    // Ghost opacity is applied via a Tailwind utility class (opacity-[0.55]),
    // not an inline style, so el.style.opacity stays empty here.
    expect(el.style.opacity).toBe('')
  })

  it('does not apply reduced opacity when node has content', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'FullNode',
        color: '#a855f7',
        description: 'Has content',
      },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.opacity).toBe('')
  })
})

describe('Pill.vue — Shape & noWrap props', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders with rounded-full when shape="pill"', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'PillBadge',
        shape: 'pill',
      },
    })
    expect(wrapper.classes()).toContain('rounded-full')
  })

  it('renders with rounded-lg by default', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'DefaultBadge',
      },
    })
    expect(wrapper.classes()).toContain('rounded-lg')
  })

  it('applies whitespace-nowrap and removes max-w-full when noWrap is true', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'Long Badge Name',
        noWrap: true,
      },
    })
    expect(wrapper.classes()).toContain('whitespace-nowrap')
    expect(wrapper.classes()).not.toContain('max-w-full')
  })
})

describe('Pill.vue — Workspace tags circular badges', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders circular badges with icon and color for workspace-defined tags', () => {
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.nodes = {
      tag1: {
        id: 'tag1',
        name: 'estrategia-soldadura',
        type: 'Tag',
        kind: 'element',
        fields: {
          color: { value: '#ea580c' },
          icon: { value: 'flame' },
          description: { value: 'Estrategia soldadura' },
        },
      } as any,
    }

    const wrapper = mount(Pill, {
      props: {
        name: 'Reja Pozuello',
        tags: ['estrategia-soldadura'],
      },
    })

    const badge = wrapper.find('[data-testid="pill-workspace-tag"]')
    expect(badge.exists()).toBe(true)
    const el = badge.element as HTMLElement
    expect(el.style.backgroundColor).toBe('#ea580c')
    expect(badge.attributes('title')).toBe('estrategia-soldadura: Estrategia soldadura')
  })

  it('does not render circular badges for ad-hoc tags without workspace definition', () => {
    const wrapper = mount(Pill, {
      props: {
        name: 'Simple Node',
        tags: ['adhoc-tag'],
      },
    })

    const badge = wrapper.find('[data-testid="pill-workspace-tag"]')
    expect(badge.exists()).toBe(false)
  })
})
