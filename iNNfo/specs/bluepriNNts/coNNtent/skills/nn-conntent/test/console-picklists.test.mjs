/**
 * nn-conntent/test/console-picklists.test.mjs
 *
 * Picklists come from the catalog (capability conntent-domain-console, "Console edits are
 * changeset operations" / "Picklists come from the catalog"): `image_model`, `avatar_model`,
 * `voice_model` and `voice` are selects whose options are read from this domaiNN's catalog,
 * models by `api_id` filtered by the capability the field consumes, voices by slug. When the
 * catalog offers nothing for a field, the field stays a free-text box -- an empty select is
 * worse than a text box.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeConsole } from '../../../../../../../scripts/export-console.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BLUEPRINT = path.resolve(HERE, '..', '..', '..');

const CATALOG = `---
level: 3
parent_spec:
  name: "coNNtent_V_0-15-1"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Probe catalog"
---

# NN index

* [[Model]]
* [[Voice]]

# NN Model

## NN Model: z-image-turbo
slug:: z-image-turbo
provider:: wavespeed
api_id:: wavespeed-ai/z-image/turbo
capability:: image
adapter:: wavespeed
price:: 0.005
price_unit:: per_image
price_date:: 2026-01-01
allowed:: true

## NN Model: flux-blocked
slug:: flux-blocked
provider:: replicate
api_id:: replicate/flux-schnell
capability:: image
adapter:: replicate
price:: 0.01
price_unit:: per_image
price_date:: 2026-01-01
allowed:: false

## NN Model: infinitetalk-fast
slug:: infinitetalk-fast
provider:: wavespeed
api_id:: wavespeed-ai/infinitetalk-fast
capability:: avatar
adapter:: infinite-talk
price:: 0.05
price_unit:: per_second
price_date:: 2026-01-01
allowed:: true

## NN Model: minimax-speech-hd
slug:: minimax-speech-hd
provider:: wavespeed
api_id:: minimax/speech-2.8-hd
capability:: tts
adapter:: minimax-speech
price:: 0.02
price_unit:: per_1k_chars
price_date:: 2026-01-01
allowed:: true

# NN Voice

## NN Voice: villabotijos
slug:: villabotijos
model:: minimax-speech-hd
voice_id:: Villabotijos01
language:: es

## NN Voice: no-provider-id
slug:: no-provider-id
model:: minimax-speech-hd
language:: es
`;

const SERIES = `---
level: 3
scope: true
parent_spec:
  name: "coNNtent_V_0-15-1"
  url: "https://example.invalid/coNNtent/spec_NN.md"
title: "Probe Series"
---

# NN Series

## NN Series: S
slug:: s
language:: es
`;

const EPISODE = `---
level: 3
parent_spec:
  name: "coNNtent_V_0-15-1"
  url: "https://example.invalid/coNNtent/spec_NN.md"
blueprint_version: "V_0-17-0"
title: "Probe episode"
---

# NN Video

## NN Video: Probe
slug:: e
title:: Probe
status:: draft
review_gates:: []
output_formats:: [1920x1920]
image_model:: wavespeed-ai/z-image/turbo

# NN Scene

## NN Scene: One
slug:: one
kind:: Libre

one two three four five six seven eight nine ten
`;

function workspace({ catalog = CATALOG } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-picklists-'));
  fs.writeFileSync(
    path.join(root, 'domaiNN_NN.md'),
    '---\nname: "Probe"\nworkspace_id: "probe"\n---\n\n# NN DomaiNN\n',
    'utf8',
  );
  fs.mkdirSync(path.join(root, 'specs', 'bluepriNNts', 'coNNtent'), { recursive: true });
  fs.copyFileSync(
    path.join(BLUEPRINT, 'spec_NN.md'),
    path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'spec_NN.md'),
  );
  const bpCatalog = path.join(BLUEPRINT, 'catalog');
  if (fs.existsSync(bpCatalog)) {
    fs.cpSync(bpCatalog, path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'catalog'), {
      recursive: true,
    });
  }
  const seriesDir = path.join(root, 'series', 's');
  const episodeDir = path.join(seriesDir, 'episodes', 'e');
  fs.mkdirSync(episodeDir, { recursive: true });
  fs.writeFileSync(path.join(seriesDir, 's_coNNtent_NN.md'), SERIES, 'utf8');
  fs.writeFileSync(path.join(episodeDir, 'e_coNNtent_NN.md'), EPISODE, 'utf8');
  fs.mkdirSync(path.join(root, 'changes'), { recursive: true });
  if (catalog !== null) fs.writeFileSync(path.join(root, 'model-catalog_NN.md'), catalog, 'utf8');
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

/** The schema slot the console shell embeds: `<script type="application/json" id="nn-schema">`. */
function schemaSlot(html) {
  const match = /<script[^>]*id="nn-schema"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match, 'the console carries the nn-schema slot');
  return JSON.parse(match[1]);
}

