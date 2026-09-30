import { Project, Scene, Section, Layer } from '../domain/types.js'
import {
  getPropertyMetadata,
  getPropertyOrder,
  getDefaultsFromSchema,
} from '../utils/schema_utils.js'
import { normalizePropertyKey } from '../config/propertyMappings.js'
import { projectToAst, serializeAst } from './ast.js'
import rules from '../rules/index.js'

/**
 * Script Serializer V_0-2-3
 * @spec-source:V_0-3-3 | role: core_serializer
 *
 * Performance Note: This serializer performs a deep inheritance analysis to ensure
 * that the generated markdown only contains "Deltas" (explicit overrides).
 */
export class ScriptSerializer {
  /**
   * Serializes a project back into markdown
   * @param {Project | Scene | Section} input - Project or part to serialize
   * @returns {string} Serialized markdown
   */
  static serialize(input: any): string {
    const isV0x = true // All active projects are V_0-3-x; legacy V_0-1 not supported for serialization

    const isProject = !!(input.config && input.sections)

    if (isProject) {
      return this._serializeProject(input as Project, isV0x)
    } else if (input.scenes) {
      return this.serializeSection(input as Section, isV0x, input.config || {})
    } else if (input.properties && (input.scene_name || input.scene_content)) {
      return this.serializeScene(input as Scene, isV0x, {}, input.config || {})
    }
    return ''
  }

  private static _serializeProject(project: Project, isV0x: boolean = false): string {
    const config = project.config as any
    const specVersion = config.video_anydeo_specification || 'V_0-3-2'
    let md = `//ANYDEO_SPEC: ${specVersion}\n\n`

    // 1. sets
    const propertySets = (project as any).property_sets || {}
    const setNames = Object.keys(propertySets)
    if (setNames.length > 0) {
      md += `# sets\n`
      setNames.forEach((name) => {
        const set = propertySets[name]
        md += `\n@set ${name}`
        if (set.description) md += `  ${set.description}`
        md += `\n`
        md += this._serializeProperties(set.properties || {}, 'set', isV0x, {}, {})
      })
      md += `\n`
    }

    // 2. templates
    const templates = project.templates || {}
    const templateNames = Object.keys(templates)
    if (templateNames.length > 0) {
      md += `# templates\n`
      templateNames.forEach((name) => {
        md += `\n` + this.serializeTemplate(name, templates[name], isV0x, templates, specVersion)
      })
      md += `\n`
    }

    // 3. video
    md += `# video\n`
    md += `- video_anydeo_specification: ${specVersion}\n`

    const videoProps = { ...project.config }
    // Clean redundant config keys already serialized or internal
    delete videoProps.anydeo_specification
    delete videoProps.video_anydeo_specification

    // Get video defaults from rules
    const videoDefaults: Record<string, any> = {}
    const systemRules = (this as any).rules || rules
    if (systemRules && systemRules.properties) {
      Object.entries(systemRules.properties).forEach(([key, rule]: [string, any]) => {
        if (rule.scope === 'video' && rule.default !== undefined) {
          videoDefaults[key] = rule.default
        }
      })
    }

    // In V_0-2-x and above, we allow scene_ and layer_ props in # vídeo for global cascading
    md += this._serializeProperties(
      videoProps,
      'video',
      isV0x,
      { video_anydeo_specification: specVersion },
      videoDefaults,
    )

    // Sections
    ;(project.sections || []).forEach((section) => {
      md += this.serializeSection(section, isV0x, project.config, templates)
    })

    return md
  }

  static serializeSection(
    section: Section,
    isV0x: boolean = false,
    videoConfig: any = {},
    templates: any = {},
  ): string {
    const sectionTitle = (section as any).name || section.title || 'Untitled Section'
    const sectionMarker = '##'
    const isDefaultSection = sectionTitle === 'Default Section'
    let md = isDefaultSection ? '' : `\n${sectionMarker} ${sectionTitle}\n`

    // Inherited context for section properties is videoConfig
    md += this._serializeProperties(section.properties || {}, 'section', isV0x, videoConfig, {})

    ;(section.scenes || []).forEach((scene) => {
      if ((scene as any).block_type === 'note') {
        md += `\n> ${(scene as any).scene_content}\n`
      } else {
        md += this.serializeScene(scene as Scene, isV0x, templates, {
          ...videoConfig,
          ...section.properties,
        })
      }
    })

    return md
  }

