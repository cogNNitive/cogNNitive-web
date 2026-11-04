#!/usr/bin/env node

/**
 * nn-conntent/test/avatar-render-refusal.test.mjs
 *
 * `render` refuses to render when an avatar Layer has no cached lip-sync clip, names
 * every such Layer and states the avatar synthesis command (cognnitive-video-engine
 * "Render Refuses Missing Avatar Clips"). There is no override flag.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { compileVideo } from '../scripts/lib/compile.mjs';
import { renderVideo } from '../scripts/lib/render.mjs';

for (const k of ['WAVESPEED_API_KEY', 'REPLICATE_API_TOKEN', 'TTS_PROVIDER', 'MEDIA_PROVIDER']) {
  delete process.env[k];
}

const avatarScript = `---
level: 3
title: "Avatar refusal"
---

# NN Video

## NN Video: Avatar refusal
slug:: avatar-refusal
title:: Avatar refusal

# NN Scene

## NN Scene: Opening
slug:: opening

This narration is spoken by the host.

# NN Layer

### NN Layer: Host
type:: presenter
asset:: media/face.png
`;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-refusal-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
  fs.mkdirSync(path.join(root, 'media'));
  fs.writeFileSync(path.join(root, 'media', 'face.png'), Buffer.from('png-bytes'));
  const scriptPath = path.join(root, 'avatar-refusal_NN.md');
  fs.writeFileSync(scriptPath, avatarScript, 'utf8');
  return { root, scriptPath };
}

/**
 * An offline compile writes its silence under `<key>-offline`; the avatar pick-up reads the
 * billable key. Copy each offline narration to the key a keyed run would read, so the test
 * exercises "audio present, clip missing" without a provider.
 */
function promoteOfflineTts(cacheDir) {
  let promoted = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('-offline.mp3')) {
        fs.copyFileSync(full, path.join(dir, entry.name.replace('-offline.mp3', '.mp3')));
        promoted++;
      }
    }
  };
  walk(cacheDir);
  return promoted;
}

test('render refuses an avatar Layer with no cached clip and names the synthesis command', async () => {
  const { root, scriptPath } = fixture();
  const cacheDir = path.join(root, 'cache');
  try {
    await compileVideo({ scriptPath, cacheDir, synthesizeAssets: true });
    assert.ok(promoteOfflineTts(cacheDir) > 0, 'the fixture produced a narration entry');

    let ran = 0;
    await assert.rejects(
      () =>
        renderVideo({
          scriptPath,
          cacheDir,
          synthesizeAssets: false,
          hyperframesRun: async () => {
            ran++;
            return { status: 0 };
          },
        }),
      (err) => {
        assert.match(err.message, /synthesize-avatar\.mjs/);
        assert.match(err.message, /Host/);
        return true;
      },
    );
    assert.equal(ran, 0, 'the renderer is never invoked');
    assert.equal(fs.existsSync(path.join(root, 'avatar-refusal_1920x1920.mp4')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
