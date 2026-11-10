/**
 * nn-conntent/scripts/lib/guard-config.mjs
 *
 * One guard config for every consumer: `loadGuard` (caps, allowlists, system voices)
 * plus the merged catalog's `Voice` elements, which is where a domaiNN registers the
 * voices it may speak with (2b.5 / 1c.6).
 *
 * Every TTS cache key is computed from this config
 * (`ttsCacheKeyFor` -> `resolveRegisteredVoice`), so compile, the avatar synthesiser,
 * the estimator and produce MUST build it the same way. A consumer that merged the
 * catalog and another that did not produced two different keys for the same
 * narration and the avatar job reported "no TTS cache entry" for audio that was on
 * disk.
 */

import { loadGuard } from './video-guard.mjs'
import { loadMergedCatalog, voiceRegistryOf } from './catalog.mjs'

/**
 * @param {string} [startDir] Directory that resolves the workspace root
 * @returns {{ root: string|null, guardFile: string|null, config: object }}
 */
export function loadGuardWithVoices(startDir) {
  const loaded = loadGuard(startDir)
  const catalog = loadMergedCatalog({ domainRoot: loaded.root })
  return {
    ...loaded,
    config: {
      ...loaded.config,
      voices: { ...(loaded.config.voices || {}), ...voiceRegistryOf(catalog) },
    },
  }
}
