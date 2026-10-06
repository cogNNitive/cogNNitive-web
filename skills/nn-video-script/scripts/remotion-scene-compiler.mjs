#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/remotion-scene-compiler.mjs
 *
 * Transforms parsed VUS / Markdown video scripts into typed Remotion Composition Manifests.
 * Computes frame-accurate timings, sequence tracks, audio bindings, transitions, and
 * visual overlay tracks (lowerThird, kineticTitle, conceptCallout).
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse as parseVus } from './lib/innfo-video-parser.generated.mjs';

/**
 * @typedef {Object} StyleTokens Resolved style tokens: style.json < video frontmatter < scene props.
 * @property {string} [fontFamily]
 * @property {string} [captionStyle] "none" | "tiktok" | "karaoke"
 * @property {number} [captionSize]
 * @property {string} [captionHighlight]
 * @property {string} [transition] Default scene transition.
 */

/**
 * @typedef {Object} CaptionsProps
 * @property {string} [style] "tiktok" | "karaoke" | "none"
 * @property {number} [size]
 * @property {string} [highlight]
 * @property {string} [fontFamily]
 */

/**
 * @typedef {Object} LowerThirdProps
 * @property {string} title
 * @property {string} [subtitle]
 * @property {string} [speakerTag]
 * @property {string} [accentColor]
 * @property {string} [fontFamily]
 * @property {number} [fontSize]
 * @property {string} [textStroke]
 * @property {"bottom-left" | "bottom-right" | "bottom-center"} [position]
 */

/**
 * @typedef {Object} KineticTitleProps
 * @property {string} heading
 * @property {string} [subheading]
 * @property {"dark" | "light" | "accent"} [theme]
 * @property {string} [fontFamily]
 * @property {number} [fontSize]
 * @property {number} [fontWeight]
 * @property {string} [textStroke]
 * @property {"pop" | "typewriter" | "spring-up"} [animationStyle]
 * @property {number} [headingSize] Heading px size (default 88). Setting it enables "big" mode (shadow + wrapping cap).
 * @property {number} [subheadingSize] Subheading px size (default 40).
 * @property {"top" | "center" | "bottom"} [anchor] Vertical placement (default center).
 */

/**
 * @typedef {Object} ConceptCalloutProps
 * @property {string} label
 * @property {string} description
 * @property {string} [icon]
 * @property {string} [highlightColor]
 * @property {string} [fontFamily]
 * @property {number} [fontSize]
 */

/**
 * @typedef {Object} VisualOverlayConfig
 * @property {string} id
 * @property {"lowerThird" | "kineticTitle" | "conceptCallout" | "captions"} type
 * @property {number} fromFrame
 * @property {number} durationInFrames
 * @property {LowerThirdProps | KineticTitleProps | ConceptCalloutProps} config
 */

/**
 * @typedef {Object} RemotionLayerProps A layer entry inside `RemotionSceneTrack.props.layers`.
 * @property {string} layer_type "image" | "video" | "talking_avatar" | "text" | ...
 * @property {string} layer_asset_source Bundle-relative media name after staging.
 * @property {number} [layer_level] Paint order (lower first).
 * @property {boolean | "true" | "false"} [layer_muted] Video layers only: mute the clip's own audio. Set to true by compile
 *   for cached avatar clips (narration is a separate Audio track); undefined for every other layer.
 */

/**
 * @typedef {Object} RemotionSceneTrack
 * @property {string} id
 * @property {"chapter_title" | "image_motion" | "kinetic_text" | "concept_diagram" | "split_screen"} sceneType
 * @property {number} fromFrame
 * @property {number} durationInFrames
 * @property {Record<string, unknown>} props
 * @property {{ type: "fade" | "slide-left" | "slide-right" | "wipe" | "none", durationInFrames: number }} [transition]
 */

/**
 * @typedef {Object} AudioTrackBinding
 * @property {string} id
 * @property {string} sceneId
 * @property {string} assetPath
 * @property {number} fromFrame
 * @property {number} durationInFrames
 * @property {number} volume
 * @property {string} sha256
 * @property {"music"} [kind] Set on per-scene background music tracks only.
 * @property {boolean} [loop] Music tracks: loop the file for the scene's duration.
 */

/**
 * @typedef {Object} RemotionCompositionManifest
 * @property {"1.0.0"} version
 * @property {string} compositionId
 * @property {number} fps
 * @property {number} width
 * @property {number} height
 * @property {number} totalDurationInFrames
 * @property {number} totalDurationInSeconds
 * @property {{ scenes: RemotionSceneTrack[], audio: AudioTrackBinding[], overlays: VisualOverlayConfig[] }} tracks
 * @property {{ generator: string, generatedAt: string, scriptSource: string }} metadata
 */

