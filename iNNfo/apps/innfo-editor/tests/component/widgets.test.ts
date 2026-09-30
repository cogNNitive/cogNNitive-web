import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TextWidget from '../../src/shared/widgets/TextWidget.vue'
import WeightWidget from '../../src/shared/widgets/WeightWidget.vue'
import CategoryWidget from '../../src/shared/widgets/CategoryWidget.vue'
import FieldString from '../../src/shared/widgets/FieldString.vue'
import FieldNumber from '../../src/shared/widgets/FieldNumber.vue'
import FieldSelect from '../../src/shared/widgets/FieldSelect.vue'
import FileRefPill from '../../src/components/editor/FileRefPill.vue'
import { resolveWidgetComponent } from '../../src/shared/widgets'

describe('TextWidget (fixture-exercised concept type "text")', () => {
  it('renders the current text value in a text input', () => {
    const wrapper = mount(TextWidget, { props: { modelValue: 'Hello world' } })
    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).value).toBe('Hello world')
  })

  it('emits update:modelValue when the user types', async () => {
    const wrapper = mount(TextWidget, { props: { modelValue: '' } })
    const input = wrapper.get('input')
    await input.setValue('New text')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['New text'])
  })
})

describe('WeightWidget (fixture-exercised concept type "weight")', () => {
  it('renders the current numeric value in a number input', () => {
    const wrapper = mount(WeightWidget, { props: { modelValue: 5 } })
    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).value).toBe('5')
  })

  it('emits update:modelValue as a number when the user types', async () => {
    const wrapper = mount(WeightWidget, { props: { modelValue: 0 } })
    const input = wrapper.get('input')
    await input.setValue('7')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([7])
  })
})

describe('CategoryWidget (fixture-exercised concept type "category")', () => {
  it('renders the current value among the provided options', () => {
    const wrapper = mount(CategoryWidget, {
      props: { modelValue: 'B', options: ['A', 'B', 'C'] },
    })
    const select = wrapper.get('select')
    expect((select.element as HTMLSelectElement).value).toBe('B')
  })

  it('emits update:modelValue when the user picks a different option', async () => {
    const wrapper = mount(CategoryWidget, {
      props: { modelValue: 'A', options: ['A', 'B', 'C'] },
    })
    const select = wrapper.get('select')
    await select.setValue('C')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['C'])
  })
})

describe('FieldSelect (field-type widget for select fields)', () => {
  it('renders options from options prop', () => {
    const wrapper = mount(FieldSelect, {
      props: { modelValue: 'B', options: ['A', 'B', 'C'] },
    })
    const select = wrapper.get('select')
    expect((select.element as HTMLSelectElement).value).toBe('B')
    const options = wrapper.findAll('option')
    expect(options.length).toBe(4) // - Select - + A, B, C
  })

  it('renders options from fieldDefinition prop', () => {
    const wrapper = mount(FieldSelect, {
      props: {
        modelValue: 'C',
        fieldDefinition: {
          name: 'status',
          type: 'select',
          options: ['A', 'B', 'C'],
        },
      },
    })
    const select = wrapper.get('select')
    expect((select.element as HTMLSelectElement).value).toBe('C')
    const options = wrapper.findAll('option')
    expect(options.length).toBe(4) // - Select - + A, B, C
  })

  it('emits update:modelValue when the user picks a different option', async () => {
    const wrapper = mount(FieldSelect, {
      props: { modelValue: 'A', options: ['A', 'B', 'C'] },
    })
    const select = wrapper.get('select')
    await select.setValue('C')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['C'])
  })
})

