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

    // Scene 2 uses Wan 2.7 T2I ($0.010) and InfiniteTalk non-fast ($0.06/s * 6s = $0.36)
    assert.equal(estimate.scenes[1].imageCost, 0.010);
    assert.equal(estimate.scenes[1].hasAvatar, true);
    assert.equal(estimate.scenes[1].avatarCost, 0.36);
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

  it('estimates scene duration when explicit scene_duration is omitted', () => {
    const scriptWithoutDuration = `//COGNNITIVE_VIDEO_SPEC: V_0-3-3
# Section: Duration Derivation
## Scene 01: Ten Word Scene
* Layer: Background
  [layer_type=image]
one two three four five six seven eight nine ten
`;
    const estimate = estimateScriptCost(scriptWithoutDuration);
    assert.equal(estimate.scenes[0].durationSeconds, 4); // 10 words / 2.5 = 4s
  });

  it('falls back to minimum duration of 3s when narration is empty', () => {
    const scriptEmptyNarration = `//COGNNITIVE_VIDEO_SPEC: V_0-3-3
# Section: Empty Narration
## Scene 01: Silent Scene
* Layer: Background
  [layer_type=image]
`;
    const estimate = estimateScriptCost(scriptEmptyNarration);
    assert.equal(estimate.scenes[0].durationSeconds, 3);
  });

  it('preserves explicit scene duration regardless of narration length', () => {
    const scriptExplicitDuration = `//COGNNITIVE_VIDEO_SPEC: V_0-3-3
# Section: Explicit Duration
## Scene 01: Fixed Scene
[scene_duration=8]
* Layer: Background
  [layer_type=image]
This is a very long narration with many words that would otherwise calculate to more than eight seconds if not fixed.
`;
    const estimate = estimateScriptCost(scriptExplicitDuration);
    assert.equal(estimate.scenes[0].durationSeconds, 8);
  });
});

describe('estimator model aliases', () => {
  it('prices and lists the normalized id for a replicate/-prefixed scene model', () => {
    const script = sampleScript.replace('Testing the first scene narration', 'Testing the first scene narration')
      .replace('[scene_type=image_motion]\n[scene_duration=5]', '[scene_type=image_motion]\n[scene_duration=5]\n[scene_tts_model=replicate/minimax/speech-2.8-hd]');
    const estimate = estimateScriptCost(script, {});
    assert.ok(estimate.planModels.includes('minimax/speech-2.8-hd'));
    assert.ok(!estimate.planModels.some((m) => m.startsWith('replicate/minimax')));
  });
});
