#!/usr/bin/env node

/**
 * nn-video-script/scripts/asset-cost-estimator.mjs
 *
 * Pre-generation asset planning, provider & model catalog, and per-scene cost estimator.
 * Aligned with the `video-script` blueprint for MiniMax TTS, WaveSpeed & Replicate
 * visual engines, and Talking Avatar LipSync models (WaveSpeed InfiniteTalk, Replicate Wan-S2V).
 *
 * Zero external mandatory runtime dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { RemotionSceneCompiler, ScriptValidationError } from './remotion-scene-compiler.mjs';
import { loadKnowledgeModel, loadTemplateModels, parseKnowledgeDocument } from './lib/knowledge-model.mjs';
import { fileURLToPath } from 'node:url';
import { computePlanHash, formatStamp } from './lib/plan-approval.mjs';
import { normalizeModelId } from './lib/video-guard.mjs';
import { isAvatarLayer } from './lib/avatar-jobs.mjs';
import { parseArgs, CliUsageError } from './lib/cli-args.mjs';

/**
 * Standard pricing catalog (USD) for supported video generation providers & models in cogNNitive Video.
 */
export const PROVIDER_PRICING_CATALOG = {
  image: {
    'black-forest-labs/flux-schnell': {
      provider: 'Replicate',
      modelName: 'FLUX.1 Schnell',
      unitPrice: 0.003,
      unit: 'image',
      quality: 'Very High',
      speed: 'Fast (~2-4s)',
      description: 'Cost-effective FLUX 4-step inference (guard model id)',
    },
    'luma/uni-v1/text-to-image': {
      provider: 'WaveSpeed AI / Luma',
      modelName: 'Luma Uni-1 Text to Image',
      unitPrice: 0.043,
      unit: 'image',
      quality: 'Very High',
      speed: 'Moderate',
      description: 'Luma Uni-1 text-to-image (approximate price from invoices)',
    },
    'black-forest-labs/flux-3/text-to-image': {
      provider: 'WaveSpeed AI / BFL',
      modelName: 'FLUX.3 Text to Image',
      unitPrice: 0.05,
      unit: 'image',
      quality: 'Maximum',
      speed: 'Moderate',
      description: 'FLUX.3 text-to-image (approximate price)',
    },
    'wavespeed-ai/minimax-h3/image-edit': {
      provider: 'WaveSpeed AI / MiniMax',
      modelName: 'MiniMax H3 Image Edit',
      unitPrice: 0.035,
      unit: 'image',
      quality: 'High',
      speed: 'Moderate',
      description: 'Image editing (approximate price)',
    },
    'wavespeed-ai/z-image/turbo': {
      provider: 'WaveSpeed AI',
      modelName: 'Z-Image Turbo',
      unitPrice: 0.005,
      unit: 'image',
      quality: 'High',
      speed: 'Fast (~1-2s)',
      description: 'Ultra-fast inference for cinematic photorealism and scenic backgrounds',
    },
    'wavespeed/wan-27-t2i': {
      provider: 'WaveSpeed AI',
      modelName: 'Wan 2.7 T2I (Alibaba)',
      unitPrice: 0.010,
      unit: 'image',
      quality: 'Very High',
      speed: 'Fast (~2-3s)',
      description: 'High-quality text-to-image generation powered by Alibaba Wan 2.7',
    },
    'replicate/flux-schnell': {
      provider: 'Replicate',
      modelName: 'FLUX.1 Schnell',
      unitPrice: 0.003,
      unit: 'image',
      quality: 'Very High',
      speed: 'Fast (~2-4s)',
      description: 'Cost-effective FLUX 4-step inference on Replicate cloud',
    },
    'replicate/flux-pro': {
      provider: 'Replicate',
      modelName: 'FLUX.1 Pro',
      unitPrice: 0.025,
      unit: 'image',
      quality: 'Maximum',
      speed: 'Moderate (~8-12s)',
      description: 'Elite quality professional image generation with maximum prompt adherence',
    },
    'replicate/recraft-v3': {
      provider: 'Replicate',
      modelName: 'Recraft V3',
      unitPrice: 0.015,
      unit: 'image',
      quality: 'Vector & Typography',
      speed: 'Fast (~3s)',
      description: 'Professional typography, graphic design, and clean vector art',
    },
    'local/sharp': {
      provider: 'Local / Sharp',
      modelName: 'Vector Composite & Static Assets',
      unitPrice: 0.000,
      unit: 'image',
      quality: 'Standard',
      speed: 'Instant (<50ms)',
      description: 'Offline local SVG rendering and local JPEG/PNG asset binding',
    },
  },
  tts: {
    'minimax/speech-2.8-hd': {
      provider: 'WaveSpeed AI / MiniMax',
      modelName: 'MiniMax Speech 2.8 HD',
      unitPricePer1kChars: 0.02,
      priceNote: 'estimated: not verified against an invoice',
      quality: 'Cinematic High-Definition',
      languages: 'Spanish, English, Multilingual',
      description: 'Default TTS model (guard model id). Price is an estimate.',
    },    'wavespeed/minimax/speech-2.5-hd-preview': {
      provider: 'WaveSpeed AI / MiniMax',
      modelName: 'MiniMax Speech 2.5 HD',
      unitPricePer1kChars: 0.015,
      quality: 'Studio Ultra-Realistic',
      languages: 'Spanish, English, French, German, Italian, Portuguese',
      description: 'High-definition emotional voice synthesis with natural cadence and tone control',
    },
    'replicate/minimax/speech-2.8-hd': {
      provider: 'Replicate / MiniMax',
      modelName: 'MiniMax Speech 2.8 HD',
      unitPricePer1kChars: 0.020,
      quality: 'Cinematic High-Definition',
      languages: 'Spanish, English, Multilingual',
      description: 'State-of-the-art TTS with human-like prosody and expressive emotional ranges',
    },
    'local/synthetic': {
      provider: 'Local / Offline',
      modelName: 'Synthetic Offline Buffer',
      unitPricePer1kChars: 0.000,
      quality: 'Standard Offline',
      languages: 'n/a',
      description: 'Offline synthetic audio buffer with zero API cost (no OS-native TTS)',
    },
  },
  avatar: {
    'wavespeed-ai/infinitetalk-fast': {
      provider: 'WaveSpeed AI',
      modelName: 'InfiniteTalk Fast',
      unitPricePerSecond: 0.015,
      quality: 'Photorealistic LipSync',
      speed: 'Fast',
      description: 'Default avatar model (about $0.015/s from real invoices: a 3s clip cost $0.045)',
    },
    'wavespeed-ai/infinitetalk': {
      provider: 'WaveSpeed AI',
      modelName: 'InfiniteTalk (non-fast)',
      unitPricePerSecond: 0.06,
      quality: 'Photorealistic LipSync',
      speed: 'Slow',
      description: 'BLOCKED by default: about $0.06/s from real invoices (a 30s clip is $1.80)',
    },    'wavespeed/infinitetalk': {
      provider: 'WaveSpeed AI',
      modelName: 'InfiniteTalk (non-fast)',
      unitPricePerSecond: 0.06,
      quality: 'Photorealistic LipSync',
      speed: 'Realtime Fast Inference',
      description: 'High-performance digital talking avatar engine synchronized to speech audio',
    },
    'replicate/wan-2.1-s2v': {
      provider: 'Replicate',
      modelName: 'Wan 2.1 S2V (Speech to Video)',
      unitPricePerSecond: 0.018,
      quality: 'Cinema-Grade Facial Animation',
      speed: 'Moderate (~15-20s)',
      description: 'High-fidelity audio-driven talking avatar and expressive lip-sync animation',
    },
  },
  video: {
    'wavespeed/wan-i2v': {
      provider: 'WaveSpeed AI',
      modelName: 'Wan 2.1 I2V (Image to Video)',
      unitPrice: 0.030,
      unit: 'clip',
      quality: 'Cinematic Motion',
      speed: 'Fast (~5-10s)',
      description: 'Economic image-to-video motion generator for dynamic scene backgrounds',
    },
    'replicate/wan-t2v': {
      provider: 'Replicate',
      modelName: 'Wan 2.1 T2V (Text to Video)',
      unitPrice: 0.035,
      unit: 'clip',
      quality: 'Generative Video',
      speed: 'Moderate (~15-30s)',
      description: 'Direct text-to-video generation from prompt descriptions',
    },
  },
};