  static serializeScene(
    scene: Scene,
    isV0x: boolean = false,
    templates: any = {},
    parentProps: any = {},
  ): string {
    if ((scene as any).block_type === 'note') {
      return `\n> ${(scene as any).scene_content}\n`
    }

    const activeTemplates = scene.scene_templates || []
    const filtered = activeTemplates.filter((t) => t !== 'scene')
    const tplPrefix = filtered.length > 0 ? filtered.map((t) => `@${t}`).join(' ') + ' ' : ''

    const namePart = scene.scene_name || 'Untitled Scene'
    let md = ''

    let cleanName = namePart.replace(/^(?:@scene\s+|@\s+)/, '').trim()

    // Robust deduplication: remove any template names from the beginning of the scene name
    if (filtered.length > 0) {
      filtered.forEach((t) => {
        // Strip '@template '
        const atRegex = new RegExp(`^@${t}\\s+`)
        while (atRegex.test(cleanName)) cleanName = cleanName.replace(atRegex, '').trim()

        // Strip 'template ' if it's repeating and we wouldn't end up with an empty name
        const noAtRegex = new RegExp(`^${t}\\s+`)
        while (noAtRegex.test(cleanName) && cleanName !== t) {
          cleanName = cleanName.replace(noAtRegex, '').trim()
        }
      })
      // Fallback if we accidentally stripped everything
      if (!cleanName) cleanName = filtered[0]
    }

    if (tplPrefix) {
      md = `\n${tplPrefix}${cleanName}\n`
    } else {
      const hasPrefix = cleanName.startsWith('@')
      md = hasPrefix ? `\n${cleanName}\n` : `\n@ ${cleanName}\n`
    }

    // --- Calculate Inheritance for Redundancy Removal ---
    let inheritedFromTemplates: Record<string, any> = {}
    let templateLayers: Layer[] = []

    activeTemplates.forEach((tName) => {
      const tpl = templates[tName]
      if (tpl) {
        const tplProps = tpl.properties || tpl
        inheritedFromTemplates = { ...inheritedFromTemplates, ...tplProps }
        if (tpl.layers) templateLayers = [...templateLayers, ...tpl.layers]
      }
    })

    const sceneContext = { ...parentProps, ...inheritedFromTemplates }
    md += this._serializeProperties(
      scene.properties || {},
      'scene',
      isV0x,
      sceneContext,
      getDefaultsFromSchema('scene'),
    )

    // Narration content
    const content =
      scene.scene_content ||
      (scene.properties as any)?.scene_content ||
      (scene.properties as any)?.content
    if (content) {
      md += `\n${content.trim()}\n`
    } else {
      console.log(
        'DEBUG: No content found for scene:',
        scene.scene_name,
        'Properties keys:',
        Object.keys(scene.properties || {}),
      )
    }

    // Layer Serialization with Redundancy Check
    const layers = scene.layers || []

    // --- DELETION PERSISTENCE (V_0-3-2) ---
    // If a layer exists in a template but is MISSING from the current scene's layers,
    // we must write a suppression block so the parser doesn't re-inject it.
    templateLayers.forEach((tl) => {
      const tlName = tl.layer_name
      const tlLevel = (tl as any).layer_level

      const stillExists = layers.some((l) => {
        const lName = l.layer_name
        const lLevel = (l as any).layer_level ?? (l.properties as any)?.layer_level

        // 1. Match by name if both have names
        if (tlName && lName) {
          return tlName.toLowerCase() === lName.toLowerCase()
        }

        // 2. Match by level if either is anonymous but they have levels
        if (tlLevel !== undefined && lLevel !== undefined) {
          return tlLevel === lLevel
        }

        return false
      })

      if (!stillExists) {
        const rawTlName = tl.layer_name || ''
        const normalizedTlName = rawTlName.toLowerCase() === 'background' ? 'background' : rawTlName
        const namePart = normalizedTlName ? ` ${normalizedTlName}` : ''
        md += `\n@@${namePart}\n- layer_active: false\n`
      }
    })

    layers.forEach((layer) => {
      const lName = layer.layer_name
      const lLevel = (layer as any).layer_level ?? (layer.properties as any)?.layer_level

      // Check if this layer is already fully defined in the template and has no changes
      const matchingTplLayer = templateLayers.find((tl) => {
        const tlName = tl.layer_name
        const tlLevel = (tl as any).layer_level

        if (tlName && lName) {
          return tlName.toLowerCase() === lName.toLowerCase()
        }
        if (tlLevel !== undefined && lLevel !== undefined) {
          return tlLevel === lLevel
        }
        return false
      })
      const layerInheritedContext = { ...sceneContext }
      // Filter inherited properties to only those applicable to layers
      Object.entries(sceneContext).forEach(([k, v]) => {
        const isNativePrefix =
          k.startsWith('video_') ||
          k.startsWith('scene_') ||
          k.startsWith('layer_') ||
          k.startsWith('var_') ||
          k.startsWith('vugen_') ||
          k.startsWith('(')
        if (!isNativePrefix && k !== 'import') delete (layerInheritedContext as any)[k]
      })

      if (matchingTplLayer) {
        const tplLayerProps = matchingTplLayer.properties || matchingTplLayer
        const layerOverrides = this._serializeProperties(
          layer.properties || {},
          'layer',
          isV0x,
          { ...layerInheritedContext, ...tplLayerProps },
          getDefaultsFromSchema('layer'),
        )

        // If the layer has no overrides and its source matches, it's redundant
        const layerSource =
          layer.layer_asset_source || (layer.properties as any)?.layer_asset_source
        const tplSource =
          matchingTplLayer.layer_asset_source || (tplLayerProps as any)?.layer_asset_source

        if (!layerOverrides.trim() && layerSource === tplSource) {
          return // Skip redundant layer
        }

        // If there are overrides, serialize just them
        md +=
          `\n` + this.serializeLayer(layer, isV0x, { ...layerInheritedContext, ...tplLayerProps })
      } else {
        md += `\n` + this.serializeLayer(layer, isV0x, layerInheritedContext)
      }
    })

    return md
  }

