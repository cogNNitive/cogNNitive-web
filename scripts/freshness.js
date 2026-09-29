#!/usr/bin/env node
/**
 * scripts/freshness.js
 *
 * Computes per-subsystem channel drift ("how far has `main` moved past the
 * tag users are currently pinned to?") using only local git, and publishes it
 * as `docs/use/freshness.json` through the existing Pages/build-docs pipeline.
 *
 * The baseline for each subsystem is its `manifest/source.yaml`
 * `channels.stable.refs` pin — never the newest matching tag (a cut-but-
 * unpinned tag must not mask drift; see design.md ADR-002).
 *
 * Zero dependencies, local git only, no `api.github.com` call.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseFocusedYaml } = require('./manifest/validate-manifest.js');
const { saveJsonAtomic } = require('./lib/atomic-fs.js');
const { resolveChannelRefs } = require('./lib/channel-refs.js');

/**
 * Subsystem -> tracked directories. Hardcoded and directory-scoped rather than
 * derived from `manifest/source.yaml` entries (those name files, which would
 * reproduce the single-file blindness this change removes — design.md ADR-003).
 *
 * ponytail: `innfo-console` lives under `iNNfo/specs/bluepriNNts/`, so a console
 * commit is double-counted under `templates` too. Accepted as an informational
 * lower-bound signal; a `:(exclude)` pathspec is the upgrade path if it ever
 * misleads (ADR-003).
 */
const SUBSYSTEM_PATHS = {
  skills: ['skills/'],
  templates: ['iNNfo/specs/bluepriNNts/'],
  'innfo-mcp': ['iNNfo/packages/innfo-mcp/'],
  'innfo-console': ['iNNfo/specs/bluepriNNts/console/'],
};

/**
 * Computes drift for every tracked subsystem. Pure and injectable: no real
 * git process is spawned here, `runGit` does all of it.
 *
 * @param {object} params
 * @param {string} params.sourceYaml - Raw contents of `manifest/source.yaml`.
 * @param {(args: string[]) => string} params.runGit - Runs a git subcommand
 *   (already scoped to the repo checkout) and returns its stdout, or throws.
 * @param {string} params.head - The ref to diff each pin against (e.g. `HEAD`).
 * @returns {Record<string, object>} Subsystem name -> freshness entry, in
 *   `SUBSYSTEM_PATHS` declaration order (stable across runs).
 */
function computeFreshness({ sourceYaml, runGit, head }) {
  const source = parseFocusedYaml(sourceYaml);
  let stableRefs = [];
  try {
    stableRefs = resolveChannelRefs(source, 'stable');
  } catch (_err) {
    stableRefs = [];
  }

  const subsystems = {};
  for (const key of Object.keys(SUBSYSTEM_PATHS)) {
    const paths = SUBSYSTEM_PATHS[key];
    const refEntry = stableRefs.find((r) => r && r.key === key);

    if (!refEntry) {
      subsystems[key] = {
        subsystem: key,
        pinnedTag: null,
        commitsSincePin: null,
        unresolved: 'no stable pin declared for this subsystem in manifest/source.yaml',
      };
      continue;
    }

    const tag = refEntry.ref;

    try {
      runGit(['rev-parse', `${tag}^{commit}`]);
    } catch (_err) {
      subsystems[key] = {
        subsystem: key,
        pinnedTag: tag,
        commitsSincePin: null,
        unresolved: 'pinned tag does not resolve in this checkout',
      };
      continue;
    }

    try {
      const pinnedTagDate = runGit(['log', '-1', '--format=%cI', tag]).trim();
      const countOut = runGit(['rev-list', '--count', `${tag}..${head}`, '--', ...paths]).trim();
      const filesOut = runGit(['diff', '--name-only', `${tag}..${head}`, '--', ...paths]).trim();
      subsystems[key] = {
        subsystem: key,
        pinnedTag: tag,
        pinnedTagDate,
        commitsSincePin: Number.parseInt(countOut, 10),
        filesTouched: filesOut === '' ? [] : filesOut.split('\n'),
      };
    } catch (err) {
      subsystems[key] = {
        subsystem: key,
        pinnedTag: tag,
        commitsSincePin: null,
        unresolved: `git command failed: ${err.message}`,
      };
    }
  }

  return subsystems;
}

function realRunGit(repoRoot) {
  return (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf-8' });
}

function main() {
  const repoRoot = path.join(__dirname, '..');
  const sourceYaml = fs.readFileSync(path.join(repoRoot, 'manifest', 'source.yaml'), 'utf-8');
  const runGit = realRunGit(repoRoot);
  const head = runGit(['rev-parse', 'HEAD']).trim();

  const subsystems = computeFreshness({ sourceYaml, runGit, head });
  const output = {
    generatedAt: new Date().toISOString(),
    head,
    subsystems,
  };

  const outPath = path.join(repoRoot, 'docs', 'use', 'freshness.json');
  try {
    saveJsonAtomic(outPath, output);
  } catch (err) {
    console.error(`FAIL: could not write docs/use/freshness.json: ${err.code || err.message}`);
    process.exit(1);
  }
  console.log(`freshness.json written: ${outPath}`);
}

module.exports = { computeFreshness, SUBSYSTEM_PATHS };

if (require.main === module) {
  main();
}