/** Default models. These are the real provider ids, identical to what the synthesizer and the spend guard use. */
export const DEFAULT_MODELS = Object.freeze({
  image: 'wavespeed-ai/z-image/turbo',
  tts: 'minimax/speech-2.8-hd',
  avatar: 'wavespeed-ai/infinitetalk-fast',
});

/**
 * Provider model ids contain a slash; anything else (a loose label such as 'elevenlabs' or
 * 'wavespeed-v1-flux') falls back. Shared by the estimator and the synthesizer so the plan
 * prices exactly the models that will be called.
 * @param {unknown} prop
 * @param {string} fallback
 * @returns {string}
 */
export function resolveModelId(prop, fallback) {
  return normalizeModelId(typeof prop === 'string' && prop.includes('/') ? prop : fallback);
}

/** Conservative fallback rates (USD) for models missing from the catalog: never under-estimate. */
const FALLBACK_RATES = { image: 0.025, ttsPer1kChars: 0.02, avatarPerSecond: 0.018, video: 0.035 };

export function findCatalogEntry(category, model) {
  const entries = PROVIDER_PRICING_CATALOG[category] || {};
  if (entries[model]) return entries[model];
  const key = Object.keys(entries).find((k) => k.endsWith('/' + model) || model.endsWith('/' + k));
  return key ? entries[key] : null;
}

