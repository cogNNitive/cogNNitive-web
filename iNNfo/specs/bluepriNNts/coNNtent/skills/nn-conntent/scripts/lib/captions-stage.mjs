/**
 * nn-conntent/scripts/lib/captions-stage.mjs
 *
 * Alignment stage running after synthesis and before animatic (capability conntent-captions).
 * Handles ASR model derivation from language, whisper consent validation, caching under
 * cache/video/captions/<sha256>.json, and enforcing the 0.90 match threshold.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  CAPTION_MATCH_MIN,
  alignCaptionLines,
  alignCaptions,
  runTranscribe,
  sceneCaptionsCacheKey,
  wordsUnsupported,
} from './captions.mjs';
import { CacheManager } from '../cache-manager.mjs';
import { EpisodeError, readEpisode, registerCaptionsValidator, resolveForEpisode } from './episode.mjs';
import { ProduceStop } from './pipeline.mjs';
import { recordStage, synthesizeEpisodeAssets } from './compile.mjs';
import { resolve as cascadeResolve } from './cascade.mjs';
import { slugify } from './knowledge-model.mjs';
import { loadCascadeBags, withScriptPresets } from './video-scope.mjs';
import { resolveDefaultCacheDir } from './video-guard.mjs';

let _whisperAvailableOverride = null;

/** Test seam to mock whisper availability. */
export function setWhisperAvailable(available) {
  _whisperAvailableOverride = available;
}

/**
 * True when the audio at `audioPath` is the synthesizer's offline placeholder
 * (`<sha>-offline.<ext>`): silence stored because no provider credential resolved. Caption
 * alignment then has nothing to match, and reporting a low ratio blames the script line for
 * audio that never contained speech.
 */
function isOfflinePlaceholder(audioPath) {
  return /-offline\.[a-z0-9]+$/i.test(path.basename(String(audioPath || '')));
}

/** The line that names a placeholder as the cause; empty when the audio is real. */
function offlinePlaceholderNote(audioPath) {
  if (!isOfflinePlaceholder(audioPath)) return '';
  return (
    ` The narration audio is the offline placeholder (${path.basename(audioPath)}): no provider ` +
    'credential resolved when it was synthesized, so it holds silence. Set the provider key and ' +
    're-synthesize this scene before aligning captions.'
  );
}

/** Check whether whisper/transcribe is available. */
export function isWhisperAvailable(deps = {}) {
  if (_whisperAvailableOverride !== null) return Boolean(_whisperAvailableOverride);
  if (process.env.NN_WHISPER_AVAILABLE !== undefined) {
    return process.env.NN_WHISPER_AVAILABLE === '1' || process.env.NN_WHISPER_AVAILABLE === 'true';
  }
  if (typeof deps?.isWhisperAvailable === 'function') {
    return Boolean(deps.isWhisperAvailable());
  }
  return true;
}

/** Where the HyperFrames CLI keeps whisper models (`ggml-<model>.bin`). */
export function whisperModelsDir(env = process.env) {
  return env.NN_WHISPER_MODELS_DIR || path.join(os.homedir(), '.cache', 'hyperframes', 'whisper', 'models');
}

/** The whisper models already installed for the HyperFrames CLI, by name. */
export function listInstalledWhisperModels(dir = whisperModelsDir()) {
  try {
    return fs
      .readdirSync(dir)
      .map((file) => /^ggml-(.+)\.bin$/.exec(file)?.[1])
      .filter(Boolean)
      .sort();
  } catch {
    // No models directory: nothing is installed yet.
    return [];
  }
}

/** Preference order when no `caption_model` is declared (quality vs size). */
const MODEL_PREFERENCE = ['small', 'medium', 'base', 'large-v3-turbo', 'large-v3', 'large-v2', 'large-v1', 'large', 'tiny'];