  static serializeLayer(
    layer: Layer,
    isV0x: boolean = false,
    inheritedProperties: Record<string, any> = {},
  ): string {
    const rawName = layer.layer_name || ''
    const normalizedName = rawName.toLowerCase() === 'background' ? 'background' : rawName
    const name = normalizedName ? ` ${normalizedName}` : ''

    const propsMd = this._serializeProperties(
      layer.properties || {},
      'layer',
      isV0x,
      inheritedProperties,
      getDefaultsFromSchema('layer'),
    )
    const source = layer.layer_asset_source || (layer.properties as any)?.layer_asset_source
    const inheritedSource = inheritedProperties.layer_asset_source

    const layerHeader = `@@${name}\n`
    let md = layerHeader
    md += propsMd

    // Media after properties - only if it differs from inherited
    if (source && source !== inheritedSource) {
      md += `![media](${source})\n`
    }

    // Text content after properties - only for text layers
    const textContent =
      (layer as any).layer_text_content || (layer.properties as any)?.layer_text_content
    const inheritedText = inheritedProperties.layer_text_content
    const type =
      layer.layer_type || (layer.properties as any)?.layer_type || inheritedProperties.layer_type

    if (
      textContent &&
      textContent !== inheritedText &&
      (type === 'text' ||
        type === 'text_static' ||
        type === 'text_dynamic' ||
        type === 'text_ai_embedded')
    ) {
      md += `\n${textContent.trim()}\n`
    }

    return md
  }

