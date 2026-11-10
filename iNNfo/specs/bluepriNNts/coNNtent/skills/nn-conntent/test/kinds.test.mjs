#!/usr/bin/env node

/**
 * nn-conntent/test/kinds.test.mjs
 *
 * The series grammar (capability video-scene-kinds): Scene Kinds and Chrome come from the
 * Series document, a kind contributes only its presets at the `kind` cascade level, `Libre`
 * contributes nothing, a V_0-15-0 scene must state a known kind, and a V_0-15-0 document
 * must resolve a language (the blueprint ships no default).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  LIBRE,
  chromeFieldsFor,
  kindBagOf,
  loadSeriesGrammar,
  validateLanguage,
  validateSceneKinds,
} from '../scripts/lib/kinds.mjs';
import { loadPresetIndex } from '../scripts/lib/presets.mjs';
import { resolve } from '../scripts/lib/cascade.mjs';

const seriesDoc = `---
level: 3
scope: true
title: "Test series"
---

# NN Series

## NN Series: Test
slug:: test
language:: es

# NN Scene Kind

## NN Scene Kind: Gancho
slug:: gancho
role:: hook
narration:: on
variants:: 3
presets:: [K]

## NN Scene Kind: Intro
slug:: intro
narration:: off
fixed:: first
asset:: media/bumper.mp4
chrome:: [watermark, music]

# NN Chrome

## NN Chrome: es
slug:: chrome-es
language:: es
watermark:: generado con IA
music:: assets/music.mp3
`;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kinds-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  const series = path.join(root, 'series', 'test');
  fs.mkdirSync(series, { recursive: true });
  fs.writeFileSync(path.join(series, 'test_coNNtent_NN.md'), seriesDoc, 'utf8');
  const episode = path.join(series, 'assets', 'ep');
  fs.mkdirSync(episode, { recursive: true });
  return { root, episode };
}

const pinned = (scenes) => ({ frontmatter: { blueprint_version: 'V_0-15-0' }, elements: { Scene: scenes } });
const scene = (name, fields) => ({ name, slug: name.toLowerCase(), fields });

test('the grammar is read from the Series document, never from a sibling file', () => {
  const { episode } = fixture();
  const grammar = loadSeriesGrammar(episode);
  assert.deepEqual(Object.keys(grammar.kinds).sort(), ['Gancho', 'Intro']);
  assert.equal(grammar.kinds.Intro.fields.fixed, 'first');
  assert.deepEqual(grammar.kinds.Gancho.fields.presets, ['K']);
  assert.equal(grammar.chrome.es.fields.watermark, 'generado con IA');
});

test('a kind contributes only its presets; Libre contributes nothing', () => {
  const { episode } = fixture();
  const grammar = loadSeriesGrammar(episode);
  assert.deepEqual(kindBagOf(grammar, 'Gancho'), { presets: ['K'] });
  assert.equal(kindBagOf(grammar, LIBRE), null);
  assert.equal(kindBagOf(grammar, 'Nope'), null);
});

test('a V_0-15-0 scene must state a known kind or Libre', () => {
  const { episode } = fixture();
  const grammar = loadSeriesGrammar(episode);
  assert.deepEqual(validateSceneKinds(pinned([scene('A', { kind: 'Gancho' })]), grammar), []);
  assert.deepEqual(validateSceneKinds(pinned([scene('A', { kind: LIBRE })]), grammar), []);
  assert.equal(validateSceneKinds(pinned([scene('A', {})]), grammar)[0].code, 'missing-kind');
  const unknown = validateSceneKinds(pinned([scene('A', { kind: 'Noticias' })]), grammar);
  assert.equal(unknown[0].code, 'unknown-kind');
  assert.match(unknown[0].message, /Gancho/);
});

test('a legacy document (no V_0-15-0 pin) is exempt from the kind rule', () => {
  const { episode } = fixture();
  const grammar = loadSeriesGrammar(episode);
  assert.deepEqual(validateSceneKinds({ frontmatter: {}, elements: { Scene: [scene('A', {})] } }, grammar), []);
});

test('a V_0-15-0 document must resolve a language', () => {
  assert.equal(validateLanguage(pinned([]), 'es'), null);
  assert.equal(validateLanguage(pinned([]), '').code, 'missing-language');
  assert.equal(validateLanguage({ frontmatter: {}, elements: {} }, ''), null, 'legacy documents keep the old default');
});

test('the kind preset sits between series and video', () => {
  const presetIndex = loadPresetIndex([
    { doc: 'series', elements: { Preset: [{ name: 'K', slug: 'k', fields: { transition: 'fade' } }] } },
  ]);
  const bags = { series: { transition: 'wipe' }, presetIndex };
  const withKind = resolve('transition', { ...bags, kind: { presets: ['K'] } });
  assert.equal(withKind.value, 'fade');
  assert.equal(withKind.source, 'kind:preset:K');
  const videoWins = resolve('transition', { ...bags, kind: { presets: ['K'] }, video: { transition: 'slide-left' } });
  assert.equal(videoWins.value, 'slide-left');
  assert.equal(videoWins.source, 'video');
  const libre = resolve('transition', { ...bags, scene: { kind: LIBRE } });
  assert.equal(libre.value, 'wipe');
});

test('chrome resolves for the cascaded language and names what is missing', () => {
  const { episode } = fixture();
  const grammar = loadSeriesGrammar(episode);
  const es = chromeFieldsFor(grammar, 'Intro', 'es');
  assert.equal(es.fields.watermark, 'generado con IA');
  assert.deepEqual(es.missing, []);
  const en = chromeFieldsFor(grammar, 'Intro', 'en');
  assert.deepEqual(en.missing.sort(), ['music', 'watermark']);
  assert.deepEqual(chromeFieldsFor(grammar, 'Gancho', 'es'), { fields: {}, missing: [] }, 'a kind without chrome resolves nothing');
});
