import { describe, it, expect } from 'vitest'
import rules from '../rules/index.js'
import { version as SYSTEM_VERSION } from '../version.js'

/**
 * @spec-source:V_0-3-3 | role: unit_test
 *
 * VUS Integrity Test
 *
 * Ensures the Unified VUS adheres to its own rules
 * and maintains Single Source of Truth consistency.
 */
describe(`VUS ${SYSTEM_VERSION} Integrity`, () => {
  it('should have correct metadata and versioning', () => {
    expect(rules.system.version).toBe(SYSTEM_VERSION)
    expect(rules.system.name).toContain('Universal Specification')
  })

  it('should have required categories defined', () => {
    const categoryIds = rules.system.categories.map((c: any) => c.id)
    expect(categoryIds).toContain('identity')
    expect(categoryIds).toContain('audio')
    expect(categoryIds).toContain('layer_core')
  })

  it('should define all properties with mandatory scopes', () => {
    const allowedScopes = ['video', 'section', 'template', 'scene', 'layer']
    Object.values(rules.properties).forEach((prop: any) => {
      const scope = prop.scope || prop.scopes?.[0]
      expect(allowedScopes).toContain(scope)
    })
  })

  it('should have default value for all required properties', () => {
    Object.entries(rules.properties).forEach(([key, prop]: [string, any]) => {
      if (prop.required && key !== 'scene_name' && key !== 'scene_content') {
        expect(prop.default).toBeDefined()
      }
    })
  })

  it('should have text-to-script properties registered correctly', () => {
    expect(rules.properties.video_script_source).toBeDefined()
    expect(rules.properties.video_original_script).toBeDefined()
    expect(rules.properties.video_script_source.category).toBe('identity')
    expect(rules.properties.video_original_script.category).toBe('identity')
  })

  it('maintain canonical model IDs for AI services', () => {
    const ttsDefault = rules.properties.scene_tts_model?.default
    if (ttsDefault) {
      // Standard check: allow replicate/ prefix
      const isReplicate = ttsDefault.includes('replicate/')
      expect(isReplicate).toBe(true)
    }
  })
})
