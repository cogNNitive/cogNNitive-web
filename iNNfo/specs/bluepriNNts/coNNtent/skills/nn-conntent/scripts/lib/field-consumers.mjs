/**
 * nn-conntent/scripts/lib/field-consumers.mjs
 *
 * Which module reads each registry field. The point is to make dead and phantom fields fail
 * CI (design A11, capability video-field-registry "Every Field Is Read And Every Read Is
 * Defined"): a registry field with no consumer is dead, and a consumer naming a field the
 * blueprint does not declare is phantom.
 *
 * Three buckets, all explicit:
 *   FIELD_CONSUMERS      the current engine reads the field (module names only);
 *   PLANNED_CONSUMERS    the field exists in V_0-15-0 and a named later slice reads it;
 *   IGNORED_BY_DESIGN    the field is annotation, never engine input, with its reason.
 *
 * Each slice deletes its `PLANNED_CONSUMERS` entries when it lands, so an entry that
 * outlives its slice is a visible lie.
 */

/** Fields the current engine reads, with the module that reads them. */
export const FIELD_CONSUMERS = {
  title: ['scene-compiler.mjs'],
  presets: ['lib/presets.mjs'],
  voice: ['lib/tts-options.mjs'],
  voice_model: ['lib/tts-options.mjs'],
  voice_speed: ['lib/tts-options.mjs'],
  voice_emotion: ['lib/tts-options.mjs'],
  avatar: ['lib/avatar-jobs.mjs'],
  avatar_model: ['lib/avatar-jobs.mjs', 'asset-cost-estimator.mjs'],
  avatar_resolution: ['lib/avatar-jobs.mjs', 'lib/avatar-request.mjs'],
  image_model: ['asset-cost-estimator.mjs', 'lib/compile.mjs'],
  image_size: ['asset-cost-estimator.mjs', 'lib/compile.mjs', 'lib/image-options.mjs'],
  sizes: ['lib/catalog.mjs'],
  status: ['produce.mjs'],
  master: ['produce.mjs'],
  budget: ['produce.mjs'],
  daily_budget: ['produce.mjs'],
  script_review: ['produce.mjs', 'lib/episode.mjs'],
  review: ['lib/episode.mjs'],
  description: ['produce.mjs'],
  language: ['lib/episode.mjs', 'scene-compiler.mjs'],
  kind: ['lib/kinds.mjs', 'lib/episode.mjs'],
  background_audio: ['scene-compiler.mjs'],
  background_audio_volume: ['scene-compiler.mjs'],
  transition: ['scene-compiler.mjs', 'lib/frame-tokens.mjs'],
  frame: ['scene-compiler.mjs', 'lib/frame-tokens.mjs'],
  components: ['scene-compiler.mjs'],
  sounds: ['lib/compile.mjs'],
  fit: ['scene-compiler.mjs'],
  type: ['scene-compiler.mjs'],
  asset: ['scene-compiler.mjs'],
  prompt: ['scene-compiler.mjs', 'lib/image-options.mjs'],
  text: ['scene-compiler.mjs'],
  position: ['scene-compiler.mjs'],
  enter_animation: ['scene-compiler.mjs'],
  exit_animation: ['scene-compiler.mjs'],
  z_index: ['scene-compiler.mjs'],
  output_formats: ['scene-compiler.mjs'],
  name: ['lib/catalog.mjs'],
  api_base: ['lib/catalog.mjs'],
  provider: ['lib/catalog.mjs'],
  api_id: ['lib/catalog.mjs'],
  capability: ['lib/catalog.mjs'],
  controls: ['lib/catalog.mjs', 'adapters/_intent.mjs'],
  adapter: ['lib/catalog.mjs'],
  allowed: ['lib/catalog.mjs'],
  voice_id: ['lib/catalog.mjs'],
  price: ['lib/catalog.mjs'],
  price_unit: ['lib/catalog.mjs'],
  price_date: ['lib/catalog.mjs'],
  price_source: ['lib/catalog.mjs'],
  stale_after_days: ['lib/catalog.mjs'],
};

/**
 * Fields declared by V_0-15-0 whose consumer lands in a named later slice. Each slice must
 * delete its entries here when it lands.
 */
export const PLANNED_CONSUMERS = {
  role: '4',
  narration: '4',
  max_duration: '4',
  fixed: '4',
  chrome: '4',
  watermark: '4',
  cta: '4',
  bumper: '4',
  music: '4',
  script: '10',
  published_url: '10',
  thumbnail: '10',
  intro: '5',
  style: '5',
  text_from: '5',
  placement: '5',
  timing: '5',
};

/** Fields that are annotation by design: never engine input, so never a phantom. */
export const IGNORED_BY_DESIGN = {
  tags: 'classification label read by the console and the docs, never by the engine',
};

/**
 * @param {{ fields: Record<string, unknown> }} registry
 * @returns {{ dead: string[], phantom: string[], ignored: string[] }}
 */
export function auditConsumers(registry) {
  const declared = new Set(Object.keys(registry.fields || {}));
  const dead = [];
  const phantom = [];
  for (const field of declared) {
    if (!FIELD_CONSUMERS[field] && !PLANNED_CONSUMERS[field] && !IGNORED_BY_DESIGN[field]) dead.push(field);
  }
  for (const field of [...Object.keys(FIELD_CONSUMERS), ...Object.keys(PLANNED_CONSUMERS), ...Object.keys(IGNORED_BY_DESIGN)]) {
    if (!declared.has(field)) phantom.push(field);
  }
  return { dead, phantom, ignored: Object.keys(IGNORED_BY_DESIGN).sort() };
}

/** Consumers of one field: real module(s), the slice that will read it, or the design reason. */
export function consumerOf(field) {
  if (FIELD_CONSUMERS[field]) return { kind: 'module', modules: FIELD_CONSUMERS[field] };
  if (PLANNED_CONSUMERS[field]) return { kind: 'slice', slice: PLANNED_CONSUMERS[field] };
  if (IGNORED_BY_DESIGN[field]) return { kind: 'ignored', reason: IGNORED_BY_DESIGN[field] };
  return null;
}
