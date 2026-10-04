#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/asset-cost-estimator.mjs
 *
 * Pre-generation asset planning, provider & model catalog, and per-scene cost estimator.
 * Aligned with VUS V_0-3-3 specification for MiniMax TTS, WaveSpeed & Replicate
 * visual engines, and Talking Avatar LipSync models (WaveSpeed InfiniteTalk, Replicate Wan-S2V).
 *
 * Zero external mandatory runtime dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { RemotionSceneCompiler } from './remotion-scene-compiler.mjs';

/**
 * Standard pricing catalog (USD) for supported video generation providers & models in cogNNitive Video.
 */
export const PROVIDER_PRICING_CATALOG = {
  image: {
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
    'wavespeed/minimax/speech-2.5-hd-preview': {
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
    'wavespeed/infinitetalk': {
      provider: 'WaveSpeed AI',
      modelName: 'InfiniteTalk (Ultra-Fast)',
      unitPricePerSecond: 0.012,
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

/**
 * Calculates itemized per-scene and total production costs for a video script.
 *
 * @param {string} scriptContentOrPath Script markdown text or file path
 * @param {Object} [options]
 * @param {string} [options.defaultImageModel="wavespeed-ai/z-image/turbo"]
 * @param {string} [options.defaultTtsModel="wavespeed/minimax/speech-2.5-hd-preview"]
 * @param {string} [options.defaultAvatarModel="wavespeed/infinitetalk"]
 * @returns {Object} Cost estimation report
 */
export function estimateScriptCost(scriptContentOrPath, options = {}) {
  let scriptContent = scriptContentOrPath;
  if (fs.existsSync(scriptContentOrPath)) {
    scriptContent = fs.readFileSync(scriptContentOrPath, 'utf8');
  }

  const compiler = new RemotionSceneCompiler(options);
  const parsed = compiler.parseScript(scriptContent);
  const defaultImageModel = options.defaultImageModel || 'wavespeed-ai/z-image/turbo';
  const defaultTtsModel = options.defaultTtsModel || (process.env.WAVESPEED_API_KEY ? 'wavespeed/minimax/speech-2.5-hd-preview' : 'local/synthetic');
  const defaultAvatarModel = options.defaultAvatarModel || 'wavespeed/infinitetalk';

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
    const avatarLayers = (scene.layers || []).filter(l => l.type === 'talking_avatar' || l.properties?.layer_type === 'talking_avatar' || l.name?.toLowerCase().includes('avatar'));
    const videoLayers = (scene.layers || []).filter(l => l.type === 'video' || l.type === 'ai_video' || l.properties?.layer_type === 'video' || l.properties?.layer_type === 'ai_video');

    const imageCount = imageLayers.length > 0 ? imageLayers.length : (avatarLayers.length === 0 && videoLayers.length === 0 ? 1 : 0);
    const avatarCount = avatarLayers.length;
    const videoCount = videoLayers.length;

    // 1. Resolve Image Model Cost
    let imageModelKey = defaultImageModel;
    if (imageLayers.length > 0 && imageLayers[0].properties?.layer_generation_model) {
      const modelProp = imageLayers[0].properties.layer_generation_model;
      if (PROVIDER_PRICING_CATALOG.image[modelProp]) {
        imageModelKey = modelProp;
      } else if (modelProp.includes('wan-27')) {
        imageModelKey = 'wavespeed/wan-27-t2i';
      } else if (modelProp.includes('flux-schnell')) {
        imageModelKey = 'replicate/flux-schnell';
      } else if (modelProp.includes('flux-pro')) {
        imageModelKey = 'replicate/flux-pro';
      }
    }
    const imagePricing = PROVIDER_PRICING_CATALOG.image[imageModelKey] || PROVIDER_PRICING_CATALOG.image[defaultImageModel] || { unitPrice: 0.005, modelName: imageModelKey, provider: 'WaveSpeed AI' };
    const sceneImageCost = imageCount * imagePricing.unitPrice;

    // 2. Resolve TTS Model Cost
    const ttsModelKey = defaultTtsModel;
    const ttsPricing = PROVIDER_PRICING_CATALOG.tts[ttsModelKey] || PROVIDER_PRICING_CATALOG.tts['wavespeed/minimax/speech-2.5-hd-preview'] || { unitPricePer1kChars: 0.015, modelName: ttsModelKey, provider: 'MiniMax' };
    const sceneTtsCost = (charCount / 1000) * (ttsPricing.unitPricePer1kChars || 0.015);

    // 3. Resolve Talking Avatar Cost
    let avatarModelKey = defaultAvatarModel;
    if (avatarLayers.length > 0 && avatarLayers[0].properties?.layer_avatar_model) {
      const modelProp = avatarLayers[0].properties.layer_avatar_model;
      if (PROVIDER_PRICING_CATALOG.avatar[modelProp]) {
        avatarModelKey = modelProp;
      }
    }
    const avatarPricing = PROVIDER_PRICING_CATALOG.avatar[avatarModelKey] || PROVIDER_PRICING_CATALOG.avatar[defaultAvatarModel];
    const sceneAvatarCost = Math.round(avatarCount * (estimatedDurationSec * (avatarPricing?.unitPricePerSecond || 0.012)) * 10000) / 10000;

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

  return {
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

  let md = `# Asset Generation & Cost Estimation Plan\n\n`;
  md += `> [!IMPORTANT]\n`;
  md += `> **Pre-Generation Approval Gate**: Review the provider selections, model capabilities, and cost estimates below. Confirm approval before synthesizing assets or running the rendering pipeline.\n\n`;

  md += `## 1. Summary Overview\n\n`;
  md += `- **Total Scenes**: ${summary.sceneCount}\n`;
  md += `- **Total Estimated Duration**: ~${summary.totalEstimatedDurationSeconds} seconds\n`;
  md += `- **Visual Image Assets**: ${summary.totalImages} images\n`;
  if (summary.totalAvatars > 0) {
    md += `- **Talking Avatars (LipSync)**: ${summary.totalAvatars} avatar scenes\n`;
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

function parseCliArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') {
      args.json = true;
    } else if (arg === '--out' && i + 1 < argv.length) {
      args.out = argv[++i];
    } else if (arg === '--image-model' && i + 1 < argv.length) {
      args.imageModel = argv[++i];
    } else if (arg === '--tts-model' && i + 1 < argv.length) {
      args.ttsModel = argv[++i];
    } else if (arg === '--avatar-model' && i + 1 < argv.length) {
      args.avatarModel = argv[++i];
    } else if (!arg.startsWith('-')) {
      args._.push(arg);
    }
  }
  return args;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const scriptPath = args._[0];

  if (!scriptPath) {
    console.error('Usage: node asset-cost-estimator.mjs <path-to-script.md> [--out asset_plan.md] [--json]');
    process.exit(1);
  }

  if (!fs.existsSync(path.resolve(scriptPath))) {
    console.error(`Error: Script file not found at ${scriptPath}`);
    process.exit(1);
  }

  const estimate = estimateScriptCost(path.resolve(scriptPath), {
    defaultImageModel: args.imageModel,
    defaultTtsModel: args.ttsModel,
    defaultAvatarModel: args.avatarModel,
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
    console.log(`✅ Asset generation and cost plan written to: ${outResolved}`);
  } else {
    console.log(formattedMd);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([a-zA-Z]:)/, '$1'))) {
  main().catch(err => {
    console.error('Error executing cost estimator:', err);
    process.exit(1);
  });
}
