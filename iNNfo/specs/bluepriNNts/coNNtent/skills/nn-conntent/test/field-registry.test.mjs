#!/usr/bin/env node

/**
 * nn-conntent/test/field-registry.test.mjs
 *
 * The generated field registry is the single machine-readable list every consumer reads
 * (design A11, capability video-field-registry): it is generated from the blueprint, its
 * freshness is a gate, every field names a consumer, and a stale or hand-edited file fails.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { buildRegistry, renderRegistry } from '../scripts/build-field-registry.mjs';
import { auditConsumers, consumerOf } from '../scripts/lib/field-consumers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPEC = path.resolve(HERE, '..', '..', '..', 'spec_NN.md');
const REGISTRY = path.resolve(HERE, '..', 'scripts', 'lib', 'field-registry.generated.json');
const SCRIPT = path.resolve(HERE, '..', 'scripts', 'build-field-registry.mjs');

const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));

test('the committed registry is exactly what the blueprint generates', () => {
  assert.equal(renderRegistry(buildRegistry(fs.readFileSync(SPEC, 'utf8'))), fs.readFileSync(REGISTRY, 'utf8'));
});

test('the registry carries the blueprint identity and the conditional-fields table', () => {
  assert.equal(registry.blueprint, 'coNNtent');
  assert.equal(registry.blueprint_version, 'V_0-18-0');
  assert.deepEqual(registry.conditional_fields, {
    avatar: ['asset', 'prompt'],
    media: ['asset', 'prompt'],
    text: ['text', 'text_from'],
    animation: ['asset'],
  });
});

test('cascade parameters are flagged and layer-only fields are not', () => {
  assert.equal(registry.fields.presets.cascade, true);
  assert.equal(registry.fields.presets.scope, 'render');
  assert.equal(registry.fields.kind.cascade, false);
  assert.equal(registry.fields.kind.scope, 'record');
  assert.equal(registry.fields.style.cascade, false);
  assert.equal(registry.fields.z_index.cascade, false);
});

test('every field has a consumer: a module, a named later slice, or a design reason', () => {
  const { dead, phantom } = auditConsumers(registry);
  assert.deepEqual(dead, [], 'no registry field may be dead');
  assert.deepEqual(phantom, [], 'no consumer may name a field the blueprint does not declare');
  for (const field of Object.keys(registry.fields)) {
    assert.ok(consumerOf(field), `${field} has a consumer`);
  }
});

test('--check is green on the committed artifact', () => {
  const res = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stderr || res.stdout);
});

test('--check fails on a stale artifact', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'field-registry-'));
  try {
    const mutated = path.join(dir, 'spec_NN.md');
    fs.writeFileSync(
      mutated,
      fs.readFileSync(SPEC, 'utf8').replace('options:: [avatar, media, text, animation]', 'options:: [avatar, media, text]'),
      'utf8',
    );
    const res = spawnSync(process.execPath, [SCRIPT, '--check', '--spec', mutated, '--out', REGISTRY], {
      encoding: 'utf8',
    });
    assert.equal(res.status, 1, 'a stale registry must fail the gate');
    assert.match(res.stderr, /DRIFT/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