/**
 * Estimated USD for ONE billable provider call, used by the spend guard (budget + ledger).
 * @param {'image' | 'tts' | 'avatar' | 'video'} kind
 * @param {string} model Provider model id
 * @param {{ chars?: number, seconds?: number }} [units]
 * @returns {number}
 */
export function estimateCallUsd(kind, model, units = {}) {
  const entry = findCatalogEntry(kind, normalizeModelId(model));
  let usd;
  if (kind === 'tts') usd = ((units.chars || 0) / 1000) * (entry?.unitPricePer1kChars ?? FALLBACK_RATES.ttsPer1kChars);
  else if (kind === 'avatar') usd = Math.ceil(units.seconds || 0) * (entry?.unitPricePerSecond ?? FALLBACK_RATES.avatarPerSecond);
  else usd = entry?.unitPrice ?? FALLBACK_RATES[kind] ?? FALLBACK_RATES.image;
  return Math.round(usd * 1e6) / 1e6;
}

/**
 * Calculates itemized per-scene and total production costs for a video script.
 *
 * @param {string} scriptContentOrPath Script markdown text or file path
 * @param {Object} [options]
 * @param {string} [options.defaultImageModel="wavespeed-ai/z-image/turbo"]
 * @param {string} [options.defaultTtsModel="minimax/speech-2.8-hd"]
 * @param {string} [options.defaultAvatarModel="wavespeed-ai/infinitetalk-fast"]
 * @returns {Object} Cost estimation report
 */
