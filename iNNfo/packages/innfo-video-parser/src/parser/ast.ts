/**
 * Anydeo Universal Specification (VUS) Formal AST
 * @spec-source: V_0-2-3 | role: architecture
 */

export type AstNode =
  | ScriptNode
  | SectionNode
  | SceneNode
  | LayerNode
  | PropertyNode
  | ContentNode
  | SetNode
  | NoteNode
  | CommentNode

export interface BaseNode {
  type: string
  /** Standard version this node was parsed under. */
  v: string
  /** Source mapping information. */
  loc?: {
    start: { line: number; column: number }
    end: { line: number; column: number }
  }
}

export interface ScriptNode extends BaseNode {
  type: 'Script'
  body: AstNode[]
}

export interface SectionNode extends BaseNode {
  type: 'Section'
  name: string
  properties: Record<string, any>
}

export interface SceneNode extends BaseNode {
  type: 'Scene'
  name: string
  properties: Record<string, any>
  layers: LayerNode[]
  scene_templates?: string[]
  scene_content?: string
  scene_sources?: string[]
}

export interface LayerNode extends BaseNode {
  type: 'Layer'
  name: string
  index: number
  properties: Record<string, any>
}

export interface SetNode extends BaseNode {
  type: 'Set'
  name: string
  description?: string
  properties: Record<string, any>
}

export interface PropertyNode extends BaseNode {
  type: 'Property' | 'GlobalProperty'
  key: string
  value: any
}

export interface CommentNode extends BaseNode {
  type: 'Comment'
  content: string
}

export interface ContentNode extends BaseNode {
  type: 'Content'
  text: string
}

export interface NoteNode extends BaseNode {
  type: 'Note'
  content: string
}

/**
 * Serializes an AST node back to a VUS Formal string.
 */
export function serializeAst(node: AstNode): string {
  switch (node.type) {
    case 'Script':
      return node.body.map(serializeAst).join('\n')
    case 'Section':
      let sectionMd = `## ${node.name}\n`
      sectionMd += serializeProperties(node.properties)
      return sectionMd
    case 'Scene':
      const sceneMarker = node.properties?.block_type === 'template' ? '@template ' : '@'
      const templatePrefix =
        node.scene_templates && node.scene_templates.length > 0
          ? node.scene_templates.map((t) => `@${t}`).join(' ') + ' '
          : ''
      const sceneWs = node.scene_templates && node.scene_templates.length > 0 ? '' : ' '

      let sceneMd = `${sceneMarker}${sceneWs}${templatePrefix}${node.name}\n`
      sceneMd += serializeProperties(node.properties, { skipSceneContent: true })
      if (node.properties.scene_content) {
        sceneMd += `\n${node.properties.scene_content}\n\n`
      }
      sceneMd += node.layers.map(serializeAst).join('')
      return sceneMd
    case 'Layer':
      let layerMd = `@@ ${node.name}\n`
      layerMd += serializeProperties(node.properties)
      return layerMd
    case 'GlobalProperty':
      if (node.key === 'video_anydeo_specification') {
        return `//ANYDEO_SPEC: ${node.value}\n`
      }
      return `- ${node.key}: ${formatValue(node.value)}\n`
    case 'Property':
      return `- ${node.key}: ${formatValue(node.value)}\n`
    case 'Comment':
      return `# ${node.content}\n`
    case 'Set':
      let setMd = `@set ${node.name}\n`
      setMd += serializeProperties(node.properties)
      return setMd
    default:
      return ''
  }
}

function serializeProperties(
  props: Record<string, any>,
  options: { skipSceneContent?: boolean } = {},
): string {
  let md = ''
  for (const [key, value] of Object.entries(props)) {
    if (key === 'block_type' || key === 'layers') continue
    if (options.skipSceneContent && key === 'scene_content') continue
    md += `- ${key}: ${formatValue(value)}\n`
  }
  return md
}

function formatValue(value: any): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }
  if (typeof value === 'object' && value !== null) {
    return `\`\`\`\n${JSON.stringify(value, null, 2)}\n\`\`\``
  }
  if (typeof value === 'string' && value.includes('\n')) {
    return `\`\`\`\n${value.trim()}\n\`\`\``
  }
  return String(value)
}

/**
 * Converts a Project domain model back into a formal AST.
 */
export function projectToAst(project: any): ScriptNode {
  const body: AstNode[] = []
  const v =
    project.config?.video_anydeo_specification || project.config?.anydeo_specification || 'V_0-3-3'

  // Global properties
  for (const [key, value] of Object.entries(project.config || {})) {
    body.push({ type: 'GlobalProperty', v, key, value } as any)
  }
  if (project.video_sources && Object.keys(project.video_sources).length > 0) {
    body.push({
      type: 'GlobalProperty',
      v,
      key: 'video_sources',
      value: project.video_sources,
    } as any)
  }

  // Templates
  for (const [name, tpl] of Object.entries(project.templates || {})) {
    const tplNode: SceneNode = {
      type: 'Scene',
      v,
      name: `template ${name}`,
      properties: { ...((tpl as any).properties || {}) },
      layers: ((tpl as any).layers || []).map(
        (l: any) =>
          ({
            type: 'Layer',
            v,
            name: l.layer_name,
            index: l.layer_level ?? 10,
            properties: { ...(l.properties || {}) },
          }) as LayerNode,
      ),
    }
    body.push(tplNode)
  }

  // Property Sets
  for (const [name, set] of Object.entries((project as any).property_sets || {})) {
    body.push({
      type: 'Set',
      v,
      name,
      properties: { ...((set as any).properties || {}) },
    } as SetNode)
  }

  // Sections
  for (const section of project.sections || []) {
    body.push({
      type: 'Section',
      v,
      name: section.title,
      properties: { ...(section.properties || {}) },
    } as SectionNode)

    for (const scene of section.scenes || []) {
      if (scene.block_type === 'note') continue
      body.push({
        type: 'Scene',
        v,
        name: scene.scene_name,
        scene_templates: (scene as any).scene_templates || [],
        properties: {
          ...(scene.properties || {}),
          scene_content: scene.scene_content,
          ...(scene.scene_sources && scene.scene_sources.length > 0
            ? { scene_sources: scene.scene_sources }
            : {}),
        },
        layers: (scene.layers || []).map(
          (l: any) =>
            ({
              type: 'Layer',
              v,
              name: l.layer_name,
              index: l.layer_level ?? 10,
              properties: { ...(l.properties || {}) },
            }) as LayerNode,
        ),
      } as SceneNode)
    }
  }

  return { type: 'Script', v, body }
}