/**
 * The whisper model for a scene. A declared `caption_model` always wins. Otherwise an
 * INSTALLED model is preferred (an English-only `.en` model only for English, where it
 * is preferred), so the CLI never downloads a model the machine does not have when
 * another one would do; with nothing installed it is `small.en` for English and
 * `small` for other languages.
 * @param {{ language?: string, captionModel?: string, installedModels?: string[] }} [input]
 */
export function resolveCaptionModel({ language = 'en', captionModel, installedModels } = {}) {
  if (captionModel) return String(captionModel);
  const english = String(language || 'en').toLowerCase().split(/[-_]/)[0] === 'en';
  const installed = new Set(installedModels ?? listInstalledWhisperModels());
  const candidates = MODEL_PREFERENCE.flatMap((m) => (english ? [`${m}.en`, m] : [m]));
  const extra = [...installed].filter((m) => !candidates.includes(m) && (english || !m.endsWith('.en')));
  const pick = [...candidates, ...extra].find((m) => installed.has(m));
  return pick || (english ? 'small.en' : 'small');
}

/**
 * The captions plan of every Scene element: its slug and lowered scene id
 * (`scene_<slug>`, the key synthesis uses for its audio), the resolved `captions`
 * mode, the whisper model, the language and the narration text. The captions stage
 * (writer) and compile (reader) both use it, so they agree on every key input.
 * @param {{ model: object, scriptPath?: string, bags?: object, installedModels?: string[] }} input
 */
export function sceneCaptionPlans({ model, scriptPath = '', bags = {}, installedModels }) {
  const videoFields = (model?.elements?.Video || [])[0]?.fields || {};
  const language = String(resolveForEpisode(model, scriptPath, 'language').value || videoFields.language || 'en');
  return (model?.elements?.Scene || []).map((scene, i) => {
    const fields = scene.fields || {};
    const slug = scene.slug || fields.slug || (scene.name ? slugify(scene.name) : `scene_${i + 1}`);
    const sceneBags = { ...bags, video: videoFields, scene: fields };
    const captionModel = cascadeResolve('caption_model', sceneBags).value || null;
    return {
      slug,
      sceneId: `scene_${slug}`,
      mode: cascadeResolve('captions', sceneBags).value || 'off',
      captionModel,
      modelName: resolveCaptionModel({ language, captionModel, installedModels }),
      language,
      narration: String(scene.narration || fields.narration || scene.description || '').trim(),
    };
  });
}

/** The synthesized narration audio of one scene, from the scene -> audio map. */
export function sceneAudioPath(audioAssets, plan) {
  return (audioAssets?.[plan.sceneId] || audioAssets?.[plan.slug])?.assetPath || null;
}

/**
 * Validates captions constraints for an episode before spend.
 * Throws EpisodeError if validation fails.
 */
export function assertCaptionsValid(episode, options = {}) {
  const scriptPath = episode.scriptPath || '';
  const scriptDir = scriptPath ? path.dirname(scriptPath) : process.cwd();
  const bags = withScriptPresets(loadCascadeBags(scriptDir), episode.model, scriptPath);
  const videoFields = (episode.model.elements?.Video || [])[0]?.fields || {};
  const scenes = episode.model.elements?.Scene || [];
  const language = String(resolveForEpisode(episode.model, scriptPath, 'language').value || videoFields.language || 'en');

  let anyCaptions = false;
  for (const scene of scenes) {
    const sceneFields = scene.fields || {};
    const sceneBags = { ...bags, video: videoFields, scene: sceneFields };
    const mode = cascadeResolve('captions', sceneBags).value || 'off';
    const captionModel = cascadeResolve('caption_model', sceneBags).value || null;

    if (mode !== 'off') {
      anyCaptions = true;
      if (mode === 'words' && wordsUnsupported(language)) {
        throw new EpisodeError(
          'captions-words-unsupported',
          `Word-level captions not supported for unspaced language "${language}". Use lines or off.`,
        );
      }
      if (captionModel && String(captionModel).endsWith('.en') && language !== 'en') {
        throw new EpisodeError(
          'caption-model-language-mismatch',
          `Caption model "${captionModel}" is English-only and cannot be used with language "${language}".`,
        );
      }
    }
  }

  if (anyCaptions) {
    if (!isWhisperAvailable(options.deps)) {
      throw new EpisodeError(
        'whisper-missing',
        'Captions require whisper.cpp (or hyperframes transcribe). Run ~/.agents/skills/nn-conntent/scripts/ensure-hyperframes.mjs to install.',
      );
    }
  }
}