describe('FieldString (field-type widget for string fields)', () => {
  it('renders the current string value in a text input', () => {
    const wrapper = mount(FieldString, { props: { modelValue: 'Hello world' } })
    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).value).toBe('Hello world')
  })

  it('emits update:modelValue when the user types', async () => {
    const wrapper = mount(FieldString, { props: { modelValue: '' } })
    const input = wrapper.get('input')
    await input.setValue('New text')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['New text'])
  })

  it('renders one FileRefPill per valid entry when modelValue is an array of source refs (readonly)', () => {
    const wrapper = mount(FieldString, {
      props: {
        modelValue: ['sources/nn/a.md#intro', 'sources/nn/b/c.md#methodology'],
        readonly: true,
      },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('a.md')
    expect(wrapper.text()).toContain('c.md')
    expect(wrapper.findAllComponents(FileRefPill).length).toBe(2)
  })

  it('falls back to plain text for array entries that are not valid source refs (readonly)', () => {
    const wrapper = mount(FieldString, {
      props: {
        modelValue: ['not a ref', 'sources/nn/valid.md'],
        readonly: true,
      },
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.text()).toContain('not a ref')
    expect(wrapper.text()).toContain('valid.md')
  })

  it('does not crash when modelValue is an array in edit mode, and joins values for the raw text input', () => {
    const wrapper = mount(FieldString, {
      props: {
        modelValue: ['sources/nn/a.md', 'sources/nn/b.md'],
        readonly: false,
      },
    })
    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).value).toBe(
      'sources/nn/a.md, sources/nn/b.md',
    )
  })
})

describe('FieldNumber (field-type widget for number fields)', () => {
  it('renders the current numeric value in a number input', () => {
    const wrapper = mount(FieldNumber, { props: { modelValue: 42 } })
    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).value).toBe('42')
  })

  it('emits update:modelValue as a number when the user types', async () => {
    const wrapper = mount(FieldNumber, { props: { modelValue: 0 } })
    const input = wrapper.get('input')
    await input.setValue('7')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([7])
  })

  it('coerces empty string to 0', () => {
    const wrapper = mount(FieldNumber, { props: { modelValue: 5 } })
    const input = wrapper.get('input')
    // Simulating clearing the input
    input.element.innerHTML = ''
    // The onInput handler converts '' to 0
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

import FieldReference from '../../src/shared/widgets/FieldReference.vue'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'

describe('FieldReference (field-type widget for reference fields)', () => {
  it('renders BlockPill in readonly mode when target node exists with WikiLink syntax', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const knowledgeStore = useKnowledgeStore()
    knowledgeStore.setGraph(
      {
        'Salón-Comedor': {
          id: 'Salón-Comedor',
          name: 'Salón-Comedor',
          parentId: null,
          childIds: [],
          type: 'Component',
          fields: {},
          markers: {},
          relationships: [],
          rawSections: {},
          source: { path: 'Salón-Comedor' },
        },
      },
      ['Salón-Comedor'],
    )

    const wrapper = mount(FieldReference, {
      props: { modelValue: '[[Salón-Comedor]]', readonly: true },
      global: { plugins: [pinia] },
    })

    expect(wrapper.findComponent({ name: 'Pill' }).exists()).toBe(true)
    expect(wrapper.text()).toContain('Salón-Comedor')
  })
})

describe('widget registry: resolveWidgetComponent (R15 "Ported widget renders known type")', () => {
  it('resolves "text" to TextWidget', () => {
    expect(resolveWidgetComponent('text')).toBe(TextWidget)
  })

  it('resolves "weight" to WeightWidget', () => {
    expect(resolveWidgetComponent('weight')).toBe(WeightWidget)
  })

  it('resolves "category" to CategoryWidget', () => {
    expect(resolveWidgetComponent('category')).toBe(CategoryWidget)
  })

  it('resolves "string" to FieldString', () => {
    expect(resolveWidgetComponent('string')).toBe(FieldString)
  })

  it('resolves "number" to FieldNumber', () => {
    expect(resolveWidgetComponent('number')).toBe(FieldNumber)
  })

  it('resolves an unported type to undefined, signalling the caller to use FallbackWidget', () => {
    expect(resolveWidgetComponent('steps')).toBeUndefined()
    expect(resolveWidgetComponent('sequence')).toBeUndefined()
    expect(resolveWidgetComponent('list')).toBeUndefined()
    // boolean, select, reference are now ported in Phase 4 — no longer unported
    expect(resolveWidgetComponent('matrix')).toBeUndefined()
  })
})
