/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { Project, Scene, Layer } from '../../domain/types.js'

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'pending' | 'info'
  code?: string
  line: number
  path: string
  context: string
  message: string
  details?: string
}

export interface ValidationRule {
  name: string
  description: string
  validate(project: Project, issues: ValidationIssue[]): boolean
}

export interface SceneValidationRule extends ValidationRule {
  validateScene(
    scene: Scene,
    project: Project,
    sIdx: number,
    idx: number,
    issues: ValidationIssue[],
  ): boolean
}

export interface LayerValidationRule extends ValidationRule {
  validateLayer(
    layer: Layer,
    scene: Scene,
    project: Project,
    sIdx: number,
    idx: number,
    lIdx: number,
    issues: ValidationIssue[],
  ): boolean
}
