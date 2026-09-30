/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { normalizeValue } from './PropertyUtils.js'
import { ScriptParser } from './Parser.js'
import { ScriptSerializer } from './Serializer.js'
import { Project } from '../domain/types.js'

describe('Property-Based Parser Round-Trip', () => {
  // Helper to generate arbitrary properties that are safe for our parser
  // We avoid special characters that would break the Markdown structure unless we handle them
  const safeString = fc
    .string({ minLength: 1, maxLength: 50 })
    .map((s) => s.replace(/[:#@\n!\[\]\(\)]/g, '_').trim())
    .filter((s) => s.length > 0)

  const arbValue = fc.oneof(
    safeString.filter((s) => isNaN(Number(s))),
    fc.integer(),
    fc.boolean(),
  )

  const arbConfigProps = fc.dictionary(
    fc
      .string({ minLength: 2, maxLength: 10 })
      .map((s) => 'vugen_video_' + s.replace(/[^a-z0-9_]/gi, '_').toLowerCase()),
    arbValue,
  )

  const arbSectionProps = fc.dictionary(
    fc
      .string({ minLength: 2, maxLength: 10 })
      .map((s) => 'vugen_section_' + s.replace(/[^a-z0-9_]/gi, '_').toLowerCase()),
    arbValue,
  )

  const arbSceneProps = fc.dictionary(
    fc
      .string({ minLength: 2, maxLength: 10 })
      .map((s) => 'vugen_scene_' + s.replace(/[^a-z0-9_]/gi, '_').toLowerCase()),
    arbValue,
  )

  const arbLayerProps = fc.dictionary(
    fc
      .string({ minLength: 2, maxLength: 10 })
      .map((s) => 'vugen_layer_' + s.replace(/[^a-z0-9_]/gi, '_').toLowerCase()),
    arbValue,
  )

  const arbLayer = fc
    .record({
      layer_name: safeString,
      layer_level: fc.integer({ min: 1, max: 99 }),
      layer_type: fc.constant('image'), // Use base image type for stability
      layer_asset_source: fc.oneof(fc.constant(''), fc.constant('http://example.com/image.jpg')),
      properties: arbLayerProps,
    })
    .map((l) => ({ ...l, startLine: 1 }))

  const arbScene = fc
    .record({
      scene_name: safeString,
      scene_content: fc.oneof(fc.constant(''), safeString),
      properties: arbSceneProps,
      layers: fc.array(arbLayer, { maxLength: 1 }),
    })
    .map((s) => ({ ...s, startLine: 1, scene_templates: [] as string[] }))

  const arbSection = fc.record({
    title: safeString,
    properties: arbSectionProps,
    scenes: fc.array(fc.oneof(arbScene), { minLength: 1, maxLength: 1 }),
  })

  const arbProject = fc.record({
    config: arbConfigProps,
    templates: fc.constant({}),
    sections: fc.array(arbSection, { minLength: 1, maxLength: 1 }),
  })

  it('should satisfy parse(serialize(project)) structural equality', () => {
    fc.assert(
      fc.property(arbProject, (projectRaw) => {
        const project = {
          config: Object.fromEntries(
            Object.entries(projectRaw.config || {}).map(([k, v]) => [
              k,
              normalizeValue(v as string),
            ]),
          ),
          templates: projectRaw.templates || {},
          sections: (projectRaw.sections || []).map((s) => ({
            ...s,
            properties: Object.fromEntries(
              Object.entries(s.properties || {}).map(([k, v]) => [k, normalizeValue(v as string)]),
            ),
            scenes: (s.scenes || []).map((sc) => ({
              ...sc,
              properties: Object.fromEntries(
                Object.entries(sc.properties || {}).map(([k, v]) => [
                  k,
                  normalizeValue(v as string),
                ]),
              ),
              layers: (sc.layers || []).map((l) => ({
                ...l,
                properties: Object.fromEntries(
                  Object.entries(l.properties || {}).map(([k, v]) => [
                    k,
                    normalizeValue(v as string),
                  ]),
                ),
              })),
            })),
          })),
        } as any

        const serialized = ScriptSerializer.serialize(project)
        const { project: parsed } = ScriptParser.parse(serialized)

        try {
          // 1. Check Config
          for (const key in project.config) {
            if (key === 'anydeo_specification' || key === 'video_name') continue
            const expected = project.config[key]
            const actual = parsed.config[key]
            expect(actual).toEqual(expected)
          }

          // 2. Check Sections & Scenes
          expect(parsed.sections.length).toEqual(project.sections.length)
          for (let i = 0; i < project.sections.length; i++) {
            const s1 = project.sections[i]
            const s2 = parsed.sections[i]

            // Check Section Props
            for (const key in s1.properties) {
              expect(s2.properties[key]).toEqual(s1.properties[key])
            }

            for (let j = 0; j < s1.scenes.length; j++) {
              const sc1 = s1.scenes[j] as any
              const sc2 = s2.scenes[j] as any

              // Check Scene Props
              const sc2Final =
                (sc2 as any).finalProperties && Object.keys((sc2 as any).finalProperties).length > 0
                  ? (sc2 as any).finalProperties
                  : sc2.properties
              Object.keys(sc1.properties).forEach((key) => {
                if (['block_type', 'scene_templates'].includes(key)) return
                expect(sc2Final[key]).toEqual(sc1.properties[key])
              })

              // Check Layers
              sc1.layers.forEach((l1: any) => {
                const l2 = sc2.layers.find((l: any) => l.layer_name === l1.layer_name)
                expect(l2).toBeDefined()

                const l2Final = (l2 as any).finalProperties || l2.properties
                for (const key in l1.properties) {
                  expect(l2Final[key]).toEqual(l1.properties[key])
                }
              })
            }
          }
        } catch (e) {
          console.log('SERIALIZED OUTPUT CAUSING FAILURE:\n', serialized)
          console.log('PARSED PROJECT:\n', JSON.stringify(parsed, null, 2))
          throw e
        }
      }),
      { numRuns: 100 },
    )
  })
})
