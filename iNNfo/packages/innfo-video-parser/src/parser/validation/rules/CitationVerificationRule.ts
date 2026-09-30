/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { Project, Scene, Layer } from '../../../domain/types.js'
import { SceneValidationRule, LayerValidationRule, ValidationIssue } from '../types.js'

export class CitationVerificationRule implements SceneValidationRule, LayerValidationRule {
  name = 'CitationVerificationRule'
  description =
    'Verifies that all referenced citekeys in scenes and layers resolve against video_sources.'

  validate(project: Project, _issues: ValidationIssue[]): boolean {
    return false
  }

  validateScene(
    scene: Scene,
    project: Project,
    sIdx: number,
    idx: number,
    issues: ValidationIssue[],
  ): boolean {
    let hasErrors = false
    const sources = (scene.scene_sources || []).filter(Boolean)
    const globalSources = project.video_sources || {}

    sources.forEach((source) => {
      const isHttp = String(source).startsWith('http://') || String(source).startsWith('https://')
      if (!isHttp && !globalSources[source]) {
        issues.push({
          severity: 'error',
          code: 'ORPHANED_CITATION',
          line: scene.startLine || 1,
          path: `section[${sIdx}].scene[${idx}].scene_sources`,
          context: `Scene: ${scene.scene_name || 'Untitled'}`,
          message: `Citation key '${source}' is not defined in global video_sources repository.`,
          details: `All non-URL citations must be registered in the project's 'video_sources' block.`,
        })
        hasErrors = true
      }
    })

    return hasErrors
  }

  validateLayer(
    layer: Layer,
    scene: Scene,
    project: Project,
    sIdx: number,
    idx: number,
    lIdx: number,
    issues: ValidationIssue[],
  ): boolean {
    let hasErrors = false
    const citekey =
      layer.layer_asset_citation_key || (layer.properties as any)?.layer_asset_citation_key
    const globalSources = project.video_sources || {}

    if (citekey && !globalSources[citekey]) {
      issues.push({
        severity: 'error',
        code: 'ORPHANED_CITATION',
        line: layer.startLine || scene.startLine || 1,
        path: `section[${sIdx}].scene[${idx}].layer[${lIdx}].layer_asset_citation_key`,
        context: `Layer: ${layer.layer_name || 'Untitled'}`,
        message: `Citation key '${citekey}' is not defined in global video_sources repository.`,
        details: `All layer asset citation keys must be registered in the project's 'video_sources' block.`,
      })
      hasErrors = true
    }

    return hasErrors
  }
}
