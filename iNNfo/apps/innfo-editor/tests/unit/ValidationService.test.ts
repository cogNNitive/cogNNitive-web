import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ValidationService } from '../../src/services/ValidationService'
import { validateFormatContent } from '../../src/shared/validator'
import { useKnowledgeStore } from '../../src/stores/knowledgeStore'

vi.mock('../../src/shared/validator', () => ({
  validateFormatContent: vi.fn(),
}))

vi.mock('../../src/stores/knowledgeStore', () => ({
  useKnowledgeStore: vi.fn(),
}))

describe('ValidationService (TDD)', () => {
  let mockModelStore: any
  let mockShowToast: any

  beforeEach(() => {
    mockModelStore = {
      getNode: vi.fn(),
    }
    mockShowToast = vi.fn()
    vi.mocked(useKnowledgeStore).mockReturnValue(mockModelStore as any)
  })

  it('shows error toast when node is not found', async () => {
    mockModelStore.getNode.mockReturnValue(null)
    const service = new ValidationService(mockModelStore, mockShowToast)

    const result = await service.runValidation('Node1')

    expect(result).toBeNull()
    expect(mockShowToast).toHaveBeenCalledWith('Selected node not found in model store.', 'error')
  })

  it('shows warning toast when node has no rawContent', async () => {
    mockModelStore.getNode.mockReturnValue({
      rawContent: null,
      source: { path: 'some/path.md' },
    })
    const service = new ValidationService(mockModelStore, mockShowToast)

    const result = await service.runValidation('Node1')

    expect(result).toBeNull()
    expect(mockShowToast).toHaveBeenCalledWith(
      'No raw content available for this node (it may be a nested element without its own file).',
      'warning',
    )
  })

  it('runs validateFormatContent and shows success toast on passing report', async () => {
    mockModelStore.getNode.mockReturnValue({
      rawContent: 'valid content',
      source: { path: 'some/file.md' },
    })
    const mockReport = {
      summary: { errors: 0, warnings: 0, total: 5, passed: 5 },
    }
    vi.mocked(validateFormatContent).mockReturnValue(mockReport as any)

    const service = new ValidationService(mockModelStore, mockShowToast)
    const result = await service.runValidation('Node1')

    expect(result).toBe(mockReport)
    expect(validateFormatContent).toHaveBeenCalledWith('valid content', 'file.md')
    expect(mockShowToast).toHaveBeenCalledWith('Validation passed (5/5 checks).', 'success')
  })

  it('shows error toast when validation report has errors', async () => {
    mockModelStore.getNode.mockReturnValue({
      rawContent: 'invalid content',
      source: { path: 'some/file.md' },
    })
    const mockReport = {
      summary: { errors: 2, warnings: 1, total: 5, passed: 2 },
    }
    vi.mocked(validateFormatContent).mockReturnValue(mockReport as any)

    const service = new ValidationService(mockModelStore, mockShowToast)
    const result = await service.runValidation('Node1')

    expect(result).toBe(mockReport)
    expect(mockShowToast).toHaveBeenCalledWith(
      'Validation found 2 error(s), 1 warning(s).',
      'error',
    )
  })

  it('shows warning toast when validation report has warnings but no errors', async () => {
    mockModelStore.getNode.mockReturnValue({
      rawContent: 'warning content',
      source: { path: 'some/file.md' },
    })
    const mockReport = {
      summary: { errors: 0, warnings: 3, total: 5, passed: 2 },
    }
    vi.mocked(validateFormatContent).mockReturnValue(mockReport as any)

    const service = new ValidationService(mockModelStore, mockShowToast)
    const result = await service.runValidation('Node1')

    expect(result).toBe(mockReport)
    expect(mockShowToast).toHaveBeenCalledWith('Validation passed with 3 warning(s).', 'warning')
  })
})
