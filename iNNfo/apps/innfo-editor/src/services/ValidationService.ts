import { useKnowledgeStore } from '../stores/knowledgeStore'
import { validateFormatContent } from '../shared/validator'
import type { ValidationReport } from '../shared/validation-types'

export class ValidationService {
  constructor(
    private knowledgeStore = useKnowledgeStore(),
    private showToast: (msg: string, type: 'success' | 'warning' | 'error') => void,
  ) {}

  async runValidation(selectedNodeId: string): Promise<ValidationReport | null> {
    const node = this.knowledgeStore.getNode(selectedNodeId)
    if (!node) {
      this.showToast('Selected node not found in model store.', 'error')
      return null
    }

    const rawContent = node.rawContent
    if (!rawContent) {
      this.showToast(
        'No raw content available for this node (it may be a nested element without its own file).',
        'warning',
      )
      return null
    }

    const fileName = node.source.path.split('/').pop() || node.source.path

    const report = validateFormatContent(rawContent, fileName)

    const { errors, warnings, total, passed } = report.summary
    if (errors === 0 && warnings === 0) {
      this.showToast(`Validation passed (${passed}/${total} checks).`, 'success')
    } else if (errors > 0) {
      this.showToast(`Validation found ${errors} error(s), ${warnings} warning(s).`, 'error')
    } else {
      this.showToast(`Validation passed with ${warnings} warning(s).`, 'warning')
    }

    return report
  }
}
