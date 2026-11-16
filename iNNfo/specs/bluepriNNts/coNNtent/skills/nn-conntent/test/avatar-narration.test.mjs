#!/usr/bin/env node

/**
 * nn-conntent/test/avatar-narration.test.mjs
 *
 * Two document contracts that used to reach the runtime instead of the guard:
 *
 * - An `avatar` Layer is a paid lip-sync job driven by its Scene's narration, so the pre-compile
 *   guard refuses one in a Scene with no narration (`avatar-requires-narration`) and names the
 *   type that draws a still. A still presenter is `type:: media`, not an avatar.
 * - A Scene Kind that declares `narration:: off` makes no TTS request, so a body it carries is
 *   never spoken: `validateSceneKinds` refuses it (`narration-off-with-body`) instead of leaving
 *   prose in the document that reaches nobody.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { SceneCompiler } from '../scripts/scene-compiler.mjs';
import { validateSceneKinds } from '../scripts/lib/kinds.mjs';

function avatarDoc(body) {
  return {
    version: 'innfo-read-knowledge@1',
    frontmatter: { title: 'Avatar check' },
    elements: {
      Video: [{ type: 'Video', name: 'Avatar check', slug: 'avatar-check', fields: { title: 'Avatar check', language: 'es' } }],
      Scene: [{ type: 'Scene', name: 'Problema', slug: 'problema', description: body, fields: {} }],
      Layer: [{ type: 'Layer', name: 'Presenter', slug: 'problema-presenter', fields: { type: 'avatar', asset: 'media/host.png' } }],
    },
  };
}

const compiler = new SceneCompiler({ width: 1920, height: 1920 });

test('an avatar Layer in a Scene with no narration is refused before any spend', () => {
  const guard = compiler.checkScript(avatarDoc(''));
  const err = guard.errors.find((e) => e.code === 'avatar-requires-narration');
  assert.ok(err, JSON.stringify(guard.errors));
  assert.match(err.message, /Presenter/);
  assert.match(err.message, /Problema/);
  assert.match(err.message, /type:: media/);
  assert.match(err.message, /placement:: full/);
});

test('an avatar Layer in a narrated Scene passes the same guard', () => {
  const guard = compiler.checkScript(avatarDoc('Esto es lo que dice el presentador.'));
  assert.ok(!guard.errors.some((e) => e.code === 'avatar-requires-narration'), JSON.stringify(guard.errors));
});

test('a kind with narration:: off refuses a Scene that carries a body', () => {
  const grammar = { kinds: { Muda: { name: 'Muda', fields: { narration: 'off' } } }, chrome: {} };
  const model = {
    frontmatter: {},
    elements: {
      Scene: [
        { type: 'Scene', name: '00 Muda', slug: '00-muda', description: 'texto que nadie va a leer', fields: { kind: 'Muda' } },
        { type: 'Scene', name: '01 Muda', slug: '01-muda', description: '', fields: { kind: 'Muda' } },
      ],
    },
  };
  const errors = validateSceneKinds(model, grammar);
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.equal(errors[0].code, 'narration-off-with-body');
  assert.match(errors[0].message, /00 Muda/);
  assert.match(errors[0].message, /narration:: on/);
});

test('a kind with narration:: on keeps its body', () => {
  const grammar = { kinds: { Narrada: { name: 'Narrada', fields: { narration: 'on' } } }, chrome: {} };
  const model = {
    frontmatter: {},
    elements: { Scene: [{ type: 'Scene', name: 'A', slug: 'a', description: 'se lee', fields: { kind: 'Narrada' } }] },
  };
  assert.deepEqual(validateSceneKinds(model, grammar), []);
});

test('a Libre Scene has its own narration rule and is never judged by a kind', () => {
  const model = {
    frontmatter: {},
    elements: { Scene: [{ type: 'Scene', name: 'A', slug: 'a', description: 'se lee', fields: { kind: 'Libre' } }] },
  };
  assert.deepEqual(validateSceneKinds(model, { kinds: {}, chrome: {} }), []);
});
