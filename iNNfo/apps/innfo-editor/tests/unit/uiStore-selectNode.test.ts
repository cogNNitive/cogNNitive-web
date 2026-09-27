import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUiStore } from '../../src/stores/uiStore'

describe('uiStore.selectNode', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('dismisses the validation report overlay so the new selection is visible', () => {
    const uiStore = useUiStore()
    uiStore.setShowValidationReport(true)

    uiStore.selectNode('Ghostbusters/Root/Element')

    expect(uiStore.selectedNodeId).toBe('Ghostbusters/Root/Element')
    expect(uiStore.showValidationReport).toBe(false)
  })

  it.each([
    'graph',
    'consoles',
    'matrices',
    'info',
    'ai-guide',
    'explorer',
  ] as const)('resets activeView to editor when activeView is %s', (view) => {
    const uiStore = useUiStore()
    uiStore.setActiveView(view)
    expect(uiStore.activeView).toBe(view)

    uiStore.selectNode('Ghostbusters/Root/Element')

    expect(uiStore.selectedNodeId).toBe('Ghostbusters/Root/Element')
    expect(uiStore.activeView).toBe('editor')
  })

  it('preserves activeView when activeView is already editor', () => {
    const uiStore = useUiStore()
    uiStore.setActiveView('editor')

    uiStore.selectNode('Ghostbusters/Root/Element')

    expect(uiStore.selectedNodeId).toBe('Ghostbusters/Root/Element')
    expect(uiStore.activeView).toBe('editor')
  })
})