export function estimateScriptCost(scriptContentOrPath, options = {}) {
  const isPath = fs.existsSync(scriptContentOrPath);
  let scriptContent = scriptContentOrPath;
  if (isPath) {
    scriptContent = fs.readFileSync(scriptContentOrPath, 'utf8');
  }

  const compiler = new RemotionSceneCompiler(options);
  const model = isPath ? loadKnowledgeModel(scriptContentOrPath) : parseKnowledgeDocument(String(scriptContent));
  const guard = compiler.checkScript(model, options);
  if (!guard.ok) throw new ScriptValidationError(guard.errors);
  const templates = isPath ? loadTemplateModels(path.dirname(scriptContentOrPath)) : {};
  const parsed = compiler.lowerKnowledgeModel(model, { templates });
  const defaultImageModel = options.defaultImageModel || DEFAULT_MODELS.image;
  const defaultTtsModel = options.defaultTtsModel || DEFAULT_MODELS.tts;
  const defaultAvatarModel = options.defaultAvatarModel || DEFAULT_MODELS.avatar;
  const planModels = new Set();
  const noteModel = (model) => {
    if (model && !model.startsWith('local/')) planModels.add(model);
  };

  const sceneEstimates = [];
  let totalCharacters = 0;
  let totalImages = 0;
  let totalAvatars = 0;
  let totalVideos = 0;
  let totalEstimatedDurationSeconds = 0;
  let totalImageCost = 0;
  let totalTtsCost = 0;
  let totalAvatarCost = 0;
  let totalVideoCost = 0;

  for (let i = 0; i < parsed.scenes.length; i++) {
    const scene = parsed.scenes[i];
    const narration = (scene.narration || '').trim();
    const wordCount = narration ? narration.split(/\s+/).filter(Boolean).length : 0;
    const charCount = narration.length;
    const explicitDuration = scene.properties?.scene_duration || scene.properties?.duration || scene.duration;
    const estimatedDurationSec = explicitDuration ? Number(explicitDuration) : Math.max(3, Math.round((wordCount / 2.5) * 10) / 10);

    // Layer breakdown
    const imageLayers = (scene.layers || []).filter(l => l.type === 'image' || l.properties?.layer_type === 'image');
    const avatarLayers = (scene.layers || []).filter(isAvatarLayer);
    const videoLayers = (scene.layers || []).filter(l => l.type === 'video' || l.type === 'ai_video' || l.properties?.layer_type === 'video' || l.properties?.layer_type === 'ai_video');

    const noLayers = avatarLayers.length === 0 && videoLayers.length === 0;
    const imageCount = imageLayers.length > 0 ? imageLayers.length : (noLayers ? 1 : 0);
    const avatarCount = avatarLayers.length;
    const videoCount = videoLayers.length;

    // 1. Image: one billable call per image layer, priced with the SAME model resolution the compile step uses.
    const imageModels = imageLayers.length > 0
      ? imageLayers.map((l) => resolveModelId(l.properties?.layer_generation_model, defaultImageModel))
      : (noLayers ? [defaultImageModel] : []);
    let sceneImageCost = 0;
    for (const m of imageModels) {
      sceneImageCost += estimateCallUsd('image', m);
      noteModel(m);
    }
    const imageModelKey = imageModels[0] || defaultImageModel;
    const imagePricing = findCatalogEntry('image', imageModelKey) || { modelName: imageModelKey, provider: 'Unlisted (fallback rate)' };

    // 2. TTS
    const ttsModelKey = resolveModelId(scene.properties?.scene_tts_model, defaultTtsModel);
    const ttsPricing = findCatalogEntry('tts', ttsModelKey) || { modelName: ttsModelKey, provider: 'Unlisted (fallback rate)' };
    const sceneTtsCost = estimateCallUsd('tts', ttsModelKey, { chars: charCount });
    if (charCount > 0) noteModel(ttsModelKey);

    // 3. Talking avatars: priced per layer by seconds
    let sceneAvatarCost = 0;
    let avatarModelKey = defaultAvatarModel;
    avatarLayers.forEach((l, idx) => {
      const m = resolveModelId(l.properties?.layer_avatar_model, defaultAvatarModel);
      if (idx === 0) avatarModelKey = m;
      sceneAvatarCost += estimateCallUsd('avatar', m, { seconds: estimatedDurationSec });
      noteModel(m);
    });
    sceneAvatarCost = Math.round(sceneAvatarCost * 10000) / 10000;
    const avatarPricing = findCatalogEntry('avatar', avatarModelKey) || { modelName: avatarModelKey };

    // 4. Resolve Video Cost
    const sceneVideoCost = Math.round(videoCount * 0.030 * 10000) / 10000;

    const sceneTotalCost = Math.round((sceneImageCost + sceneTtsCost + sceneAvatarCost + sceneVideoCost) * 10000) / 10000;

    totalCharacters += charCount;
    totalImages += imageCount;
    totalAvatars += avatarCount;
    totalVideos += videoCount;
    totalEstimatedDurationSeconds += estimatedDurationSec;
    totalImageCost += sceneImageCost;
    totalTtsCost += sceneTtsCost;
    totalAvatarCost += sceneAvatarCost;
    totalVideoCost += sceneVideoCost;

    sceneEstimates.push({
      sceneNumber: i + 1,
      sceneId: scene.id,
      sceneTitle: scene.name || scene.title || `Scene ${i + 1}`,
      durationSeconds: estimatedDurationSec,
      narrationSnippet: narration.slice(0, 60) + (narration.length > 60 ? '...' : ''),
      characterCount: charCount,
      imageCount,
      imageModel: imagePricing.modelName,
      imageProvider: imagePricing.provider,
      imageCost: sceneImageCost,
      ttsModel: ttsPricing.modelName,
      ttsProvider: ttsPricing.provider,
      ttsCost: sceneTtsCost,
      hasAvatar: avatarCount > 0,
      avatarModel: avatarCount > 0 ? avatarPricing.modelName : null,
      avatarCost: sceneAvatarCost,
      totalCost: sceneTotalCost,
    });
  }

  const grandTotalCost = totalImageCost + totalTtsCost + totalAvatarCost + totalVideoCost;

  // Comparison tiers
  const tiers = {
    fastMiniMax: {
      name: 'WaveSpeed & MiniMax Fast Tier (Recommended)',
      imageProvider: 'WaveSpeed AI (Z-Image Turbo / Wan 2.7)',
      ttsProvider: 'MiniMax Speech 2.5 HD (WaveSpeed)',
      avatarProvider: 'WaveSpeed InfiniteTalk',
      estimatedTotalCost: (totalImages * 0.005) + ((totalCharacters / 1000) * 0.015) + (totalAvatars * totalEstimatedDurationSeconds * 0.012),
      tradeoff: 'Ultra-low latency, natural emotional Spanish/English voice, economical and fast rendering.',
    },
    cinematicReplicate: {
      name: 'Replicate & Wan Cinema Tier',
      imageProvider: 'Replicate (FLUX.1 Pro / Recraft V3)',
      ttsProvider: 'MiniMax Speech 2.8 HD (Replicate)',
      avatarProvider: 'Wan 2.1 S2V (Replicate)',
      estimatedTotalCost: (totalImages * 0.025) + ((totalCharacters / 1000) * 0.020) + (totalAvatars * totalEstimatedDurationSeconds * 0.018),
      tradeoff: 'Cinema-grade photorealism, full 28-step FLUX generation, high-fidelity lip-sync animation.',
    },
    offlineFree: {
      name: 'Offline / Free Local Tier',
      imageProvider: 'Local SVG Compositor / Existing Assets',
      ttsProvider: 'Local Synthetic Offline Buffer',
      avatarProvider: 'Static Layer Avatar',
      estimatedTotalCost: 0.000,
      tradeoff: 'Zero API credit cost, 100% offline, standard OS voice & local graphic compositing.',
    },
  };

  const planHash = computePlanHash(scriptContent, {
    image: options.defaultImageModel,
    tts: options.defaultTtsModel,
    avatar: options.defaultAvatarModel,
  });

  return {
    planHash,
    planModels: [...planModels].sort(),
    scenes: sceneEstimates,
    summary: {
      sceneCount: sceneEstimates.length,
      totalCharacters,
      totalImages,
      totalAvatars,
      totalVideos,
      totalEstimatedDurationSeconds,
      totalImageCost: Math.round(totalImageCost * 10000) / 10000,
      totalTtsCost: Math.round(totalTtsCost * 10000) / 10000,
      totalAvatarCost: Math.round(totalAvatarCost * 10000) / 10000,
      totalVideoCost: Math.round(totalVideoCost * 10000) / 10000,
      grandTotalCost: Math.round(grandTotalCost * 10000) / 10000,
      currency: 'USD',
    },
    tiers,
  };
}