/** Background music volume when a scene declares music but no `scene_background_audio_volume`. */
export const DEFAULT_BG_MUSIC_VOLUME = 0.2;

/** Drops keys whose value is undefined/null/empty-string so optional config never leaks defaults. */
function optionalKeys(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}

/**
 * Splits raw scene prose into spoken narration and overlay hints.
 *  - every `<!-- ... -->` comment (single or multi-line, anywhere) is removed from the narration;
 *  - a comment of the form `overlay: <type> { json }` is returned as an overlay (malformed JSON is dropped);
 *  - the remaining prose is one space-joined line, like the line scanner always produced (so the TTS
 *    cache key does not depend on how the paragraph was wrapped).
 * \param {string} content
 * \returns {{ narration: string, overlays: { type: string, data: Record<string, unknown> }[] }}
 */
export function extractNarrationAndOverlays(content) {
  const overlays = [];
  const stripped = String(content).replace(/<!--([\s\S]*?)-->/g, (_all, inner) => {
    const m = /^\s*overlay:\s*([A-Za-z0-9_-]+)\s*(\{[\S\s]*\})\s*$/.exec(inner);
    if (m) {
      try {
        overlays.push({ type: m[1], data: JSON.parse(m[2]) });
      } catch {
        // malformed hint: dropped, never spoken
      }
    }
    return ' ';
  });
  const narration = stripped
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
  return { narration, overlays };
}

export class RemotionSceneCompiler {
  /**
   * @param {Object} [options]
   * @param {number} [options.fps=30]
   * @param {number} [options.width=1920]
   * @param {number} [options.height=1080]
   * @param {number} [options.wordsPerSecond=2.5]
   * @param {number} [options.defaultSceneDuration=5]
   */
  constructor(options = {}) {
    this.fps = options.fps || 30;
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.wordsPerSecond = options.wordsPerSecond || 2.5;
    this.defaultSceneDuration = options.defaultSceneDuration || 5;
  }

  /**
   * Creates a lowerThird overlay descriptor
   * @param {Object} params
   * @param {string} params.id
   * @param {number} params.fromFrame
   * @param {number} params.durationInFrames
   * @param {LowerThirdProps} params.props
   * @returns {VisualOverlayConfig}
   */
  createLowerThirdOverlay({ id, fromFrame, durationInFrames, props }) {
    return {
      id,
      type: 'lowerThird',
      fromFrame,
      durationInFrames,
      config: {
        title: props.title || props.layer_title || props.layer_text_content || props.heading || '',
        subtitle: props.subtitle || props.layer_subtitle || '',
        speakerTag: props.speakerTag || props.speaker_tag || props.layer_speaker_tag || '',
        accentColor: props.accentColor || props.accent_color || props.layer_accent_color || '#3b82f6',
        fontFamily: props.fontFamily || props.font_family || props.layer_text_font || undefined,
        fontSize: props.fontSize ?? props.font_size ?? props.layer_text_size ?? undefined,
        textStroke: props.textStroke || props.text_stroke || undefined,
        position: props.position || props.layer_position || 'bottom-left',
      },
    };
  }

  /**
   * Creates a kineticTitle overlay descriptor
   * @param {Object} params
   * @param {string} params.id
   * @param {number} params.fromFrame
   * @param {number} params.durationInFrames
   * @param {KineticTitleProps} params.props
   * @returns {VisualOverlayConfig}
   */
  createKineticTitleOverlay({ id, fromFrame, durationInFrames, props }) {
    return {
      id,
      type: 'kineticTitle',
      fromFrame,
      durationInFrames,
      config: {
        heading: props.heading || props.layer_heading || props.title || props.layer_title || props.layer_text_content || '',
        subheading: props.subheading || props.layer_subheading || props.subtitle || props.layer_subtitle || '',
        theme: props.theme || props.layer_theme || 'dark',
        fontFamily: props.fontFamily || props.font_family || props.layer_text_font || undefined,
        fontSize: props.fontSize ?? props.font_size ?? props.layer_text_size ?? undefined,
        fontWeight: props.fontWeight ?? props.font_weight ?? undefined,
        textStroke: props.textStroke || props.text_stroke || undefined,
        animationStyle: props.animationStyle || props.animation_style || props.layer_animation_style || 'spring-up',
        // Optional big-text controls: only present when set, so existing manifests stay byte-identical.
        ...optionalKeys({
          headingSize: props.headingSize ?? props.heading_size ?? props.layer_heading_size,
          subheadingSize: props.subheadingSize ?? props.subheading_size ?? props.layer_subheading_size,
          anchor: props.anchor ?? props.layer_anchor,
        }),
      },
    };
  }

