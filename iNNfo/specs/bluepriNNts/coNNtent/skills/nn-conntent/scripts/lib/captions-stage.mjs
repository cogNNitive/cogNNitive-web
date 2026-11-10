/**
 * nn-conntent/scripts/lib/captions-stage.mjs
 *
 * Alignment stage running after synthesis and before animatic (capability conntent-captions).
 * Handles ASR model derivation from language, whisper consent validation, caching under
 * cache/video/captions/<sha256>.json, and enforcing the 0.90 match threshold.
 *
 * Zero external dependencies. ESM module.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  CAPTION_MATCH_MIN,
  alignCaptionLines,
  alignCaptions,
  captionsCacheKey,
  runTranscribe,
  wordsUnsupported,
} from './captions.mjs';
import { CacheManager } from '../cache-manager.mjs';
import { EpisodeError, readEpisode, registerCaptionsValidator, resolveForEpisode } from './episode.mjs';
import { ProduceStop } from './pipeline.mjs';
import { recordStage } from './compile.mjs';
import { resolve as cascadeResolve } from './cascade.mjs';
import { loadCascadeBags, withScriptPresets } from './video-scope.mjs';
import { normalizeModelId, resolveDefaultCacheDir } from './video-guard.mjs';

let _whisperAvailableOverride = null;

/** Test seam to mock whisper availability. */
export function setWhisperAvailable(available) {
  _whisperAvailableOverride = available;
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

/** Derive the whisper model name from scene language and optional caption_model override. */
export function resolveCaptionModel({ language = 'en', captionModel } = {}) {
  if (captionModel) return String(captionModel);
  const lang = String(language || 'en').toLowerCase();
  return lang === 'en' ? 'small.en' : 'small';
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
 * @param {{ scriptPath: string, facts?: object, deps?: object, cacheDir?: string, model?: object }} options
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
  const bags = withScriptPresets(loadCascadeBags(scriptDir), episode.model, scriptPath);
  const videoFields = (episode.model.elements?.Video || [])[0]?.fields || {};
  const scenes = episode.model.elements?.Scene || [];
  const language = String(resolveForEpisode(episode.model, scriptPath, 'language').value || videoFields.language || 'en');

  const cacheDir = options.cacheDir || resolveDefaultCacheDir(scriptDir);
  const cacheManager = new CacheManager({ baseDir: cacheDir });
  const captionsCacheDir = cacheManager.getCacheDir('captions');

  let hits = 0;
  let misses = 0;
  const alignedCaptions = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const sceneFields = scene.fields || {};
    const sceneSlug = scene.slug || sceneFields.slug || `scene_${i + 1}`;
    const sceneBags = { ...bags, video: videoFields, scene: sceneFields };
    const mode = cascadeResolve('captions', sceneBags).value || 'off';
    const captionModel = cascadeResolve('caption_model', sceneBags).value || null;

    if (mode === 'off') continue;

    const narration = String(scene.narration || sceneFields.narration || scene.description || '').trim();
    if (!narration) {
      // Silent scene: skipped without error
      continue;
    }

    const modelName = resolveCaptionModel({ language, captionModel });

    // Locate audio file
    let audioPath = deps.audioAssets?.[sceneSlug]?.assetPath || deps.audioPath;
    if (!audioPath && scriptPath) {
      // Look up cached TTS audio in cache manager
      const ttsModel = normalizeModelId(cascadeResolve('voice_model', sceneBags).value);
      const audioSha = deps.audioAssets?.[sceneSlug]?.sha256;
      if (audioSha) {
        audioPath = cacheManager.resolvePath(audioSha, 'mp3', 'tts');
      }
    }

    if (!audioPath || !fs.existsSync(audioPath)) {
      if (deps.audioPath && fs.existsSync(deps.audioPath)) {
        audioPath = deps.audioPath;
      } else {
        // Fallback: check tts cache directory for any matching audio
        const ttsDir = cacheManager.getCacheDir('tts');
        const files = fs.existsSync(ttsDir) ? fs.readdirSync(ttsDir) : [];
        if (files.length > 0) {
          audioPath = path.join(ttsDir, files[0]);
        }
      }
    }

    let audioSha = '0'.repeat(64);
    if (audioPath && fs.existsSync(audioPath)) {
      const audioBytes = fs.readFileSync(audioPath);
      audioSha = crypto.createHash('sha256').update(audioBytes).digest('hex');
    }

    const cacheKey = captionsCacheKey({
      audioSha,
      text: narration,
      engine: 'auto',
      engineVersion: `${modelName}:${language}`,
    });
    const cacheFile = path.join(captionsCacheDir, `${cacheKey}.json`);

    let aligned;
    if (fs.existsSync(cacheFile)) {
      hits++;
      aligned = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    } else {
      misses++;
      const runner = deps.runTranscribe || runTranscribe;
      const transcribeRes = runner({
        audioPath: audioPath || 'audio.mp3',
        language: language === 'en' ? undefined : language,
        model: modelName,
        deps: deps.transcribeDeps || deps,
      });

      if (!transcribeRes || transcribeRes.ok !== true) {
        throw new ProduceStop(
          'caption-alignment-failed',
          `Caption alignment failed for scene "${sceneSlug}": transcribe failed (${transcribeRes?.reason || 'unknown'})`,
          { exitCode: 1, details: { scene: sceneSlug, cause: transcribeRes?.reason } },
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
        });
      }

      if (!aligned || !aligned.ok || Number(aligned.coverage) < CAPTION_MATCH_MIN) {
        const ratio = aligned && Number.isFinite(aligned.coverage) ? aligned.coverage.toFixed(2) : 'unknown';
        throw new ProduceStop(
          'caption-alignment-failed',
          `Caption alignment failed for scene "${sceneSlug}": match ratio ${ratio} is below threshold ${CAPTION_MATCH_MIN}`,
          { exitCode: 1, details: { scene: sceneSlug, coverage: aligned?.coverage, cause: aligned?.reason } },
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
