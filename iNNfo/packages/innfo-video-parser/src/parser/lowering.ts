/**
 * Anydeo Universal Specification (VUS) Lowering
 * Maps formal AST nodes to the runtime Project schema.
 * @spec-source: V_0-3-1 | role: architecture
 */

import { Project, Scene, Section, Layer, NoteSchema } from '../domain/types.js'
import { ScriptNode, AstNode, SceneNode, SectionNode, LayerNode } from './ast.js'
import { normalizeValue, normalizePropertyKey } from './PropertyUtils.js'
import rules from '../rules/index.js'

export interface LoweringOptions {
  title?: string
  defaultVersion?: string
}

function toNameList(raw: any): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String)
  if (!raw) return []
  return String(raw)
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Lowers a Script AST into a Project object.
 * Handles structural organization and basic property mapping.
 */
export function lowerAst(script: ScriptNode, options: LoweringOptions = {}): Project {
  const project: Project = {
    config: {},
    video_sources: {},
    templates: {},
    property_sets: {},
    sections: [],
    flattenScenes: [],
    uiSchema: { video: {}, scene: {}, layer: {} },
    propertyMetadata: {},
  }

  if (options.title && !project.config.video_name) {
    project.config.video_name = options.title
  }

  let currentSection: Section | null = null
  let currentScene: any | null = null
  let currentLayer: any | null = null

  for (const node of script.body) {
    switch (node.type) {
      case 'GlobalProperty':
        const normalizedVal = normalizeValue(node.value)
        const normKey = normalizePropertyKey(node.key)
        if (
          currentLayer &&
          (normKey.startsWith('layer_') ||
            normKey.startsWith('vugen_') ||
            normKey.startsWith('var_'))
        ) {
          currentLayer.properties[normKey] = normalizedVal
          currentLayer[normKey] = normalizedVal
        } else if (
          currentScene &&
          (normKey.startsWith('scene_') ||
            normKey.startsWith('layer_') ||
            normKey.startsWith('vugen_') ||
            normKey.startsWith('var_'))
        ) {
          currentScene.properties[normKey] = normalizedVal
          currentScene[normKey] = normalizedVal
          if (currentScene.finalProperties) {
            currentScene.finalProperties[normKey] = normalizedVal
          }
        } else {
          project.config[normKey] = normalizedVal
        }
        break

      case 'Set':
        const setProps: Record<string, any> = {}
        if (node.properties) {
          Object.entries(node.properties).forEach(([k, v]) => {
            setProps[k] = normalizeValue(v as string)
          })
        }
        project.property_sets[node.name] = {
          name: node.name,
          description: node.description,
          properties: setProps,
        }
        break

      case 'Section':
        const sectionLowName = node.name.toLowerCase()
        if (
          [
            'video',
            'vídeo',
            'sets',
            'templates',
            'template',
            'scene',
            'layer',
            'sections',
          ].includes(sectionLowName)
        ) {
          // Migrate properties to global config if any
          if (node.properties) {
            Object.entries(node.properties).forEach(([k, v]) => {
              const nk = normalizePropertyKey(k)
              if (
                nk.startsWith('video_') ||
                nk.startsWith('vugen_') ||
                nk.startsWith('var_') ||
                (k.startsWith('(') && k.endsWith(')'))
              ) {
                project.config[nk] = normalizeValue(v as string)
              }
            })
          }
          continue
        }
        const sectionProps: Record<string, any> = {}
        for (const [k, v] of Object.entries(node.properties)) {
          sectionProps[k] = normalizeValue(v as string)
        }
        currentSection = {
          title: node.name,
          properties: sectionProps,
          scenes: [],
        }
        project.sections.push(currentSection)
        currentScene = null
        currentLayer = null
        break

      case 'Scene':
        // Ignore legacy container headers only if they come from markdown # markers
        const lowName = node.name.toLowerCase()
        const isContainer = ['video', 'sets', 'templates', 'template', 'scene', 'layer'].includes(
          lowName,
        )

        if (isContainer && ((node as any).marker === '# ' || (node as any).marker === '#')) {
          // If it had global/video/vugen props, migrate them to global config
          if (node.properties) {
            Object.entries(node.properties).forEach(([k, v]) => {
              if (k.startsWith('video_') || k.startsWith('vugen_') || k.startsWith('var_')) {
                project.config[k] = v
              }
            })
          }
          continue
        }

        // In V_0-2-3, '@template' is a Scene with a specific name or property.
        if (node.properties?.block_type === 'template') {
          const templateName = node.name
          currentScene = lowerScene(node, -1, 0)
          // Expose structural refs at the top level: this is the contract
          // consumed by the Rust PropertyResolver (`includes`, `scene_templates`).
          const tplProps = (currentScene as any).properties || {}
          if (tplProps.includes !== undefined) {
            ;(currentScene as any).includes = toNameList(tplProps.includes)
          }
          if (tplProps.scene_templates !== undefined) {
            ;(currentScene as any).scene_templates = toNameList(tplProps.scene_templates)
          }
          project.templates[templateName] = currentScene
          currentLayer = null
          continue
        }

        if (!currentSection) {
          currentSection = {
            title: 'Default Section',
            properties: {},
            scenes: [],
          }
          project.sections.push(currentSection)
        }

        currentScene = lowerScene(
          node,
          project.sections.length - 1,
          currentSection.scenes.length,
          currentSection.properties,
        )
        currentSection.scenes.push(currentScene)
        currentLayer = null
        break

      case 'Layer':
        if (currentScene) {
          currentLayer = lowerLayer(node, currentScene.properties)
          currentScene.layers.push(currentLayer)
        }
        break

      case 'Content':
        if (currentLayer) {
          // If we have an active layer, try to extract asset source from content
          const match = node.text.match(/!\[.*?\]\((.*?)\)/)
          if (match && !currentLayer.layer_asset_source) {
            currentLayer.layer_asset_source = match[1]
            currentLayer.properties.layer_asset_source = match[1]
          } else if (
            ['text', 'text_static', 'text_dynamic', 'text_ai_embedded'].includes(
              currentLayer.layer_type,
            )
          ) {
            // V_0-2-3: Assign text content to layer_text_content
            const newText =
              (currentLayer.properties.layer_text_content
                ? currentLayer.properties.layer_text_content + '\n'
                : '') + node.text
            currentLayer.properties.layer_text_content = newText
            currentLayer.layer_text_content = newText
          } else {
            // Otherwise attach to scene content
            const content =
              (currentScene.scene_content ? currentScene.scene_content + '\n' : '') + node.text
            // Replace dot placeholder if it exists alone
            currentScene.scene_content = currentScene.scene_content === '.' ? node.text : content
            currentScene.properties.scene_content = currentScene.scene_content
          }
        } else if (currentScene) {
          const content =
            (currentScene.scene_content ? currentScene.scene_content + '\n' : '') + node.text
          // Replace dot placeholder if it exists alone
          currentScene.scene_content = currentScene.scene_content === '.' ? node.text : content
          currentScene.properties.scene_content = currentScene.scene_content
        }
        break

      case 'Comment':
        break
    }
  }

  // Post-process: Flatten scenes and assign indices
  const flattenScenes: any[] = []
  project.sections.forEach((section, sIdx) => {
    let sceneIdx = 0
    section.scenes.forEach((item) => {
      // Check if it's a Note
      if ((item as any).block_type === 'note') return

      const scene = item as Scene
      scene.sIdx = sIdx
      scene.idx = sceneIdx
      flattenScenes.push({ sIdx, idx: sceneIdx, scene })
      sceneIdx++
    })
  })
  project.flattenScenes = flattenScenes

  return project
}