  /**
   * Creates a conceptCallout overlay descriptor
   * @param {Object} params
   * @param {string} params.id
   * @param {number} params.fromFrame
   * @param {number} params.durationInFrames
   * @param {ConceptCalloutProps} params.props
   * @returns {VisualOverlayConfig}
   */
  createConceptCalloutOverlay({ id, fromFrame, durationInFrames, props }) {
    return {
      id,
      type: 'conceptCallout',
      fromFrame,
      durationInFrames,
      config: {
        label: props.label || props.layer_label || props.title || props.layer_title || props.layer_text_content || '',
        description: props.description || props.layer_description || '',
        icon: props.icon || props.layer_icon || 'info',
        highlightColor: props.highlightColor || props.highlight_color || props.layer_highlight_color || '#eab308',
        fontFamily: props.fontFamily || props.font_family || props.layer_text_font || undefined,
        fontSize: props.fontSize ?? props.font_size ?? props.layer_text_size ?? undefined,
      },
    };
  }

  /**
   * Creates a word-level captions overlay descriptor (TikTok-style).
   * The renderer highlights the active token; narration text is the source.
   */
  createCaptionsOverlay({ id, fromFrame, durationInFrames, props, narration }) {
    return {
      id,
      type: 'captions',
      fromFrame,
      durationInFrames,
      config: {
        text: props.text || narration || '',
        style: props.style || props.caption_style || 'tiktok',
        size: props.size ?? props.caption_size ?? 80,
        highlight: props.highlight || props.caption_highlight || '#39E508',
        fontFamily: props.fontFamily || props.font_family || undefined,
      },
    };
  }

