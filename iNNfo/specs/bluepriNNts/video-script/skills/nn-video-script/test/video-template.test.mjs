import test from 'node:test';
import assert from 'node:assert/strict';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';

const templates = {
  Full: { tool: 'wavespeed', voice: 'Lucas', model: 'minimax/spe128' },
  Section: { tool: 'wavespeed', voice: 'Other', model: 'minimax/section' },
};

function model(videoFields = {}, sceneFields = {}) {
  return {
    version: 'nn-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V', ...videoFields } }],
      Scene: [{ type: 'Scene', name: 's1', slug: 's1', description: 'words here', fields: sceneFields }],
      Layer: [],
    },
  };
}

const compiler = new SceneCompiler();

test('a video-level template:: applies to scenes without their own', () => {
  const lowered = compiler.lowerKnowledgeModel(model({ template: '[[Series :: Full]]' }), { templates });
  assert.equal(lowered.videoTemplate.name, 'Full');
  assert.equal(lowered.scenes[0].resolvedTemplate.name, 'Full');
  assert.equal(lowered.scenes[0].properties.scene_voice, 'Lucas');
});

test('a scene template:: overrides the video template', () => {
  const lowered = compiler.lowerKnowledgeModel(
    model({ template: '[[Series :: Full]]' }, { template: '[[Series :: Section]]' }),
    { templates },
  );
  assert.equal(lowered.scenes[0].resolvedTemplate.name, 'Section');
  assert.equal(lowered.scenes[0].properties.scene_voice, 'Other');
});

test('no video template leaves scenes unresolved', () => {
  const lowered = compiler.lowerKnowledgeModel(model({}), { templates });
  assert.equal(lowered.videoTemplate, null);
  assert.equal(lowered.scenes[0].resolvedTemplate, null);
});
