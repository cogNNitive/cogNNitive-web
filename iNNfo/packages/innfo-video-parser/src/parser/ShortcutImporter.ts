/**
 * @spec-source:V_0-3-3 | role: core_logic
 */
export class ShortcutImporter {
  /**
   * Translates a raw shorthand markdown text with // template comments
   * into a strict V_0-2-0 compliant explicit markdown text.
   */
  static transpile(rawText: string): string {
    const lines = rawText.split('\n')

    let output = ''
    let hasSections = false

    // Scan to see if user has provided explicit headers.
    for (const line of lines) {
      if (/^#+\s/.test(line.trim())) {
        hasSections = true
        break
      }
      if (/^@/.test(line.trim())) {
        // Already has explicit blocks, we could optionally skip translation
        // or just let them pass through. we will just let it pass through standard logic.
      }
    }

    if (!hasSections) {
      output += '## Default Section (Imported)\n\n'
    }

    let currentTemplates: string[] = []
    let currentBlockLines: string[] = []
    let consecutiveComments = false
    let lastStructuralBarrier: 'header' | 'scene' | 'layer' | 'none' = 'none'
    let isInsideMultiline = false

    const flushBlock = () => {
      if (currentBlockLines.length === 0) return

      const blockContent = currentBlockLines.join('\n').trim()
      if (blockContent) {
        // Determine if we need to construct an explicit Scene (@)
        // We ONLY do this if we are not already inside an explicit scene/layer block.
        const needsImplicitScene =
          lastStructuralBarrier === 'header' || lastStructuralBarrier === 'none'

        if (needsImplicitScene) {
          output += '@ \n'
        }

        // Add the template imports from shorthand //
        if (currentTemplates.length > 0) {
          const imports = currentTemplates.join(', ')
          output += `- import: ${imports}\n`
        }

        // Add the scene content as standard implicit text (Parser.ts handles this as scene_content)
        output += `${blockContent}\n\n`
      }

      currentBlockLines = []
    }

    for (const line of lines) {
      const trimmed = line.trim()

      if (isInsideMultiline) {
        output += line + '\n'
        if (trimmed === '```') {
          isInsideMultiline = false
        }
        continue
      }

      // Detect template assignments (Shorthand // TemplateName)
      // [V_0-2-0]: Skip Descriptive comments (e.g., // [Documentation] or // Long sentence)
      const isTemplateShorthand = /^(\/\/)\s*[a-zA-Z0-9_-]+$/.test(trimmed)
      if (isTemplateShorthand) {
        if (currentBlockLines.length > 0) {
          flushBlock()
          currentTemplates = []
        } else if (!consecutiveComments) {
          // New comment block started after an empty line flush
          currentTemplates = []
        }

        consecutiveComments = true
        const templateName = trimmed.replace('//', '').trim()
        if (templateName) {
          currentTemplates.push(templateName)
        }
        continue
      } else if (trimmed.startsWith('//')) {
        // It's a descriptive comment, let it pass through to the parser as a comment line
        output += line + '\n'
        continue
      }

      consecutiveComments = false

      // Detect structural barriers. If we see a structural barrier, we shouldn't translate it implicitly.
      const isHeader = /^#+\s/.test(trimmed)
      const isScene = /^@\s/.test(trimmed) || /^@[\p{L}\p{N}_-]+\s*/u.test(trimmed)
      const isLayer = /^@@/.test(trimmed)

      if (isHeader || isScene || isLayer) {
        flushBlock()
        output += line + '\n'
        currentTemplates = []

        if (isHeader) lastStructuralBarrier = 'header'
        else if (isScene) lastStructuralBarrier = 'scene'
        else if (isLayer) lastStructuralBarrier = 'layer'

        continue
      }

      // Paragraph separation detection (empty line)
      if (trimmed === '') {
        if (currentBlockLines.length > 0) {
          flushBlock()
        }
        continue
      }

      // [FIX V_0-2-0]: Skip property lines (- key: val) so they remain in parent scope
      // We use a regex that matches common VUS property starts.
      const isProperty = /^-?\s*[a-zA-Z0-9_-]+\s*[:=]/.test(trimmed)
      if (isProperty && currentBlockLines.length === 0) {
        output += line + '\n'
        if (trimmed.endsWith('```')) {
          isInsideMultiline = true
        }
        continue
      }

      currentBlockLines.push(line)
    }

    flushBlock()

    return output
  }
}
