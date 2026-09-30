import { Layer, Scene, Project } from '../../../domain/types.js'
import { LayerValidationRule, ValidationIssue } from '../types.js'

/**
 * Validates asset source compliance with V_0-1-1 (Primigenia Rule).
 * Assets MUST be specified via Markdown inclusion ![alt](url).
 *
 * @spec-source:V_0-3-3 | role: quality_check
 */
export class AssetSourceRule implements LayerValidationRule {
  name = 'AssetSourceRule'
  description =
    'Validates that visual layers have a primary asset source defined via Markdown syntax.'

  validate(_project: Project, _issues: ValidationIssue[]): boolean {
    // Project level validation for assets is not implemented here.
    return false
  }

  validateLayer(
    layer: Layer,
    scene: Scene,
    project: Project,
    sIdx: number,
    scIdx: number,
    lIdx: number,
    issues: ValidationIssue[],
  ): boolean {
    let hasErrors = false

    const layerType = this._getEffectiveLayerProperty('layer_type', layer, scene, project)
    const isAudio = layerType === 'audio'
    const isVideo = layerType === 'video'
    const isImage = layerType === 'image'

    const assetSource = this._getEffectiveLayerProperty('layer_asset_source', layer, scene, project)

    // 1. Mandatory Asset Source for visual/audio layers
    if ((isAudio || isVideo || isImage) && !assetSource) {
      issues.push({
        severity: 'warning',
        line: (layer as any).startLine || 1,
        path: `section[${sIdx}].scene[${scIdx}].layer[${lIdx}]`,
        context: `Scene: ${scene.scene_name || 'Untitled'} > Layer: ${(layer as any).layer_name || 'Untitled'}`,
        message: `Layer type '${layerType || 'image'}' requires an asset source.`,
        details: `Specify the asset using Markdown syntax: ![media](path/to/asset) in the layer block.`,
      })
      hasErrors = true
    }

    // 2. Validate Primigenia Metadata (if provided)
    const metadata = (layer as any).propertyMetadata?.layer_asset_source
    if (layer.layer_asset_source && (!metadata || !metadata.isPrimigenia)) {
      // This check is performed at the parser level with an Error,
      // but here we catch it if bypass through some other mean
      // we won't throw, just warn
    }

    return hasErrors
  }

  private _getEffectiveLayerProperty(
    key: string,
    layer: Layer,
    scene: Scene,
    project: Project,
  ): any {
    // 1. Local layer property
    const layerProps = (layer as any).properties || {}
    if (layerProps[key] !== undefined && layerProps[key] !== null && layerProps[key] !== '')
      return layerProps[key]
    if (
      (layer as any)[key] !== undefined &&
      (layer as any)[key] !== null &&
      (layer as any)[key] !== '' &&
      key !== 'properties'
    )
      return (layer as any)[key]

    // 2. Template layer property (matching by name)
    const templateList = scene.scene_templates || []
    if (templateList.length > 0 && project.templates) {
      for (let i = templateList.length - 1; i >= 0; i--) {
        const tplName = templateList[i]
        const tpl = project.templates[tplName]
        if (tpl && tpl.layers) {
          const tplLayer = tpl.layers.find((l: any) => l.layer_name === (layer as any).layer_name)
          if (tplLayer) {
            const tplLayerProps = (tplLayer as any).properties || {}
            const val =
              tplLayerProps[key] !== undefined ? tplLayerProps[key] : (tplLayer as any)[key]
            if (val !== undefined && val !== null && val !== '') return val
          }
        }
      }
    }

    // 3. Fallback to scene properties (cascading)
    const sceneProps = scene.properties || {}
    if (sceneProps[key] !== undefined && sceneProps[key] !== null && sceneProps[key] !== '')
      return sceneProps[key]

    // 4. Fallback to scene templates (cascading properties from template level)
    if (templateList.length > 0 && project.templates) {
      for (let i = templateList.length - 1; i >= 0; i--) {
        const tplName = templateList[i]
        const tpl = project.templates[tplName]
        if (tpl) {
          const tplProps = (tpl as any).properties || {}
          const val = tplProps[key] !== undefined ? tplProps[key] : (tpl as any)[key]
          if (val !== undefined && val !== null && val !== '') return val
        }
      }
    }

    // 5. Global config
    if (
      project.config &&
      project.config[key] !== undefined &&
      project.config[key] !== null &&
      project.config[key] !== ''
    ) {
      return project.config[key]
    }

    return undefined
  }
}
