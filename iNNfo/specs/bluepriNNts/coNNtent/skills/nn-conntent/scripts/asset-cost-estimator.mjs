#!/usr/bin/env node

/**
 * nn-conntent/scripts/asset-cost-estimator.mjs
 *
 * Pre-generation asset planning, provider & model catalog, and per-scene cost estimator.
 * Aligned with the `coNNtent` blueprint for MiniMax TTS, WaveSpeed & Replicate
 * visual engines, and Talking Avatar LipSync models (WaveSpeed InfiniteTalk, Replicate Wan-S2V).
 *
 * Zero external mandatory runtime dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import { SceneCompiler, ScriptValidationError } from './scene-compiler.mjs';
import { loadKnowledgeModel, parseKnowledgeDocument } from './lib/knowledge-model.mjs';
import { fileURLToPath } from 'node:url';
import { computePlanHash, formatStamp } from './lib/plan.mjs';
import { normalizeModelId } from './lib/video-guard.mjs';
import { loadCascadeBags, resolve, withScriptPresets } from './lib/video-scope.mjs';
import { isAvatarLayer, collectAvatarJobs, ttsCachePathFor, AVATAR_CACHE_EXT, AVATAR_CACHE_CATEGORY } from './lib/avatar-jobs.mjs';
import { layerPrompt, imageCachePathFor } from './lib/image-options.mjs';
import { loadMergedCatalog, assertImageSize, isPriceStale, DEFAULT_STALE_AFTER_DAYS } from './lib/catalog.mjs';
import { CacheManager } from './cache-manager.mjs';
import { loadGuard, resolveDefaultCacheDir } from './lib/video-guard.mjs';
import { parseArgs, CliUsageError } from './lib/cli-args.mjs';

export function resolveModelId(prop, fallback) {
  return normalizeModelId(typeof prop === 'string' && prop.includes('/') ? prop : fallback);
}

/** Conservative fallback rates (USD) for models missing from the catalog: never under-estimate. */
const FALLBACK_RATES = { image: 0.025, ttsPer1kChars: 0.02, avatarPerSecond: 0.018, video: 0.035 };

export function findCatalogEntry(category, model) {
  const id = normalizeModelId(model);
  if (!id) return null;
  const models = Object.values(mergedCatalog().models);
  const entry = models.find(
    (m) =>
      String(m.capability) === category &&
      (String(m.api_id) === id || String(m.api_id).endsWith('/' + id) || id.endsWith('/' + String(m.api_id))),
  );
  if (!entry) return null;
  const price = Number(entry.price);
  const unit = String(entry.price_unit || '');
  return {
    slug: entry.slug,
    provider: entry.provider,
    modelName: entry.slug,
    unit,
    unitPrice: unit === 'per_image' ? price : undefined,
    unitPricePer1kChars: unit === 'per_1k_chars' ? price : undefined,
    unitPricePerSecond: unit === 'per_second' ? price : undefined,
    priceDate: entry.price_date,
    priceSource: entry.price_source || 'blueprint',
  };
}

/** The merged catalog, loaded once per process (design A9/A14). */
let CATALOG = null;
function mergedCatalog() {
  if (!CATALOG) CATALOG = loadMergedCatalog({ overlay: null });
  return CATALOG;
}

/**
 * The models in this plan whose catalog `price_date` is past the staleness threshold.
 * A stale price does not change the estimate; the plan just has to say so.
 * @param {string[]} modelIds
 * @param {Date} now
 * @returns {Array<{ model: string, priceDate: string }>}
 */
function stalePricesOf(modelIds, now) {
  const catalog = mergedCatalog();
  const stale = [];
  for (const id of modelIds) {
    const entry = Object.values(catalog.models || {}).find(
      (model) =>
        String(model.api_id) === id ||
        String(model.api_id).endsWith('/' + id) ||
        id.endsWith('/' + String(model.api_id)),
    );
    if (!entry || !entry.price_date) continue;
    if (isPriceStale(entry.price_date, { now })) {
      stale.push({ model: id, priceDate: String(entry.price_date) });
    }
  }
  return stale;
}

/**
 * Allowed model ids that have no price in any catalog category, deduplicated and normalized.
 * @param {{ allowedModels?: string[] }} config
 * @returns {string[]}
 */
