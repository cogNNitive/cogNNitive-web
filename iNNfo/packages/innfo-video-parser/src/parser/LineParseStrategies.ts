/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
// UVS-COMPLIANT: V_0-2-4
import { ParserContext, ParserBlock } from './types.js'
import {
  parsePropertyPair,
  extractInlineProperties,
  extractMediaShortcuts,
} from './PropertyUtils.js'

export abstract class LineParseStrategy {
  abstract matches(line: string): boolean
  abstract parse(line: string, context: ParserContext, lineNumber: number): boolean

  protected placeBlock(block: ParserBlock, context: ParserContext) {
    if (!context.root) {
      context.root = {
        type: 'root',
        title: 'Root',
        properties: {},
        propertyMetadata: {},
        children: [],
        parsingState: 'properties',
        level: 0,
        content: '',
        startLine: 1,
      }
      context.stack = [context.root as ParserBlock]
    }

    // Auto-pop logic: if new block level <= top of stack level, pop stack
    while (
      context.stack.length > 1 &&
      block.level <= context.stack[context.stack.length - 1].level
    ) {
      context.stack.pop()
    }

    const parent = context.stack[context.stack.length - 1] as ParserBlock
    if (!parent.children) parent.children = []
    parent.children.push(block)
    context.stack.push(block)
    context.currentBlock = block
  }
}

