import { Project, Scene, Layer } from '../../../domain/types.js'
import { SceneValidationRule, LayerValidationRule, ValidationIssue } from '../types.js'
import rules from '../../../rules/index.js'
import { getFlatDefinitions } from '../utils.js'
import { version as SYSTEM_VERSION } from '../../../version.js'

// @spec-source:V_0-3-3 | scope: parser
// If a new property is added to the spec, this rule must be updated if structural logic changes.
export class UnknownPropertyRule implements SceneValidationRule, LayerValidationRule {
  name = 'UnknownPropertyRule'
  description = 'Checks for unknown, non-canonical, or out-of-scope properties (VUS compliant)'

  private _flatDefMap: Record<string, any>

  constructor() {
    const allProps = rules.properties as Record<string, any>
    this._flatDefMap = getFlatDefinitions(allProps)
  }

  validate(_project: Project, _issues: ValidationIssue[]): boolean {
    return false
  }

  /**
   * @spec-source:V_0-3-3 | logic: scene_scope_enforcement
   */
  validateScene(
    scene: Scene,
    _project: Project,
    sIdx: number,
    idx: number,
    issues: ValidationIssue[],
  ): boolean {
    let hasErrors = false
    const props = scene.properties || {}
    const pathStr = `section[${sIdx}].scene[${idx}]`

    // V_0-2-5: Prohibit headers in narration content
    const content = scene.scene_content || (scene.properties as any)?.scene_content
    if (content && /^\s*#+/m.test(content)) {
      issues.push({
        severity: 'error',
        line: (scene as any).startLine || 1,
        path: pathStr,
        context: `Scene: ${scene.scene_name || 'Untitled'}`,
        message: `Invalid Content: Markdown headers (#) are prohibited in narration.`,
        details: `Narration must be plain text for TTS compatibility. Headers are reserved for structural markers (Sections, Scenes, Comments).`,
      })
      hasErrors = true
    }

    Object.keys(props).forEach((prop) => {
      // Structural/Lifecycle fields handled by the parser stack
      if (
        [
          'block_type',
          'scene_templates',
          'scene_name',
          'id',
          'startLine',
          'scene_tts_model',
          'scene_content',
        ].includes(prop)
      )
        return
      if (prop.startsWith('var_') || prop.startsWith('vugen_')) return
      // V_0-2-4: Allow model-prefixed properties (e.g., 'replicate/minimax/speech-2.8-hd/voice')
      // V_0-2-4: Allow injected model parameters (e.g., 'scene_voice', 'scene_voice_speed') ONLY if they follow model-prefixed patterns.
      // Loose names like the old voice_id are no longer allowed at root level.

      if (prop.includes('/')) return

      const def = this._flatDefMap[prop]
      if (!def) {
        console.error(
          `[UnknownPropertyRule] ERROR: Property '${prop}' not found in map for scene '${scene.scene_name}'.`,
        )
        issues.push({
          severity: 'error',
          line: (scene as any).startLine || 1,
          path: pathStr,
          context: `Scene: ${scene.scene_name || 'Untitled'}`,
          message: `Unknown or non-canonical property '${prop}'.`,
          details: `VUS ${SYSTEM_VERSION} (VUS) requires strictly scoped keys (e.g., 'scene_voice'). For custom variables, use the 'var_' prefix.`,
        })
        hasErrors = true
      } else if (def.scope && def.scope !== 'scene' && def.scope !== 'common') {
        // Rule 3: Explicit Scope Decoration
        // Layer-scoped props at scene level are VALID as downward-inheritance defaults
        // Video-scoped props at scene level are often used in "# Video" blocks or as global overrides.
        // We flag these as warnings, not errors.
        const isInheritedDefault = def.scope === 'layer' || def.scope === 'video'
        issues.push({
          severity: isInheritedDefault ? 'warning' : 'error',
          line: (scene as any).startLine || 1,
          path: pathStr,
          context: `Scene: ${scene.scene_name || 'Untitled'}`,
          message: isInheritedDefault
            ? `Scope Hint: Property '${prop}' is ${def.scope}-scoped but set at scene level (valid as inherited default/global block).`
            : `Scope Mismatch: Property '${prop}' is scoped to '${def.scope}' but was used in a Scene.`,
          details: isInheritedDefault
            ? `This is valid: the HierarchyResolver will treat this as a default for this scope.`
            : `Ensure properties are used in their correct block (Scene vs Layer).`,
        })
        if (!isInheritedDefault) hasErrors = true
      }
    })
    return hasErrors
  }

  /**
   * @spec-source:V_0-3-3 | logic: layer_scope_enforcement
   */
  validateLayer(
    layer: Layer,
    scene: Scene,
    _project: Project,
    sIdx: number,
    idx: number,
    lIdx: number,
    issues: ValidationIssue[],
  ): boolean {
    let hasErrors = false
    const props = (layer as any).properties || {}
    const pathStr = `section[${sIdx}].scene[${idx}].layer[${lIdx}]`

    Object.keys(props).forEach((prop) => {
      // Structural/Lifecycle fields handled by the parser stack
      if (['block_type', 'layer_name', 'layer_level', 'id', 'startLine'].includes(prop)) return

      // Custom variables must start with var_
      if (prop.startsWith('var_') || prop.startsWith('layer_var_')) return
      // V_0-2-4: Allow model-prefixed properties
      if (prop.includes('/')) return
      // Loose names are no longer allowed at root level.

      const def = this._flatDefMap[prop]
      if (!def) {
        issues.push({
          severity: 'error',
          line: (layer as any).startLine || (scene as any).startLine || 1,
          path: pathStr,
          context: `Scene: ${scene.scene_name || 'Untitled'} > Layer: ${(layer as any).layer_name || 'Untitled'}`,
          message: `Unknown or non-canonical layer property '${prop}'.`,
          details: `VUS ${SYSTEM_VERSION} (VUS) requires strictly scoped keys (e.g., 'layer_type'). For custom variables, use the 'var_' prefix.`,
        })
        hasErrors = true
      } else if (def.scope && def.scope !== 'layer' && def.scope !== 'common') {
        // Rule 3: Explicit Scope Decoration
        issues.push({
          severity: 'error',
          line: (layer as any).startLine || (scene as any).startLine || 1,
          path: pathStr,
          context: `Scene: ${scene.scene_name || 'Untitled'} > Layer: ${(layer as any).layer_name || 'Untitled'}`,
          message: `Scope Mismatch: Property '${prop}' is scoped to '${def.scope}' but was used in a Layer.`,
          details: `Ensure properties are used in their correct block (Scene vs Layer).`,
        })
        hasErrors = true
      }
    })
    return hasErrors
  }
}
