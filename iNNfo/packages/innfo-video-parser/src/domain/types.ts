/**
 * @spec-source:V_0-3-3 | role: quality_check
 */
import { z } from 'zod'

export interface PropertyRule {
  id: string
  label: string
  description?: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'multiselect' | 'color' | 'file' | 'textarea'
  default?: any
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  options_key?: string
  category?: string
  depends_on?: null | string | Record<string, any>
  scope?: 'video' | 'section' | 'template' | 'scene' | 'layer' | string
  ui?: Record<string, any>
  title?: string
  [key: string]: any
}

export type PropertySource = 'Video' | 'Section' | 'Template' | 'Scene' | 'Auto' | 'Override'

export interface UIMetadata {
  categories: string[]
  asset_types: Array<{ value: string; label: string }>
  s2v_models: Array<{ value: string; label: string }>
  image_models: Array<{ value: string; label: string }>
  video_models: Array<{ value: string; label: string }>
  voices: Array<{ value: string; label: string }>
  tts_emotions: Array<{ value: string; label: string }>
  [key: string]: any
}

/**
 * Domain types for Anydeo V4.0
 */

export const NoteSchema = z.object({
  block_type: z.literal('note'),
  scene_content: z.string(),
  startLine: z.number().optional().default(1),
})

export const SourceEntrySchema = z
  .object({
    citekey: z.string(),
    title: z.string().optional(),
    author: z.string().optional(),
    url: z.string().optional(),
    doi: z.string().optional(),
    date: z.string().optional(),
    accessed_date: z.string().optional(),
    license: z.string().optional(),
  })
  .passthrough()

// @spec-impact V_0-2-4 | scope: layer
export const LayerSchema = z
  .object({
    layer_level: z.number().int().optional(),
    layer_name: z.string().default('Untitled Layer'),
    layer_type: z.string().optional(),
    layer_asset_source: z.string().optional().default(''),
    layer_audio_volume: z.number().optional(),
    layer_avatar_model: z.string().optional(),
    layer_generation_model: z.string().optional(),
    layer_asset_citation_key: z.string().optional(),
    layer_asset_access_date: z.string().optional(),
    properties: z.record(z.string(), z.any()).default({}),
    propertyMetadata: z.record(z.string(), z.any()).optional().default({}),
    startLine: z.number().optional().default(1),
    finalProperties: z.record(z.string(), z.any()).optional(),
    inheritedProperties: z.record(z.string(), z.any()).optional(),
  })
  .passthrough()

// @spec-impact V_0-1-1 | scope: scene
export const SceneSchema = z
  .object({
    sIdx: z.number().optional().default(0),
    idx: z.number().optional().default(0),
    scene_name: z.string().default('Untitled Scene'),
    scene_content: z.string().optional().default(''),
    scene_sources: z.array(z.string()).optional().default([]),
    scene_sources_text: z.string().optional(),
    properties: z.record(z.string(), z.any()).default({}),
    scene_templates: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .default([])
      .transform((val) => (Array.isArray(val) ? val : val ? [val] : [])),
    scene_background_audio_volume: z.number().optional().default(0.2),
    scene_tts_model: z.string().optional(),
    scene_voice: z.string().optional(),
    scene_voice_volume: z.number().optional().default(1.0),
    scene_image_model: z.string().optional(),
    scene_video_model: z.string().optional(),
    layers: z.array(LayerSchema).optional().default([]),
    propertyMetadata: z.record(z.string(), z.any()).optional().default({}),
    startLine: z.number().optional().default(1),
    finalProperties: z.record(z.string(), z.any()).optional(),
    inheritedProperties: z.record(z.string(), z.any()).optional(),
  })
  .passthrough()

export const SectionSchema = z
  .object({
    title: z.string().min(1, 'Section title is required'),
    properties: z.record(z.string(), z.any()).default({}),
    background: z.string().optional(),
    scenes: z.array(z.union([SceneSchema, NoteSchema])),
  })
  .passthrough()

export const UISchemaSchema = z
  .object({
    video: z.record(z.string(), z.any()).optional().default({}),
    scene: z.record(z.string(), z.any()).optional().default({}),
    layer: z.record(z.string(), z.any()).optional().default({}),
  })
  .passthrough()

export const PropertySetSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  properties: z.record(z.string(), z.any()).default({}),
})

export const ProjectSchema = z
  .object({
    config: z.record(z.string(), z.any()).default({}),
    video_sources: z.record(z.string(), SourceEntrySchema).optional().default({}),
    templates: z.record(z.string(), z.any()).default({}),
    property_sets: z.record(z.string(), PropertySetSchema).optional().default({}),
    sections: z.array(SectionSchema),
    flattenScenes: z.array(z.any()).optional().default([]),
    uiSchema: UISchemaSchema.optional().default({}),
    propertyMetadata: z.record(z.string(), z.any()).optional().default({}),
  })
  .passthrough()