// Regex Constants
const REGEX_MULTI_TEMPLATE = /^((?:@[\p{L}\p{N}_-]+\s*)+)/u
const REGEX_LAYER_SHORTCUT = /^@@(?:\s*\(((?:[^()]*|\([^()]*\))*)\))?(?:\s+(.*))?$/u
const REGEX_TEMPLATE_IDENTIFIER = /^@template\s+([\p{L}\p{N}_-]+)(?:\s+(.*))?$/u
const REGEX_UI_RESERVED = /^@\s*(video|scene|layer)(?:\s+(video|scene|layer))?\s*$/u
const REGEX_SCENE_ANCHOR = /^@[\p{L}\p{N}_-]/u
const REGEX_HEADER_MATCH = /^#+\s/
const REGEX_HEADER_LEVEL = /^(#+)/
const REGEX_SHORTCUT_MEDIA = /!\[(.*?)\]\((.*?)\)/
const REGEX_FIELDS_PAREN = /^\s*\(((?:[^()]*|\([^()]*\))*)\)/
const REGEX_SPEC_HEADER = /^\/\/\s*(?:ANYDEO_SPEC|VUS-COMPLIANT)\s*:\s*([\w.-]+)/

export class ShortcutSceneStrategy extends LineParseStrategy {
  override matches(line: string): boolean {
    const trimmed = line.trim()
    if (REGEX_UI_RESERVED.test(trimmed)) return true
    if (trimmed.startsWith('@@')) return false
    if (trimmed.startsWith('@layer ')) return false
    if (trimmed.startsWith('@@template ')) return false

    return trimmed.startsWith('@')
  }

  override parse(line: string, context: ParserContext, lineNumber: number): boolean {
    const trimmed = line.trim()

    // 0. Check for @video, @scene, @layer (Reserved UI Schema keywords)
    const uiSchemaMatch = trimmed.match(REGEX_UI_RESERVED)
    if (uiSchemaMatch) {
      const block: ParserBlock = {
        type: 'template',
        title: uiSchemaMatch[1], // "video", "scene", "layer"
        properties: {
          block_type: 'ui_schema',
        },
        propertyMetadata: {},
        content: '',
        children: [],
        level: 2,
        parsingState: 'properties',
        startLine: lineNumber,
      }
      this.placeBlock(block, context)
      return true
    }

    // 1a. Check for @set definition block
    const setDefMatch = trimmed.match(/^@\s*set\s+([\p{L}\p{N}_-]+)(?:\s+(.*))?$/u)
    if (setDefMatch) {
      const block: ParserBlock = {
        type: 'set',
        title: setDefMatch[1],
        properties: {},
        propertyMetadata: {},
        content: setDefMatch[2] ? setDefMatch[2].trim() : '',
        children: [],
        level: 2,
        parsingState: 'properties',
        startLine: lineNumber,
      }
      this.placeBlock(block, context)
      return true
    }

    // 1. Check for @template definition block
    const templateDefMatch = trimmed.match(REGEX_TEMPLATE_IDENTIFIER)
    if (templateDefMatch) {
      const block: ParserBlock = {
        type: 'template',
        title: templateDefMatch[1],
        properties: {},
        propertyMetadata: {},
        content: '',
        children: [],
        level: 2,
        parsingState: 'properties',
        startLine: lineNumber,
      }
      this.placeBlock(block, context)
      return true
    }

    // 2. Parse Scene Shortcut (@Title or @Template Name)
    // [V_0-3-2]: Refined logic to avoid blind substring(1) which caused duplication.
    let workingLine = trimmed
    const templates: string[] = []

    // If it starts with '@ ', it's a marker followed by name.
    if (workingLine.startsWith('@ ')) {
      workingLine = workingLine.substring(1).trim()
    } else if (workingLine.startsWith('@')) {
      // It might be one or more templates: @Template1 @Template2 Name
      const tplMatch = workingLine.match(REGEX_MULTI_TEMPLATE)
      if (tplMatch) {
        const tplPart = tplMatch[1]
        const found = tplPart.match(/@([\p{L}\p{N}_-]+)/gu)
        if (found) {
          found.forEach((t) => templates.push(t.replace(/^@/, '')))
        }
        workingLine = workingLine.replace(tplMatch[0], '').trim()
      } else {
        // Lone @ followed by name (e.g. @Title)
        workingLine = workingLine.substring(1).trim()
      }
    }

    // Extract inline properties in parens: (key: val, key2: val2)
    let props: Record<string, any> = {}
    let propertyMetadata: Record<string, any> = {}
    const fieldMatch = workingLine.match(REGEX_FIELDS_PAREN)
    if (fieldMatch) {
      const extracted = extractInlineProperties(fieldMatch[1])
      props = extracted.properties
      propertyMetadata = extracted.propertyMetadata
      workingLine = workingLine.replace(fieldMatch[0], '').trim()
    }

    // Extract inline media: ![alt](url)
    const { media: inlineMedia, cleanContent: finalLine } = extractMediaShortcuts(workingLine)
    workingLine = finalLine

    const title = workingLine || 'Untitled Scene'

    const scProps: Record<string, any> = {
      ...props,
      scene_templates: templates,
    }
    // REMOVED INSTRUCTION: inlineMedia injection here causes Scope Mismatch on Scenes
    // layer_asset_source is now HANDLED in Parser.ts as an internal Layer 0 (Primigenia).
    if (!scProps.block_type) scProps.block_type = 'scene'

    const block: ParserBlock = {
      type: 'scene',
      title,
      properties: scProps,
      propertyMetadata,
      inline_media: inlineMedia,
      content: '',
      children: [],
      level: 3,
      parsingState: 'content',
      startLine: lineNumber,
    }
    this.placeBlock(block, context)
    return true
  }
}

export class TemplateApplicationStrategy extends LineParseStrategy {
  override matches(line: string): boolean {
    const trimmed = line.trim()
    // Matches @TemplateName (no space after @, and alphanumeric/underscore/dash only)
    return /^@[\p{L}\p{N}_-]+$/u.test(trimmed)
  }

  override parse(line: string, context: ParserContext, _lineNumber: number): boolean {
    if (!context.currentBlock) return false

    const type = context.currentBlock.type
    // Only apply if we are inside a block that supports templates
    if (!['scene', 'layer', 'template'].includes(type)) return false

    const name = line.trim().substring(1)

    if (type === 'scene' || type === 'template') {
      const current = context.currentBlock.properties.scene_templates || []
      const templates = Array.isArray(current) ? [...current] : current ? [current] : []
      if (!templates.includes(name)) templates.push(name)
      context.currentBlock.properties.scene_templates = templates
    } else if (type === 'layer') {
      const current = context.currentBlock.properties.import || []
      const templates = Array.isArray(current) ? [...current] : current ? [current] : []
      if (!templates.includes(name)) templates.push(name)
      context.currentBlock.properties.import = templates
    }

    return true
  }
}

export class SpecVersionStrategy extends LineParseStrategy {
  override matches(line: string): boolean {
    return REGEX_SPEC_HEADER.test(line.trim())
  }

  override parse(line: string, context: ParserContext, _lineNumber: number): boolean {
    const match = line.trim().match(REGEX_SPEC_HEADER)
    if (match) {
      context.specVersion = match[1]
      return true
    }
    return false
  }
}

export class HeaderStrategy extends LineParseStrategy {
  override matches(line: string): boolean {
    return REGEX_HEADER_MATCH.test(line.trim())
  }

  override parse(line: string, context: ParserContext, lineNumber: number): boolean {
    const trimmed = line.trim()
    const levelMatch = trimmed.match(REGEX_HEADER_LEVEL)
    const level = levelMatch ? levelMatch[1].length : 1
    const title = trimmed.replace(REGEX_HEADER_MATCH, '').trim()

    const lowerTitle = title.toLowerCase()
    // Structural Identifiers (Strict V_0-3-1 English-only)
    const isVideo = lowerTitle === 'video' || lowerTitle === 'vídeo'
    const isTemplates = lowerTitle === 'templates'
    const isSections = lowerTitle === 'sections'
    const isSets = lowerTitle === 'sets'
    const isTemplate = lowerTitle === 'template'
    const isScene = lowerTitle === 'scene'
    const isLayer = lowerTitle === 'layer'

    let type: ParserBlock['type'] = 'section'

    if (isVideo) {
      type = 'video'
    } else if (isTemplates) {
      type = 'templates'
    } else if (isSections) {
      type = 'sections'
    } else if (isSets) {
      type = 'sets'
    } else if (isTemplate || isScene || isLayer) {
      type = 'template'
    } else if (level === 1) {
      type = 'section'
    }

    const block: ParserBlock = {
      type,
      title,
      properties: {},
      propertyMetadata: {},
      content: '',
      children: [],
      level,
      parsingState: 'properties',
      startLine: lineNumber,
    }

    this.placeBlock(block, context)
    return true
  }
}

export class ShortcutLayerStrategy extends LineParseStrategy {
  override matches(line: string): boolean {
    return REGEX_LAYER_SHORTCUT.test(line.trim())
  }

  override parse(line: string, context: ParserContext, lineNumber: number): boolean {
    const trimmed = line.trim()
    const match = trimmed.match(REGEX_LAYER_SHORTCUT)
    if (!match) return false

    const index = 10
    const labelPart = match[1] || ''
    const content = match[2] || ''

    const props: Record<string, any> = {
      layer_level: index,
    }
    const propertyMetadata: Record<string, any> = {}

    let labelTitle = ''
    if (labelPart) {
      const extracted = extractInlineProperties(labelPart)
      if (Object.keys(extracted.properties).length > 0) {
        Object.assign(props, extracted.properties)
        Object.assign(propertyMetadata, extracted.propertyMetadata)
      } else {
        labelTitle = labelPart
      }
    }

    const { media: inlineMedia, cleanContent } = extractMediaShortcuts(content)

    const layerProps: Record<string, any> = { ...props }
    if (inlineMedia) layerProps.layer_asset_source = inlineMedia

    const rawTitle = labelTitle.trim() || cleanContent.trim() || (index === 10 ? 'background' : '')
    const finalTitle = rawTitle.toLowerCase() === 'background' ? 'background' : rawTitle

    const block: ParserBlock = {
      type: 'layer',
      title: finalTitle,
      properties: layerProps,
      propertyMetadata,
      inline_media: inlineMedia,
      content: labelTitle.trim() ? cleanContent : '',
      children: [],
      level: 4,
      parsingState: 'content',
      startLine: lineNumber,
    }

    this.placeBlock(block, context)
    return true
  }
}

export class PropertyStrategy extends LineParseStrategy {
  override matches(line: string): boolean {
    const trimmed = line.trim()

    if (!trimmed.startsWith('- ')) return false

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) return false

    const key = trimmed.substring(2, colonIndex).trim()

    // Stricter property key validation
    if (key.includes(' ')) return false
    // Don't catch conversational sentences (No uppercase leading) unless in parens
    if (/^[A-Z]/.test(key) && !key.startsWith('(')) return false

    return /^\(?[a-zA-Z0-9_./-]+\)?$/.test(key)
  }

  override parse(line: string, context: ParserContext, lineNumber: number): boolean {
    const parsed = parsePropertyPair(line)
    if (!parsed || !context.currentBlock) return false

    const key = parsed.key
    const value = parsed.value

    // Check for multiline start: - key: ```
    if (typeof value === 'string' && value.trim() === '```') {
      context.isParsingMultilineProperty = true
      context.lastPropertyKey = key
      context.currentBlock.properties[key] = ''
      return true
    }

    context.currentBlock.properties[key] = value

    if (key === 'video_anydeo_specification' || key === 'anydeo_specification') {
      context.specVersion = value
    }
    if (parsed.isHidden) {
      if (!context.currentBlock.propertyMetadata) context.currentBlock.propertyMetadata = {}
      if (!context.currentBlock.propertyMetadata[parsed.key])
        context.currentBlock.propertyMetadata[parsed.key] = {}
      context.currentBlock.propertyMetadata[parsed.key].isHidden = true
    }
    context.lastPropertyKey = parsed.key
    return true
  }
}

