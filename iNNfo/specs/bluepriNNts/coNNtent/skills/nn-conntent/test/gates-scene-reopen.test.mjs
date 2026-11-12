/**
 * nn-conntent/test/gates-scene-reopen.test.mjs
 *
 * Review iteration (#612 item 5): every scene carries its own script hash, so a text
 * edit to one scene of a real episode document reopens that scene only; the other
 * scenes keep their applied approval. Driven through the engine entry points `produce`
 * uses (readEpisode → cascade bags → scriptSubjectsForEpisode → scriptGateStates), so a
 * lowering that leaked one scene's narration into another scene's subject (an offset,
 * a running duration, an index) would fail here.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readEpisode } from '../scripts/lib/episode.mjs';
import { loadCascadeBags, withScriptPresets } from '../scripts/lib/video-scope.mjs';
import { scriptGateStates, scriptSubjectsForEpisode } from '../scripts/lib/review-subject.mjs';

const scene = (name, slug, narration) => `## NN Scene: ${name}
slug:: ${slug}
kind:: Libre

${narration}
`;

const episodeDoc = (narrations) => `---
level: 3
parent_spec:
  name: "coNNtent_V_0-19-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
knowledge_version: "V_0-1-0"
title: "Probe episode"
---

# NN Video

## NN Video: Probe
slug:: e
title:: Probe
status:: draft
review_gates:: [script]

# NN Scene

${scene('One', 'one', narrations[0])}
${scene('Two', 'two', narrations[1])}
${scene('Three', 'three', narrations[2])}`;

function workspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-gates-reopen-'));
  const seriesDir = path.join(root, 'series', 's');
  const episodeDir = path.join(seriesDir, 'episodes', 'e');
  fs.mkdirSync(episodeDir, { recursive: true });
  fs.writeFileSync(
    path.join(seriesDir, 's_coNNtent_NN.md'),
    '---\nlevel: 3\nscope: true\nparent_spec:\n  name: "coNNtent_V_0-19-0"\n  url: "https://example.invalid/coNNtent/spec_NN.md"\ntitle: "S"\n---\n\n# NN Series\n\n## NN Series: S\nslug:: s\nlanguage:: es\n',
    'utf8',
  );
  return { root, scriptPath: path.join(episodeDir, 'e_coNNtent_NN.md') };
}

function subjectsOf(scriptPath) {
  const model = readEpisode(scriptPath).model;
  const bags = withScriptPresets(loadCascadeBags(path.dirname(scriptPath)), model, scriptPath);
  return scriptSubjectsForEpisode({ model, bags, scriptDir: path.dirname(scriptPath), language: 'es' });
}

const approvedBy = (subjects) =>
  subjects.map((entry) => ({
    scene: entry.scene,
    gate: 'script',
    verdict: 'approved',
    reviewedHash: entry.hash,
    planHash: null,
    notes: null,
    reviewer: 'Ana',
    authorKind: 'human',
    origin: 'console',
    appliedAt: '2026-11-09T10:00:00.000Z',
    changeset: 'changes/e_ana_1_changes_NN.md',
  }));

test('editing one scene of an approved episode reopens only that scene', () => {
  const ws = workspace();
  try {
    const before = ['Primera escena corta.', 'Segunda escena del medio.', 'Tercera escena final.'];
    fs.writeFileSync(ws.scriptPath, episodeDoc(before), 'utf8');
    const original = subjectsOf(ws.scriptPath);
    assert.deepEqual(original.map((s) => s.scene), ['one', 'two', 'three']);
    const verdicts = approvedBy(original);
    assert.deepEqual(
      scriptGateStates(original, verdicts).map((s) => s.state),
      ['approved', 'approved', 'approved'],
    );

    // A longer narration in the FIRST scene: anything positional downstream would move.
    const after = [
      'Primera escena, ahora bastante mas larga que antes, con muchas palabras nuevas que alargan la locucion.',
      before[1],
      before[2],
    ];
    fs.writeFileSync(ws.scriptPath, episodeDoc(after), 'utf8');
    const states = scriptGateStates(subjectsOf(ws.scriptPath), verdicts);
    assert.deepEqual(
      states.map((s) => [s.scene, s.state]),
      [
        ['one', 'reopened'],
        ['two', 'approved'],
        ['three', 'approved'],
      ],
    );
    assert.equal(states[0].cause.kind, 'content-changed');
  } finally {
    fs.rmSync(ws.root, { recursive: true, force: true });
  }
});

test('editing a middle scene leaves the scenes before and after it approved', () => {
  const ws = workspace();
  try {
    const before = ['Uno.', 'Dos.', 'Tres.'];
    fs.writeFileSync(ws.scriptPath, episodeDoc(before), 'utf8');
    const verdicts = approvedBy(subjectsOf(ws.scriptPath));
    fs.writeFileSync(ws.scriptPath, episodeDoc([before[0], 'Dos, corregido.', before[2]]), 'utf8');
    assert.deepEqual(
      scriptGateStates(subjectsOf(ws.scriptPath), verdicts).map((s) => s.state),
      ['approved', 'reopened', 'approved'],
    );
  } finally {
    fs.rmSync(ws.root, { recursive: true, force: true });
  }
});
