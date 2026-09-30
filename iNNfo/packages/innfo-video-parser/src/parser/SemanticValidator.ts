/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { Project, Scene, Layer } from '../domain/types.js'
import {
  ValidationRule,
  SceneValidationRule,
  LayerValidationRule,
  ValidationIssue,
} from './validation/types.js'
import { UnknownPropertyRule } from './validation/rules/UnknownPropertyRule.js'
import { MandatorySchemaRule } from './validation/rules/MandatorySchemaRule.js'
import { EnumValidationRule } from './validation/rules/EnumValidationRule.js'
import { AssetSourceRule } from './validation/rules/AssetSourceRule.js'
import { CitationVerificationRule } from './validation/rules/CitationVerificationRule.js'

export class SemanticValidator {
  private static builtinRules: ValidationRule[] = [
    new MandatorySchemaRule(),
    new UnknownPropertyRule(),
    new EnumValidationRule(),
    new AssetSourceRule(),
    new CitationVerificationRule(),
  ]

  private static pluginRules: ValidationRule[] = []

  /**
   * Registers a new validation rule (usually from a plugin).
   */
  static registerRule(rule: ValidationRule): void {
    this.pluginRules.push(rule)
  }

  /**
   * Clears all registered plugin rules.
   */
  static clearPluginRules(): void {
    this.pluginRules = []
  }

  private static get rules(): ValidationRule[] {
    return [...this.builtinRules, ...this.pluginRules]
  }

  /**
   * Performs strict semantic validation on the project structure to catch logic mapping errors.
   * Compliant with VUS v0.6.0.
   *
   * @spec-impact V_0-1-1 | scope: scene,layer
   */
  static validate(project: Project, issues: ValidationIssue[], styleDictionary?: any): boolean {
    let hasErrors = false

    // Global project rules
    this.rules.forEach((rule) => {
      if (rule.validate(project, issues)) hasErrors = true
    })

    if (!project.sections) return hasErrors

    project.sections.forEach((section, sIdx) => {
      section.scenes?.forEach((item, idx) => {
        if ((item as any).block_type === 'note') return
        const scene = item as Scene

        // Scene level rules
        this.rules.forEach((rule) => {
          const sceneRule = rule as any as SceneValidationRule
          if (sceneRule.validateScene) {
            if (sceneRule.validateScene(scene, project, sIdx, idx, issues)) hasErrors = true
          }
        })

        // Layer level rules
        scene.layers?.forEach((layer, lIdx) => {
          this.rules.forEach((rule) => {
            const layerRule = rule as any as LayerValidationRule
            if (layerRule.validateLayer) {
              if (layerRule.validateLayer(layer, scene, project, sIdx, idx, lIdx, issues))
                hasErrors = true
            }
          })
        })
      })
    })

    // Add special structural rules
    if (this._validateVisuals(project, issues)) hasErrors = true
    if (this._validateStyles(project, issues, styleDictionary)) hasErrors = true

    return hasErrors
  }

  private static _validateVisuals(project: Project, issues: ValidationIssue[]): boolean {
    const hasErrors = false
    project.sections.forEach((section, sIdx) => {
      section.scenes?.forEach((item, idx) => {
        if ((item as any).block_type === 'note') return
        const scene = item as Scene

        const props = (scene as any).finalProperties || scene.properties || {}

        // @spec-impact V_0-1-1 | scope: scene
        // In VUS, visual content should be in @layer blocks.
        // A scene MUST have at least one layer OR inherit layers from a template.
        const hasLayers =
          (scene.layers && scene.layers.length > 0) ||
          (scene.scene_templates && scene.scene_templates.length > 0)

        if (!hasLayers) {
          issues.push({
            severity: 'pending',
            line: (scene as any).startLine || 1,
            path: `section[${sIdx}].scene[${idx}]`,
            context: `Scene: ${scene.scene_name || 'Untitled'}`,
            message: `Scene '${scene.scene_name}' has no visual layers.`,
            details: `VUS V_0-1-1 requires all visual content to be defined at the layer level (@@ notation).`,
          })
          // 'pending' does not block processing, just UI hint
        }
      })
    })
    return hasErrors
  }

  private static _validateStyles(
    project: Project,
    issues: ValidationIssue[],
    styleDictionary?: any,
  ): boolean {
    if (!styleDictionary) return false
    let hasErrors = false

    project.sections.forEach((section, sIdx) => {
      section.scenes?.forEach((item, idx) => {
        if ((item as any).block_type === 'note') return
        const scene = item as Scene

        // Validate Scene Visual Style
        const sceneStyle = (scene.properties as any)?.scene_visual_style
        if (
          sceneStyle &&
          styleDictionary.visual_styles &&
          !styleDictionary.visual_styles[sceneStyle]
        ) {
          issues.push({
            severity: 'error',
            line: (scene as any).startLine || 1,
            path: `section[${sIdx}].scene[${idx}].scene_visual_style`,
            context: `Scene: ${scene.scene_name || 'Untitled'}`,
            message: `Visual style '${sceneStyle}' not found in assets/_instructions.md.`,
            details: `Available visual styles: ${Object.keys(styleDictionary.visual_styles).join(', ')}`,
          })
          hasErrors = true
        }

        // Validate Layer Visual Style
        scene.layers?.forEach((layer, lIdx) => {
          const layerStyle = (layer.properties as any)?.layer_visual_style
          if (
            layerStyle &&
            styleDictionary.visual_styles &&
            !styleDictionary.visual_styles[layerStyle]
          ) {
            issues.push({
              severity: 'error',
              line: (layer as any).startLine || 1,
              path: `section[${sIdx}].scene[${idx}].layer[${lIdx}].layer_visual_style`,
              context: `Layer: ${layer.layer_name || 'Untitled'}`,
              message: `Visual style '${layerStyle}' not found in assets/_instructions.md.`,
              details: `Available visual styles: ${Object.keys(styleDictionary.visual_styles).join(', ')}`,
            })
            hasErrors = true
          }
        })
      })
    })
    return hasErrors
  }
}