export class MultilinePropertyContinuationStrategy extends LineParseStrategy {
  override matches(_line: string): boolean {
    // This is a state-based strategy, it matches purely on context state
    return false // Not used via standard matching if we handle it in LineParser or specific logic
  }

  // Since LineParser uses .matches(), we need a different approach or make matches() check context
  static matchesMultiline(context: ParserContext): boolean {
    return !!context.isParsingMultilineProperty
  }

  override parse(line: string, context: ParserContext, _lineNumber: number): boolean {
    if (!context.isParsingMultilineProperty || !context.currentBlock || !context.lastPropertyKey)
      return false

    const trimmed = line.trim()
    if (trimmed === '```') {
      context.isParsingMultilineProperty = false
      // Clean up trailing newline if any
      const val = context.currentBlock.properties[context.lastPropertyKey]
      if (typeof val === 'string' && val.endsWith('\n')) {
        context.currentBlock.properties[context.lastPropertyKey] = val.slice(0, -1)
      }
      return true
    }

    const currentValue = context.currentBlock.properties[context.lastPropertyKey] || ''
    context.currentBlock.properties[context.lastPropertyKey] = currentValue + line + '\n'
    return true
  }
}

export class ContentStrategy extends LineParseStrategy {
  override matches(line: string): boolean {
    const trimmed = line.trim()
    return trimmed.length > 0 && !trimmed.startsWith('#') && !trimmed.startsWith('@')
  }

