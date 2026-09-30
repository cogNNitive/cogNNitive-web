import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ModelInfoPanel from '../../src/components/editor/ModelInfoPanel.vue'
import { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { useModelStore } from '../../src/stores/modelStore'
import type { ModelNode } from '../../src/model/types'

function makeNode(id: string, overrides: Partial<ModelNode> = {}): ModelNode {
  return {
    id,
    name: id,
    parentId: null,
    childIds: [],
    storageMode: 'FILE' as const,
    type: 'text',
    fields: {},
    markers: {},
    relationships: [],
    rawSections: {},
    source: { path: id },
    ...overrides,
  }
}

const rootContentWithVersion = `---
spec_version: "V_0-1-5"
knowledge_version: "V_1-2-3"
title: "Versioned Model"
---

# _F Versioned Model

A model with a version field.
`

const rootContentWithoutVersion = `---
spec_version: "V_0-1-5"
title: "Unversioned Model"
---

# _F Unversioned Model

A model without explicit version.
`

const rootContentWithParentSpec = `---
spec_version: "V_0-2-0"
parent_spec:
  name: "business_V_0-2-0"
  url: "https://raw.githubusercontent.com/cogNNitive/cogNNitive/main/iNNfo/specs/v0.2.0/level2/business/business_V_0-2-0_NN.md"
knowledge_version: "V_1-0-0"
title: "Business Model"
---

# _F Business Model
`

describe('ModelInfoPanel.vue — Version Management (R-VM-01, R-VM-06)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('shows current version from model frontmatter', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          kind: 'concept',
          childIds: [],
          rawContent: rootContentWithVersion,
          source: { path: 'Model_V_1-2-3_Template_F.md' },
        }),
      },
      ['Root'],
    )

    const wrapper = mount(ModelInfoPanel, {
      props: { rootNodeId: 'Root' },
    })

    // The header should show "V_1-2-3" in the collapsible header
    // First click to expand the version panel
    const versionHeaders = wrapper.findAll('h3')
    // Find the Version Management header
    const versionHeader = versionHeaders.find((h3) => h3.text().includes('Version Management'))
    expect(versionHeader).toBeDefined()

    // Click to expand
    const collapsibleDiv = wrapper
      .findAll('.cursor-pointer')
      .find((el) => el.text().includes('Version Management'))!
    await collapsibleDiv.trigger('click')

    // Now the expanded panel should show the current version
    const versionDisplay = wrapper.find('[data-testid="current-version-display"]')
    expect(versionDisplay.exists()).toBe(true)
    expect(versionDisplay.text()).toContain('V_1-2-3')
  })

  it('defaults to V_1-0-0 when no knowledge_version in frontmatter', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          kind: 'concept',
          childIds: [],
          rawContent: rootContentWithoutVersion,
          source: { path: 'Model_V_1-0-0_Template_F.md' },
        }),
      },
      ['Root'],
    )

    const wrapper = mount(ModelInfoPanel, {
      props: { rootNodeId: 'Root' },
    })

    // Expand the panel
    const collapsibleDiv = wrapper
      .findAll('.cursor-pointer')
      .find((el) => el.text().includes('Version Management'))!
    await collapsibleDiv.trigger('click')

    // Should show default V_1-0-0
    const versionDisplay = wrapper.find('[data-testid="current-version-display"]')
    expect(versionDisplay.exists()).toBe(true)
    expect(versionDisplay.text()).toContain('V_1-0-0')
  })

  it('shows three bump buttons with version previews', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          kind: 'concept',
          childIds: [],
          rawContent: rootContentWithVersion,
          source: { path: 'Model_V_1-2-3_Template_F.md' },
        }),
      },
      ['Root'],
    )
    // Set up a workspace handle so buttons are not disabled
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = { name: 'test' } as any
    workspaceStore.hasHandle = true

    const wrapper = mount(ModelInfoPanel, {
      props: { rootNodeId: 'Root' },
    })

    // Expand panel
    const collapsibleDiv = wrapper
      .findAll('.cursor-pointer')
      .find((el) => el.text().includes('Version Management'))!
    await collapsibleDiv.trigger('click')

    // There should be 3 buttons
    const buttons = wrapper.findAll('.grid-cols-3 button')
    expect(buttons).toHaveLength(3)

    // Button text should contain bump level names
    const buttonText = buttons.map((b) => b.text())
    const allText = buttonText.join(' ')
    expect(allText).toContain('Major')
    expect(allText).toContain('Minor')
    expect(allText).toContain('Patch')

    // Should show version previews
    expect(allText).toContain('V_2-0-0') // major
    expect(allText).toContain('V_1-3-0') // minor
    expect(allText).toContain('V_1-2-4') // patch
  })

  it('bump buttons show hover tooltip with version preview', async () => {
    const modelStore = useModelStore()
    modelStore.setGraph(
      {
        Root: makeNode('Root', {
          kind: 'concept',
          childIds: [],
          rawContent: rootContentWithVersion,
          source: { path: 'Model_V_1-2-3_Template_F.md' },
        }),
      },
      ['Root'],
    )
    const workspaceStore = useWorkspaceStore()
    workspaceStore.handle = { name: 'test' } as any
    workspaceStore.hasHandle = true

    const wrapper = mount(ModelInfoPanel, {
      props: { rootNodeId: 'Root' },
    })

    const collapsibleDiv = wrapper
      .findAll('.cursor-pointer')
      .find((el) => el.text().includes('Version Management'))!
    await collapsibleDiv.trigger('click')

    const buttons = wrapper.findAll('.grid-cols-3 button')
    expect(buttons.length).toBeGreaterThanOrEqual(3)

    // Check title attributes for version preview format "V_1-2-3 → V_X-Y-Z"
    const titles = buttons.map((b) => b.attributes('title'))
    expect(titles[0]).toContain('→')
    expect(titles[0]).toContain('V_1-2-3')
  })

  describe('Disabled states (R-VM-06)', () => {
    it('buttons are disabled when no workspace handle is connected', async () => {
      const modelStore = useModelStore()
      modelStore.setGraph(
        {
          Root: makeNode('Root', {
            kind: 'concept',
            childIds: [],
            rawContent: rootContentWithVersion,
          }),
        },
        ['Root'],
      )
      // Deliberately no handle set

      const wrapper = mount(ModelInfoPanel, {
        props: { rootNodeId: 'Root' },
      })

      const collapsibleDiv = wrapper
        .findAll('.cursor-pointer')
        .find((el) => el.text().includes('Version Management'))!
      await collapsibleDiv.trigger('click')

      const buttons = wrapper.findAll('.grid-cols-3 button')
      buttons.forEach((btn) => {
        expect(btn.attributes('disabled')).toBeDefined()
        // Should have opacity class
        expect(btn.classes()).toContain('opacity-50')
        expect(btn.classes()).toContain('cursor-not-allowed')
      })
    })

    it('shows tooltip explaining why buttons are disabled', async () => {
      const modelStore = useModelStore()
      modelStore.setGraph(
        {
          Root: makeNode('Root', {
            kind: 'concept',
            childIds: [],
            rawContent: rootContentWithVersion,
          }),
        },
        ['Root'],
      )

      const wrapper = mount(ModelInfoPanel, {
        props: { rootNodeId: 'Root' },
      })

      const collapsibleDiv = wrapper
        .findAll('.cursor-pointer')
        .find((el) => el.text().includes('Version Management'))!
      await collapsibleDiv.trigger('click')

      // Check that a disabled reason message is shown
      const reasonText = wrapper.find('.text-amber-500')
      expect(reasonText.exists()).toBe(true)
      expect(reasonText.text()).toContain('Connect a workspace')
    })

    it('buttons are disabled when saving is in progress', async () => {
      const modelStore = useModelStore()
      modelStore.setGraph(
        {
          Root: makeNode('Root', {
            kind: 'concept',
            childIds: [],
            rawContent: rootContentWithVersion,
          }),
        },
        ['Root'],
      )
      const workspaceStore = useWorkspaceStore()
      workspaceStore.handle = { name: 'test' } as any
      workspaceStore.hasHandle = true
      workspaceStore.saving = true // Saving in progress

      const wrapper = mount(ModelInfoPanel, {
        props: { rootNodeId: 'Root' },
      })

      const collapsibleDiv = wrapper
        .findAll('.cursor-pointer')
        .find((el) => el.text().includes('Version Management'))!
      await collapsibleDiv.trigger('click')

      const buttons = wrapper.findAll('.grid-cols-3 button')
      buttons.forEach((btn) => {
        expect(btn.attributes('disabled')).toBeDefined()
      })
    })

    it('buttons are disabled when there is no root node', async () => {
      // Don't set up modelStore at all (no root)
      const workspaceStore = useWorkspaceStore()
      workspaceStore.handle = { name: 'test' } as any
      workspaceStore.hasHandle = true

      const wrapper = mount(ModelInfoPanel, {
        props: { rootNodeId: 'Root' },
      })

      const collapsibleDiv = wrapper
        .findAll('.cursor-pointer')
        .find((el) => el.text().includes('Version Management'))!
      await collapsibleDiv.trigger('click')

      const buttons = wrapper.findAll('.grid-cols-3 button')
      buttons.forEach((btn) => {
        expect(btn.attributes('disabled')).toBeDefined()
      })
    })

    it('does not render the Active Model Stack pills anymore', () => {
      const modelStore = useModelStore()
      modelStore.setGraph(
        {
          Root: makeNode('Root', {
            kind: 'concept',
            childIds: [],
            rawContent: rootContentWithVersion,
            source: { path: 'MyModel_NN.md' },
          }),
        },
        ['Root'],
      )

      const wrapper = mount(ModelInfoPanel, {
        props: { rootNodeId: 'Root' },
      })

      expect(wrapper.find('[data-testid="info-panel-model-stack"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('Active Model Stack:')
    })

    it('shows the template name instead of the version in the Name field', () => {
      const modelStore = useModelStore()
      modelStore.setGraph(
        {
          Root: makeNode('Root', {
            kind: 'concept',
            childIds: [],
            rawContent: rootContentWithParentSpec,
            source: { path: 'MyModel_NN.md' },
          }),
        },
        ['Root'],
      )

      const wrapper = mount(ModelInfoPanel, {
        props: { rootNodeId: 'Root' },
      })

      const templateSection = wrapper.findAll('div').find((el) => el.text().includes('2. Template'))!
      expect(templateSection.text()).toContain('Name:')
      expect(templateSection.text()).toContain('business_V_0-2-0')
      expect(templateSection.text()).toContain('Version:')
      expect(templateSection.text()).toContain('V_0-2-0')
      // The Name field must not fall back to a bare version string
      expect(templateSection.text()).not.toContain('V_0-1-0')
    })
  })

  describe('parseFrontmatter widening deltas (design.md)', () => {
    it('reads a nested `template.version` field that is not the first key of its YAML block', () => {
      const rootContentNestedVersionNotFirstKey = `---
spec_version: "V_0-2-0"
template:
  name: "business_V_0-2-0"
  version: "V_0-3-0"
knowledge_version: "V_1-0-0"
title: "Nested Version Model"
---

# _F Nested Version Model
`
      const modelStore = useModelStore()
      modelStore.setGraph(
        {
          Root: makeNode('Root', {
            kind: 'concept',
            childIds: [],
            rawContent: rootContentNestedVersionNotFirstKey,
            source: { path: 'MyModel_NN.md' },
          }),
        },
        ['Root'],
      )

      const wrapper = mount(ModelInfoPanel, {
        props: { rootNodeId: 'Root' },
      })

      const templateSection = wrapper.findAll('div').find((el) => el.text().includes('2. Template'))!
      expect(templateSection.text()).toContain('Version:')
      // The explicit nested `template.version` must win even though it is
      // NOT the first key of the `template:` block — the old regex-based
      // extractNestedFieldValue only matched the first key and silently
      // fell back to deriving "V_0-2-0" from the template name instead.
      expect(templateSection.text()).toContain('V_0-3-0')
    })

    it('readString() coerces YAML-typed number/boolean scalars into strings (unquoted scalar delta)', async () => {
      // `useModelFrontmatter.ts` does not exist yet — this import is expected
      // to fail until task 5.1 creates it (RED by "code does not exist yet").
      const { readString } = await import('../../src/components/editor/composables/useModelFrontmatter')

      // The old regex-based extraction always produced a string (it read raw
      // text off the page). `parseFrontmatter` parses real YAML, so an
      // unquoted scalar like `knowledge_version: 1.5` arrives as a JS `number`,
      // and an unquoted `true`/`false` arrives as a JS `boolean`. Every
      // caller downstream (e.g. `parseVersionString(str: string)`, which
      // calls `.match()`) requires a string — without this adapter a numeric
      // YAML scalar would crash the component at render time.
      expect(readString(1.5)).toBe('1.5')
      expect(readString(true)).toBe('true')
      expect(readString(false)).toBe('false')
      // Strings pass through unchanged (trimmed) — the widening never
      // narrows already-valid string values.
      expect(readString('V_1-2-3')).toBe('V_1-2-3')
      expect(readString('  padded  ')).toBe('padded')
      // Absent values stay absent so callers can still apply `??`/`||` fallbacks.
      expect(readString(null)).toBeNull()
      expect(readString(undefined)).toBeNull()
    })

    it('renders a `knowledge_version` unquoted numeric YAML scalar without crashing once wired to useModelFrontmatter', async () => {
      const rootContentUnquotedNumericVersion = `---
spec_version: "V_0-1-5"
knowledge_version: 1.5
title: "Numeric Version Model"
---

# _F Numeric Version Model
`
      const modelStore = useModelStore()
      modelStore.setGraph(
        {
          Root: makeNode('Root', {
            kind: 'concept',
            childIds: [],
            rawContent: rootContentUnquotedNumericVersion,
            source: { path: 'MyModel_NN.md' },
          }),
        },
        ['Root'],
      )

      // Must not throw: `parseVersionString` calls `.match()` on the raw
      // knowledge_version value. `parseFrontmatter` (unlike the old regex) parses
      // unquoted `1.5` as a YAML number, so `readString()` must coerce it
      // back to a string before it ever reaches `.match()`.
      const wrapper = mount(ModelInfoPanel, {
        props: { rootNodeId: 'Root' },
      })

      const collapsibleDiv = wrapper
        .findAll('.cursor-pointer')
        .find((el) => el.text().includes('Version Management'))!
      await collapsibleDiv.trigger('click')

      // Not a valid "V_M-m-p" pattern, so it can't be parsed into a SemVer —
      // the raw coerced string "1.5" is shown as-is instead of crashing or
      // silently defaulting to "V_1-0-0".
      const versionDisplay = wrapper.find('[data-testid="current-version-display"]')
      expect(versionDisplay.exists()).toBe(true)
      expect(versionDisplay.text()).toContain('1.5')
    })
  })
})
