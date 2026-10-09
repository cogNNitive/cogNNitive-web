#!/usr/bin/env node

/**
 * nn-video-script/test/overlay-events.test.mjs
 *
 * Compiler semantics for markdown-native blockquote overlay events:
 *   - one overlay track per `>` event, scheduled sequentially with no overlap
 *   - configured `enter_animation` / `exit_animation` reach the track
 *   - a referenced video blueprint is resolved and composed
 *   - a missing template/blueprint falls back to defaults and warns, without failing
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { RemotionSceneCompiler } from '../scripts/remotion-scene-compiler.mjs';
import { resolveOverlayAnimation } from '../scripts/scene/overlay-animation.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..', '..', '..', '..', '..', '..');

const sceneScript = (lines) =>
  [
    '//ANYDEO_SPEC: V_0-3-3',
    '# Video',
    '- video_title: Overlay Events',
    '- video_fps: 30',
    ...lines.video || [],
    '',
    '# Scenes',
    '',
    '## Scene 1: Overlay Events',
    '@base Overlay Scene',
    '- scene_duration: 20',
    '',
    ...lines.body || [],
    '',
  ].join('\n');

function compile(text, options = {}) {
  const compiler = new RemotionSceneCompiler({ fps: 30 });
  const manifest = compiler.compile(text, options);
  return { compiler, manifest };
}

describe('markdown-native overlay event scheduling', () => {
  it('emits one overlay track per > event, sequentially and without overlap', () => {
    const { manifest } = compile(
      sceneScript({
        body: [
          'Narration line for the scene.',
          '> quote: "Stay hungry"',
          '> lower-third: "Dr. Alice Smith" [subtitle="Quantum Researcher"]',
          '> broll: media/engine.png [source="NASA"]',
        ],
      }),
    );

    const scene = manifest.tracks.scenes[0];
    const events = manifest.tracks.overlays.filter((o) => o.id.includes('_event_'));
    assert.equal(events.length, 3, 'one overlay track per blockquote event');
    assert.deepEqual(events.map((o) => o.type), ['quote', 'lowerThird', 'broll']);

    // Sequential from the scene start.
    assert.equal(events[0].fromFrame, scene.fromFrame);
    assert.equal(events[1].fromFrame, events[0].fromFrame + events[0].durationInFrames);
    assert.equal(events[2].fromFrame, events[1].fromFrame + events[1].durationInFrames);

    // No temporal collision.
    for (let i = 1; i < events.length; i++) {
      assert.ok(
        events[i].fromFrame >= events[i - 1].fromFrame + events[i - 1].durationInFrames,
        `overlay ${i} must not overlap overlay ${i - 1}`,
      );
      assert.ok(events[i].durationInFrames >= 1);
    }

    // Payloads and options land in the config.
    assert.equal(events[0].config.text, 'Stay hungry');
    assert.equal(events[1].config.title, 'Dr. Alice Smith');
    assert.equal(events[1].config.subtitle, 'Quantum Researcher');
    assert.equal(events[2].config.assetPath, 'media/engine.png');
    assert.equal(events[2].config.source, 'NASA');
  });

  it('rejects directive tokens from the spoken narration', () => {
    const { manifest } = compile(
      sceneScript({
        body: ['Spoken words only.', '> quote: "Not spoken"', 'More spoken words.'],
      }),
    );
    const narration = manifest.tracks.scenes[0].props.narration;
    assert.equal(narration, 'Spoken words only. More spoken words.');
    assert.ok(!narration.includes('>'));
    assert.ok(!narration.includes('Not spoken'));
  });

  it('carries configured enter_animation and exit_animation on the overlay track', () => {
    const { manifest } = compile(
      sceneScript({
        body: [
          'Narration.',
          '> lower-third: "Guest" [enter_animation=slide-in-left] [exit_animation=slide-out-left]',
        ],
      }),
    );
    const event = manifest.tracks.overlays.find((o) => o.id.includes('_event_'));
    assert.equal(event.enterAnimation, 'slide-in-left');
    assert.equal(event.exitAnimation, 'slide-out-left');
  });
});

describe('overlay enter/exit motion', () => {
  it('fades an overlay in from the first frame and out at the end', () => {
    const enter = resolveOverlayAnimation({
      frame: 0,
      durationInFrames: 60,
      enterAnimation: 'fade-in',
      exitAnimation: 'fade-out',
    });
    const settled = resolveOverlayAnimation({
      frame: 30,
      durationInFrames: 60,
      enterAnimation: 'fade-in',
      exitAnimation: 'fade-out',
    });
    const leaving = resolveOverlayAnimation({
      frame: 59,
      durationInFrames: 60,
      enterAnimation: 'fade-in',
      exitAnimation: 'fade-out',
    });
    assert.ok(enter.opacity < 1, 'enter frame is not fully opaque');
    assert.equal(settled.opacity, 1, 'middle frame is fully opaque');
    assert.ok(leaving.opacity < 1, 'exit frame is not fully opaque');
  });

  it('offsets a slide-in overlay and zooms a zoom-in overlay', () => {
    const slide = resolveOverlayAnimation({
      frame: 0,
      durationInFrames: 60,
      enterAnimation: 'slide-in-left',
      exitAnimation: 'fade-out',
    });
    assert.match(slide.transform, /translate\(-/, 'slide-in-left starts off-screen to the left');
    const zoom = resolveOverlayAnimation({
      frame: 0,
      durationInFrames: 60,
      enterAnimation: 'zoom-in',
      exitAnimation: 'fade-out',
    });
    assert.match(zoom.transform, /scale\(0\.85/, 'zoom-in starts scaled down');
  });
});

describe('video blueprint resolution', () => {
  it('resolves an external blueprint and composes its broll template', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-video-blueprint-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'series_blueprint.md'),
        ['@broll_template', '- duration: 7', '- fit: contain', '- enter_animation: zoom-in', '- exit_animation: zoom-out', ''].join('\n'),
      );
      const text = sceneScript({
        video: ['- video_blueprint: series_blueprint.md'],
        body: ['Narration.', '> broll: media/city.png'],
      });
      const { manifest } = compile(text, { scriptSource: path.join(dir, 'script.md') });
      const event = manifest.tracks.overlays.find((o) => o.id.includes('_event_'));
      assert.equal(event.type, 'broll');
      assert.equal(event.durationInFrames, 7 * 30);
      assert.equal(event.enterAnimation, 'zoom-in');
      assert.equal(event.exitAnimation, 'zoom-out');
      assert.equal(event.config.fit, 'contain');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back to sensible defaults and warns when the blueprint is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-video-blueprint-missing-'));
    try {
      const text = sceneScript({
        video: ['- video_blueprint: does-not-exist.md'],
        body: ['Narration.', '> broll: media/city.png'],
      });
      const { compiler, manifest } = compile(text, { scriptSource: path.join(dir, 'script.md') });
      const event = manifest.tracks.overlays.find((o) => o.id.includes('_event_'));
      assert.ok(event, 'overlay still emitted with defaults');
      assert.ok(event.durationInFrames >= 1);
      assert.ok(
        compiler.warnings.some((w) => /blueprint/i.test(w)),
        `expected a blueprint warning, got ${JSON.stringify(compiler.warnings)}`,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('falls back when a referenced blueprint exists but declares no such template', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-video-blueprint-empty-'));
    try {
      fs.writeFileSync(path.join(dir, 'series_blueprint.md'), '# no templates here\n');
      const text = sceneScript({
        video: ['- video_blueprint: series_blueprint.md'],
        body: ['Narration.', '> broll: media/city.png'],
      });
      const { manifest } = compile(text, { scriptSource: path.join(dir, 'script.md') });
      const event = manifest.tracks.overlays.find((o) => o.id.includes('_event_'));
      assert.equal(event.type, 'broll');
      assert.ok(event.durationInFrames >= 1, 'system default duration applied');
      assert.equal(event.config.fit, 'cover');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads the domain spec_NN.md as the default template tier', () => {
    const compiler = new RemotionSceneCompiler();
    const templates = compiler.resolveBlueprintTemplates(path.join(os.tmpdir(), 'no-such-script.md'));
    assert.ok(templates.broll_template, 'domain @broll_template is loaded as the default tier');
    assert.equal(templates.broll_template.fit, 'cover');
    assert.ok(templates.template, 'domain @template is loaded as the default tier');
  });

  it('lets a series override win over the domain default', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-video-blueprint-domain-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'series_blueprint.md'),
        ['@broll_template', '- duration: 9', ''].join('\n'),
      );
      const compiler = new RemotionSceneCompiler();
      const templates = compiler.resolveBlueprintTemplates(path.join(dir, 'script.md'));
      assert.equal(templates.broll_template.duration, '9', 'series override wins over the domain default');
      assert.equal(templates.broll_template.fit, 'cover', 'unspecified fields still fall back to the domain default');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('caption template resolution', () => {
  it('sources caption styling and animation from the blueprint @caption_template', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-video-caption-template-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'blueprint.md'),
        [
          '@caption_template',
          '- caption_style: karaoke',
          '- caption_size: 64',
          '- caption_highlight: "#abcdef"',
          '- font_family: Fira Code',
          '- enter_animation: zoom-in',
          '- exit_animation: zoom-out',
          '',
        ].join('\n'),
      );
      const text = sceneScript({
        video: ['- video_blueprint: blueprint.md', '- video_caption_style: tiktok'],
        body: ['Narration words here.'],
      });
      const { manifest } = compile(text, { scriptSource: path.join(dir, 'script.md') });
      const captions = manifest.tracks.overlays.find((o) => o.type === 'captions');
      assert.ok(captions, 'a captions overlay is emitted');
      assert.equal(captions.config.style, 'tiktok', 'explicit script style wins over the blueprint default');
      assert.equal(captions.config.size, 64, 'size sourced from @caption_template');
      assert.equal(captions.config.highlight, '#abcdef');
      assert.equal(captions.config.fontFamily, 'Fira Code');
      assert.equal(captions.enterAnimation, 'zoom-in');
      assert.equal(captions.exitAnimation, 'zoom-out');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lets explicit script caption props win over the blueprint @caption_template', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nn-video-caption-override-'));
    try {
      fs.writeFileSync(
        path.join(dir, 'blueprint.md'),
        ['@caption_template', '- caption_size: 64', '- caption_highlight: "#abcdef"', ''].join('\n'),
      );
      const text = sceneScript({
        video: ['- video_blueprint: blueprint.md', '- video_caption_style: tiktok', '- video_caption_size: 100'],
        body: ['Narration words here.'],
      });
      const { manifest } = compile(text, { scriptSource: path.join(dir, 'script.md') });
      const captions = manifest.tracks.overlays.find((o) => o.type === 'captions');
      assert.equal(captions.config.size, 100, 'script caption_size wins over the blueprint default');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('legacy inline overlay quarantine', () => {
  it('still recognizes legacy <!-- overlay: --> directives and warns once per compile', () => {
    const text = sceneScript({
      body: [
        'Narration.',
        '<!-- overlay: lowerThird { "title": "Old A" } -->',
        '<!-- overlay: lowerThird { "title": "Old B" } -->',
      ],
    });
    const compiler = new RemotionSceneCompiler({ fps: 30 });
    const manifest = compiler.compile(text);
    const legacyOverlays = manifest.tracks.overlays.filter((o) => o.type === 'lowerThird');
    assert.equal(legacyOverlays.length, 2, 'legacy overlays are still recognized');
    const deprecations = compiler.warnings.filter((w) => /deprecated|legacy/i.test(w));
    assert.equal(deprecations.length, 1, 'exactly one deprecation warning per compile');
  });

  it('is quarantined with a legacy marker and exactly one matching ledger entry', () => {
    const compilerSrc = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'remotion-scene-compiler.mjs'),
      'utf8',
    );
    // Built from parts so this test file is not itself a ledger marker (the guard
    // scans every tracked file except its own suite).
    const marker = `legacy:${'video-overlay'}/html-comment-overlays`;
    assert.ok(compilerSrc.includes(marker), 'legacy path must carry the quarantine marker');

    const { parseFocusedYaml } = require(path.join(REPO_ROOT, 'scripts', 'lib', 'yaml-parser.js'));
    const doc = parseFocusedYaml(fs.readFileSync(path.join(REPO_ROOT, 'legacy-ledger.yaml'), 'utf8'));
    const matches = (doc.entries || []).filter((e) => e.id === 'html-comment-overlays');
    assert.equal(matches.length, 1, 'exactly one html-comment-overlays ledger entry');
    assert.ok(
      matches[0].paths.includes(
        'iNNfo/specs/bluepriNNts/video/skills/nn-video-script/scripts/remotion-scene-compiler.mjs',
      ),
      'ledger entry must cover the quarantined compiler path',
    );
  });
});