  override parse(line: string, context: ParserContext, _lineNumber: number): boolean {
    if (!context.currentBlock) return false

    const trimmed = line.trim()
    if (context.currentBlock.parsingState === 'content') {
      context.currentBlock.content = context.currentBlock.content
        ? context.currentBlock.content + '\n' + trimmed
        : trimmed
      return true
    }
    return false
  }
}

export class MediaInclusionStrategy extends LineParseStrategy {
  override matches(line: string): boolean {
    return REGEX_SHORTCUT_MEDIA.test(line.trim())
  }

  override parse(line: string, context: ParserContext, _lineNumber: number): boolean {
    if (!context.currentBlock) return false
    const match = line.trim().match(REGEX_SHORTCUT_MEDIA)
    if (match) {
      const url = match[2]
      const type = context.currentBlock.type

      // Import PathUtils for type detection (Static class, no need to import separately if part of internal bundle logic or use property utils)
      // But here we are in LineParseStrategies, let's use a simple local check or import PathUtils

      // Store in canonical V_0-1-1 key ONLY for layers/templates
      // to avoid Scope Mismatch error on Scenes
      if (type === 'layer' || type === 'template') {
        context.currentBlock.properties.layer_asset_source = url

        // --- AUTO-TYPE DETECTION (ENHANCEMENT) ---
        // Infer layer_type only if it's not explicitly set to a specialized type (talking_avatar, ai_image, etc.)
        const currentType = context.currentBlock.properties.layer_type
        if (
          !currentType ||
          currentType === 'image' ||
          currentType === 'video' ||
          currentType === 'audio'
        ) {
          const ext = url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() || ''
          const isVideo = ['mp4', 'webm', 'mov', 'm4v'].includes(ext)
          const isAudio = ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)

          if (isVideo) context.currentBlock.properties.layer_type = 'video'
          else if (isAudio) context.currentBlock.properties.layer_type = 'audio'
          else if (!currentType) context.currentBlock.properties.layer_type = 'image'
        }
        // ------------------------------------------
      }

      if (!context.currentBlock.propertyMetadata) context.currentBlock.propertyMetadata = {}
      if (!context.currentBlock.propertyMetadata.layer_asset_source)
        context.currentBlock.propertyMetadata.layer_asset_source = {}
      context.currentBlock.propertyMetadata.layer_asset_source.isPrimigenia = true

      context.currentBlock.inline_media = url
      return true
    }
    return false
  }
}

export class LineParser {
  private multilineStrategy = new MultilinePropertyContinuationStrategy()
  private strategies: LineParseStrategy[] = [
    new SpecVersionStrategy(),
    new HeaderStrategy(),
    new TemplateApplicationStrategy(),
    new ShortcutSceneStrategy(),
    new ShortcutLayerStrategy(),
    new PropertyStrategy(),
    new MediaInclusionStrategy(),
    new ContentStrategy(),
  ]

  parseLine(line: string, context: ParserContext, lineNumber: number) {
    // State-based escape hatch for multiline properties
    if (context.isParsingMultilineProperty) {
      if (this.multilineStrategy.parse(line, context, lineNumber)) return
    }

    for (const strategy of this.strategies) {
      if (strategy.matches(line)) {
        if (strategy.parse(line, context, lineNumber)) return
      }
    }
  }
}
