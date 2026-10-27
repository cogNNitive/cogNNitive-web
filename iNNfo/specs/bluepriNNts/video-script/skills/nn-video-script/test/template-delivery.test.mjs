import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadTemplateModels } from '../scripts/lib/knowledge-model.mjs';
import { buildTtsVoiceOptions } from '../scripts/lib/tts-options.mjs';
import { SceneCompiler } from '../scripts/scene-compiler.mjs';

const TEMPLATES_DOC = `---
version: nn-read-knowledge@1
url: "./spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Demo Series"
---

# NN Template

## NN Template: Presenter Full
slug:: presenter-full
tool:: wavespeed
voice:: demo-voice
tts_model:: minimax/speech-2.8-hd
speed:: 1.1
emotion:: happy

## NN Template: Plain
slug:: plain
tool:: wavespeed
voice:: demo-voice
tts_model:: minimax/speech-2.8-hd
`;

function writeTemplates() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-template-delivery-'));
  fs.writeFileSync(path.join(dir, 'templates_V_0-1-0_demo_NN.md'), TEMPLATES_DOC, 'utf8');
  return dir;
}

function sceneModel(templateName) {
  return {
    version: 'nn-read-knowledge@1',
    frontmatter: { title: 'V' },
    elements: {
      Video: [{ type: 'Video', name: 'V', slug: 'v', fields: { title: 'V', template: `[[Series :: ${templateName}]]` } }],
      Scene: [{ type: 'Scene', name: 's1', slug: 's1', description: 'words here', fields: {} }],
      Layer: [],
    },
  };
}

test('loadTemplateModels carries speed and emotion from the Template element', () => {
  const templates = loadTemplateModels(writeTemplates());

  assert.equal(templates['Presenter Full'].speed, 1.1);
  assert.equal(templates['Presenter Full'].emotion, 'happy');
  // A Template that declares neither keeps them absent, so defaults never leak
  // into the TTS cache key.
  assert.equal('speed' in templates.Plain, false);
  assert.equal('emotion' in templates.Plain, false);
});

test('buildTtsVoiceOptions puts speed and emotion into the TTS cache key', () => {
  const templates = loadTemplateModels(writeTemplates());
  const lowered = new SceneCompiler().lowerKnowledgeModel(sceneModel('Presenter Full'), { templates });

  const voiceOptions = buildTtsVoiceOptions(lowered.scenes[0], {});

  assert.equal(voiceOptions.speed, 1.1);
  assert.equal(voiceOptions.emotion, 'happy');
});

test('buildTtsVoiceOptions omits delivery the template does not declare', () => {
  const templates = loadTemplateModels(writeTemplates());
  const lowered = new SceneCompiler().lowerKnowledgeModel(sceneModel('Plain'), { templates });

  const voiceOptions = buildTtsVoiceOptions(lowered.scenes[0], {});

  assert.equal('speed' in voiceOptions, false);
  assert.equal('emotion' in voiceOptions, false);
});

test('the compiled manifest carries the template delivery for the synthesizer', () => {
  const templates = loadTemplateModels(writeTemplates());
  const lowered = new SceneCompiler().lowerKnowledgeModel(sceneModel('Presenter Full'), { templates });

  assert.equal(lowered.scenes[0].resolvedTemplate.speed, 1.1);
  assert.equal(lowered.scenes[0].resolvedTemplate.emotion, 'happy');
});
