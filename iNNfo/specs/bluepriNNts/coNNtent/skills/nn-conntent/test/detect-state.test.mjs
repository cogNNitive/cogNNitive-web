/**
 * nn-conntent/test/detect-state.test.mjs
 *
 * The state-aware entry point (capability conntent-procedures "State-aware entry point";
 * design D-R1; task 5b.1). Detection reads files only and the first match wins.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { PROCEDURE_NAMES, detectState } from '../scripts/lib/detect-state.mjs';

const DOMAIN = '---\nname: "P"\nworkspace_id: "p"\n---\n\n# NN DomaiNN\n';
const DEFAULTS = '# NN Video Defaults\n\n## NN Video Defaults: D\nlanguage:: es\n';
const SERIES = (slug) =>
  `---\nlevel: 3\nscope: true\nparent_spec:\n  name: "coNNtent_V_0-17-0"\n  url: "x"\ntitle: "S"\n---\n\n# NN Series\n\n## NN Series: S\nslug:: ${slug}\nlanguage:: es\n`;
const EPISODE = (slug, status) =>
  `---\nlevel: 3\nparent_spec:\n  name: "coNNtent_V_0-17-0"\n  url: "x"\nblueprint_version: "V_0-17-0"\ntitle: "E"\n---\n\n# NN Video\n\n## NN Video: E\nslug:: ${slug}\nstatus:: ${status}\n`;

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-detect-state-'));
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const write = (root, rel, text) => {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
};

const setupDomain = (root) => {
  write(root, 'domaiNN_NN.md', DOMAIN);
  write(root, 'video-defaults_NN.md', DEFAULTS);
};

const addSeries = (root, slug, statuses = []) => {
  write(root, `series/${slug}/${slug}_coNNtent_NN.md`, SERIES(slug));
  statuses.forEach((status, i) => {
    write(root, `series/${slug}/episodes/e${i + 1}/e${i + 1}_coNNtent_NN.md`, EPISODE(`e${i + 1}`, status));
  });
};

test('an empty folder asks to set up the domain', () => {
  const ws = workspace();
  try {
    assert.equal(detectState(ws.root).procedure, PROCEDURE_NAMES.setupDomain);
  } finally {
    ws.cleanup();
  }
});

test('a legacy layout is rejected with the layout message, not adapted', () => {
  const ws = workspace();
  try {
    setupDomain(ws.root);
    write(ws.root, 'series/s/assets/e/e_coNNtent_NN.md', EPISODE('e', 'draft'));
    write(ws.root, 'video-guard.json', '{}');
    const state = detectState(ws.root);
    assert.equal(state.procedure, PROCEDURE_NAMES.setupDomain);
    assert.equal(state.reason, 'legacy-layout');
    assert.ok(state.legacy.length >= 2);
    assert.ok(state.legacy.every((finding) => finding.code === 'legacy-layout'));
  } finally {
    ws.cleanup();
  }
});

test('frame then character are proposed before the first series, and are skippable', () => {
  const ws = workspace();
  try {
    setupDomain(ws.root);
    const frame = detectState(ws.root);
    assert.equal(frame.procedure, PROCEDURE_NAMES.defineFrame);
    assert.equal(frame.skippable, true);

    write(ws.root, 'library/frames/neutral/FRAME.md', '# FRAME\n');
    assert.equal(detectState(ws.root).procedure, PROCEDURE_NAMES.defineCharacter);

    write(ws.root, 'library/characters/lucas/CHARACTER.md', '# CHARACTER\n');
    assert.equal(detectState(ws.root).procedure, PROCEDURE_NAMES.createSeries);
  } finally {
    ws.cleanup();
  }
});

test('once a series exists the frame and character proposals are gone', () => {
  const ws = workspace();
  try {
    setupDomain(ws.root);
    addSeries(ws.root, 's', []);
    const state = detectState(ws.root);
    assert.equal(state.procedure, PROCEDURE_NAMES.planEpisode);
    assert.equal(state.series, 's');
  } finally {
    ws.cleanup();
  }
});

test('an idea episode or one without a draft is planned', () => {
  const ws = workspace();
  try {
    setupDomain(ws.root);
    addSeries(ws.root, 's', ['idea']);
    const state = detectState(ws.root);
    assert.equal(state.procedure, PROCEDURE_NAMES.planEpisode);
    assert.equal(state.reason, 'unplanned-episode');
    assert.equal(state.episode, 'e1');
  } finally {
    ws.cleanup();
  }
});

test('a draft, approved, produced or failed_qa episode is produced', () => {
  for (const status of ['draft', 'approved', 'produced', 'failed_qa']) {
    const ws = workspace();
    try {
      setupDomain(ws.root);
      addSeries(ws.root, 's', [status]);
      const state = detectState(ws.root);
      assert.equal(state.procedure, PROCEDURE_NAMES.produceEpisode, status);
      assert.equal(state.episode, 'e1');
    } finally {
      ws.cleanup();
    }
  }
});

test('all episodes delivered proposes a new episode', () => {
  const ws = workspace();
  try {
    setupDomain(ws.root);
    addSeries(ws.root, 's', ['delivered', 'archived']);
    const state = detectState(ws.root);
    assert.equal(state.procedure, PROCEDURE_NAMES.planEpisode);
    assert.equal(state.reason, 'all-delivered');
  } finally {
    ws.cleanup();
  }
});
