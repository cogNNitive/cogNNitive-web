/**
 * Anydeo Peggy Parser Integration Test
 * @spec-source: V_0-2-5 | role: quality_check
 */

import { describe, it, expect } from 'vitest'
import * as PeggyParser from './vus_parser.js'
import { lowerAst } from './lowering.js'
import { Project } from '../domain/types.js'

describe('Peggy Parser Integration', () => {
  it('should parse a formal VUS script with @ and @@ notation', () => {
    const script = `
//ANYDEO_SPEC: V_0-2-5
- video_name: Peggy Test
- video_author: AI Agent

## Intro Section
- background: #ff0000

@ Intro Scene
- scene_content: Welcome to the Peggy parser test.

@@ Background
- layer_level: 10
- layer_type: image
- layer_asset_source: assets/bg.png

@@ Overlay
- layer_level: 20
- layer_type: ai_image
- layer_generation_context: a futuristic laboratory
`

    const ast = PeggyParser.parse(script)
    expect(ast.type).toBe('Script')
    expect(ast.body.length).toBeGreaterThan(0)

    const project = lowerAst(ast)

    expect(project.config.video_name).toBe('Peggy Test')
    expect(project.sections.length).toBe(1)
    expect(project.sections[0].title).toBe('Intro Section')
    expect(project.sections[0].scenes.length).toBe(1)

    const scene = project.sections[0].scenes[0] as any
    expect(scene.scene_name).toBe('Intro Scene')
    expect(scene.layers.length).toBe(2)

    expect(scene.layers[0].layer_name).toBe('background')
    expect(scene.layers[0].layer_level).toBe(10)
    expect(scene.layers[1].layer_name).toBe('Overlay')
    expect(scene.layers[1].layer_level).toBe(20)
  })

  it('should handle multiline properties with ```', () => {
    const script =
      '@ Scene With Multiline\n' +
      '- scene_content: ```\n' +
      '  This is a multiline\n' +
      '  content block.\n' +
      '  It should preserve line breaks.\n' +
      '  ```\n'
    const ast = PeggyParser.parse(script)
    const project = lowerAst(ast)
    const scene = project.sections[0].scenes[0] as any

    expect(scene.scene_content).toContain('This is a multiline')
    expect(scene.scene_content).toContain('preserve line breaks.')
  })

  it('should parse global properties', () => {
    const script = `
- video_resolution: 1080x1920
- video_fps: 60
`
    const ast = PeggyParser.parse(script)
    const project = lowerAst(ast)

    expect(project.config.video_resolution).toBe('1080x1920')
    expect(project.config.video_fps).toBe(60)
  })

  it('should parse templates with @template', () => {
    const script = `
@template MyCustomTemplate
- scene_tts_model: custom_model
@@ Watermark
- layer_level: 10
- layer_type: image
- layer_asset_source: assets/logo.png
`
    const ast = PeggyParser.parse(script)
    const project = lowerAst(ast)

    expect(project.templates['MyCustomTemplate']).toBeDefined()
    expect(project.templates['MyCustomTemplate'].properties.scene_tts_model).toBe('custom_model')
    expect(project.templates['MyCustomTemplate'].layers.length).toBe(1)
    expect(project.templates['MyCustomTemplate'].layers[0].layer_level).toBe(10)
  })

  it('should parse property sets with @set', () => {
    const script = `
@set branding_watermark Some brand description
- layer_asset_source: assets/logo.png
- layer_opacity: 0.8
- layer_level: 90
`
    const ast = PeggyParser.parse(script)
    const project = lowerAst(ast)

    expect(project.property_sets['branding_watermark']).toBeDefined()
    expect(project.property_sets['branding_watermark'].description).toBe('Some brand description')
    expect(project.property_sets['branding_watermark'].properties.layer_asset_source).toBe(
      'assets/logo.png',
    )
    expect(project.property_sets['branding_watermark'].properties.layer_opacity).toBe(0.8)
    expect(project.property_sets['branding_watermark'].properties.layer_level).toBe(90)
  })
})