  /**
   * Parses markdown/VUS text into intermediate scene and layer structures.
   * @param {string} scriptText
   * @returns {Object}
   */
  parseScript(scriptText) {
    try {
      const origLog = console.log;
      let parseResult;
      try {
        console.log = () => {};
        parseResult = parseVus(scriptText);
      } finally {
        console.log = origLog;
      }

      const proj = parseResult?.project;
      const sections = proj?.sections || [];
      const allScenes = [];
      for (const sec of sections) {
        for (const sc of (sec.scenes || [])) {
          allScenes.push({ sec, sc });
        }
      }

      if (allScenes.length > 0) {
        const cfg = proj.config || {};
        const result = {
          title: cfg.video_title || cfg.video_name || 'video',
          fps: Number(cfg.video_fps) || this.fps,
          width: Number(cfg.video_width) || this.width,
          height: Number(cfg.video_height) || this.height,
          // First-class style tokens (A): carried through for compile-time resolution.
          // Precedence: options.style < video props < scene props.
          videoProps: {
            video_aspect: cfg.video_aspect,
            video_font: cfg.video_font || cfg.video_font_family,
            video_caption_style: cfg.video_caption_style || cfg.caption_style,
            video_caption_size: cfg.video_caption_size !== undefined ? Number(cfg.video_caption_size) : undefined,
            video_caption_highlight: cfg.video_caption_highlight || cfg.caption_highlight,
            video_transition: cfg.video_transition,
            video_transition_easing: cfg.video_transition_easing,
          },
          scenes: [],
        };

        for (let i = 0; i < allScenes.length; i++) {
          const { sec, sc } = allScenes[i];
          const secHeading = (sec.title || sec.name || '').trim();
          const hasSceneSection = secHeading && /^(scene\b|@scene\b)/i.test(secHeading);
          const rawName = hasSceneSection ? secHeading : (sc.scene_name || `Scene ${i + 1}`);
          const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
          const sceneId = `scene_${i + 1}_${slug}`;

          const props = {
            ...(sc.inheritedProperties || {}),
            ...(sc.properties || {}),
            ...(sc.finalProperties || {}),
          };

          const sceneLayers = [];
          const rawLayers = sc.layers || [];

          for (let lIdx = 0; lIdx < rawLayers.length; lIdx++) {
            const layer = rawLayers[lIdx];
            const layerName = layer.layer_name || `Layer ${lIdx + 1}`;
            const layerId = `${sceneId}_layer_${lIdx + 1}`;
            const layerProps = {
              layer_type: layer.layer_type,
              layer_asset_source: layer.layer_asset_source,
              layer_level: layer.layer_level,
              ...(layer.properties || {}),
              ...(layer.finalProperties || {}),
            };

            sceneLayers.push({
              id: layerId,
              name: layerName,
              properties: layerProps,
              effects: layer.effects || [],
            });
          }

          // The vendored parser hands back the raw scene prose, HTML comments included. Overlay
          // hints (<!-- overlay: type { json } -->) become overlay layers, and NO comment may ever be
          // spoken: the narration is what goes to the paid TTS and into its cache key.
          const { narration, overlays } = extractNarrationAndOverlays(sc.scene_content || '');
          for (const ov of overlays) {
            sceneLayers.push({
              id: `${sceneId}_overlay_${sceneLayers.length + 1}`,
              name: ov.type,
              properties: { layer_type: ov.type, ...ov.data },
              effects: [],
            });
          }

          result.scenes.push({
            id: sceneId,
            name: rawName,
            template: (sc.scene_templates && sc.scene_templates[0]) || null,
            properties: props,
            narration,
            layers: sceneLayers,
          });
        }

        return result;
      }
    } catch {
      // Fall back to line scanner below
    }

    const lines = scriptText.split(/\r?\n/);
    const result = {
      title: 'video',
      fps: this.fps,
      width: this.width,
      height: this.height,
      videoProps: {},
      scenes: [],
    };

    let currentScene = null;
    let currentLayer = null;
    let inScenesBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      // Video title / settings
      if (line.startsWith('# Video') || line.startsWith('# video')) {
        inScenesBlock = false;
        continue;
      }
      if (line.startsWith('- video_title:')) {
        result.title = line.replace(/^- video_title:\s*/, '').replace(/<!--.*-->$/, '').trim();
        continue;
      }
      if (line.startsWith('- video_fps:')) {
        const val = parseInt(line.replace(/^- video_fps:\s*/, ''), 10);
        if (!isNaN(val)) result.fps = val;
        continue;
      }
      // First-class video style tokens (A): aspect / font / caption defaults / transition.
      // Kept flat in videoProps so compile() can resolve style.json < video < scene.
      if (/^- video_(aspect|font|font_family|caption_style|caption_size|caption_highlight|transition|transition_easing):/.test(line)) {
        const m = line.match(/^- (video_[a-z_]+):\s*(.*)$/);
        if (m) {
          const v = m[2].replace(/<!--.*-->$/, '').trim().replace(/^"|"$/g, '');
          result.videoProps[m[1]] = /^\d+$/.test(v) ? Number(v) : v;
        }
        continue;
      }

      if (line.startsWith('# Scenes') || line.startsWith('# scenes') || line.startsWith('# Section') || line.startsWith('# section')) {
        inScenesBlock = true;
        continue;
      }

      if (line.startsWith('# Video') || line.startsWith('# video') || line.startsWith('# Sets') || line.startsWith('# sets') || line.startsWith('# Sources') || line.startsWith('# sources') || line.startsWith('## Set') || line.startsWith('## set')) {
        inScenesBlock = false;
        continue;
      }

      // Scene header: ## Scene Name, ## Scene 1: Name, or ## @scene Name
      if (line.startsWith('## @scene') || line.startsWith('## Scene') || line.startsWith('## scene') || (line.startsWith('## ') && inScenesBlock)) {
        inScenesBlock = true;
        currentLayer = null;
        const rawName = line.replace(/^##\s*(@scene\s*)?/, '').trim();
        const sceneId = `scene_${result.scenes.length + 1}_${rawName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
        currentScene = {
          id: sceneId,
          name: rawName,
          template: null,
          properties: {},
          narration: '',
          layers: [],
        };
        result.scenes.push(currentScene);
        continue;
      }

      if (!currentScene) {
        continue;
      }

      // Template call: @base Scene Title
      if (line.startsWith('@') && !line.startsWith('@@')) {
        currentScene.template = line.substring(1).trim();
        continue;
      }

      // Layer header: @@ Layer Name or * Layer: Name
      if (line.startsWith('@@') || line.startsWith('* Layer:') || line.startsWith('* Layer')) {
        const layerName = line.replace(/^(@@|\*\s*Layer:?)\s*/i, '').trim();
        const layerId = `${currentScene.id}_layer_${currentScene.layers.length + 1}`;
        currentLayer = {
          id: layerId,
          name: layerName,
          properties: {},
          effects: [],
        };
        currentScene.layers.push(currentLayer);
        continue;
      }

      // Markdown image asset: ![alt](path)
      const mdImgMatch = line.match(/^!\[(.*?)\]\((.*?)\)/);
      if (mdImgMatch) {
        if (!currentLayer) {
          currentLayer = {
            id: `${currentScene.id}_layer_${currentScene.layers.length + 1}`,
            name: mdImgMatch[1] || 'Asset',
            properties: {
              layer_type: 'image',
              layer_asset_source: mdImgMatch[2],
            },
            effects: [],
          };
          currentScene.layers.push(currentLayer);
        } else {
          currentLayer.properties.layer_asset_source = mdImgMatch[2];
        }
        continue;
      }

      // Bracket property: [key=value] or [key="value"]
      const bracketMatch = line.match(/^\[([a-zA-Z0-9_-]+)\s*=\s*(.*)\]$/);
      if (bracketMatch) {
        const key = bracketMatch[1].trim();
        let rawVal = bracketMatch[2].trim();
        let parsedVal = rawVal;
        if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
          parsedVal = rawVal.slice(1, -1);
        } else if (!isNaN(Number(rawVal)) && rawVal !== '') {
          parsedVal = Number(rawVal);
        }

        if (currentLayer) {
          currentLayer.properties[key] = parsedVal;
        } else {
          currentScene.properties[key] = parsedVal;
        }
        continue;
      }

      // Properties: - key: value
      if (line.startsWith('- ')) {
        const propMatch = line.match(/^- ([a-zA-Z0-9_-]+):\s*(.*)$/);
        if (propMatch) {
          const key = propMatch[1].trim();
          let rawVal = propMatch[2].replace(/<!--.*-->$/, '').trim();
          let parsedVal = rawVal;
          if (rawVal.startsWith('"') && rawVal.endsWith('"')) {
            parsedVal = rawVal.slice(1, -1);
          } else if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
            try {
              parsedVal = JSON.parse(rawVal);
            } catch {
              parsedVal = rawVal.slice(1, -1).split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
            }
          } else if (!isNaN(Number(rawVal)) && rawVal !== '') {
            parsedVal = Number(rawVal);
          }

          if (currentLayer) {
            currentLayer.properties[key] = parsedVal;
          } else {
            currentScene.properties[key] = parsedVal;
          }
          continue;
        }
      }

      // Comments / Overlay hints: <!-- overlay: type { json } -->
      const overlayMatch = line.match(/<!--\s*overlay:\s*([a-zA-Z0-9_-]+)\s*(\{.*\})\s*-->/);
      if (overlayMatch) {
        try {
          const overlayType = overlayMatch[1];
          const overlayData = JSON.parse(overlayMatch[2]);
          currentScene.layers.push({
            id: `${currentScene.id}_overlay_${currentScene.layers.length + 1}`,
            name: overlayType,
            properties: {
              layer_type: overlayType,
              ...overlayData,
            },
            effects: [],
          });
          continue;
        } catch {
          // ignore malformed comment
        }
      }

      // Narration prose (regular text lines not matching headers, tags or properties)
      if (!line.startsWith('*') && !line.startsWith('@@') && !line.startsWith('[') && !line.startsWith('-') && !line.startsWith('@') && !line.startsWith('!') && !line.startsWith('#') && !line.startsWith('<!--')) {
        const cleanProse = line.replace(/<!--.*?-->/g, '').trim();
        if (cleanProse) {
          currentScene.narration = currentScene.narration
            ? `${currentScene.narration} ${cleanProse}`
            : cleanProse;
        }
      }
    }

    return result;
  }

  /**
   * Compiles parsed script data or raw markdown into a RemotionCompositionManifest.
   * @param {string | Object} scriptInput
   * @param {Object} [options]
   * @param {Record<string, number>} [options.audioDurations] Map of sceneId -> duration in seconds
   * @param {Record<string, { assetPath: string, sha256?: string, durationSeconds?: number }>} [options.audioAssets]
   * @param {string} [options.scriptSource="script.md"]
   * @returns {RemotionCompositionManifest}
   */
  compile(scriptInput, options = {}) {
    let parsed;
    let scriptSource = options.scriptSource || 'script.md';

    if (typeof scriptInput === 'string') {
      parsed = this.parseScript(scriptInput);
    } else if (typeof scriptInput === 'object' && scriptInput !== null) {
      if (scriptInput.scenes && Array.isArray(scriptInput.scenes)) {
        parsed = scriptInput;
      } else {
        throw new Error('Invalid script input object: must contain a "scenes" array');
      }
    } else {
      throw new Error('Invalid script input: expected string or parsed object');
    }

    const fps = options.fps || parsed.fps || this.fps;
    const width = options.width || parsed.width || this.width;
    const height = options.height || parsed.height || this.height;
    const audioDurations = options.audioDurations || {};
    const audioAssets = options.audioAssets || {};
    // Style precedence: style.json (options.style) < video props < scene props (applied per scene below).
    const videoStyle = { ...(options.style || {}), ...(parsed.videoProps || {}) };

    const compositionId = (parsed.title || 'composition')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const sceneTracks = [];
    const audioTracks = [];
    const overlayTracks = [];

    let currentFrame = 0;

    for (let i = 0; i < parsed.scenes.length; i++) {
      const sc = parsed.scenes[i];
      const sceneId = sc.id || `scene_${i + 1}`;

      // 1. Determine Scene Duration
      let durationInSeconds = this.defaultSceneDuration;

      if (audioDurations[sceneId] !== undefined) {
        durationInSeconds = audioDurations[sceneId];
      } else if (sc.properties?.scene_duration !== undefined) {
        durationInSeconds = Number(sc.properties.scene_duration);
      } else if (audioAssets[sceneId]?.durationSeconds !== undefined) {
        durationInSeconds = audioAssets[sceneId].durationSeconds;
      } else if (sc.narration && sc.narration.trim().length > 0) {
        const words = sc.narration.trim().split(/\s+/).length;
        durationInSeconds = Math.max(3, words / this.wordsPerSecond);
      }

      // Exact frame count math
      const durationInFrames = Math.max(1, Math.ceil(durationInSeconds * fps));
      const fromFrame = currentFrame;

      // 2. Classify Scene Type
      let sceneType = 'image_motion';
      const declaredType = sc.properties?.scene_type || sc.properties?.sceneType;
      const validTypes = ['chapter_title', 'image_motion', 'kinetic_text', 'concept_diagram', 'split_screen'];

      if (declaredType && validTypes.includes(declaredType)) {
        sceneType = declaredType;
      } else if (sc.name && /intro|hook|title|welcome/i.test(sc.name) && sc.layers.some((l) => l.properties?.layer_type === 'text' && (l.properties?.layer_level || 0) >= 50)) {
        sceneType = 'chapter_title';
      } else if (sc.layers.some((l) => l.properties?.layer_type === 'diagram' || l.properties?.layer_type === 'concept_diagram')) {
        sceneType = 'concept_diagram';
      } else if (sc.layers.some((l) => l.properties?.layer_type === 'split_screen')) {
        sceneType = 'split_screen';
      } else if (sc.layers.some((l) => l.properties?.layer_type === 'kinetic_text')) {
        sceneType = 'kinetic_text';
      }

      // 3. Transition Configuration (A: default from video/style + easing passthrough)
      let transition = undefined;
      const transIn = sc.properties?.transition_in;
      const transOut = sc.properties?.transition_out;
      const rawTransition = sc.properties?.scene_transition || sc.properties?.transition
        || videoStyle.video_transition;
      if (transIn || transOut || rawTransition) {
        const transType = transIn || transOut || (typeof rawTransition === 'string' ? rawTransition : rawTransition.type || 'fade');
        const transDuration = typeof rawTransition === 'object' && rawTransition.durationInFrames
          ? rawTransition.durationInFrames
          : sc.properties?.scene_transition_duration !== undefined
            ? Number(sc.properties.scene_transition_duration)
            : Math.round(fps * 0.5);
        const easing = (typeof rawTransition === 'object' && rawTransition.easing)
          || sc.properties?.scene_transition_easing
          || videoStyle.video_transition_easing
          || 'bezier(0.16,1,0.3,1)';
        transition = {
          type: transType,
          durationInFrames: transDuration,
          easing,
          ...(transIn ? { in: transIn } : {}),
          ...(transOut ? { out: transOut } : {}),
        };
      }

      // Collect scene props (style tokens resolved here so the renderer stays presentational)
      const sceneProps = {
        title: sc.name || `Scene ${i + 1}`,
        narration: sc.narration || '',
        ...sc.properties,
        fontFamily: sc.properties?.font_family || sc.properties?.fontFamily
          || videoStyle.video_font || videoStyle.fontFamily,
        captionStyle: sc.properties?.caption_style || sc.properties?.captionStyle
          || videoStyle.video_caption_style || videoStyle.captionStyle || 'none',
        layers: sc.layers.map((l) => ({
          name: l.name,
          ...l.properties,
          effects: l.effects || [],
        })),
      };

      sceneTracks.push({
        id: sceneId,
        sceneType,
        fromFrame,
        durationInFrames,
        props: sceneProps,
        ...(transition ? { transition } : {}),
      });

      // 4. Audio Track Binding
      const boundAudio = audioAssets[sceneId];
      if (boundAudio || sc.properties?.audio_asset_source || sc.properties?.voiceover) {
        const assetPath = boundAudio?.assetPath || sc.properties?.audio_asset_source || sc.properties?.voiceover || `audio/${sceneId}.mp3`;
        const sha256 = boundAudio?.sha256 || crypto.createHash('sha256').update(sc.narration || sceneId).digest('hex');
        audioTracks.push({
          id: `audio_${sceneId}`,
          sceneId,
          assetPath,
          fromFrame,
          durationInFrames,
          volume: sc.properties?.audio_volume !== undefined ? Number(sc.properties.audio_volume) : 1.0,
          sha256,
        });
      }

      // 4b. Background music (per-scene `scene_background_audio`): plays for ITS scene only,
      // looping if the file is shorter. Volume: explicit `scene_background_audio_volume` wins
      // (0 included), otherwise DEFAULT_BG_MUSIC_VOLUME (the parser spec's default).
      const bgMusic = sc.properties?.scene_background_audio;
      if (bgMusic && typeof bgMusic === 'string') {
        if (path.isAbsolute(bgMusic) || /^[A-Za-z]:[\\/]/.test(bgMusic) || /^[a-z]+:\/\//i.test(bgMusic)) {
          throw new Error(`Invalid background audio "${bgMusic}" in scene "${sceneId}": use a path relative to the script, inside the series tree.`);
        }
        const rawVolume = sc.properties?.scene_background_audio_volume;
        const bgVolume = rawVolume !== undefined && Number.isFinite(Number(rawVolume)) ? Number(rawVolume) : DEFAULT_BG_MUSIC_VOLUME;
        audioTracks.push({
          id: `bgmusic_${sceneId}`,
          sceneId,
          kind: 'music',
          assetPath: bgMusic,
          fromFrame,
          durationInFrames,
          volume: bgVolume,
          loop: true,
          sha256: crypto.createHash('sha256').update(`bgmusic:${bgMusic}`).digest('hex'),
        });
      }

      // 5. Visual Overlays
      for (let j = 0; j < sc.layers.length; j++) {
        const layer = sc.layers[j];
        const lType = (layer.properties?.layer_type || layer.properties?.type || '').toLowerCase();
        const layerName = (layer.name || '').toLowerCase();
        const layerProps = layer.properties || {};

        const overlayStartOffset = layerProps.from_frame_offset !== undefined
          ? Number(layerProps.from_frame_offset)
          : layerProps.from_seconds_offset !== undefined
            ? Math.round(Number(layerProps.from_seconds_offset) * fps)
            : 0;

        const overlayFromFrame = fromFrame + overlayStartOffset;
        const overlayDuration = layerProps.duration_in_frames !== undefined
          ? Number(layerProps.duration_in_frames)
          : layerProps.duration_seconds !== undefined
            ? Math.round(Number(layerProps.duration_seconds) * fps)
            : Math.max(1, durationInFrames - overlayStartOffset);

        if (lType === 'lowerthird' || lType === 'lower_third' || layerName.includes('lower third') || layerName.includes('lowerthird') || layerProps.lower_third_name) {
          overlayTracks.push(
            this.createLowerThirdOverlay({
              id: `overlay_${sceneId}_${j + 1}`,
              fromFrame: overlayFromFrame,
              durationInFrames: overlayDuration,
              props: {
                ...layerProps,
                title: layerProps.lower_third_name || layerProps.title || layerProps.layer_title || layerProps.layer_text_content || layer.name,
                subtitle: layerProps.lower_third_role || layerProps.subtitle || layerProps.layer_subtitle,
                speakerTag: layerProps.lower_third_badge || layerProps.speaker_tag || layerProps.speakerTag || layerProps.layer_speaker_tag,
                accentColor: layerProps.lower_third_color || layerProps.accent_color || layerProps.accentColor || layerProps.layer_accent_color,
                position: layerProps.position || layerProps.layer_position,
              },
            })
          );
        } else if (lType === 'kinetictitle' || lType === 'kinetic_title' || lType === 'kinetic_text' || layerName.includes('kinetic') || layerProps.kinetic_title_text) {
          overlayTracks.push(
            this.createKineticTitleOverlay({
              id: `overlay_${sceneId}_${j + 1}`,
              fromFrame: overlayFromFrame,
              durationInFrames: overlayDuration,
              props: {
                ...layerProps,
                heading: layerProps.kinetic_title_text || layerProps.heading || layerProps.layer_heading || layerProps.title || layerProps.layer_title || layerProps.layer_text_content || layer.name,
                subheading: layerProps.kinetic_title_subtitle || layerProps.subheading || layerProps.layer_subheading || layerProps.subtitle || layerProps.layer_subtitle,
                theme: layerProps.theme || layerProps.layer_theme,
                animationStyle: layerProps.animation_style || layerProps.animationStyle || layerProps.layer_animation_style,
              },
            })
          );
        } else if (lType === 'conceptcallout' || lType === 'concept_callout' || lType === 'callout' || layerName.includes('concept') || layerProps.concept_main) {
          overlayTracks.push(
            this.createConceptCalloutOverlay({
              id: `overlay_${sceneId}_${j + 1}`,
              fromFrame: overlayFromFrame,
              durationInFrames: overlayDuration,
              props: {
                ...layerProps,
                label: layerProps.concept_main || layerProps.label || layerProps.layer_label || layerProps.title || layerProps.layer_title || layerProps.layer_text_content || layer.name,
                description: layerProps.concept_sub || layerProps.description || layerProps.layer_description || '',
                icon: layerProps.icon || layerProps.layer_icon,
                highlightColor: layerProps.highlight_color || layerProps.highlightColor || layerProps.layer_highlight_color,
              },
            })
          );
        } else if (lType === 'captions' || lType === 'caption' || lType === 'subtitles' || layerName.includes('caption') || layerName.includes('subtitle')) {
          overlayTracks.push(
            this.createCaptionsOverlay({
              id: `overlay_${sceneId}_${j + 1}`,
              fromFrame: overlayFromFrame,
              durationInFrames: overlayDuration,
              props: {
                ...layerProps,
                style: layerProps.style || layerProps.caption_style || sceneProps.captionStyle,
                size: layerProps.size ?? layerProps.caption_size ?? videoStyle.video_caption_size,
                highlight: layerProps.highlight || layerProps.caption_highlight || videoStyle.video_caption_highlight,
                fontFamily: layerProps.fontFamily || layerProps.font_family || sceneProps.fontFamily,
              },
              narration: sc.narration,
            })
          );
        }
      }

      // Scene-level caption default: no captions layer authored, but caption_style != none.
      const sceneCaptionStyle = sc.properties?.caption_style || sceneProps.captionStyle;
      const hasCaptionsLayer = overlayTracks.some((o) => o.id.startsWith(`overlay_${sceneId}_`) && o.type === 'captions');
      if (!hasCaptionsLayer && sceneCaptionStyle && sceneCaptionStyle !== 'none' && sc.narration) {
        overlayTracks.push(
          this.createCaptionsOverlay({
            id: `overlay_${sceneId}_captions`,
            fromFrame,
            durationInFrames,
            props: {
              style: sceneCaptionStyle,
              size: sc.properties?.caption_size ?? videoStyle.video_caption_size,
              highlight: sc.properties?.caption_highlight || videoStyle.video_caption_highlight,
              fontFamily: sceneProps.fontFamily,
            },
            narration: sc.narration,
          })
        );
      }

      currentFrame += durationInFrames;
    }

    const totalDurationInFrames = currentFrame;
    const totalDurationInSeconds = totalDurationInFrames / fps;

    /** @type {RemotionCompositionManifest} */
    const manifest = {
      version: '1.0.0',
      compositionId,
      fps,
      width,
      height,
      totalDurationInFrames,
      totalDurationInSeconds,
      tracks: {
        scenes: sceneTracks,
        audio: audioTracks,
        overlays: overlayTracks,
      },
      metadata: {
        generator: 'cogNNitive Video Engine',
        generatedAt: new Date().toISOString(),
        scriptSource,
      },
    };

    return manifest;
  }
}

// CLI runner helper if invoked directly
function main() {
  const scriptPath = process.argv[2];
  if (!scriptPath) {
    console.error('Usage: node remotion-scene-compiler.mjs <script.md> [--out <manifest.json>]');
    process.exit(1);
  }

  const outIdx = process.argv.indexOf('--out');
  const outPath = outIdx !== -1 ? process.argv[outIdx + 1] : null;

  try {
    const content = fs.readFileSync(path.resolve(scriptPath), 'utf8');
    const compiler = new RemotionSceneCompiler();
    const manifest = compiler.compile(content, { scriptSource: scriptPath });

    const jsonStr = JSON.stringify(manifest, null, 2);
    if (outPath) {
      fs.writeFileSync(path.resolve(outPath), jsonStr, 'utf8');
      console.log(`✅ [remotion-scene-compiler] Manifest written to ${outPath}`);
    } else {
      console.log(jsonStr);
    }
  } catch (err) {
    console.error(`❌ [remotion-scene-compiler] ${err.message}`);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