/**
 * Tauri Bridge & Configuration Schemas
 */

export const AppSettingsSchema = z.object({
  replicate_key: z.string().optional().nullable(),
  pexels_key: z.string().optional().nullable(),
  work_dir: z.string(),
  config_dir: z.string(),
  enabled_plugins: z.array(z.string()).default(['advanced-ai', 'lottie-animations', 'stock-media']),
  disabled_models: z.array(z.string()).default([]),
  max_cache_size_mb: z.number().default(1024),
  preferred_encoder: z.string().default('auto'),
  default_image_model: z.string().optional().nullable(),
  default_video_model: z.string().optional().nullable(),
  default_llm_model: z.string().optional().nullable(),
  default_avatar_model: z.string().optional().nullable(),
  default_tts_model: z.string().optional().nullable(),
})

export const ModelDefinitionSchema = z
  .object({
    id: z.string().optional(),
    value: z.string().optional(),
    name: z.string().optional(),
    label: z.string().optional(),
    version: z.string().optional(),
    desc: z.string().optional(),
    description: z.string().optional(),
    provider: z.string().optional(),
    tier: z.string().optional(),
    metrics: z.record(z.any()).optional(),
    parameters: z.array(z.any()).optional(),
    inputs_mapping: z.record(z.string()).optional(),
    max_outputs: z.number().optional(),
  })
  .passthrough()

export const ForgeModelDefinitionSchema = z
  .object({
    id: z.string().optional(),
    value: z.string().optional(),
    name: z.string().optional(),
    label: z.string().optional(),
    type: z.string().optional(),
    provider: z.string().optional().default('replicate'),
    description: z.string().optional(),
    parameters: z.array(z.any()).optional().default([]),
  })
  .passthrough()

export const ModelsConfigSchema = z.object({
  image: z.array(ModelDefinitionSchema).default([]),
  video: z.array(ModelDefinitionSchema).default([]),
  lipsync: z.array(ModelDefinitionSchema).default([]),
  tts: z.array(ModelDefinitionSchema).default([]),
  forge_models: z.array(ForgeModelDefinitionSchema).default([]),
  system_options: z
    .object({
      voices: z.array(z.string()).default([]),
      tts_emotions: z.array(z.string()).default([]),
      transitions: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
      effects: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    })
    .optional()
    .default({}),
})

export const HardwareStatusSchema = z.object({
  has_nvenc: z.boolean(),
  has_qsv: z.boolean(),
  has_vulkan: z.boolean(),
  using: z.string(),
})

export const RecentScriptSchema = z.object({
  name: z.string(),
  path: z.string(),
  date: z.string(),
})

export type Layer = z.infer<typeof LayerSchema> & {
  finalProperties?: Record<string, any>
  inheritedProperties?: Record<string, any>
}
export type Scene = z.infer<typeof SceneSchema> & {
  finalProperties?: Record<string, any>
  inheritedProperties?: Record<string, any> // Hierarchical source traceability property metadata
  outputPath?: string
  duration?: number
}
export type Section = z.infer<typeof SectionSchema>
export type Project = z.infer<typeof ProjectSchema>
export type AppSettings = z.infer<typeof AppSettingsSchema>
export type ModelsConfig = z.infer<typeof ModelsConfigSchema>
export type HardwareStatus = z.infer<typeof HardwareStatusSchema>
export type RecentScript = z.infer<typeof RecentScriptSchema>

export type SourceEntry = z.infer<typeof SourceEntrySchema>

export type Template = {
  name: string
  props: Record<string, any>
  includes?: string[]
}

export type PropertySet = z.infer<typeof PropertySetSchema>

export interface RenderResult {
  outputPath: string
  duration: number
  sceneHash: string
}

export interface ProcessingOptions {
  projectDir: string
  tempDir: string
  resolution: string
  fps: number
}

export interface AttributionMetadata {
  source: string
  url?: string
  author: string
  date?: string
  license?: string
  layer_asset_is_ai?: boolean
  layer_asset_author?: string
  layer_asset_license?: string
  layer_meta_source?: string
  layer_asset_citation_key?: string
  layer_asset_access_date?: string
  ai?: {
    prompt?: string
    model?: string
  }
}

export interface PublishChapter {
  timestamp: string
  title: string
}

export interface OutputMetadata {
  version: string
  engine: string
  generatedAt: string
  author: string
  title: string
  config: {
    resolution: string
    fps: number
    bgAudio?: string
  }
  scenes: Array<{
    index: number
    description: string
    duration: number
    mediaPath?: string
  }>
  totalDuration: number
  sceneCount: number
  publish: {
    chapters: PublishChapter[]
    suggestedTitle?: string
    suggestedTags?: string[]
    category?: string
    privacy?: string
  }
}

export interface AssembleResult {
  videoPath: string
  metadataPath: string
  duration: number
  publishChapters: PublishChapter[]
}
