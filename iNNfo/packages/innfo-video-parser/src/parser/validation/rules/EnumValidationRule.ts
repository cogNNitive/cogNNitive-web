/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { Project, Scene, Layer } from '../../../domain/types.js'
import { SceneValidationRule, LayerValidationRule, ValidationIssue } from '../types.js'
import rules from '../../../rules/index.js'
import { getFlatDefinitions } from '../utils.js'

export class EnumValidationRule implements SceneValidationRule, LayerValidationRule {
  name = 'EnumValidationRule'
  description = 'Checks for valid values in select/enum properties (v0.6.0 compliant)'

  private _flatDefMap: Record<string, any> | null = null
  private _apiOptions: any = null

  private _ensureRules() {
    if (!this._flatDefMap) {
      const allProps = (rules.properties || rules) as Record<string, any>
      this._flatDefMap = getFlatDefinitions(allProps)
      this._apiOptions = (rules as any).system?.api_options || {}
    }
  }

  validate(_project: Project, _issues: ValidationIssue[]): boolean {
    return false
  }

  validateScene(
    scene: Scene,
    _project: Project,
    sIdx: number,
    idx: number,
    issues: ValidationIssue[],
  ): boolean {
    this._ensureRules()
    let hasErrors = false
    const props = scene.properties || {}
    const pathStr = `section[${sIdx}].scene[${idx}]`

    Object.entries(props).forEach(([propKey, propVal]) => {
      const isInvalid = this._checkEnum(
        propVal as string | number,
        propKey,
        issues,
        pathStr,
        `Scene: ${scene.scene_name || 'Untitled'}`,
        (scene as any).startLine || 1,
      )
      if (isInvalid) hasErrors = true
    })

    return hasErrors
  }

  validateLayer(
    layer: Layer,
    scene: Scene,
    _project: Project,
    sIdx: number,
    idx: number,
    lIdx: number,
    issues: ValidationIssue[],
  ): boolean {
    this._ensureRules()
    let hasErrors = false
    const layerPath = `section[${sIdx}].scene[${idx}].layer[${lIdx}]`
    const layerProps = (layer as any).properties || {}

    Object.entries(layerProps).forEach(([propKey, propVal]) => {
      const isInvalid = this._checkEnum(
        propVal as string | number,
        propKey,
        issues,
        layerPath,
        `Scene: ${scene.scene_name || 'Untitled'} > Layer: ${(layer as any).layer_name || 'Untitled'}`,
        (layer as any).startLine || (scene as any).startLine || 1,
      )
      if (isInvalid) hasErrors = true
    })

    return hasErrors
  }

  private _checkEnum(
    val: string | number,
    defKey: string,
    issues: ValidationIssue[],
    pathStr: string,
    contextName: string,
    line: number,
  ): boolean {
    if (val === undefined || val === null || val === 'none' || val === 'auto' || val === '')
      return false

    const def = this._flatDefMap![defKey]
    if (!def || def.type !== 'select') return false

    let knownOptions: any[] = []
    if (def.options) knownOptions = [...def.options]
    if (def.options_key && this._apiOptions![def.options_key]) {
      const dynamic = this._apiOptions![def.options_key] || []
      knownOptions = [...knownOptions, ...dynamic]
    }

    if (knownOptions.length > 0) {
      const strVal = String(val).trim().toLowerCase()
      const isValid = knownOptions.some((opt: any) => {
        if (typeof opt === 'string') return opt.trim().toLowerCase() === strVal
        const optVal = String(opt.value || opt.id || '')
          .trim()
          .toLowerCase()
        const optLabel = String(opt.label || '')
          .trim()
          .toLowerCase()
        if (optVal === strVal || optLabel === strVal) return true
        const numVal = parseFloat(strVal)
        const optNumVal = parseFloat(optVal)
        if (!isNaN(numVal) && !isNaN(optNumVal) && numVal === optNumVal) return true
        return false
      })

      if (!isValid) {
        const possibleMatches = knownOptions
          .map((opt: any) => (typeof opt === 'string' ? opt : opt.label || opt.value || opt.id))
          .join(', ')
        issues.push({
          severity: 'error',
          line: line,
          path: pathStr,
          context: contextName,
          message: `Invalid value '${val}' for property '${def.label || defKey}'.`,
          details: `Allowed options: ${possibleMatches}`,
        })
        return true
      }
    }
    return false
  }
}
