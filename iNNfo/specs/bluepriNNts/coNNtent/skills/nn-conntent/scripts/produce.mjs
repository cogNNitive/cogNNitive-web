#!/usr/bin/env node

/**
 * nn-conntent/scripts/produce.mjs
 *
 * The `produce <episode>` CLI (capability video-produce-command). It parses the flags and
 * runs one pass of `lib/pipeline.mjs`, which owns the stage order, the stop points and the
 * console regeneration on every exit.
 *
 * Exit codes: 0 done, 10 awaiting review, 11 over budget / budget unset, 12 failed QA, 1 error.
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ChangesetError, EXIT_ERROR, EpisodeError, ProduceStop, produce } from './lib/pipeline.mjs';

export * from './lib/pipeline.mjs';

const USAGE = [
  'Usage: node produce.mjs <episode-doc-or-folder> [options]',
  '  --dry-run               estimate and stop before any spend',
  '  --no-open               regenerate the console without opening a browser tab',
  '',
  'Exit codes: 0 done, 10 a gate is open, 11 a spend stop no verdict can satisfy, 12 failed QA, 1 error.',
].join('\n');

function parseFlags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      out._.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (key === 'dry-run') out.dryRun = true;
    else if (key === 'no-open') out.noOpen = true;
    else throw new ProduceStop('unknown-option', `Unknown option --${key}`);
  }
  return out;
}

async function main() {
  let flags;
  try {
    flags = parseFlags(process.argv.slice(2));
  } catch (err) {
    console.error(`❌ [produce] ${err.message}\n${USAGE}`);
    process.exit(EXIT_ERROR);
  }
  if (!flags._[0]) {
    console.error(USAGE);
    process.exit(EXIT_ERROR);
  }
  try {
    const result = await produce({ episodePath: flags._[0], dryRun: flags.dryRun, noOpen: flags.noOpen });
    if (result.summary && result.summary.stages) {
      for (const stage of result.summary.stages) {
        console.log(
          `  ${stage.stage.padEnd(8)} ${String(stage.durationMs).padStart(6)} ms  cache ${stage.hits} hit / ${stage.misses} miss`,
        );
      }
      console.log(
        `Real cost $${result.summary.realUsd.toFixed(4)} of $${result.summary.estimateUsd.toFixed(4)} estimated, ` +
          `budget $${result.summary.budgetUsd.toFixed(2)}, link_mode ${result.summary.linkMode}`,
      );
    }
    process.exit(result.code);
  } catch (err) {
    if (err instanceof ProduceStop || err instanceof EpisodeError || err instanceof ChangesetError) {
      console.error(`❌ [produce] ${err.message}`);
      process.exit(err.exitCode || EXIT_ERROR);
    }
    throw err;
  }
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  main().catch((err) => {
    console.error(`❌ [produce] ${err?.stack || err}`);
    process.exit(EXIT_ERROR);
  });
}
