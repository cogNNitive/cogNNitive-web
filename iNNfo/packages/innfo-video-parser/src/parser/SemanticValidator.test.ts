/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { describe, it, expect } from 'vitest'
import { SemanticValidator } from './SemanticValidator.js'
import { Project } from '../domain/types.js'

describe('SemanticValidator', () => {
  it('should return false (no errors) for an empty project without sections', () => {
    const project: any = {
      sections: [],
      uiSchema: { video: { t: 1 }, scene: { t: 1 }, layer: { t: 1 } },
    }
    const issues: any[] = []
    const hasErrors = SemanticValidator.validate(project, issues)
    expect(hasErrors).toBe(false)
  })

  it('should catch missing mandatory scene properties', () => {
    const project: any = {
      uiSchema: { video: { t: 1 }, scene: { t: 1 }, layer: { t: 1 } },
      templates: {},
      sections: [
        {
          scenes: [
            {
              block_type: 'scene',
              // scene_name is missing
              // scene_content is missing
              layers: [],
            },
          ],
        },
      ],
    }
    const issues: any[] = []
    const hasErrors = SemanticValidator.validate(project as Project, issues)

    expect(hasErrors).toBe(true)
    const sceneNameError = issues.find((i) => i.message.includes("'Scene Name' is missing"))
    const contentError = issues.find((i) => i.message.includes("'Content' is missing"))

    expect(sceneNameError).toBeDefined()
    expect(contentError).toBeDefined()
  })

  it('should catch unknown properties in scene header', () => {
    const project: any = {
      uiSchema: { video: { t: 1 }, scene: { t: 1 }, layer: { t: 1 } },
      templates: {},
      sections: [
        {
          scenes: [
            {
              block_type: 'scene',
              scene_name: 'Test Scene',
              scene_content: 'Hello',
              properties: {
                unknown_prop: 'value',
              },
              layers: [],
            },
          ],
        },
      ],
    }
    const issues: any[] = []
    const hasErrors = SemanticValidator.validate(project as Project, issues)

    expect(hasErrors).toBe(true)
    expect(
      issues.some((i) => i.message.includes("Unknown or non-canonical property 'unknown_prop'")),
    ).toBe(true)
  })

  it('should validate enum values correctly', () => {
    const project: any = {
      uiSchema: { video: { t: 1 }, scene: { t: 1 }, layer: { t: 1 } },
      templates: {},
      sections: [
        {
          scenes: [
            {
              block_type: 'scene',
              scene_name: 'Enum Test',
              scene_content: 'Test',
              properties: {
                scene_duration_mode: 'invalid_mode', // Should be auto_voice, auto_media or custom
              },
              layers: [],
            },
          ],
        },
      ],
    }
    const issues: any[] = []
    const hasErrors = SemanticValidator.validate(project as Project, issues)

    expect(hasErrors).toBe(true)
    expect(
      issues.some((i) =>
        i.message.includes("Invalid value 'invalid_mode' for property 'Duration Mode'"),
      ),
    ).toBe(true)
  })

  it('should validate v0.6.0 property scoping (canonical vs custom var_)', () => {
    const project: any = {
      config: { video_name: 'Test' },
      uiSchema: { video: { t: 1 }, scene: { t: 1 }, layer: { t: 1 } },
      templates: {},
      sections: [
        {
          scenes: [
            {
              block_type: 'scene',
              scene_name: 'Canonical Test',
              scene_content: 'Test',
              properties: {
                scene_tts_model: 'replicate/minimax/speech-2.8-hd', // Canonical
                var_custom_feeling: 'epic', // Valid custom
              },
              layers: [
                {
                  block_type: 'layer',
                  layer_name: 'Bg',
                  layer_type: 'image',
                  layer_asset_source: './test.jpg', // Canonical
                  properties: {
                    layer_text_style: '#ffffff', // Canonical
                    var_layer_anim: 'fade', // Valid custom
                  },
                },
              ],
            },
          ],
        },
      ],
    }
    const issues: any[] = []
    const hasErrors = SemanticValidator.validate(project as Project, issues)

    // Should NOT have errors because all are canonical or have var_ prefix
    expect(hasErrors).toBe(false)
    const errorIssues = issues.filter((i) => i.severity === 'error')
    expect(errorIssues.length).toBe(0)
  })

  it('should recognize layer_scale, layer_crop, layer_effects, and layer_visual_style properties as canonical (V_0-3-2)', () => {
    const project: any = {
      uiSchema: { video: { t: 1 }, scene: { t: 1 }, layer: { t: 1 } },
      templates: {},
      sections: [
        {
          scenes: [
            {
              block_type: 'scene',
              scene_name: 'Canonical Check',
              scene_content: 'Test',
              layers: [
                {
                  block_type: 'layer',
                  layer_name: 'Styled Layer',
                  layer_type: 'image',
                  layer_asset_source: './test.jpg',
                  properties: {
                    layer_scale: 1.5,
                    layer_effects: ['zoom_in', 'grayscale'],
                    layer_visual_style: 'cinematic ultra photorealistic',
                  },
                },
              ],
            },
          ],
        },
      ],
    }
    const issues: any[] = []
    const hasErrors = SemanticValidator.validate(project as Project, issues)

    const errors = issues.filter((i) => i.severity === 'error')
    if (errors.length > 0) {
      console.error(
        'Validation errors found (EXPECTED PASS):',
        errors.map((e) => `${e.path}: ${e.message}`),
      )
    }

    expect(errors.length).toBe(0)
    expect(hasErrors).toBe(false)
  })

  it('should catch non-canonical properties without var_ prefix', () => {
    const project: any = {
      uiSchema: { video: { t: 1 }, scene: { t: 1 }, layer: { t: 1 } },
      templates: {},
      sections: [
        {
          scenes: [
            {
              block_type: 'scene',
              scene_name: 'Naming Check',
              scene_content: 'Test',
              properties: {
                my_custom_prop: 'value', // Should be var_my_custom_prop
              },
              layers: [],
            },
          ],
        },
      ],
    }
    const issues: any[] = []
    SemanticValidator.validate(project as Project, issues)

    expect(
      issues.some((i) => i.message.includes("Unknown or non-canonical property 'my_custom_prop'")),
    ).toBe(true)
    expect(issues.some((i) => i.details?.includes("use the 'var_' prefix"))).toBe(true)
  })
})
