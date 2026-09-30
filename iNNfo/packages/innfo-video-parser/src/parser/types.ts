/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
/**
 * Parser specific types for VUS V3.0
 */

export interface ParserBlock {
  type:
    | 'root'
    | 'video'
    | 'sections'
    | 'scenes'
    | 'templates'
    | 'section'
    | 'scene'
    | 'layer'
    | 'template'
    | 'note'
    | 'sets'
    | 'set'
    | 'unknown'
  title: string
  properties: Record<string, any>
  content: string
  children: ParserBlock[]
  level: number
  parsingState: 'properties' | 'content'
  inline_media?: string
  tags?: string[]
  propertyMetadata?: Record<string, { isHidden?: boolean; isPrimigenia?: boolean }>
  startLine: number
}

export interface ParserContext {
  root: ParserBlock | null
  stack: ParserBlock[]
  currentBlock: ParserBlock | null
  lastPropertyKey: string | null
  isParsingMultilineProperty?: boolean
  specVersion?: string
}

export interface PropertyMatch {
  key: string
  value: any
}
