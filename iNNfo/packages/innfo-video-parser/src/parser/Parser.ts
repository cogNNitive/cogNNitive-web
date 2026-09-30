import { ProjectSchema, Project, Scene, Section } from '../domain/types.js'
import { LineParser } from './LineParseStrategies.js'
import { ParserContext, ParserBlock } from './types.js'
import { processProperties } from './PropertyUtils.js'
import { normalizePropertyValue } from '../config/propertyMappings.js'
import { SemanticValidator } from './SemanticValidator.js'
import rules from '../rules/index.js'

import { parse as peggyParse } from './vus_parser.js'
import { lowerAst } from './lowering.js'

// Script parser for the Universal Specification (VUS)

export interface ParseResult {
  project: Project
  issues: any[]
}

/**
 * Script parser V_0-2-1 (Hierarchical Cascading Inheritance)
 * @spec-source:V_0-3-3 | role: core_parser
 */
export class ScriptParser {
  /**
   * Parses a script content into a project structure
   * @param {string} content - Script file content
   * @param {string} title - Optional title for the video
   * @param {any} styleDictionary - Optional dictionary of styles for validation
   * @returns {ParseResult} Parsed project and list of issues
   */
  static parse(
    content: string,
    title: string = 'Untitled Video',
    styleDictionary?: any,
  ): ParseResult {
    const issues: any[] = []

    if (!content || content.trim().length === 0) {
      issues.push({ severity: 'warning', line: 1, message: 'Script content is empty.' })
      return {
        project: {
          config: {},
          video_sources: {},
          templates: {},
          property_sets: {},
          sections: [],
          flattenScenes: [],
          uiSchema: { video: {}, scene: {}, layer: {} },
          propertyMetadata: {},
        },
        issues,
      }
    }
    const lines = content.split('\n')
    const trimmed = content.trim()
    const isFormalInput =
      trimmed.startsWith('# video') ||
      trimmed.startsWith('- ') ||
      trimmed.startsWith('@') ||
      trimmed.startsWith('//ANYDEO_SPEC')

    let formalProject: Project | null = null
    const formalIssues: any[] = []

    if (isFormalInput) {
      try {
        const ast = (peggyParse as any)(content)

        formalProject = lowerAst(ast, { title })

        if (formalProject.config && formalProject.config.video_sources !== undefined) {
          const normalizedSources = normalizePropertyValue(
            'video_sources',
            formalProject.config.video_sources,
          )
          formalProject.video_sources = normalizedSources
          delete formalProject.config.video_sources
        }

        // Validation
        const validationResult = ProjectSchema.safeParse(formalProject)
        if (!validationResult.success) {
          this._handleValidationErrors(validationResult.error, formalIssues)
        } else {
          formalProject = validationResult.data

          // Post-process with standard VUS resolution logic (after validation to keep references clean)
          this._postProcessProject(formalProject)

          SemanticValidator.validate(formalProject, formalIssues, styleDictionary)
        }
      } catch (e: any) {
        console.error(
          `[Parser] Formal parsing error: ${e.message} at line ${e.location?.start?.line}`,
        )
        formalIssues.push({
          severity: 'warning',
          line: e.location?.start?.line || 1,
          message: `Formal parsing failed: ${e.message}`,
        })
      }
    }

    const context: ParserContext = {
      root: null,
      stack: [],
      currentBlock: null,
      lastPropertyKey: null,
    }
    const lineParser = new LineParser()

    lines.forEach((line, index) => {
      try {
        lineParser.parseLine(line, context, index + 1)
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        const details = 'Check for correct indentation (2 spaces) and property syntax (Key: Value).'
        issues.push({
          severity: 'error',
          line: index + 1,
          message: `Error parsing line: ${msg}`,
          details,
        })
      }
    })

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

    if (context.root) {
      // 1. Process Global Config (# video block)
      project.config = processProperties(context.root.properties)
      if (project.config.video_sources) {
        project.video_sources = project.config.video_sources
        delete project.config.video_sources
      }
      project.propertyMetadata = context.root.propertyMetadata || {}
      if (!project.config.video_name) {
        project.config.video_name = title // fallback to caller-supplied title
      }

      // 1.5 Extract UI Schema (@video, @scene, @layer)
      this._extractUISchema(context.root, project)

      // 1.6 Promote @video UI Schema to global config if needed (supporting minimal SSoT format)
      if (project.uiSchema?.video) {
        Object.entries(project.uiSchema.video).forEach(([key, val]) => {
          const value = val && typeof val === 'object' && 'value' in val ? val.value : val
          if (project.config[key] === undefined || project.config[key] === '') {
            project.config[key] = value
          }
        })
      }

      // 2. Process Children (Templates, Sections, etc)
      // Only cascade specific prefixes from global config to avoid polluting scene/layer scopes
      const cascadableGlobalProps: Record<string, any> = {}
      Object.entries(project.config).forEach(([k, v]) => {
        if (
          k.startsWith('scene_') ||
          k.startsWith('layer_') ||
          k.startsWith('var_') ||
          k.startsWith('vugen_') ||
          k === 'import' ||
          k === 'scene_templates'
        ) {
          cascadableGlobalProps[k] = v
        }
      })
      this._walk(context.root, project, null, null, cascadableGlobalProps)

      // 3. Post-process to assign sIdx and idx for UI consistency
      const flattenScenes: any[] = []
      project.sections.forEach((section, sIdx) => {
        let sceneIdx = 0
        section.scenes?.forEach((item: any) => {
          if (item.block_type === 'note') return
          const scene = item
          scene.sIdx = sIdx
          scene.idx = sceneIdx

          // 3.1 Hierarchical Layer Resolution
          this._resolveLayerInheritance(
            scene,
            project.templates,
            project.config,
            project.video_sources,
            project.property_sets,
          )

          flattenScenes.push({ sIdx, idx: sceneIdx, scene })
          sceneIdx++
        })
      })
      project.flattenScenes = flattenScenes
    }

    // Validate and return
    const validationResult = ProjectSchema.safeParse(project)
    if (!validationResult.success) {
      this._handleValidationErrors(validationResult.error, issues)
      return { project, issues }
    }

    // Validate Template References
    this._validateTemplateReferences(validationResult.data, issues)

    // Run strict semantic validation
    SemanticValidator.validate(validationResult.data, issues, styleDictionary)

    // --- Task 4.1: Parallel Run Comparison ---
    if (isFormalInput && formalProject && !formalIssues.some((i) => i.severity === 'error')) {
      return { project: formalProject, issues: formalIssues }
    }

    return { project: validationResult.data, issues }
  }
  private static _resolveLayerInheritance(
    scene: any,
    templates: Record<string, any>,
    projectConfig: any,
    videoSources?: Record<string, any>,
    propertySets?: Record<string, any>,
  ) {
    // Generate formatted scene sources text
    const formattedSources: string[] = []
    const sourcesList = scene.scene_sources || []
    const sourcesMap = videoSources || {}

    sourcesList.forEach((source: string) => {
      if (!source) return
      const isUrl = source.startsWith('http://') || source.startsWith('https://')
      if (isUrl) {
        formattedSources.push(source)
      } else if (sourcesMap[source]) {
        const src = sourcesMap[source]
        const title = src.title || ''
        const author = src.author || ''
        const url = src.url || src.doi || ''

        let citation = ''
        if (title && author) {
          citation = `${title} by ${author}`
        } else if (title) {
          citation = title
        } else if (author) {
          citation = author
        } else {
          citation = source
        }

        if (url) {
          citation += ` (${url})`
        }
        formattedSources.push(citation)
      } else {
        formattedSources.push(source)
      }
    })

    const sceneSourcesText = formattedSources.join(', ')
    scene.scene_sources_text = sceneSourcesText

    // --- V_0-3-1: Global Scene Template Auto-Injection ---
    // Ensure that a template named 'scene' is always applied first if it exists.
    if (
      templates['scene'] &&
      (!scene.scene_templates || !scene.scene_templates.includes('scene'))
    ) {
      scene.scene_templates = ['scene', ...(scene.scene_templates || [])]
    }

    if (!scene.scene_templates || !Array.isArray(scene.scene_templates)) return

    const resolvedLayers: any[] = []
    const layerMap = new Map<string, any>()
    const sets: Record<string, any> = propertySets || {}

    const toNameList = (raw: any): string[] => {
      if (Array.isArray(raw)) return raw.filter(Boolean).map(String)
      if (!raw) return []
      return String(raw)
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    }

    // Resolve a reference to a template OR a property set. Sets are
    // property-only "templates" (no layers), so both share one resolution path.
    const resolveRef = (refName: string) => {
      if (refName && templates && templates[refName]) return templates[refName]
      if (refName && sets[refName])
        return { properties: sets[refName].properties || {}, layers: [] }
      return null
    }

    const mergeTemplateLayer = (tplLayer: any) => {
      const lowerName = String(tplLayer.layer_name).toLowerCase()
      if (layerMap.has(lowerName)) {
        // Merge properties into existing layer
        const existing = layerMap.get(lowerName)
        existing.properties = { ...existing.properties, ...tplLayer.properties }

        // Track layer-level inherited properties
        ;(existing as any).inheritedProperties = {
          ...((existing as any).inheritedProperties || {}),
          ...tplLayer.properties,
        }

        // Metadata update
        existing.layer_type = tplLayer.layer_type || existing.layer_type
        existing.layer_level =
          tplLayer.layer_level !== undefined ? tplLayer.layer_level : existing.layer_level
        existing.layer_asset_source = tplLayer.layer_asset_source || existing.layer_asset_source
      } else {
        // Clone template layer to avoid shared state mutations
        const clonedLayer = JSON.parse(JSON.stringify(tplLayer))
        ;(clonedLayer as any).inheritedProperties = { ...tplLayer.properties }
        layerMap.set(lowerName, clonedLayer)
        resolvedLayers.push(clonedLayer)
      }
    }

    const sceneInheritedProps: Record<string, any> = { ...projectConfig }

    // Recursively apply a template reference: parent templates (scene_templates)
    // and included property sets (includes) first, then its own props/layers.
    const collectTemplate = (refName: string, seen: Set<string>) => {
      const key = String(refName)
      if (!key || seen.has(key)) return
      const ref = resolveRef(key)
      if (!ref) return
      seen.add(key)

      const refProps = ref.properties || ref

      // Lowest priority: parent templates referenced by scene_templates.
      toNameList((ref as any).scene_templates ?? refProps.scene_templates).forEach((parent) =>
        collectTemplate(parent, seen),
      )

      // Then: included property sets (in declaration order).
      toNameList((ref as any).includes ?? refProps.includes).forEach((setName) => {
        const set = sets[setName]
        if (set) Object.assign(sceneInheritedProps, set.properties || {})
      })

      // Highest: this template's own properties, then its layers.
      Object.assign(sceneInheritedProps, refProps)
      ;(ref.layers || []).forEach(mergeTemplateLayer)
    }

    // 1. Collect layers from templates (in order)
    ;(scene.scene_templates as string[]).forEach((tplName: string) =>
      collectTemplate(tplName, new Set()),
    )

    ;(scene as any).inheritedProperties = {
      ...((scene as any).inheritedProperties || {}),
      ...sceneInheritedProps,
    }

    // 2. Merge explicit scene layers and resolve layer-level templates
    scene.layers.forEach((sceneLayer: any) => {
      const name = sceneLayer.layer_name
      const lowerName = name.toLowerCase()

      // 2.1 Handle Layer-Level Template Imports (@TemplateName inside a layer)
      const importsRaw = sceneLayer.properties?.import || []
      const imports = Array.isArray(importsRaw) ? importsRaw : [importsRaw]

      imports.filter(Boolean).forEach((tplName: string) => {
        const ref = resolveRef(tplName)
        if (ref) {
          // Merge referenced template/set properties as a base for this layer
          const tplProps = ref.properties || ref
          sceneLayer.properties = { ...tplProps, ...sceneLayer.properties }
          sceneLayer.layer_type = sceneLayer.layer_type || (ref as any).layer_type
          sceneLayer.layer_asset_source =
            sceneLayer.layer_asset_source || (ref as any).layer_asset_source
        }
      })
      // `import` is structural sugar; never leak it as a canonical layer property.
      if (sceneLayer.properties && 'import' in sceneLayer.properties)
        delete sceneLayer.properties.import

      // 2.2 Resolve properties and merge with inherited
      if (layerMap.has(lowerName)) {
        const existing = layerMap.get(lowerName)
        existing.properties = { ...existing.properties, ...sceneLayer.properties }

        // Only override layer_type if explicitly set in the scene
        if (sceneLayer.layer_type !== undefined) {
          existing.layer_type = sceneLayer.layer_type
        }

        // Only override layer_level if explicitly set in the scene
        if (sceneLayer.layer_level !== undefined) {
          existing.layer_level = sceneLayer.layer_level
        }
        existing.layer_asset_source = sceneLayer.layer_asset_source || existing.layer_asset_source
      } else {
        resolvedLayers.push(sceneLayer)
      }
    })

    // 3. Update scene with final resolved layers (sorted by level)
    // EXCLUSION LOGIC: If a layer has layer_active: false or (hidden): true, it's suppressed
    scene.layers = resolvedLayers
      .filter((l) => {
        const lp = l.properties || {}
        const active =
          lp.layer_active !== false && lp['(hidden)'] !== true && l.layer_active !== false
        return active
      })
      .sort((a, b) => (a.layer_level ?? 0) - (b.layer_level ?? 0))

    // 4. Apply final defaults if still missing (V_0-3-0 inheritance logic)
    scene.layers.forEach((layer: any) => {
      if (layer.layer_level === undefined) {
        layer.layer_level = rules.properties.layer_level?.default ?? 10
      }
      if (!layer.layer_type) {
        layer.layer_type = rules.properties.layer_type?.default || 'image'
      }

      // --- V_0-2-3 Universal Variable Interpolation ---
      // Automatically resolve any {property} found in layer properties
      if (layer.properties) {
        const resolutionContext: Record<string, any> = {
          ...(projectConfig || {}),
          ...(scene || {}),
          ...(scene.properties || {}),
          scene_name: (
            scene.properties?.scene_name ||
            scene.scene_name ||
            scene.title ||
            ''
          ).trim(),
          scene_sources_text: sceneSourcesText,
        }

        for (const [key, value] of Object.entries(layer.properties)) {
          let resolvedValue = value
          if (typeof value === 'string' && value.includes('{')) {
            resolvedValue = value.replace(/\{([^}]+)\}/g, (_, propName) => {
              const trimmedProp = propName.trim()
              // First check layer properties (highest priority overrides)
              if (layer.properties[trimmedProp] !== undefined) return layer.properties[trimmedProp]
              // Then check the combined context (scene, project, meta)
              return resolutionContext[trimmedProp] ?? `{${trimmedProp}}`
            })
            layer.properties[key] = resolvedValue
          }

          if (typeof resolvedValue === 'string' && resolvedValue.includes('![')) {
            const mediaMatch = resolvedValue.match(/!\[.*?\]\((.*?)\)/)
            if (mediaMatch) {
              const extractedPath = mediaMatch[1]
              if (key === 'layer_text_content' && !layer.properties.layer_asset_source) {
                layer.layer_asset_source = extractedPath
                // Clean the text content to avoid TTS issues with the tag
                const cleaned = resolvedValue.replace(mediaMatch[0], '').trim()
                layer.properties[key] = cleaned
                layer.layer_text_content = cleaned
              } else if (key === 'layer_asset_source' || key === 'layer_asset_raw_url') {
                layer.layer_asset_source = extractedPath
                layer.properties[key] = extractedPath
              }
            }
          }

          // Always sync critical properties to the top level for engine/UI compatibility
          if (key === 'layer_generation_embedded_text')
            layer.layer_generation_embedded_text = layer.properties[key]
          if (key === 'layer_text_content') layer.layer_text_content = layer.properties[key]
          if (key === 'layer_generation_subject')
            layer.layer_generation_subject = layer.properties[key]
          if (key === 'layer_type') layer.layer_type = layer.properties[key]
          if (key === 'layer_level')
            layer.layer_level =
              typeof layer.properties[key] === 'number'
                ? layer.properties[key]
                : parseInt(layer.properties[key])
          if (key === 'layer_asset_source') layer.layer_asset_source = layer.properties[key]
          if (key === 'layer_asset_citation_key')
            layer.layer_asset_citation_key = layer.properties[key]
          if (key === 'layer_asset_access_date')
            layer.layer_asset_access_date = layer.properties[key]
        }
      }
    })
  }

  private static _handleValidationErrors(error: any, issues: any[]) {
    console.error('❌ Validation Error in ScriptParser:', error)
    error.issues.forEach((e: any) => {
      let details = 'Ensure all required fields are present and have correct data types.'
      const pathStr = e.path.join('.')
      if (pathStr.includes('fps'))
        details = 'FPS must be a positive number (usually 24, 30, or 60).'
      if (pathStr.includes('duration')) details = 'Duration must be a positive number.'
      if (pathStr.includes('asset_type'))
        details = 'Supported types: image, video, ai_image, ai_video, talking_avatar.'

      issues.push({
        severity: 'error',
        line: 1,
        path: pathStr,
        message: `${pathStr}: ${e.message}`,
        details,
      })
    })
  }

  private static _validateTemplateReferences(project: Project, issues: any[]) {
    const targetProject = project
    targetProject.sections.forEach((section, sIdx) => {
      section.scenes.forEach((scene: any, idx) => {
        const templateNamesRaw = scene.properties?.scene_templates || scene.scene_templates || []
        const templateNames = Array.isArray(templateNamesRaw)
          ? templateNamesRaw
          : typeof templateNamesRaw === 'string'
            ? templateNamesRaw
                .split(/[,\s]+/)
                .map((t) => t.trim())
                .filter(Boolean)
            : templateNamesRaw
              ? [templateNamesRaw]
              : []

        templateNames.forEach((templateName: string) => {
          const isSet = !!(project as any).property_sets?.[templateName]
          if (templateName && !project.templates[templateName] && !isSet) {
            issues.push({
              severity: 'error',
              line: scene.startLine || 1,
              path: `section[${sIdx}].scene[${idx}]`,
              context: `Scene: ${scene.scene_name || 'Untitled'}`,
              message: `Template '${templateName}' is used but not defined.`,
              details: `All templates must be explicitly defined in the script header under '# Templates' (e.g., '@template ${templateName}').`,
            })
          }
        })
      })
    })
  }

  /**
   * Extracts UI Schema definitions from the block tree
   */
  private static _extractUISchema(root: ParserBlock, project: Project) {
    const findAndProcess = (block: ParserBlock) => {
      block.children?.forEach((child) => {
        if (child.type === 'template' && child.properties.block_type === 'ui_schema') {
          const type = child.title as 'video' | 'scene' | 'layer'
          if (['video', 'scene', 'layer'].includes(type) && project.uiSchema) {
            const props = processProperties(child.properties)
            delete props.block_type // Clean up internal tag

            // Blend in metadata
            const mergedProps: Record<string, any> = {}
            for (const [key, val] of Object.entries(props)) {
              const meta = child.propertyMetadata?.[key]
              mergedProps[key] = meta ? { value: val, ...meta } : val
            }
            project.uiSchema[type] = mergedProps
          }
        }
        findAndProcess(child)
      })
    }
    findAndProcess(root)
  }

  /**
   * Recursively walks the block tree to build project structure
   */
  static _walk(
    block: ParserBlock,
    project: Project,
    currentSection: Section | null = null,
    currentScene: Scene | null = null,
    inheritedProps: Record<string, any> = {},
  ) {
    block.children?.forEach((child) => {
      const childInheritedProps = { ...inheritedProps }

      // Determine if the child has properties that should cascade to descendants
      if (child.type === 'video' || child.type === 'section') {
        const props = processProperties(child.properties)
        for (const [k, v] of Object.entries(props)) {
          if (
            k.startsWith('scene_') ||
            k.startsWith('layer_') ||
            k.startsWith('var_') ||
            k.startsWith('vugen_') ||
            k === 'import' ||
            k === 'scene_templates'
          ) {
            childInheritedProps[k] = v
          }
        }
      }

      switch (child.type) {
        case 'template':
          const templateProps = processProperties(child.properties)
          const templateMediaPath = templateProps.layer_asset_source || child.inline_media || ''

          // Inject block type for validation and UI
          templateProps.block_type = 'template'
          if (templateMediaPath) {
            templateProps.layer_asset_source = templateMediaPath
          }

          const template: any = {
            ...templateProps,
            properties: templateProps,
            layer_asset_source: templateMediaPath,
            layers: [],
            propertyMetadata: child.propertyMetadata || {},
          }
          project.templates[child.title] = template
          this._walk(child, project, null, template, childInheritedProps)
          break
        case 'video':
          // Global video config properties from # video block
          const videoProps = processProperties(child.properties)
          if (videoProps.video_sources) {
            project.video_sources = {
              ...(project.video_sources || {}),
              ...videoProps.video_sources,
            }
            delete videoProps.video_sources
          }
          project.config = { ...project.config, ...videoProps }
          project.propertyMetadata = {
            ...(project.propertyMetadata || {}),
            ...(child.propertyMetadata || {}),
          }
          this._walk(child, project, currentSection, currentScene, childInheritedProps)
          break

        case 'templates':
          // Container for multiple templates
          this._walk(child, project, currentSection, currentScene, childInheritedProps)
          break

        case 'sets':
          // Walk into the # Sets container to process @set children
          this._walk(child, project, currentSection, currentScene, childInheritedProps)
          break

        case 'set': {
          const setProps = processProperties(child.properties)
          delete setProps.block_type
          if (!project.property_sets) project.property_sets = {}
          project.property_sets[child.title] = {
            name: child.title,
            description: child.content || undefined,
            properties: setProps,
          }
          break
        }
        case 'section':
          const explicitSectionProps = processProperties(child.properties)
          const section: Section = {
            title: child.title,
            properties: { ...inheritedProps, ...explicitSectionProps },
            background: explicitSectionProps.background,
            scenes: [],
          }
          project.sections.push(section)
          this._walk(child, project, section, null, childInheritedProps)
          break

        case 'scene':
          const scene = this._processScene(child, project, currentSection, childInheritedProps)
          this._walk(child, project, currentSection, scene, childInheritedProps)
          break

        case 'layer':
          if (currentScene) {
            this._processLayer(child, currentScene)
          }
          break

        case 'note':
          break

        default:
          this._walk(child, project, currentSection, currentScene)
          break
      }

      // Persistence: If we are at root level and a default section was created,
      // ensure it's used for the next siblings in this loop.
      if (!currentSection && project.sections.length > 0) {
        const lastSection = project.sections[project.sections.length - 1]
        if (lastSection.title === 'Default Section') {
          currentSection = lastSection
        }
      }
    })
  }

  private static _processScene(
    child: ParserBlock,
    project: Project,
    currentSection: Section | null,
    inheritedProps: Record<string, any>,
  ): Scene {
    const explicitProps = processProperties(child.properties)
    const sceneProps = { ...inheritedProps, ...explicitProps }

    const rawTemplates = sceneProps.scene_templates || []
    const explicitTemplates = Array.isArray(rawTemplates)
      ? rawTemplates
      : typeof rawTemplates === 'string'
        ? rawTemplates
            .split(/[,\s]+/)
            .map((t) => t.trim())
            .filter(Boolean)
        : rawTemplates
          ? [String(rawTemplates)]
          : []

    const sceneTemplates = [...explicitTemplates]

    const scene: Scene = {
      sIdx: currentSection ? project.sections.indexOf(currentSection) : 0,
      idx: currentSection ? currentSection.scenes.length : 0,
      scene_name: child.title, // Header title
      scene_content: child.content || sceneProps.scene_content || '',
      scene_templates: sceneTemplates,
      scene_sources: sceneProps.scene_sources || [],
      inheritedProperties: { ...inheritedProps },
      properties: {
        ...explicitProps,
      },
      layers: [],
      scene_background_audio_volume: sceneProps.scene_background_audio_volume ?? 0.3,
      scene_voice_volume: sceneProps.scene_voice_volume ?? 1.0,
      startLine: child.startLine || 1,
      propertyMetadata: child.propertyMetadata || {},
      finalProperties: {},
    }

    // Scene markdown assets are treated as an internal background layer at z-index 0.
    if (child.inline_media) {
      const inlineMediaMatch = child.inline_media.match(/^(.+?)(?:\s+(.+))?$/)
      scene.layers.push({
        layer_name: 'background',
        layer_level: 0,
        layer_type: inlineMediaMatch ? rules.properties.layer_type?.default || 'image' : undefined,
        layer_asset_source: inlineMediaMatch ? inlineMediaMatch[1] : '',
        properties: {
          layer_level: 0,
          layer_type: rules.properties.layer_type?.default || 'image',
          layer_asset_source: child.inline_media,
          layer_width: rules.properties.layer_width?.default || 100,
          layer_height: rules.properties.layer_height?.default || 100,
        },
        startLine: child.startLine,
      } as any)
    }

    if (!currentSection) {
      const defaultSection: Section = {
        title: 'Default Section',
        properties: { ...inheritedProps },
        background: inheritedProps.background,
        scenes: [],
      }
      project.sections.push(defaultSection)
      currentSection = defaultSection
    }

    currentSection.scenes.push(scene)
    return scene
  }

  private static _processLayer(child: ParserBlock, currentScene: Scene) {
    const explicitProps = processProperties(child.properties)
    const inheritedProps: Record<string, any> = {}
    const cascadeProps = (sourceProps: Record<string, any>) => {
      for (const [k, v] of Object.entries(sourceProps)) {
        if (
          k.startsWith('layer_') ||
          k.startsWith('var_') ||
          k.startsWith('vugen_') ||
          k === 'import'
        ) {
          inheritedProps[k] = v
        }
      }
    }
    cascadeProps(currentScene.properties || {})

    const layerProps = { ...inheritedProps, ...explicitProps }

    // Inline media (after @@ level Title [media_path])
    if (child.inline_media && !layerProps.layer_asset_source) {
      layerProps.layer_asset_source = child.inline_media
    }

    // --- V_0-2-3 Text Handling ---
    if (
      ['text', 'text_static', 'text_dynamic', 'text_ai_embedded'].includes(layerProps.layer_type) &&
      child.content &&
      !layerProps.layer_text_content
    ) {
      layerProps.layer_text_content = child.content
    }
    // -----------------------------

    if (!currentScene.layers) currentScene.layers = []

    const normalizedTitle = child.title.toLowerCase() === 'background' ? 'background' : child.title
    const existingLayer = currentScene.layers.find(
      (l) => l.layer_name.toLowerCase() === normalizedTitle.toLowerCase(),
    )

    if (existingLayer) {
      if (layerProps.layer_type) existingLayer.layer_type = layerProps.layer_type
      if (layerProps.layer_asset_source)
        existingLayer.layer_asset_source = layerProps.layer_asset_source
      if (layerProps.layer_asset_citation_key)
        existingLayer.layer_asset_citation_key = layerProps.layer_asset_citation_key
      if (layerProps.layer_asset_access_date)
        existingLayer.layer_asset_access_date = layerProps.layer_asset_access_date
      existingLayer.properties = { ...existingLayer.properties, ...layerProps }
      ;(existingLayer as any).finalProperties = {
        ...((existingLayer as any).finalProperties || {}),
        ...layerProps,
      }
    } else {
      const layer = {
        layer_name: normalizedTitle,
        layer_level: layerProps.layer_level,
        layer_type: layerProps.layer_type,
        layer_asset_source: layerProps.layer_asset_source || '',
        layer_asset_citation_key: layerProps.layer_asset_citation_key,
        layer_asset_access_date: layerProps.layer_asset_access_date,
        properties: { ...layerProps },
        finalProperties: { ...layerProps },
        startLine: child.startLine,
        propertyMetadata: child.propertyMetadata || {},
      }
      currentScene.layers.push(layer as any)
    }
  }

  private static _postProcessProject(project: Project, templates: any = {}) {
    project.sections.forEach((section, sIdx) => {
      let sceneIdx = 0
      section.scenes?.forEach((scene: any) => {
        if (scene.block_type === 'note') return
        scene.sIdx = sIdx
        scene.idx = sceneIdx
        this._resolveLayerInheritance(
          scene,
          project.templates || templates,
          project.config,
          project.video_sources,
          project.property_sets,
        )
        sceneIdx++
      })
    })

    // Flatten scenes
    const flattenScenes: any[] = []
    project.sections.forEach((section, sIdx) => {
      let sceneIdx = 0
      section.scenes.forEach((item) => {
        if ((item as any).block_type === 'note') return
        const scene = item as Scene
        flattenScenes.push({ sIdx, idx: sceneIdx, scene })
        sceneIdx++
      })
    })
    project.flattenScenes = flattenScenes
  }
}
