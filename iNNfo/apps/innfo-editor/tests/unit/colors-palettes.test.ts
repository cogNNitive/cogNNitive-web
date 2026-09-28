import { describe, it, expect } from 'vitest'
import { getColorClasses } from '../../src/utils/colors'
import { useBlockVisuals } from '../../src/composables/useBlockVisuals'

describe('colors.ts palettes & useBlockVisuals', () => {
  it('resolves grey palette with light grey background and dark text for concepts', () => {
    const palette = getColorClasses('grey')
    expect(palette.selectedBg).toContain('bg-slate-100')
    expect(palette.conceptText).toContain('text-slate-900')

    const visuals = useBlockVisuals({
      kind: 'concept',
      color: 'grey',
    })

    const classes = visuals.containerClasses.value.join(' ')
    expect(classes).toContain('bg-slate-100')
    expect(classes).toContain('text-slate-900')
  })

  it('resolves purple palette with solid purple background and white text for Models', () => {
    const palette = getColorClasses('purple')
    expect(palette.selectedBg).toBe('bg-purple-600')
    expect(palette.conceptText).toBe('text-white')

    const visuals = useBlockVisuals({
      kind: 'concept',
      color: 'purple',
    })

    const classes = visuals.containerClasses.value.join(' ')
    expect(classes).toContain('bg-purple-600')
    expect(classes).toContain('text-white')
  })

  it('falls back to discrete light grey palette for unknown colors', () => {
    const fallback = getColorClasses('unknown_color')
    expect(fallback.selectedBg).toContain('bg-slate-100')
    expect(fallback.conceptText).toContain('text-slate-900')
  })
})
