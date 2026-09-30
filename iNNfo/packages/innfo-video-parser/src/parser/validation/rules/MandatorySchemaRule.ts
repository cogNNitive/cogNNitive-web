/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { Project, Scene, Layer } from '../../../domain/types.js'
import { SceneValidationRule, LayerValidationRule, ValidationIssue } from '../types.js'
import rules from '../../../rules/index.js'
import { version as SYSTEM_VERSION } from '../../../version.js'

import { PropertyResolution } from '../../../utils/PropertyResolution.js'

export class MandatorySchemaRule implements SceneValidationRule, LayerValidationRule {
  name = 'MandatorySchemaRule'
  description = `Checks for mandatory project and property requirements as defined in VUS ${SYSTEM_VERSION}`

  private _allProps: Record<string, any> | null = null

  private _ensureRules() {
    if (!this._allProps) {
      this._allProps = (rules.properties || rules) as Record<string, any>
    }
  }

  validate(project: Project, issues: ValidationIssue[]): boolean {
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
    const pathStr = `section[${sIdx}].scene[${idx}]`

    this._ensureRules()
    const props = this._allProps!

    // `block_type` is only present on Note blocks, not on typed Scene objects.
    // Use a narrow cast to check for it without widening the whole object to `any`.
    const sceneWithBlockType = scene as Scene & { block_type?: string }

    Object.entries(props).forEach(([key, def]: [string, any]) => {
      if (def.required && def.scope === 'scene') {
        if (sceneWithBlockType.block_type === 'template') return

        const val = PropertyResolution.getEffectiveSceneProperty(key, scene, project)
        const isEmpty = val === undefined || val === null || val === '' || val === 'none'

        if (isEmpty) {
          issues.push({
            severity: 'warning',
            line: scene.startLine ?? 1,
            path: pathStr,
            context: `Scene: ${scene.scene_name || 'Untitled'}`,
            message: `Required field '${def.label || key}' is missing.`,
            details: def.description || 'This field is mandatory for the scene structure.',
          })
          hasErrors = true
        }
      }
    })

    const currentModel = PropertyResolution.getEffectiveSceneProperty(
      'scene_tts_model',
      scene,
      project,
    )
    const layers = scene.layers || []
    const hasTalkingAvatar = layers.some((l) => l.layer_type === 'talking_avatar')

    if (
      hasTalkingAvatar &&
      (!currentModel ||
        currentModel === 'none' ||
        currentModel === 'unset' ||
        currentModel === 'automatic')
    ) {
      // For talking avatars, automatic is acceptable but we need to ensure tts_model is active
    }

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
    const layerPath = `section[${sIdx}].scene[${idx}].layer[${lIdx}]`

    this._ensureRules()
    const props = this._allProps!

    Object.entries(props).forEach(([key, def]: [string, any]) => {
      if (def.required && def.scope === 'layer') {
        const depends_on = def.depends_on
        let shouldCheck = true
        if (depends_on && typeof depends_on === 'object') {
          shouldCheck = Object.entries(depends_on).every(([k, v]: [string, any]) => {
            const currentVal = PropertyResolution.getEffectiveLayerProperty(
              k,
              layer,
              scene,
              project,
            )
            return currentVal === v
          })
        }

        if (shouldCheck) {
          const val = PropertyResolution.getEffectiveLayerProperty(key, layer, scene, project)
          const isEmpty = val === undefined || val === null || val === ''
          if (isEmpty) {
            issues.push({
              severity: 'error',
              line: layer.startLine ?? scene.startLine ?? 1,
              path: layerPath,
              context: `Scene: ${scene.scene_name || 'Untitled'} > Layer: ${layer.layer_name || 'Untitled'}`,
              message: `Required field '${def.label || key}' is missing.`,
              details: def.description || 'Mandatory layer property is missing.',
            })
            hasErrors = true
          }
        }
      }
    })

    return hasErrors
  }
}