export function unpricedAllowedModels(config) {
  const out = [];
  for (const raw of config?.allowedModels || []) {
    const id = normalizeModelId(raw);
    const entry = Object.values(mergedCatalog().models).find(
      (m) => String(m.api_id) === id || String(m.api_id).endsWith('/' + id) || id.endsWith('/' + String(m.api_id)),
    );
    const priced = entry && entry.price !== undefined && entry.price !== null && String(entry.price).trim() !== '';
    if (!priced && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Emits one warning per allowed model without a price. The run continues: an unpriced model
 * is estimated at a conservative fallback rate (cognnitive-video-engine "Allowed Models Must
 * Be Priced"). Returns the warned models so a caller can assert or report them.
 * @param {{ allowedModels?: string[] }} config
 * @param {(message: string) => void} [warn]
 * @returns {string[]}
 */
export function warnUnpricedAllowedModels(config, warn = console.warn) {
  const models = unpricedAllowedModels(config);
  for (const model of models) {
    warn(
      '[video-engine] warning: allowed model "' + model + '" has no price in the catalog; ' +
        'the estimate falls back to a conservative rate.',
    );
  }
  return models;
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
 * @param {string} [options.cacheDir] Video cache read (read-only) to price cached items at $0 (default: the workspace cache of a script path)
 * @returns {Object} Cost estimation report
 */
export function estimateScriptCost(scriptContentOrPath, options = {}) {
  const isPath = fs.existsSync(scriptContentOrPath);
  let scriptContent = scriptContentOrPath;
  if (isPath) {
    scriptContent = fs.readFileSync(scriptContentOrPath, 'utf8');
  }

  const scriptDir = isPath
    ? path.dirname(path.resolve(scriptContentOrPath))
    : (options.scriptDir ? path.resolve(options.scriptDir) : null);
  const compiler = new SceneCompiler(options);
  const model = isPath ? loadKnowledgeModel(scriptContentOrPath) : parseKnowledgeDocument(String(scriptContent));
  // Model selection goes through the single cascade resolver
  // (layer > scene > video > kind > series > domain > blueprint). The plan and
  // the execution read the same bags, so they pick the SAME model id. No flag
  // supplies a parameter: the cascade has no `cli` level.
  const bags = withScriptPresets(
    options.bags || (scriptDir ? loadCascadeBags(scriptDir) : {}),
    model,
    isPath ? path.resolve(scriptContentOrPath) : null,
  );
  const guard = compiler.checkScript(model, { ...options, bags, scriptDir });
  if (!guard.ok) throw new ScriptValidationError(guard.errors);
  const parsed = compiler.lowerKnowledgeModel(model, { ...options, bags, scriptDir });
  const defaultImageModel = normalizeModelId(resolve('image_model', bags).value);
  const defaultImageSize = resolve('image_size', bags).value;
  const defaultAvatarModel = normalizeModelId(resolve('avatar_model', bags).value);
  const defaultTtsModel = normalizeModelId(resolve('voice_model', bags).value);
  const planModels = new Set();
  const noteModel = (model) => {
    if (model && !model.startsWith('local/')) planModels.add(model);
  };

  // What the cache already holds is not charged again. The cache is opened READ-ONLY and the
  // keys come from the helpers compile uses, so a hit here is a hit there. Offline placeholders
  // live under `<key>-offline`, never under the key read here. Without a script path or cache
  // dir nothing is known to be cached: everything is priced.
  const cacheDir = options.cacheDir || (scriptDir ? resolveDefaultCacheDir(scriptDir) : null);
  const cache = cacheDir ? new CacheManager({ baseDir: cacheDir, readOnly: true }) : null;
  const models = { image: defaultImageModel, imageSize: defaultImageSize, tts: defaultTtsModel, avatar: defaultAvatarModel };
  const loaded = scriptDir ? loadGuard(scriptDir) : { config: {}, root: null };
  const config = loaded.config;
  warnUnpricedAllowedModels(config);
  // An `image_size` the resolved model does not offer fails the ESTIMATE, before any spend,
  // against the same merged catalog (reference + domaiNN overlay) the compile reads.
  if (defaultImageSize) {
    assertImageSize(loadMergedCatalog({ domainRoot: loaded.root }), defaultImageModel, defaultImageSize);
  }
  const cachedAvatarLayers = new Set();
  if (cache && scriptDir) {
    try {
      const { jobs } = collectAvatarJobs({ parsed, scriptDir, cacheManager: cache, config, models, bags: bags });
      for (const j of jobs) if (cache.getSync(j.cacheKey, AVATAR_CACHE_EXT, AVATAR_CACHE_CATEGORY)) cachedAvatarLayers.add(j.layer);
    } catch {
      // An input that cannot be resolved leaves the avatar priced: never under-estimate.
    }
  }

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
    const estimatedDurationSec = Math.max(3, Math.round((wordCount / 2.5) * 10) / 10);

    // Layer breakdown
    const promptLayers = (scene.layers || []).filter(layerPrompt);
    const avatarLayers = (scene.layers || []).filter(isAvatarLayer);
    const videoLayers = (scene.layers || []).filter(l => l.type === 'video' || l.type === 'ai_video' || l.properties?.layer_type === 'video' || l.properties?.layer_type === 'ai_video');

    // Compile generates an image only for a layer with a prompt: no prompt, no quote.
    const imageCount = promptLayers.length;
    const avatarCount = avatarLayers.length;
    const videoCount = videoLayers.length;

    // 1. Image: one billable call per prompt layer, priced with the SAME model resolution the compile step uses.
    let sceneImageCost = 0;
    let imageCached = 0;
    for (const l of promptLayers) {
      noteModel(defaultImageModel);
      if (cache && imageCachePathFor(scene, l, { cacheManager: cache, models })) {
        imageCached++;
        continue;
      }
      sceneImageCost += estimateCallUsd('image', defaultImageModel);
    }
    const imagePricing = findCatalogEntry('image', defaultImageModel) || { modelName: defaultImageModel, provider: 'Unlisted (fallback rate)' };

    // 2. TTS
    const ttsModelKey = normalizeModelId(scene.properties?.scene_voice_model);
    const ttsPricing = findCatalogEntry('tts', ttsModelKey) || { modelName: ttsModelKey, provider: 'Unlisted (fallback rate)' };
    const ttsCached = Boolean(cache && charCount > 0 && ttsCachePathFor(scene, { cacheManager: cache, config, models, bags: bags }));
    const sceneTtsCost = ttsCached ? 0 : estimateCallUsd('tts', ttsModelKey, { chars: charCount });
    if (charCount > 0) noteModel(ttsModelKey);

    // 3. Talking avatars: priced per layer by seconds
    let sceneAvatarCost = 0;
    let avatarModelKey = defaultAvatarModel;
    let avatarCached = avatarCount > 0;
    avatarLayers.forEach((l, idx) => {
      const m = normalizeModelId(l.properties?.layer_avatar_model);
      if (idx === 0) avatarModelKey = m;
      noteModel(m);
      if (cachedAvatarLayers.has(l)) return;
      avatarCached = false;
      sceneAvatarCost += estimateCallUsd('avatar', m, { seconds: estimatedDurationSec });
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
      imageCached,
      ttsModel: ttsPricing.modelName,
      ttsProvider: ttsPricing.provider,
      ttsCost: sceneTtsCost,
      ttsCached,
      hasAvatar: avatarCount > 0,
      avatarModel: avatarCount > 0 ? avatarPricing.modelName : null,
      avatarCost: sceneAvatarCost,
      avatarCached,
      totalCost: sceneTotalCost,
    });
  }

  const grandTotalCost = totalImageCost + totalTtsCost + totalAvatarCost + totalVideoCost;

  // Comparison tiers
  const tiers = {
    fastMiniMax: {
      name: 'WaveSpeed & MiniMax Fast Tier',
      imageProvider: 'WaveSpeed AI (Z-Image Turbo / Wan 2.7)',
      ttsProvider: 'MiniMax Speech 2.8 Turbo (WaveSpeed)',
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

  // An allowed model without a catalog price blocks the estimate: there is no fallback rate
  // (capability video-model-catalog "Unpriced Allowed Models Block, Unknown Models Fail").
  const allowedIds = new Set((config.allowedModels || []).map(normalizeModelId));
  for (const [kind, id] of [
    ['image', defaultImageModel],
    ['tts', defaultTtsModel],
    ['avatar', defaultAvatarModel],
  ]) {
    const model = normalizeModelId(id);
    if (model && allowedIds.has(model) && !findCatalogEntry(kind, model)) {
      throw new Error(`unpriced-model: "${model}" is allowed but has no price in the merged catalog. Nothing was spent.`);
    }
  }
  const planHash = computePlanHash(
    scriptContent,
    { image: defaultImageModel, tts: defaultTtsModel, avatar: defaultAvatarModel },
    resolvedPrices({
      image: defaultImageModel,
      tts: defaultTtsModel,
      avatar: defaultAvatarModel,
    }),
  );

  return {
    planHash,
    planModels: [...planModels].sort(),
    stalePrices: stalePricesOf([...planModels], options.now instanceof Date ? options.now : new Date()),
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
/** Resolved unit prices for the chosen models, so a price change invalidates an approval. */
function resolvedPrices(models) {
  const priceOf = (kind, id) => {
    const entry = findCatalogEntry(kind, id);
    if (!entry) return undefined;
    return entry.unitPrice ?? entry.unitPricePer1kChars ?? entry.unitPricePerSecond;
  };
  return {
    image: priceOf('image', models.image),
    tts: priceOf('tts', models.tts),
    avatar: priceOf('avatar', models.avatar),
  };
}
export function formatAssetPlanMarkdown(estimateResult) {
  const { scenes, summary, tiers } = estimateResult;

  let md = formatStamp({ planHash: estimateResult.planHash, totalUsd: summary.grandTotalCost, models: estimateResult.planModels }) + `\n\n`;
  md += `# Asset Generation & Cost Estimation Plan\n\n`;
  md += `- **Plan Hash**: \`${estimateResult.planHash.slice(0, 8)}\` (full hash on the first line of this file)\n\n`;
  md += `> [!IMPORTANT]\n`;
  md += `> **Pre-Generation Cost Gate**: Review the provider selections, model capabilities, and cost estimates below. Run the episode through \`produce\` and pass this plan hash to \`--approve\` to spend past the Episode budget: \`node scripts/produce.mjs <episode> --approve ${estimateResult.planHash.slice(0, 8)}\`. Spend is capped by \`budgetPerRunUsd\` and \`dailyCapUsd\` in \`video-guard.json\`. Items already in the cache are priced \$0.\n\n`;

  // A price can be old without being wrong for the estimate; the plan just has to admit it.
  const stalePrices = Array.isArray(estimateResult.stalePrices) ? estimateResult.stalePrices : [];
  if (stalePrices.length > 0) {
    md += `> [!WARNING]\n`;
    md += `> **Stale price**: ${stalePrices.length} model price(s) in this plan were priced more than `;
    md += `${DEFAULT_STALE_AFTER_DAYS} days ago. The estimate is the best number available, not an invoice.\n`;
    for (const stale of stalePrices) {
      md += `> - \`${stale.model}\` priced on ${stale.priceDate}\n`;
    }
    md += `\n`;
  }

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
    const imgInfo = `${sc.imageProvider} (\`\$${sc.imageCost.toFixed(4)}\`${sc.imageCached ? `, ${sc.imageCached} cached` : ''})`;
    const ttsInfo = `${sc.characterCount} chars (\`\$${sc.ttsCost.toFixed(4)}\`${sc.ttsCached ? ', cached' : ''})`;
    const avatarInfo = sc.hasAvatar ? `${sc.avatarModel} (\`\$${sc.avatarCost.toFixed(4)}\`${sc.avatarCached ? ', cached' : ''})` : '—';
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

  md += `\n## 4. Resolved Models & Budget\n\n`;
  md += `Models this plan will call (stamped on the first line; approval covers exactly these):\n\n`;
  if (estimateResult.planModels.length === 0) md += `- none (nothing billable)\n`;
  for (const m of estimateResult.planModels) md += `- \`${m}\`\n`;
  md += `\nBudget to approve: \$${summary.grandTotalCost.toFixed(4)} USD (cap 1.25x).\n`;

  return md;
}

const USAGE = [
  'Usage: node asset-cost-estimator.mjs <script.md> [options]',
  '  --out <asset_plan.md>     write the Markdown plan (stamped with plan_hash) instead of printing it',
  '  --json                    print the estimate as JSON (includes planHash and planModels)',
].join('\n');

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      boolean: ['json'],
      value: ['out'],
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

  const estimate = estimateScriptCost(path.resolve(scriptPath), {});

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

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(err => {
    console.error('Error executing cost estimator:', err);
    process.exit(1);
  });
}
