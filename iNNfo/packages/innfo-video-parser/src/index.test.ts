import { describe, expect, it } from 'vitest'
import { parse, validate, VUS_SPEC } from './index.js'

const VALID_SCRIPT = `//ANYDEO_SPEC: V_0-3-3
# Intro
@ Scene
This is the narration for the scene.
@@ Visual
- layer_type: image
![media](media/hero.jpg)
`

describe('package entry point', () => {
  it('exposes the pinned spec with version, sha256 and parsed content', () => {
    expect(VUS_SPEC.version).toBe('V_0-3-3')
    expect(VUS_SPEC.sha256).toBe('d617aadcc85ad5816ca0b447e28032b14c1fc64bac65f550fa4149bd4f7cedda')
    expect(VUS_SPEC.spec.info.version).toBe('V_0-3-3')
    expect(Array.isArray(VUS_SPEC.spec.api_options.voices)).toBe(true)
  })

  it('parses a valid script with zero issues', () => {
    const { project, issues } = parse(VALID_SCRIPT)
    expect(issues).toEqual([])
    expect(project.sections.length).toBeGreaterThan(0)
  })

  it('validate() reports no errors for a parsed valid script', () => {
    const { project } = parse(VALID_SCRIPT)
    expect(validate(project).filter((i) => i.severity === 'error')).toEqual([])
  })

  it('validate() flags a property used outside its scope', () => {
    const { project } = parse(VALID_SCRIPT)
    const scene = project.sections[0].scenes[0] as any
    scene.properties = { ...scene.properties, my_custom_prop: 'x' }
    const issues = validate(project)
    expect(issues.some((i) => i.message.includes("Unknown or non-canonical property 'my_custom_prop'"))).toBe(true)
  })
})