registerCaptionsValidator(assertCaptionsValid);

/**
 * Runs the captions alignment stage for all scenes of an episode.
 * Executed after asset synthesis and before the animatic.
 *
 * Each scene aligns against ITS OWN synthesized narration: the scene -> audio map is
 * `options.audioAssets` / `deps.audioAssets` (the synthesis result, keyed by scene id),
 * else it is read from the TTS cache with a read-only plan pass (nothing spent). A
 * scene with no audio stops with `caption-audio-missing`; there is no fallback to
 * another file. `deps.audioPath` is an explicit test seam: one file for every scene.
 *
 * `bags` are the outer cascade bags (as for synthesis and compile; default: loaded from the script dir).
 *
 * @param {{ scriptPath: string, facts?: object, deps?: object, cacheDir?: string, model?: object, audioAssets?: object, bags?: object }} options
 * @returns {Promise<{ ok: boolean, captions: Array<object> }>}
 */
export async function alignEpisodeCaptions(options = {}) {
  const { scriptPath, facts, deps = {} } = options;
  const stageStart = Date.now();
  const episode = options.model
    ? { scriptPath, model: options.model }
    : readEpisode(scriptPath, { model: deps.model });

  assertCaptionsValid(episode, { deps });

  const scriptDir = scriptPath ? path.dirname(scriptPath) : process.cwd();
  const outerBags = options.bags || loadCascadeBags(scriptDir);
  const bags = withScriptPresets(outerBags, episode.model, scriptPath);
  const plans = sceneCaptionPlans({ model: episode.model, scriptPath, bags, installedModels: deps.installedModels })
    .filter((plan) => plan.mode !== 'off' && plan.narration);

  // `produce` hands its cache dir in `deps`: the stage must write where compile reads.
  const cacheDir = options.cacheDir || deps.cacheDir || resolveDefaultCacheDir(scriptDir);
  const cacheManager = new CacheManager({ baseDir: cacheDir });
  const captionsCacheDir = cacheManager.getCacheDir('captions');

  const synthesizerOptions = options.synthesizerOptions || deps.synthesizerOptions;
  let audioAssets = options.audioAssets || deps.audioAssets || null;
  if (!audioAssets && !deps.audioPath && plans.length > 0 && scriptPath) {
    const lookup = deps.lookupAudioAssets || synthesizeEpisodeAssets;
    audioAssets = (
      await lookup({
        scriptPath,
        cacheDir,
        model: episode.model,
        lookupOnly: true,
        ...(options.bags ? { bags: options.bags } : {}),
        ...(synthesizerOptions ? { synthesizerOptions } : {}),
      })
    ).audioAssets;
  }

  let hits = 0;
  let misses = 0;
  const alignedCaptions = [];

  for (const plan of plans) {
    const { slug: sceneSlug, mode, modelName, language, narration } = plan;
    const audioPath = deps.audioPath || sceneAudioPath(audioAssets, plan);
    if (!audioPath || !fs.existsSync(audioPath)) {
      throw new ProduceStop(
        'caption-audio-missing',
        `Captions for scene "${sceneSlug}" need its synthesized narration audio, and none was found` +
          (audioPath ? ` (${audioPath} does not exist)` : '') +
          '. Run synthesis for this scene first.',
        { exitCode: 1, details: { scene: sceneSlug, audioPath } },
      );
    }

    const cacheKey = sceneCaptionsCacheKey({ audioPath, text: narration, modelName, language });
    const cacheFile = path.join(captionsCacheDir, `${cacheKey}.json`);

    let aligned;
    if (fs.existsSync(cacheFile)) {
      hits++;
      aligned = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } else {
      misses++;
      const runner = deps.runTranscribe || runTranscribe;
      const transcribeRes = runner({
        audioPath,
        language: language === 'en' ? undefined : language,
        model: modelName,
        deps: deps.transcribeDeps || deps,
      });

      if (!transcribeRes || transcribeRes.ok !== true) {
        throw new ProduceStop(
          'caption-alignment-failed',
          `Caption alignment failed for scene "${sceneSlug}": transcribe failed (${transcribeRes?.reason || 'unknown'}).${offlinePlaceholderNote(audioPath)}`,
          {
            exitCode: 1,
            details: {
              scene: sceneSlug,
              cause: transcribeRes?.reason,
              offlinePlaceholder: isOfflinePlaceholder(audioPath),
            },
          },
        );
      }

      const words = Array.isArray(transcribeRes.words) ? transcribeRes.words : [];
      if (mode === 'lines') {
        const segments = Array.isArray(transcribeRes.segments) && transcribeRes.segments.length > 0
          ? transcribeRes.segments
          : words;
        aligned = alignCaptionLines({ scriptText: narration, segments });
      } else {
        aligned = alignCaptions({
          scriptText: narration,
          words,
          segments: transcribeRes.segments,
          audioDurationSeconds: transcribeRes.durationSeconds,
          language,
        });
      }

      if (!aligned || !aligned.ok || Number(aligned.coverage) < CAPTION_MATCH_MIN) {
        const ratio = aligned && Number.isFinite(aligned.coverage) ? aligned.coverage.toFixed(2) : 'unknown';
        // A ratio alone tells an author nothing actionable. Name the script tokens that found no
        // match and show the transcript the aligner compared, so the fix is either rewriting the
        // line or turning captions off for the video.
        const unmatched = Array.isArray(aligned?.unmatched) ? aligned.unmatched.filter(Boolean) : [];
        const shown = unmatched.slice(0, 8).map((word) => `"${word}"`).join(', ');
        const transcriptText = String(aligned?.transcriptText || '').slice(0, 200);
        const detail =
          (shown ? ` Unmatched from the script: ${shown}${unmatched.length > 8 ? ', …' : ''}.` : '') +
          (transcriptText ? ` Transcript: "${transcriptText}".` : ' No transcript was produced.') +
          // Silent audio has one cause: naming it replaces advice that cannot work here.
          (offlinePlaceholderNote(audioPath) ||
            ' Short lines and words the synthesiser pronounces differently are the usual cause: ' +
              'rewrite the line, or set `captions:: off` for the video.');
        throw new ProduceStop(
          'caption-alignment-failed',
          `Caption alignment failed for scene "${sceneSlug}": match ratio ${ratio} is below threshold ${CAPTION_MATCH_MIN}.${detail}`,
          {
            exitCode: 1,
            details: {
              scene: sceneSlug,
              coverage: aligned?.coverage,
              cause: aligned?.reason,
              offlinePlaceholder: isOfflinePlaceholder(audioPath),
            },
          },
        );
      }

      fs.writeFileSync(cacheFile, JSON.stringify(aligned), 'utf8');
    }

    alignedCaptions.push({
      scene: sceneSlug,
      mode,
      coverage: aligned.coverage,
      words: aligned.words || [],
      lines: aligned.lines || [],
    });
  }

  if (facts && facts.rootDir) {
    recordStage(facts, {
      stage: 'captions',
      start: stageStart,
      end: Date.now(),
      cache: { hits, misses },
    });
  }

  return { ok: true, captions: alignedCaptions };
}
