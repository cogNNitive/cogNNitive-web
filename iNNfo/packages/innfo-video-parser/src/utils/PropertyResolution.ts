import { Project, Scene, Layer } from '../domain/types.js'

/**
 * Centralized property resolution logic for VUS scripts.
 * Cascades from Layer -> Scene Template Layer -> Scene -> Scene Template -> Video Config -> SSoT Defaults.
 * @spec-source:V_0-3-3 | role: property_engine
 */

/**
 * Narrows a typed domain object to a general record for dynamic key access.
 * Preferred over `as any` because it preserves the constraint that values
 * are `unknown` rather than silently widening everything to `any`.
 */
type AsRecord<T> = T & Record<string, unknown>

export class PropertyResolution {
  /**
   * Resolves the effective value for a scene property, considering inheritance.
   */
  static getEffectiveSceneProperty(key: string, scene: Scene, project: Project): unknown {
    // Fast path: if ConfigResolver has already resolved this scene, use finalProperties
    if (
      scene.finalProperties &&
      scene.finalProperties[key] !== undefined &&
      scene.finalProperties[key] !== null &&
      scene.finalProperties[key] !== ''
    ) {
      return scene.finalProperties[key]
    }

    // Fallback cascade for pre-resolution contexts (validation, etc.)
    return this.cascadeSceneProperty(key, scene, project)
  }

  /**
   * Raw cascade lookup without requiring prior resolution.
   * Used by validation rules that run before ConfigResolver.resolve().
   */
  private static cascadeSceneProperty(key: string, scene: Scene, project: Project): unknown {
    // 1. Scene direct property (explicit)
    if (
      scene.properties?.[key] !== undefined &&
      scene.properties[key] !== null &&
      scene.properties[key] !== ''
    ) {
      return scene.properties[key]
    }

    // Handle direct model properties outside the properties map (legacy/convenience)
    const sceneRecord = scene as AsRecord<Scene>
    if (
      sceneRecord[key] !== undefined &&
      sceneRecord[key] !== null &&
      sceneRecord[key] !== '' &&
      key !== 'properties'
    ) {
      return sceneRecord[key]
    }

    // 2. Scene templates (cascading, last template has priority)
    const templateList = scene.scene_templates || []
    if (templateList.length > 0 && project.templates) {
      for (let i = templateList.length - 1; i >= 0; i--) {
        const tpl = project.templates[templateList[i]]
        if (tpl) {
          const tplVal = tpl[key] !== undefined ? tpl[key] : tpl.properties?.[key]
          if (tplVal !== undefined && tplVal !== null && tplVal !== '') return tplVal
        }
      }
    }

    // 3. Global video config
    if (
      project.config?.[key] !== undefined &&
      project.config[key] !== null &&
      project.config[key] !== ''
    ) {
      return project.config[key]
    }

    return undefined
  }

  /**
   * Resolves the effective value for a layer property, considering inheritance.
   */
  static getEffectiveLayerProperty(
    key: string,
    layer: Layer,
    scene: Scene,
    project: Project,
  ): unknown {
    // 1. Local layer property
    const layerProps = layer.properties || {}
    if (layerProps[key] !== undefined && layerProps[key] !== null && layerProps[key] !== '')
      return layerProps[key]

    const layerRecord = layer as AsRecord<Layer>
    if (
      layerRecord[key] !== undefined &&
      layerRecord[key] !== null &&
      layerRecord[key] !== '' &&
      key !== 'properties'
    )
      return layerRecord[key]

    // 2. Template layer property (matching by name)
    const templateList = scene.scene_templates || []
    if (templateList.length > 0 && project.templates) {
      for (let i = templateList.length - 1; i >= 0; i--) {
        const tplName = templateList[i]
        const tpl = project.templates[tplName]
        if (tpl && tpl.layers) {
          const tplLayer = (tpl.layers as Layer[]).find((l) => l.layer_name === layer.layer_name)
          if (tplLayer) {
            const tplLayerProps = tplLayer.properties || {}
            const tplLayerRecord = tplLayer as AsRecord<Layer>
            const val = tplLayerProps[key] !== undefined ? tplLayerProps[key] : tplLayerRecord[key]
            if (val !== undefined && val !== null && val !== '') return val
          }
        }
      }
    }

    // 3. Fallback to scene properties (cascading)
    const sceneVal = this.getEffectiveSceneProperty(key, scene, project)
    if (sceneVal !== undefined) return sceneVal

    return undefined
  }
}