const fieldOf = (schema, name) => {
  const fields = Array.isArray(schema.fields) ? schema.fields : [];
  return fields.filter((f) => String(f && f.name) === name);
};

test('model picklists carry the catalog api_id, filtered by the capability the field consumes', async () => {
  const ws = workspace();
  try {
    const result = await writeConsole({ rootDir: ws.root, open: false });
    const schema = schemaSlot(fs.readFileSync(result.path, 'utf8'));

    const image = fieldOf(schema, 'image_model')[0];
    assert.ok(image, 'the image_model field is declared');
    assert.equal(image.type, 'select', 'a catalog-backed field is a select');
    assert.deepEqual(image.options, ['wavespeed-ai/z-image/turbo'], 'api_id, allowed, capability image only');

    const avatar = fieldOf(schema, 'avatar_model')[0];
    assert.deepEqual(avatar.options, ['wavespeed-ai/infinitetalk-fast'], 'avatar models only');

    const tts = fieldOf(schema, 'voice_model')[0];
    assert.deepEqual(tts.options, ['minimax/speech-2.8-hd'], 'tts models only');
  } finally {
    ws.cleanup();
  }
});

test('the voice picklist is the catalog voices that have a provider id, by slug', async () => {
  const ws = workspace();
  try {
    const result = await writeConsole({ rootDir: ws.root, open: false });
    const schema = schemaSlot(fs.readFileSync(result.path, 'utf8'));
    const voice = fieldOf(schema, 'voice')[0];
    assert.ok(voice, 'the voice field is declared');
    assert.equal(voice.type, 'select');
    assert.deepEqual(voice.options, ['villabotijos'], 'a Voice with no provider id cannot be picked');
  } finally {
    ws.cleanup();
  }
});

test('no catalog leaves every picklist field a free-text box', async () => {
  const ws = workspace({ catalog: null });
  try {
    const result = await writeConsole({ rootDir: ws.root, open: false });
    const schema = schemaSlot(fs.readFileSync(result.path, 'utf8'));
    for (const name of ['image_model', 'avatar_model', 'voice_model', 'voice']) {
      const field = fieldOf(schema, name)[0];
      assert.ok(field, `${name} is declared`);
      assert.notEqual(field.type, 'select', `${name} stays free text with no catalog`);
    }
  } finally {
    ws.cleanup();
  }
});

const ALLOWLIST_CATALOG = `---
level: 3
parent_spec:
  name: "coNNtent_V_0-15-1"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Allowlist only catalog"
---

# NN index

* [[Model]]

# NN Model

## NN Model: z-image-turbo
slug:: z-image-turbo
allowed:: true

## NN Model: infinitetalk-fast
slug:: infinitetalk-fast
allowed:: true

## NN Model: minimax-speech-hd
slug:: minimax-speech-hd
allowed:: true
`;

test('picklists merge blueprint reference catalog with domain overlay declaring only allowed slugs', async () => {
  const ws = workspace({ catalog: ALLOWLIST_CATALOG });
  try {
    const result = await writeConsole({ rootDir: ws.root, open: false });
    const schema = schemaSlot(fs.readFileSync(result.path, 'utf8'));

    const image = fieldOf(schema, 'image_model')[0];
    assert.ok(image, 'the image_model field is declared');
    assert.equal(image.type, 'select');
    assert.deepEqual(image.options, ['wavespeed-ai/z-image/turbo']);

    const avatar = fieldOf(schema, 'avatar_model')[0];
    assert.ok(avatar, 'the avatar_model field is declared');
    assert.equal(avatar.type, 'select');
    assert.deepEqual(avatar.options, ['wavespeed-ai/infinitetalk-fast']);

    const tts = fieldOf(schema, 'voice_model')[0];
    assert.ok(tts, 'the voice_model field is declared');
    assert.equal(tts.type, 'select');
    assert.deepEqual(tts.options, ['minimax/speech-2.8-hd']);
  } finally {
    ws.cleanup();
  }
});