function lowerScene(
  node: SceneNode,
  sIdx: number,
  idx: number,
  inheritedProps: Record<string, any> = {},
): any {
  const explicitProps: Record<string, any> = {}
  for (const [k, v] of Object.entries(node.properties)) {
    const nk = normalizePropertyKey(k)
    explicitProps[nk] = normalizeValue(v as string)
  }

  return {
    sIdx,
    idx,
    scene_name: node.name,
    scene_content: explicitProps.scene_content || '',
    scene_sources: explicitProps.scene_sources || [],
    scene_background_audio_volume: explicitProps.scene_background_audio_volume,
    scene_tts_model: explicitProps.scene_tts_model,
    scene_voice: explicitProps.scene_voice,
    scene_voice_volume: explicitProps.scene_voice_volume,
    scene_image_model: explicitProps.scene_image_model,
    scene_video_model: explicitProps.scene_video_model,
    properties: explicitProps,
    layers: (node.layers || []).map((l) => lowerLayer(l)),
    scene_templates: node.scene_templates || [],
    startLine: node.loc?.start.line || 1,
    propertyMetadata: {},
    finalProperties: {},
    inheritedProperties: {},
  } as Scene
}

function lowerLayer(node: any, sceneProps: Record<string, any> = {}): Layer {
  const name = node.name.toLowerCase() === 'background' ? 'background' : node.name

  const explicitProps: Record<string, any> = {}
  for (const [k, v] of Object.entries(node.properties)) {
    const nk = normalizePropertyKey(k)
    explicitProps[nk] = normalizeValue(v as string)
  }

  const properties = explicitProps

  // Extract asset source from markdown content if present (![media](path))
  let assetSource = properties.layer_asset_source || ''

  // Check properties first (sometimes AI puts it in layer_text_content)
  if (!assetSource && typeof properties.layer_text_content === 'string') {
    const match = properties.layer_text_content.match(/!\[.*?\]\((.*?)\)/)
    if (match) {
      assetSource = match[1]
      // Clean it from text content
      const cleaned = properties.layer_text_content.replace(match[0], '').trim()
      properties.layer_text_content = cleaned
      ;(properties as any).layer_asset_source = assetSource
    }
  }

  if (!assetSource && node.content) {
    const match = node.content.match(/!\[.*?\]\((.*?)\)/)
    if (match) assetSource = match[1]
  }

  // layer_type resolution priority: explicit > asset-inferred > undefined (let template inheritance fill it).
  const resolvedLayerType = properties.layer_type || (assetSource ? 'image' : undefined)

  const zIndex = (node as any).index
  if (zIndex !== undefined && properties.layer_level === undefined) {
    properties.layer_level = zIndex
  }
  const resolvedLevel = properties.layer_level !== undefined ? properties.layer_level : zIndex

  return {
    ...properties,
    layer_name: name,
    layer_level: resolvedLevel,
    layer_type: resolvedLayerType,
    layer_asset_source: assetSource,
    properties,
    finalProperties: {},
    startLine: node.loc?.start.line || 1,
    propertyMetadata: {},
  }
}