  private static _serializeProperties(
    properties: Record<string, any>,
    scope: 'video' | 'section' | 'scene' | 'layer' | 'template' | 'set',
    allowCascading: boolean = false,
    inheritedProperties: Record<string, any> = {},
    systemDefaults: Record<string, any> = {},
  ): string {
    if (!properties) return ''
    let md = ''

    const isSetScope = scope === 'set'
    const SKIP_KEYS = [
      'sIdx',
      'idx',
      'usage',
      'block_type',
      'templates_resolved',
      '_key',
      'layer_name',
      'scene_name',
      'section_title',
      'scene_content',
      'propertyMetadata',
      'startLine',
      'finalProperties',
      'inheritedProperties',
      'layers',
      'sections',
      'templates',
      ...(isSetScope ? [] : ['layer_asset_source', 'layer_meta_source', 'layer_text_content']),
      'video_anydeo_specification',
      'anydeo_specification',
    ]

    const canonicalOrder = getPropertyOrder()
    const keys = Object.keys(properties)
      .filter((key) => !SKIP_KEYS.includes(key) && !key.startsWith('_'))
      .sort((a, b) => {
        const normA = normalizePropertyKey(a.startsWith('(') ? a.substring(1, a.length - 1) : a)
        const normB = normalizePropertyKey(b.startsWith('(') ? b.substring(1, b.length - 1) : b)

        let idxA = canonicalOrder.indexOf(normA)
        let idxB = canonicalOrder.indexOf(normB)

        // Handling for model-injected properties (e.g., model/parameter)
        // If a property is an injection, we try to place it right after its parent model property
        if (idxA === -1 && a.includes('/')) {
          const parentKey = Object.keys(properties).find((pk) => {
            const val = properties[pk]
            return typeof val === 'string' && a.startsWith(val + '/')
          })
          if (parentKey) {
            const parentIdx = canonicalOrder.indexOf(normalizePropertyKey(parentKey))
            if (parentIdx !== -1) idxA = parentIdx + 0.001
          }
        }

        if (idxB === -1 && b.includes('/')) {
          const parentKey = Object.keys(properties).find((pk) => {
            const val = properties[pk]
            return typeof val === 'string' && b.startsWith(val + '/')
          })
          if (parentKey) {
            const parentIdx = canonicalOrder.indexOf(normalizePropertyKey(parentKey))
            if (parentIdx !== -1) idxB = parentIdx + 0.001
          }
        }

        if (idxA === -1 && idxB === -1) return a.localeCompare(b)
        if (idxA === -1) return 1
        if (idxB === -1) return -1

        if (idxA === idxB) return a.localeCompare(b)

        return idxA - idxB
      })

    keys.forEach((key) => {
      const value = properties[key]
      if (value === undefined || value === null) return

      const canonicalKey = normalizePropertyKey(key)
      const metadata = getPropertyMetadata(canonicalKey)

      // Scope validation
      if (
        scope &&
        scope !== 'template' &&
        scope !== 'set' &&
        metadata &&
        metadata.scope &&
        metadata.scope !== scope
      ) {
        const isCascadable =
          allowCascading &&
          (scope === 'video' || scope === 'section') &&
          (metadata.scope === 'scene' || metadata.scope === 'layer')
        if (!isCascadable) return
      }

      // --- REDUNDANCY CHECKS ---

      // 1. Check against Inherited Values (Templates/Parents)
      if (key in inheritedProperties && inheritedProperties[key] === value) {
        return
      }

      // 2. Check against System Defaults (Schema)
      if (key in systemDefaults && systemDefaults[key] === value && !(key in inheritedProperties)) {
        return
      }

      // 3. Transient Property Logic (V_0-3-2): Hide Raw URL if asset is already local
      if (key === 'layer_asset_raw_url' && properties['layer_asset_source']) {
        const source = properties['layer_asset_source']
        const isLocal = typeof source === 'string' && !source.startsWith('http')
        if (isLocal) return
      }

      let valStr = String(value).trim() // <--- TRIM PARA EVITAR SALTOS EXTRA
      if (Array.isArray(value)) {
        valStr = value.join(', ').trim()
      } else if (typeof value === 'boolean') {
        valStr = value ? 'true' : 'false'
      } else if (typeof value === 'object') {
        return
      }

      const isMultiline = valStr.includes('\n')
      const cleanKey =
        key.startsWith('(') && key.endsWith(')') ? key.substring(1, key.length - 1) : key
      const displayKey = metadata && metadata.hidden ? `(${cleanKey})` : key

      const prefix = '- '

      if (isMultiline) {
        md += `${prefix}${displayKey}: \`\`\`\n${valStr}\n\`\`\`\n`
      } else {
        md += `${prefix}${displayKey}: ${valStr}\n`
      }
    })

    return md
  }

  /**
   * Serializes a single template.
   */
  static serializeTemplate(
    name: string,
    props: any,
    isV0x: boolean,
    allTemplates: any,
    specVersion?: string,
  ): string {
    let md = `@template ${name}\n`

    const dataToSerialize = props && props.properties ? props.properties : props
    const inheritedContext = { video_anydeo_specification: specVersion }
    md += this._serializeProperties(
      dataToSerialize,
      'template',
      true,
      inheritedContext,
      getDefaultsFromSchema('template'),
    )

    // Media after properties
    const source = dataToSerialize.layer_asset_source || props.layer_asset_source
    if (source) {
      md += `![media](${source})\n`
    }

    // Text content after properties
    const textContent = dataToSerialize.layer_text_content || props.layer_text_content
    const type = dataToSerialize.layer_type || props.layer_type
    if (
      textContent &&
      (type === 'text' ||
        type === 'text_static' ||
        type === 'text_dynamic' ||
        type === 'text_ai_embedded')
    ) {
      md += `\n${textContent.trim()}\n`
    }

    if (props && props.layers && Array.isArray(props.layers)) {
      props.layers.forEach((l: any) => {
        md += this.serializeLayer(l, isV0x, inheritedContext)
      })
    }

    return md
  }
}
