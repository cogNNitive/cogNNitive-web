/**
 * nn-conntent/test/qa.test.mjs
 *
 * Full QA test suite (capability conntent-qa; design D-P5; tasks 3b-4.1..3b-4.6).
 * Replaces minimal overlay check with master and output-set checkpoints:
 * - qaMaster: structural, visible text edge density, duration, size, audio stream
 * - qaOutputSet: formats, thumbnails, description existence, non-empty, dimensions
 * - deterministic qa.json report
 * - failed_qa on failure, exit 12, no delivery, master kept
 * - rerun from failed_qa resumes and succeeds
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  QA_TEXT_EDGE_MIN,
  qaMaster,
  qaOutputSet,
  writeQaReport,
} from '../scripts/lib/qa.mjs';
import { produce, EXIT_QA, EXIT_DONE, ProduceStop } from '../scripts/lib/pipeline.mjs';
import { readEpisode } from '../scripts/lib/episode.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BLUEPRINT = path.resolve(HERE, '..', '..', '..');

function dummyWorkspace(doc = defaultEpisodeDoc()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-ws-'));
  fs.writeFileSync(path.join(root, 'domaiNN_NN.md'), '---\nname: "QA Probe"\nworkspace_id: "qa-probe"\n---\n\n# NN DomaiNN\n', 'utf8');
  fs.mkdirSync(path.join(root, 'specs', 'bluepriNNts', 'coNNtent'), { recursive: true });
  fs.mkdirSync(path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'V_0-18-0'), { recursive: true });
  fs.copyFileSync(path.join(BLUEPRINT, 'spec_NN.md'), path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'spec_NN.md'));
  fs.copyFileSync(path.join(BLUEPRINT, 'spec_NN.md'), path.join(root, 'specs', 'bluepriNNts', 'coNNtent', 'V_0-18-0', 'spec_NN.md'));
  fs.copyFileSync(path.join(BLUEPRINT, 'defaults', 'video-defaults_NN.md'), path.join(root, 'video-defaults_NN.md'));
  fs.mkdirSync(path.join(root, 'changes'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'specs', 'defiNNe_V_0-1-0_NN.md'),
    '---\nspec_version: "V_0-1-0"\nlevel: 0\ntitle: "L0"\n---\n\n# NN DefiNNition\n',
    'utf8',
  );
  const seriesDir = path.join(root, 'series', 's');
  const episodeDir = path.join(seriesDir, 'episodes', 'e');
  fs.mkdirSync(episodeDir, { recursive: true });
  fs.writeFileSync(
    path.join(seriesDir, 's_coNNtent_NN.md'),
    '---\nlevel: 3\nscope: true\nparent_spec:\n  name: "coNNtent_V_0-15-1"\n  url: "https://example.invalid/coNNtent/spec_NN.md"\ntitle: "S"\n---\n\n# NN Series\n\n## NN Series: S\nslug:: s\nlanguage:: es\n',
    'utf8',
  );
  const scriptPath = path.join(episodeDir, 'e_coNNtent_NN.md');
  fs.writeFileSync(scriptPath, doc, 'utf8');
  return { root, episodeDir, scriptPath };
}

function defaultEpisodeDoc({ status = 'approved', budget = '1.5' } = {}) {
  return `---
spec_version: "V_0-18-0"
level: 3
parent_spec:
  name: "coNNtent_V_0-18-0"
  url: "https://example.invalid/coNNtent/spec_NN.md"
blueprint_version: "V_0-18-0"
title: "QA Test Episode"
---

# NN index

* [[Video]]
* [[Scene]]

# NN Video

## NN Video: e
slug:: e
title: QA Test Episode
status:: ${status}
budget:: ${budget}
review_gates:: []
output_formats:: [1920x1920]

# NN Scene

## NN Scene: one
slug:: one
order:: 1
title:: Opening
narration:: "Hello world"
`;
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

function createManifest({
  fps = 30,
  width = 1920,
  height = 1920,
  totalDurationInFrames = 90,
  scenes = null,
  overlays = null,
} = {}) {
  return {
    fps,
    width,
    height,
    totalDurationInFrames,
    totalDurationInSeconds: totalDurationInFrames / fps,
    tracks: {
      scenes: scenes || [
        { id: 'scene_one', slug: 'one', fromFrame: 0, durationInFrames: totalDurationInFrames, narration: 'Hello world', props: { layers: [] } },
      ],
      overlays: overlays || [],
      audio: [{ id: 'audio_narration', fromFrame: 0, durationInFrames: totalDurationInFrames }],
    },
    metadata: {},
  };
}

// ---------------------------------------------------------------------------
// 1. Tool unavailable / unreadable master
// ---------------------------------------------------------------------------
test('qaMaster: ffprobe or ffmpeg missing or unreadable master fails with qa-unavailable', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-unavail-'));
  try {
    const manifest = createManifest();
    const res = await qaMaster({
      episodeDir: dir,
      manifest,
      masterPath: path.join(dir, 'non-existent.mp4'),
      declaredSize: '1920x1920',
      deps: {
        checkTools: () => ({ ok: false, error: 'ffprobe not found' }),
      },
    });
    assert.equal(res.ok, false);
    const unavail = res.checks.find((c) => c.id === 'qa-unavailable');
    assert.ok(unavail, 'reported qa-unavailable check');
    assert.equal(unavail.status, 'fail');
  } finally {
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// 2. Master duration mismatch
// ---------------------------------------------------------------------------
test('qaMaster: duration mismatch > 1 frame reports duration-mismatch', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-dur-'));
  try {
    const manifest = createManifest({ totalDurationInFrames: 90 }); // 3.0s at 30fps
    const masterPath = path.join(dir, 'master.mp4');
    fs.writeFileSync(masterPath, 'video');
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'hyperframes', 'index.html'), '<div id="root"></div>');

    // Master is 2.0s (1 second shorter, clearly > 1 frame off)
    const res = await qaMaster({
      episodeDir: dir,
      manifest,
      masterPath,
      declaredSize: '1920x1920',
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({
          width: 1920,
          height: 1920,
          duration: 2.0,
          hasAudio: true,
        }),
      },
    });

    assert.equal(res.ok, false);
    const durCheck = res.checks.find((c) => c.id === 'duration-mismatch');
    assert.ok(durCheck, 'reports duration-mismatch');
    assert.equal(durCheck.expected, 3.0);
    assert.equal(durCheck.found, 2.0);
  } finally {
    cleanup(dir);
  }
});

test('qaMaster: duration within 1 frame passes duration check', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-dur-pass-'));
  try {
    const manifest = createManifest({ totalDurationInFrames: 90 }); // 3.0s at 30fps (frame = 0.0333s)
    const masterPath = path.join(dir, 'master.mp4');
    fs.writeFileSync(masterPath, 'video');
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'hyperframes', 'index.html'), '<div id="root"></div>');

    // 3.02s is within 1 frame (30fps -> 0.0333s)
    const res = await qaMaster({
      episodeDir: dir,
      manifest,
      masterPath,
      declaredSize: '1920x1920',
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({
          width: 1920,
          height: 1920,
          duration: 3.02,
          hasAudio: true,
        }),
      },
    });

    const durCheck = res.checks.find((c) => c.id === 'duration-mismatch');
    assert.equal(durCheck, undefined, 'no duration mismatch');
    assert.ok(res.checks.some((c) => c.id === 'duration' && c.status === 'pass'));
  } finally {
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// 3. Master size mismatch
// ---------------------------------------------------------------------------
test('qaMaster: size mismatch reports size-mismatch', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-size-'));
  try {
    const manifest = createManifest();
    const masterPath = path.join(dir, 'master.mp4');
    fs.writeFileSync(masterPath, 'video');
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'hyperframes', 'index.html'), '<div id="root"></div>');

    const res = await qaMaster({
      episodeDir: dir,
      manifest,
      masterPath,
      declaredSize: '1920x1920',
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({
          width: 1920,
          height: 1080, // Wrong: 1080 instead of 1920
          duration: 3.0,
          hasAudio: true,
        }),
      },
    });

    assert.equal(res.ok, false);
    const sizeCheck = res.checks.find((c) => c.id === 'size-mismatch');
    assert.ok(sizeCheck, 'reports size-mismatch');
    assert.equal(sizeCheck.expected, '1920x1920');
    assert.equal(sizeCheck.found, '1920x1080');
  } finally {
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// 4. Missing audio stream when narration exists
// ---------------------------------------------------------------------------
test('qaMaster: missing audio stream when scenes have narration reports audio-missing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-audio-'));
  try {
    const manifest = createManifest();
    const masterPath = path.join(dir, 'master.mp4');
    fs.writeFileSync(masterPath, 'video');
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'hyperframes', 'index.html'), '<div id="root"></div>');

    const res = await qaMaster({
      episodeDir: dir,
      manifest,
      masterPath,
      declaredSize: '1920x1920',
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({
          width: 1920,
          height: 1920,
          duration: 3.0,
          hasAudio: false, // Silent master with narrated scene
        }),
      },
    });

    assert.equal(res.ok, false);
    const audioCheck = res.checks.find((c) => c.id === 'audio-missing');
    assert.ok(audioCheck, 'reports audio-missing');
  } finally {
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// 5. Structural overlay check
// ---------------------------------------------------------------------------
test('qaMaster: overlay in manifest but missing in index.html reports overlay-missing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-ov-struct-'));
  try {
    const overlays = [
      { id: 'overlay_title_1', type: 'kineticTitle', sceneId: 'scene_one', fromFrame: 0, durationInFrames: 60, config: { title: 'Main Title' } },
    ];
    const manifest = createManifest({ overlays });
    const masterPath = path.join(dir, 'master.mp4');
    fs.writeFileSync(masterPath, 'video');
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    // index.html has NO host for overlay_title_1
    fs.writeFileSync(path.join(dir, 'hyperframes', 'index.html'), '<div id="root"></div>');

    const res = await qaMaster({
      episodeDir: dir,
      manifest,
      masterPath,
      declaredSize: '1920x1920',
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({ width: 1920, height: 1920, duration: 3.0, hasAudio: true }),
      },
    });

    assert.equal(res.ok, false);
    const missing = res.checks.find((c) => c.id === 'overlay-missing');
    assert.ok(missing, 'reports overlay-missing');
    assert.equal(missing.overlayKind, 'kineticTitle');
    assert.equal(missing.scene, 'scene_one');
  } finally {
    cleanup(dir);
  }
});

test('qaMaster: overlay host with mismatched start/duration reports overlay-missing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-ov-timing-'));
  try {
    const overlays = [
      { id: 'overlay_title_1', type: 'kineticTitle', sceneId: 'scene_one', fromFrame: 30, durationInFrames: 60, config: { title: 'Main Title' } },
    ];
    const manifest = createManifest({ overlays }); // 30fps -> start 1.0s, duration 2.0s
    const masterPath = path.join(dir, 'master.mp4');
    fs.writeFileSync(masterPath, 'video');
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    // data-start is 5.0 instead of 1.0
    fs.writeFileSync(
      path.join(dir, 'hyperframes', 'index.html'),
      '<div id="root"><div id="overlay_title_1" class="clip nn-overlay" data-start="5.0" data-duration="2.0"></div></div>',
    );

    const res = await qaMaster({
      episodeDir: dir,
      manifest,
      masterPath,
      declaredSize: '1920x1920',
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({ width: 1920, height: 1920, duration: 3.0, hasAudio: true }),
      },
    });

    assert.equal(res.ok, false);
    const missing = res.checks.find((c) => c.id === 'overlay-missing');
    assert.ok(missing, 'reports overlay-missing due to timing mismatch');
  } finally {
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// 6. Visible overlay check (edge density comparison)
// ---------------------------------------------------------------------------
test('qaMaster: overlay emitted in HTML but invisible in video frames reports overlay-missing (F1 regression)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-ov-invis-'));
  try {
    const overlays = [
      { id: 'overlay_watermark_1', type: 'watermark', sceneId: 'scene_one', fromFrame: 0, durationInFrames: 90, config: { text: 'Watermark' } },
    ];
    const manifest = createManifest({ overlays });
    const masterPath = path.join(dir, 'master.mp4');
    fs.writeFileSync(masterPath, 'video');
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    // Host exists structurally
    fs.writeFileSync(
      path.join(dir, 'hyperframes', 'index.html'),
      '<div id="root"><div id="overlay_watermark_1" class="clip nn-overlay" data-start="0" data-duration="3"></div></div>',
    );

    // Edge density diff is 0 (transparent / invisible)
    const res = await qaMaster({
      episodeDir: dir,
      manifest,
      masterPath,
      declaredSize: '1920x1920',
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({ width: 1920, height: 1920, duration: 3.0, hasAudio: true }),
        sampleEdgeDensity: () => 0.0001, // Below QA_TEXT_EDGE_MIN
      },
    });

    assert.equal(res.ok, false);
    const invis = res.checks.find((c) => c.id === 'overlay-missing');
    assert.ok(invis, 'reports overlay-missing because pixels do not appear');
    assert.ok(invis.sampled, 'sampled time is included');
  } finally {
    cleanup(dir);
  }
});

test('qaMaster: visible overlay with edge density >= QA_TEXT_EDGE_MIN passes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-ov-vis-'));
  try {
    const overlays = [
      { id: 'overlay_watermark_1', type: 'watermark', sceneId: 'scene_one', fromFrame: 0, durationInFrames: 90, config: { text: 'Watermark' } },
    ];
    const manifest = createManifest({ overlays });
    const masterPath = path.join(dir, 'master.mp4');
    fs.writeFileSync(masterPath, 'video');
    fs.mkdirSync(path.join(dir, 'hyperframes'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'hyperframes', 'index.html'),
      '<div id="root"><div id="overlay_watermark_1" class="clip nn-overlay" data-start="0" data-duration="3"></div></div>',
    );

    const res = await qaMaster({
      episodeDir: dir,
      manifest,
      masterPath,
      declaredSize: '1920x1920',
      deps: {
        checkTools: () => ({ ok: true }),
        probeMaster: () => ({ width: 1920, height: 1920, duration: 3.0, hasAudio: true }),
        sampleEdgeDensity: () => QA_TEXT_EDGE_MIN + 0.02, // Well above threshold
      },
    });

    assert.equal(res.ok, true);
    assert.ok(res.checks.some((c) => c.id === 'overlay-present'));
  } finally {
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// 7. Output-set QA: qaOutputSet
// ---------------------------------------------------------------------------
test('qaOutputSet: missing format or thumbnail reports output-missing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-out-missing-'));
  try {
    const slug = 'test-ep';
    // Only master exists, thumbnail and format are missing
    fs.writeFileSync(path.join(dir, `${slug}_1920x1920.mp4`), 'master');
    fs.writeFileSync(path.join(dir, `${slug}_description.md`), '# Description');

    const res = await qaOutputSet({
      episodeDir: dir,
      slug,
      outputFormats: ['1920x1920', '1080x1920'],
      thumbnailFormats: ['1080x1920'],
      deps: {
        probeSize: () => ({ width: 1920, height: 1920 }),
      },
    });

    assert.equal(res.ok, false);
    const missing = res.checks.filter((c) => c.id === 'output-missing');
    assert.ok(missing.length >= 2, 'both format and thumbnail reported missing');
    assert.ok(missing.some((c) => c.file.includes('thumbnail_1080x1920.png')));
    assert.ok(missing.some((c) => c.file.includes('1080x1920.mp4')));
  } finally {
    cleanup(dir);
  }
});

test('qaOutputSet: 0-byte file reports output-empty', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-out-empty-'));
  try {
    const slug = 'test-ep';
    fs.writeFileSync(path.join(dir, `${slug}_1920x1920.mp4`), 'master');
    fs.writeFileSync(path.join(dir, `${slug}_thumbnail_1080x1920.png`), ''); // 0 bytes
    fs.writeFileSync(path.join(dir, `${slug}_description.md`), '# Description');

    const res = await qaOutputSet({
      episodeDir: dir,
      slug,
      outputFormats: ['1920x1920'],
      thumbnailFormats: ['1080x1920'],
      deps: {
        probeSize: () => ({ width: 1920, height: 1920 }),
      },
    });

    assert.equal(res.ok, false);
    const emptyCheck = res.checks.find((c) => c.id === 'output-empty');
    assert.ok(emptyCheck, 'reports output-empty');
    assert.ok(emptyCheck.file.includes('thumbnail_1080x1920.png'));
  } finally {
    cleanup(dir);
  }
});

test('qaOutputSet: dimension mismatch reports output-size-mismatch', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-out-size-'));
  try {
    const slug = 'test-ep';
    fs.mkdirSync(path.join(dir, 'formats'), { recursive: true });
    const fmtPath = path.join(dir, 'formats', `${slug}_1080x1920.mp4`);
    fs.writeFileSync(fmtPath, 'video-bytes');
    fs.writeFileSync(path.join(dir, `${slug}_description.md`), '# Description');

    const res = await qaOutputSet({
      episodeDir: dir,
      slug,
      outputFormats: ['1080x1920'],
      thumbnailFormats: [],
      deps: {
        probeSize: () => ({ width: 1080, height: 1080 }), // Wrong: 1080x1080 instead of 1080x1920
      },
    });

    assert.equal(res.ok, false);
    const mismatch = res.checks.find((c) => c.id === 'output-size-mismatch');
    assert.ok(mismatch, 'reports output-size-mismatch');
    assert.equal(mismatch.expected, '1080x1920');
    assert.equal(mismatch.found, '1080x1080');
  } finally {
    cleanup(dir);
  }
});

test('qaOutputSet: all outputs present and valid passes', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-out-pass-'));
  try {
    const slug = 'test-ep';
    fs.mkdirSync(path.join(dir, 'formats'), { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}_1920x1920.mp4`), 'master');
    fs.writeFileSync(path.join(dir, 'formats', `${slug}_1080x1920.mp4`), 'video-bytes');
    fs.writeFileSync(path.join(dir, `${slug}_thumbnail_1080x1920.png`), 'png-bytes');
    fs.writeFileSync(path.join(dir, `${slug}_description.md`), '# Description');

    const res = await qaOutputSet({
      episodeDir: dir,
      slug,
      outputFormats: ['1920x1920', '1080x1920'],
      thumbnailFormats: ['1080x1920'],
      deps: {
        probeSize: (filePath) => {
          if (filePath.includes('1920x1920')) return { width: 1920, height: 1920 };
          return { width: 1080, height: 1920 };
        },
      },
    });

    assert.equal(res.ok, true);
    assert.ok(res.checks.every((c) => c.status === 'pass'));
  } finally {
    cleanup(dir);
  }
});

// ---------------------------------------------------------------------------
// 8. Deterministic report: writeQaReport
// ---------------------------------------------------------------------------
test('qa report: deterministic and byte-identical across repeat runs', async () => {
  const dir1 = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-det-1-'));
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-qa-det-2-'));
  try {
    const sampleChecks = [
      { id: 'size', checkpoint: 'master', status: 'pass', expected: '1920x1920', found: '1920x1920', sampled: 'master.mp4' },
      { id: 'duration', checkpoint: 'master', status: 'pass', expected: 3.0, found: 3.0, sampled: 'master.mp4' },
      { id: 'overlay-present', checkpoint: 'master', status: 'pass', scene: 'scene_one', overlayKind: 'title', sampled: 'tMid=1.5s' },
    ];

    writeQaReport(dir1, { ok: true, checks: sampleChecks });
    writeQaReport(dir2, { ok: true, checks: sampleChecks });

    const report1 = fs.readFileSync(path.join(dir1, 'qa.json'), 'utf8');
    const report2 = fs.readFileSync(path.join(dir2, 'qa.json'), 'utf8');
    assert.equal(report1, report2, 'reports are byte-identical');
  } finally {
    cleanup(dir1);
    cleanup(dir2);
  }
});

// ---------------------------------------------------------------------------
// 9. Pipeline integration: failed_qa blocks delivery and leaves master
// ---------------------------------------------------------------------------
test('pipeline: failed QA sets status failed_qa, exits 12, writes qa.json, leaves master, no delivery', async () => {
  const ws = dummyWorkspace();
  const masterPath = path.join(ws.episodeDir, 'e_1920x1920.mp4');
  try {
    await assert.rejects(
      produce({
        episodePath: ws.scriptPath,
        deps: {
          writeConsole: async () => ({ status: 'unchanged' }),
          synthesizeEpisodeAssets: async () => ({}),
          render: async () => {
            fs.writeFileSync(masterPath, 'master-video-bytes');
            fs.mkdirSync(path.join(ws.episodeDir, 'hyperframes'), { recursive: true });
            fs.writeFileSync(path.join(ws.episodeDir, 'hyperframes', 'manifest.json'), JSON.stringify(createManifest()));
            fs.writeFileSync(path.join(ws.episodeDir, 'hyperframes', 'index.html'), '<div id="root"></div>');
            return { outputVideoPath: masterPath, renderTimeMs: 10, linkMode: 'link' };
          },
          qa: {
            qaMaster: async () => ({
              ok: false,
              checks: [{ id: 'overlay-missing', checkpoint: 'master', status: 'fail', scene: 'one', overlayKind: 'title' }],
            }),
            qaOutputSet: async () => ({ ok: true, checks: [] }),
          },
          log: () => {},
        },
      }),
      (err) => {
        assert.ok(err instanceof ProduceStop);
        assert.equal(err.code, 'qa-failed');
        assert.equal(err.exitCode, EXIT_QA);
        return true;
      },
    );

    // Episode status became failed_qa
    const ep = readEpisode(ws.scriptPath);
    assert.equal(ep.status, 'failed_qa');

    // qa.json was written
    const qaReportPath = path.join(ws.episodeDir, 'qa.json');
    assert.ok(fs.existsSync(qaReportPath), 'qa.json written in episode folder');
    const qaData = JSON.parse(fs.readFileSync(qaReportPath, 'utf8'));
    assert.equal(qaData.ok, false);

    // Master file kept on disk
    assert.ok(fs.existsSync(masterPath), 'master file is kept on disk');

    // Deliveries NOT touched
    const delivDir = path.join(ws.episodeDir, 'deliveries');
    assert.equal(fs.existsSync(delivDir), false, 'no deliveries folder created');
  } finally {
    cleanup(ws.root);
  }
});

// ---------------------------------------------------------------------------
// 10. Pipeline integration: rerun from failed_qa resumes and succeeds
// ---------------------------------------------------------------------------
test('pipeline: rerun from failed_qa proceeds when QA passes', async () => {
  const ws = dummyWorkspace(defaultEpisodeDoc({ status: 'failed_qa' }));
  const masterPath = path.join(ws.episodeDir, 'e_1920x1920.mp4');
  try {
    const result = await produce({
      episodePath: ws.scriptPath,
      deps: {
        writeConsole: async () => ({ status: 'unchanged' }),
        synthesizeEpisodeAssets: async () => ({}),
        thumbnailBase: 'stub.png',
        render: async () => {
          fs.writeFileSync(masterPath, 'master-video-bytes');
          fs.mkdirSync(path.join(ws.episodeDir, 'hyperframes'), { recursive: true });
          fs.writeFileSync(path.join(ws.episodeDir, 'hyperframes', 'manifest.json'), JSON.stringify(createManifest()));
          fs.writeFileSync(path.join(ws.episodeDir, 'hyperframes', 'index.html'), '<div id="root"></div>');
          return { outputVideoPath: masterPath, renderTimeMs: 10, linkMode: 'link' };
        },
        qa: {
          qaMaster: async () => ({
            ok: true,
            checks: [{ id: 'all-passed', checkpoint: 'master', status: 'pass' }],
          }),
          qaOutputSet: async () => ({
            ok: true,
            checks: [{ id: 'outputs-passed', checkpoint: 'output-set', status: 'pass' }],
          }),
        },
        renderThumbnails: async ({ episodeDir, slug }) => [
          { path: path.join(episodeDir, `${slug}_thumbnail_stub.png`) },
        ],
        deliver: async () => ({ created: true, version: 'v1' }),
        log: () => {},
      },
    });

    assert.equal(result.code, EXIT_DONE);
    const ep = readEpisode(ws.scriptPath);
    assert.equal(ep.status, 'delivered');
  } finally {
    cleanup(ws.root);
  }
});

// ---------------------------------------------------------------------------
// 11. CLI does not accept --skip-qa
// ---------------------------------------------------------------------------
test('CLI reject --skip-qa option with exit 1 and usage does not list it', () => {
  const script = path.resolve(HERE, '..', 'scripts', 'produce.mjs');
  const run = spawnSync(process.execPath, [script, '--skip-qa'], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Unknown option --skip-qa/);
  assert.doesNotMatch(run.stderr.split('\n').slice(1).join('\n'), /--skip-qa/, 'the usage never lists --skip-qa');
});
