#!/usr/bin/env node

/**
 * skills/nn-video-script/scripts/approve-plan.mjs
 *
 * Usage: node approve-plan.mjs <asset_plan.md> [--allow-model <name>]...
 *
 * Writes `asset_plan.approved.json` next to the plan, recording the plan hash,
 * the estimated total, the approved model set and any `--allow-model` overrides.
 * This is a HUMAN act: it needs an interactive terminal and a typed confirmation,
 * and there is deliberately no `--yes` flag. Agents must never run it for the user.
 * (A process with file-write access can still hand-write the JSON; see
 * references/cost-guardrails.md for the residual risk.)
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { APPROVAL_FILENAME, parsePlanMarkdown, writeApproval } from './lib/plan-approval.mjs';
import { parseArgs, CliUsageError } from './lib/cli-args.mjs';

/**
 * @param {string} planPath
 * @param {{ allowModels?: string[] }} [opts]
 * @returns {{ approvalPath: string, planHash: string, totalUsd: number, models: string[] }}
 */
export function approvePlan(planPath, { allowModels = [] } = {}) {
  const resolved = path.resolve(planPath);
  if (!fs.existsSync(resolved)) throw new Error('Plan file not found: ' + resolved);
  const { planHash, totalUsd, models } = parsePlanMarkdown(fs.readFileSync(resolved, 'utf8'));
  if (!planHash || totalUsd === null || !models) {
    throw new Error(
      resolved + ' has no valid plan stamp on its first line. Regenerate it with asset-cost-estimator.mjs --out.',
    );
  }
  const approvalPath = path.join(path.dirname(resolved), APPROVAL_FILENAME);
  writeApproval(approvalPath, { planHash, totalUsd, allowedModels: models, allowModels });
  return { approvalPath, planHash, totalUsd, models };
}

/**
 * Asks the human to type the first 8 characters of the plan hash.
 * Returns false (never approves) when the input is not a TTY.
 * @param {{ input: NodeJS.ReadableStream, output: NodeJS.WritableStream, isTTY: boolean, expected: string }} io
 * @returns {Promise<boolean>}
 */
export async function confirmApproval({ input, output, isTTY, expected }) {
  if (!isTTY) return false;
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await new Promise((resolve) => {
      rl.question('Type ' + expected + ' to approve this spend: ', resolve);
    });
    return String(answer).trim() === expected;
  } finally {
    rl.close();
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { repeatable: ['allow-model'] });
  } catch (err) {
    if (!(err instanceof CliUsageError)) throw err;
    console.error('Error: ' + err.message);
    process.exit(1);
  }
  const planPath = parsed._[0];
  if (!planPath) {
    console.error('Usage: node approve-plan.mjs <asset_plan.md> [--allow-model <name>]...   (human approval of the spend)');
    process.exit(1);
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Error: approve-plan must be run interactively by a human (a TTY is required). Agents must not run it.');
    process.exit(1);
  }
  try {
    const resolved = path.resolve(planPath);
    const stamp = parsePlanMarkdown(fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : '');
    if (!stamp.planHash) throw new Error(resolved + ' has no valid plan stamp on its first line.');
    const allowModels = parsed.flags['allow-model'] || [];
    console.log('Plan ' + resolved);
    console.log('  estimated total: $' + stamp.totalUsd.toFixed(4) + ' (run cap: 1.25x = $' + (stamp.totalUsd * 1.25).toFixed(4) + ')');
    console.log('  approved models: ' + (stamp.models.join(', ') || '(none)'));
    if (allowModels.length) console.log('  EXTRA --allow-model overrides: ' + allowModels.join(', '));
    const ok = await confirmApproval({
      input: process.stdin,
      output: process.stdout,
      isTTY: true,
      expected: stamp.planHash.slice(0, 8),
    });
    if (!ok) {
      console.error('Not approved.');
      process.exit(1);
    }
    const res = approvePlan(planPath, { allowModels });
    console.log('Approved plan (est. $' + res.totalUsd.toFixed(4) + ' USD) -> ' + res.approvalPath);
  } catch (err) {
    console.error('Error: ' + err.message);
    process.exit(1);
  }
}

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) await main();
