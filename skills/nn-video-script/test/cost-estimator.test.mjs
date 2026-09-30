import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVIDER_PRICING_CATALOG,
  estimateScriptCost,
  formatAssetPlanMarkdown,
} from '../scripts/asset-cost-estimator.mjs';

const sampleScript = `//COGNNITIVE_VIDEO_SPEC: V_0-3-3
//RESOLUTION: 1920x1080
//FPS: 30

# Section: Testing Cost Estimation

## Scene 01: First Scene
[scene_type=image_motion]
[scene_duration=5]
* Layer: Background
  [layer_type=image]
  [layer_provider=wavespeed]
  [layer_generation_model=wavespeed-ai/z-image/turbo]
Testing the first scene narration with exactly fifty characters.

## Scene 02: Avatar LipSync Scene
[scene_type=image_motion]
[scene_duration=6]
* Layer: Background
  [layer_type=image]
  [layer_provider=wavespeed]
  [layer_generation_model=wavespeed/wan-27-t2i]
* Layer: Avatar
  [layer_type=talking_avatar]
  [layer_avatar_model=wavespeed/infinitetalk]
Testing the second scene with an avatar and MiniMax speech synthesis.
`;

describe('Asset Cost Estimator & Video Model Catalog', () => {
  it('exposes standard pricing catalog with MiniMax TTS, WaveSpeed, Replicate, and Avatar models', () => {
    assert.ok(PROVIDER_PRICING_CATALOG.image['wavespeed-ai/z-image/turbo']);
    assert.ok(PROVIDER_PRICING_CATALOG.image['wavespeed/wan-27-t2i']);
    assert.ok(PROVIDER_PRICING_CATALOG.image['replicate/flux-schnell']);
    assert.ok(PROVIDER_PRICING_CATALOG.tts['wavespeed/minimax/speech-2.5-hd-preview']);
    assert.ok(PROVIDER_PRICING_CATALOG.tts['replicate/minimax/speech-2.8-hd']);
    assert.ok(PROVIDER_PRICING_CATALOG.avatar['wavespeed/infinitetalk']);
    assert.ok(PROVIDER_PRICING_CATALOG.avatar['replicate/wan-2.1-s2v']);
    assert.equal(PROVIDER_PRICING_CATALOG.image['local/sharp'].unitPrice, 0);
  });

  it('calculates itemized per-scene costs with image, MiniMax TTS, and Talking Avatar', () => {
    const estimate = estimateScriptCost(sampleScript, {
      defaultImageModel: 'wavespeed-ai/z-image/turbo',
      defaultTtsModel: 'wavespeed/minimax/speech-2.5-hd-preview',
      defaultAvatarModel: 'wavespeed/infinitetalk',
    });

    assert.equal(estimate.scenes.length, 2);
    assert.equal(estimate.summary.sceneCount, 2);
    assert.equal(estimate.summary.totalImages, 2);
    assert.equal(estimate.summary.totalAvatars, 1);
    assert.ok(estimate.summary.totalCharacters > 100);
    assert.ok(estimate.summary.grandTotalCost > 0);

    // Scene 1 uses Z-Image Turbo ($0.005)
    assert.equal(estimate.scenes[0].imageCost, 0.005);
    assert.equal(estimate.scenes[0].hasAvatar, false);

    // Scene 2 uses Wan 2.7 T2I ($0.010) and InfiniteTalk ($0.012/s * 6s = $0.072)
    assert.equal(estimate.scenes[1].imageCost, 0.010);
    assert.equal(estimate.scenes[1].hasAvatar, true);
    assert.equal(estimate.scenes[1].avatarCost, 0.072);
  });

  it('generates markdown table with summary, itemized scenes, and tiers comparison', () => {
    const estimate = estimateScriptCost(sampleScript);
    const md = formatAssetPlanMarkdown(estimate);

    assert.ok(md.includes('# Asset Generation & Cost Estimation Plan'));
    assert.ok(md.includes('Pre-Generation Approval Gate'));
    assert.ok(md.includes('| Scene | Title & Focus | Duration | Visual Layer & Cost | Voiceover (MiniMax) & Cost | Talking Avatar | Scene Total |'));
    assert.ok(md.includes('| **Scene 1** |'));
    assert.ok(md.includes('| **Scene 2** |'));
    assert.ok(md.includes('Talking Avatar'));
    assert.ok(md.includes('Provider & Quality Tiers Comparison (cogNNitive Video)'));
    assert.ok(md.includes('WaveSpeed & MiniMax Fast Tier'));
    assert.ok(md.includes('Replicate & Wan Cinema Tier'));
    assert.ok(md.includes('User Consultation & Approval Checklist'));
  });
});
