import type { KnowledgeNode, MetamodelConcept } from '../model/types'

export interface PromptContext {
  block?: KnowledgeNode
  schema?: MetamodelConcept
  conceptName?: string
  elementName?: string
  elementType?: string
  modelName?: string
  modelPath?: string
  relativePath?: string
  workspaceName?: string
  rawContent?: string
  userNotes?: string
  taskType?: 'implement' | 'refactor' | 'explain' | 'validate' | 'custom'
  customInstructions?: string
}

function getNodeDescription(node?: KnowledgeNode): string | undefined {
  if (!node?.fields) return undefined
  const desc = node.fields['description']?.value
  return typeof desc === 'string' ? desc : undefined
}

export function generateOpenCodePrompt(context: PromptContext): string {
  const parts: string[] = []

  const targetTitle = context.elementName
    ? `${context.conceptName ? context.conceptName + ': ' : ''}${context.elementName}`
    : context.conceptName || context.modelName || 'Model Element'

  parts.push(`# Context: iNNfo Model Element — ${targetTitle}`)

  if (context.modelName || context.relativePath || context.modelPath) {
    parts.push(`- **Model:** \`${context.modelName || 'Active Model'}\``)
    const filePath = context.relativePath || context.modelPath
    if (filePath) {
      parts.push(`- **File:** \`${filePath}\``)
    }
    parts.push('')
  }

  const desc = getNodeDescription(context.block)
  if (desc) {
    parts.push(`> ${desc}\n`)
  }

  if (context.block?.fields && Object.keys(context.block.fields).length > 0) {
    parts.push('### Fields:')
    for (const [k, fv] of Object.entries(context.block.fields)) {
      const v = fv?.value !== undefined ? fv.value : fv
      parts.push(`- **${k}:** ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    }
    parts.push('')
  }

  const raw = context.rawContent
  if (raw) {
    parts.push('### Definition (Markdown AST segment):')
    parts.push('```markdown')
    parts.push(raw.trim())
    parts.push('```\n')
  }

  parts.push('### Instructions:')
  if (context.userNotes) {
    parts.push(context.userNotes)
  } else {
    parts.push(
      `Please inspect this ${context.conceptName || 'element'} and provide implementation or verification code conforming to clean architecture and project standards.`,
    )
  }

  return parts.join('\n')
}

