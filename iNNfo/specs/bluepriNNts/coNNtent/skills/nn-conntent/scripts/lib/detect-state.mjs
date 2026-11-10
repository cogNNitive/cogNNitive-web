/**
 * nn-conntent/scripts/lib/detect-state.mjs
 *
 * The state-aware entry point: read the domaiNN's files (never conversation memory) and
 * propose the one procedure that comes next (capability conntent-procedures "State-aware
 * entry point"; design D-R1; task 5b.1). Detection is read-only and stateless.
 */

import fs from 'node:fs';
import path from 'node:path';

import { assertLayout } from './layout.mjs';

/** The six procedure names, exactly as the procedures document declares them. */
export const PROCEDURE_NAMES = {
  setupDomain: 'Set up the Domain',
  defineFrame: 'Define a Frame',
  defineCharacter: 'Define a Character',
  createSeries: 'Create a Series',
  planEpisode: 'Plan an Episode',
  produceEpisode: 'Produce an Episode',
};

const exists = (p) => {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
};

const dirsIn = (dir) => {
  try {
    return fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return [];
  }
};

const hasFile = (dir, re) => {
  try {
    return fs.readdirSync(dir).some((name) => re.test(name));
  } catch {
    return false;
  }
};

/** Folders under `<base>` that hold a file matching `re`. */
function foldersWith(base, re) {
  return dirsIn(base).filter((entry) => hasFile(path.join(base, entry.name), re)).map((entry) => entry.name);
}

function seriesList(root) {
  return dirsIn(path.join(root, 'series'))
    .map((entry) => ({ slug: entry.name, dir: path.join(root, 'series', entry.name) }))
    .filter((series) => hasFile(series.dir, /_coNNtent_NN\.md$/));
}

function episodeList(seriesDir) {
  return dirsIn(path.join(seriesDir, 'episodes'))
    .map((entry) => ({ slug: entry.name, dir: path.join(seriesDir, 'episodes', entry.name) }))
    .filter((episode) => hasFile(episode.dir, /_coNNtent_NN\.md$/));
}

/** The `status::` of an episode, or ''. */
function statusOf(episodeDir) {
  let names = [];
  try {
    names = fs.readdirSync(episodeDir).filter((name) => /_coNNtent_NN\.md$/.test(name));
  } catch {
    return '';
  }
  if (names.length === 0) return '';
  try {
    const text = fs.readFileSync(path.join(episodeDir, names[0]), 'utf8');
    const match = /^status::\s*(\S+)/m.exec(text);
    return match ? match[1] : '';
  } catch {
    return '';
  }
}

/** The episode states that make `produce` the next step. */
const PRODUCIBLE = new Set(['draft', 'approved', 'produced', 'failed_qa']);

/**
 * @param {string} rootDir
 * @returns {{ procedure: string, reason: string, series?: string, episode?: string,
 *   skippable?: boolean, legacy?: Array<{ code: string, path: string, message: string }> }}
 */
export function detectState(rootDir) {
  const root = path.resolve(String(rootDir || '.'));

  // 1. Legacy layout: reject, never adapt.
  const legacy = assertLayout(root);
  if (legacy.length > 0) {
    return { procedure: PROCEDURE_NAMES.setupDomain, reason: 'legacy-layout', legacy };
  }

  // 2. No domaiNN, or no defaults: set the domain up.
  if (!exists(path.join(root, 'domaiNN_NN.md')) || !exists(path.join(root, 'video-defaults_NN.md'))) {
    return { procedure: PROCEDURE_NAMES.setupDomain, reason: 'no-domain' };
  }

  const series = seriesList(root);

  // 3. No series: frame, then character (both skippable), then the series.
  if (series.length === 0) {
    if (foldersWith(path.join(root, 'library', 'frames'), /^FRAME\.md$/).length === 0) {
      return { procedure: PROCEDURE_NAMES.defineFrame, reason: 'no-frame', skippable: true };
    }
    if (foldersWith(path.join(root, 'library', 'characters'), /^CHARACTER\.md$/).length === 0) {
      return { procedure: PROCEDURE_NAMES.defineCharacter, reason: 'no-character', skippable: true };
    }
    return { procedure: PROCEDURE_NAMES.createSeries, reason: 'no-series' };
  }

  // 4. A series with no episode: plan one.
  const withEpisodes = series
    .map((entry) => ({ ...entry, episodes: episodeList(entry.dir) }))
    .filter((entry) => entry.episodes.length > 0);
  if (withEpisodes.length === 0) {
    return { procedure: PROCEDURE_NAMES.planEpisode, reason: 'no-episode', series: series[0].slug };
  }

  // 5/6. The first episode that still needs work decides.
  for (const entry of withEpisodes) {
    for (const episode of entry.episodes) {
      const status = statusOf(episode.dir);
      if (!status || status === 'idea') {
        return {
          procedure: PROCEDURE_NAMES.planEpisode,
          reason: 'unplanned-episode',
          series: entry.slug,
          episode: episode.slug,
        };
      }
      if (PRODUCIBLE.has(status)) {
        return {
          procedure: PROCEDURE_NAMES.produceEpisode,
          reason: 'producible',
          series: entry.slug,
          episode: episode.slug,
        };
      }
    }
  }

  // 7. Everything is delivered (or archived): the next step is a new episode.
  return { procedure: PROCEDURE_NAMES.planEpisode, reason: 'all-delivered' };
}