/**
 * Generates human-readable Markdown asset plan and provider choice table.
 *
 * @param {Object} estimateResult
 * @returns {string} Markdown text
 */
export function formatAssetPlanMarkdown(estimateResult) {
  const { scenes, summary, tiers } = estimateResult;

  let md = formatStamp({ planHash: estimateResult.planHash, totalUsd: summary.grandTotalCost, models: estimateResult.planModels }) + `\n\n`;
  md += `# Asset Generation & Cost Estimation Plan\n\n`;
  md += `- **Plan Hash**: \`${estimateResult.planHash.slice(0, 8)}\` (full hash on the first line of this file)\n\n`;
  md += `> [!IMPORTANT]\n`;
  md += `> **Pre-Generation Approval Gate**: Review the provider selections, model capabilities, and cost estimates below. Billable synthesis is refused until a human approves THIS plan with \`node scripts/approve-plan.mjs <this file>\`. Spend is then capped at 1.25x the total below.\n\n`;

  md += `## 1. Summary Overview\n\n`;
  md += `- **Total Scenes**: ${summary.sceneCount}\n`;
  md += `- **Total Estimated Duration**: ~${summary.totalEstimatedDurationSeconds} seconds\n`;
  md += `- **Visual Image Assets**: ${summary.totalImages} images\n`;
  if (summary.totalAvatars > 0) {
    md += `- **Talking Avatars (LipSync)**: ${summary.totalAvatars} avatar scenes\n`;
    md += `- **Avatar cost is an ESTIMATE** (scene_duration, or words/2.5 until the narration audio exists). synthesize-avatar.mjs bills ceil(seconds) of the MEASURED audio, so the final figure can differ; produce avatars only with that script.` + `\n`;
  }
  md += `- **Voiceover Characters**: ${summary.totalCharacters.toLocaleString()} characters (MiniMax TTS)\n`;
  md += `- **Total Estimated Production Cost**: **\$${summary.grandTotalCost.toFixed(4)} USD**\n\n`;

  md += `## 2. Itemized Cost Breakdown by Scene\n\n`;
  md += `| Scene | Title & Focus | Duration | Visual Layer & Cost | Voiceover (MiniMax) & Cost | Talking Avatar | Scene Total |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  for (const sc of scenes) {
    const imgInfo = `${sc.imageProvider} (\`\$${sc.imageCost.toFixed(4)}\`)`;
    const ttsInfo = `${sc.characterCount} chars (\`\$${sc.ttsCost.toFixed(4)}\`)`;
    const avatarInfo = sc.hasAvatar ? `${sc.avatarModel} (\`\$${sc.avatarCost.toFixed(4)}\`)` : '—';
    md += `| **Scene ${sc.sceneNumber}** | ${sc.sceneTitle} | ~${sc.durationSeconds}s | ${imgInfo} | ${ttsInfo} | ${avatarInfo} | **\$${sc.totalCost.toFixed(4)}** |\n`;
  }

  md += `| **TOTAL** | **All ${summary.sceneCount} Scenes** | **~${summary.totalEstimatedDurationSeconds}s** | **\$${summary.totalImageCost.toFixed(4)}** | **\$${summary.totalTtsCost.toFixed(4)}** | **\$${summary.totalAvatarCost.toFixed(4)}** | **\$${summary.grandTotalCost.toFixed(4)}** |\n\n`;

  md += `## 3. Provider & Quality Tiers Comparison (cogNNitive Video)\n\n`;
  md += `| Tier | Image Model (WaveSpeed / Replicate) | Voiceover TTS (MiniMax) | Talking Avatar LipSync | Est. Total | Tradeoffs |\n`;
  md += `|---|---|---|---|---|---|\n`;

  for (const key of Object.keys(tiers)) {
    const t = tiers[key];
    md += `| **${t.name}** | ${t.imageProvider} | ${t.ttsProvider} | ${t.avatarProvider || '—'} | **\$${t.estimatedTotalCost.toFixed(4)}** | ${t.tradeoff} |\n`;
  }

  md += `\n## 4. User Consultation & Approval Checklist\n\n`;
  md += `- [ ] **Image Model Selected**: Confirm provider (WaveSpeed Z-Image / Wan 2.7 / Replicate FLUX)\n`;
  md += `- [ ] **TTS Voice Model Selected**: Confirm MiniMax model (MiniMax Speech 2.5 HD / MiniMax 2.8 HD / Local)\n`;
  if (summary.totalAvatars > 0) {
    md += `- [ ] **Talking Avatar Model Selected**: Confirm LipSync engine (WaveSpeed InfiniteTalk / Wan 2.1 S2V)\n`;
  }
  md += `- [ ] **Budget Approved**: Total estimated spend \$${summary.grandTotalCost.toFixed(4)} USD confirmed\n`;

  return md;
}

