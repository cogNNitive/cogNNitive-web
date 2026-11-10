/**
 * nn-conntent/test/placement.test.mjs
 *
 * The blueprint declares the episode and series locations: `Video` instances live at
 * `{container}/episodes/{slug}/`, the Series document is named `<s>_coNNtent_NN.md` and
 * recognised by frontmatter `scope: true`, and the episode document `<slug>_coNNtent_NN.md`
 * satisfies the nn-core `_NN` stem invariant. (capability conntent-folder-contract
 * "Series and episode locations are declared by the bluepriNNt"; design G1/G2.)
 *
 * Task 1a.5 — RED: `BP/spec_NN.md` still declares `placement:: "{container}/assets/{slug}/"`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertLayout } from '../scripts/lib/layout.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
// test -> nn-conntent -> skills -> coNNtent (the blueprint root)
const BP = path.resolve(here, '..', '..', '..');
const SPEC = path.join(BP, 'spec_NN.md');

const VIDEO_PLACEMENT_RE = /placement::\s+"\{container\}\/episodes\/\{slug\}\/"/;

test('the blueprint declares the Video placement as episodes/<slug>/', () => {
  const text = fs.readFileSync(SPEC, 'utf8');
  assert.match(text, VIDEO_PLACEMENT_RE);
});

test('a series/<s>/episodes/<slug>/ tree with the new document names is a clean layout', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'placement-'));
  try {
    fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '# NN DomaiNN\n', 'utf8');
    fs.mkdirSync(path.join(root, 'series', 's', 'episodes', 'e'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'series', 's', 's_coNNtent_NN.md'),
      '---\nlevel: 3\nscope: true\ntitle: "S"\n---\n',
      'utf8',
    );
    fs.writeFileSync(
      path.join(root, 'series', 's', 'episodes', 'e', 'e_coNNtent_NN.md'),
      '---\nlevel: 3\ntitle: "E"\n---\n\n# NN Video\n',
      'utf8',
    );
    assert.deepEqual(assertLayout(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});