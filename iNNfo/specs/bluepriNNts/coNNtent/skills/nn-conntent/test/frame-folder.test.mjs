/**
 * nn-conntent/test/frame-folder.test.mjs
 *
 * Slice 2c — a frame is a folder. `library/frames/<name>/FRAME.md` with frontmatter
 * (`colors`, `typography`, `spacing`, `components`) parsed by the nn-core YAML parser
 * (nested `components:` maps included), an optional `caption-skin.html`/`fonts/`, and
 * emission copying it to `hyperframes/frame.md` with resolved tokens.
 *
 * (capability conntent-frame "A Frame Is A Folder With FRAME.md", "FRAME.md Frontmatter
 * Schema"; G11 — no third divergent parser.)
 *
 * Task 2c.1 — RED: the module still treats frames as single files and the parser is the
 * hand-rolled YAML subset.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { loadFrameFolder, emitHyperframesFrame } from '../scripts/lib/frame-tokens.mjs';

const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

const FRAME = `---
name: night
description: Night brand
colors:
  primary: "#7c3aed"
  background: "#0f0f13"
  foreground: "#f5f5f5"
typography:
  heading: { fontFamily: "Space Grotesk", weight: 700 }
  body: { fontFamily: "Inter", weight: 400 }
spacing:
  gap: 8px
components:
  button:
    radius: "12px"
    fill: "{colors.primary}"
---

Night frame: dark surfaces, violet accent.
`;

test('loadFrameFolder parses FRAME.md with nested components: maps through nn-core', () => {
  const root = tmp('frame-folder-');
  const frameDir = path.join(root, 'library', 'frames', 'night');
  fs.mkdirSync(frameDir, { recursive: true });
  fs.writeFileSync(path.join(frameDir, 'FRAME.md'), FRAME, 'utf8');

  const loaded = loadFrameFolder({ frameDir });
  assert.equal(loaded.name, 'night');
  assert.equal(loaded.tokens.colors.primary, '#7c3aed');
  // Nested components map must survive the parser.
  assert.equal(loaded.tokens.components.button.fill, '{colors.primary}');
  assert.equal(loaded.tokens.spacing.gap, '8px');
  fs.rmSync(root, { recursive: true, force: true });
});

test('loadFrameFolder reads an optional caption-skin.html and fonts/', () => {
  const root = tmp('frame-folder-skin-');
  const frameDir = path.join(root, 'library', 'frames', 'night');
  fs.mkdirSync(path.join(frameDir, 'fonts'), { recursive: true });
  fs.writeFileSync(path.join(frameDir, 'FRAME.md'), FRAME, 'utf8');
  fs.writeFileSync(path.join(frameDir, 'caption-skin.html'), '<style>.cap{color:var(--accent)}</style>', 'utf8');
  fs.writeFileSync(path.join(frameDir, 'fonts', 'Inter.woff2'), 'woff', 'utf8');

  const loaded = loadFrameFolder({ frameDir });
  assert.equal(loaded.skin, '<style>.cap{color:var(--accent)}</style>');
  assert.deepEqual(Array.from(loaded.fonts), ['Inter.woff2']);
  fs.rmSync(root, { recursive: true, force: true });
});

test('emitHyperframesFrame copies FRAME.md to hyperframes/frame.md and the skin', () => {
  const root = tmp('frame-folder-emit-');
  const frameDir = path.join(root, 'library', 'frames', 'night');
  fs.mkdirSync(frameDir, { recursive: true });
  fs.writeFileSync(path.join(frameDir, 'FRAME.md'), FRAME, 'utf8');
  fs.writeFileSync(path.join(frameDir, 'caption-skin.html'), 'skin-bytes', 'utf8');
  const projectDir = path.join(root, 'project');
  fs.mkdirSync(projectDir, { recursive: true });

  emitHyperframesFrame({ frameDir, projectDir });
  const emitted = fs.readFileSync(path.join(projectDir, 'hyperframes', 'frame.md'), 'utf8');
  assert.equal(emitted, FRAME, 'frame.md is byte-identical to FRAME.md');
  const skin = fs.readFileSync(path.join(projectDir, 'hyperframes', 'caption-skin.html'), 'utf8');
  assert.equal(skin, 'skin-bytes');
  fs.rmSync(root, { recursive: true, force: true });
});