const USAGE = [
  'Usage: node asset-cost-estimator.mjs <script.md> [options]',
  '  --out <asset_plan.md>     write the Markdown plan (stamped with plan_hash) instead of printing it',
  '  --json                    print the estimate as JSON (includes planHash and planModels)',
  '  --image-model <id>        default image model (part of plan_hash; pass the same to compile)',
  '  --tts-model <id>          default TTS model (part of plan_hash; pass the same to compile)',
  '  --avatar-model <id>       default avatar model (part of plan_hash; pass the same to compile)',
].join('\n');

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      boolean: ['json'],
      value: ['out', 'image-model', 'tts-model', 'avatar-model'],
    });
  } catch (err) {
    if (!(err instanceof CliUsageError)) throw err;
    console.error('Error: ' + err.message + '\n' + USAGE);
    process.exit(1);
  }
  const args = parsed.flags;
  const scriptPath = parsed._[0];

  if (!scriptPath) {
    console.error(USAGE);
    process.exit(1);
  }

  if (!fs.existsSync(path.resolve(scriptPath))) {
    console.error(`Error: Script file not found at ${scriptPath}`);
    process.exit(1);
  }

  const estimate = estimateScriptCost(path.resolve(scriptPath), {
    defaultImageModel: args['image-model'],
    defaultTtsModel: args['tts-model'],
    defaultAvatarModel: args['avatar-model'],
  });

  if (args.json) {
    console.log(JSON.stringify(estimate, null, 2));
    return;
  }

  const formattedMd = formatAssetPlanMarkdown(estimate);

  if (args.out) {
    const outResolved = path.resolve(args.out);
    fs.mkdirSync(path.dirname(outResolved), { recursive: true });
    fs.writeFileSync(outResolved, formattedMd, 'utf8');
    console.log(`Asset generation and cost plan written to: ${outResolved}`);
  } else {
    console.log(formattedMd);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(err => {
    console.error('Error executing cost estimator:', err);
    process.exit(1);
  });
}
