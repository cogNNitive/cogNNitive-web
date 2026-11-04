/**
 * nn-conntent/test/plan-stale-price.test.mjs
 *
 * The plan must say when a price it relies on is old. The catalog carries `price_date`
 * per model; past the threshold the estimate is still the best number we have, so the
 * run is not blocked — the plan just has to admit it (design A9, P3 "one of every fact").
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAssetPlanMarkdown } from '../scripts/asset-cost-estimator.mjs';

const estimate = (over = {}) => ({
  planHash: 'f'.repeat(64),
  planModels: ['wavespeed-ai/flux-3/text-to-image'],
  stalePrices: [],
  scenes: [
    {
      sceneNumber: 1,
      sceneTitle: 'One',
      durationSeconds: 3,
      imageProvider: 'wavespeed-ai/flux-3/text-to-image',
      imageCost: 0.02,
      imageCached: null,
      characterCount: 10,
      ttsCost: 0,
      ttsCached: null,
      hasAvatar: false,
      avatarModel: '',
      avatarCost: 0,
      avatarCached: null,
      totalCost: 0.02,
    },
  ],
  tiers: {
    balanced: {
      name: 'Balanced',
      imageProvider: 'wavespeed-ai/flux-3/text-to-image',
      ttsProvider: 'minimax/speech-2.8-hd',
      avatarProvider: '',
      estimatedTotalCost: 0.02,
      tradeoff: 'default',
    },
  },
  summary: {
    sceneCount: 1,
    totalCharacters: 10,
    totalImages: 1,
    totalAvatars: 0,
    totalVideos: 0,
    totalEstimatedDurationSeconds: 3,
    totalImageCost: 0.02,
    totalTtsCost: 0,
    totalAvatarCost: 0,
    totalVideoCost: 0,
    grandTotalCost: 0.02,
  },
  ...over,
});

test('the plan warns when a price is stale, naming the model and its date', () => {
  const md = formatAssetPlanMarkdown(
    estimate({ stalePrices: [{ model: 'wavespeed-ai/flux-3/text-to-image', priceDate: '2020-01-01' }] }),
  );
  assert.match(md, /stale price/i, 'the plan says the price is stale');
  assert.match(md, /wavespeed-ai\/flux-3\/text-to-image/, 'it names the model');
  assert.match(md, /2020-01-01/, 'and the date it was priced');
});

test('the plan carries no stale-price warning when every price is current', () => {
  const md = formatAssetPlanMarkdown(estimate());
  assert.doesNotMatch(md, /stale price/i);
});

test('a stale price never changes the plan hash or the total', () => {
  const fresh = formatAssetPlanMarkdown(estimate());
  const stale = formatAssetPlanMarkdown(
    estimate({ stalePrices: [{ model: 'wavespeed-ai/flux-3/text-to-image', priceDate: '2020-01-01' }] }),
  );
  assert.match(stale, /plan_hash: f{64}/, 'the stamp is unchanged');
  assert.match(stale, /total_usd: 0\.02/, 'the total is still reported');
  assert.match(fresh, /plan_hash: f{64}/);
});
