#!/usr/bin/env node

/**
 * nn-video-script/scripts/approve-plan.mjs
 *
 * Usage: node approve-plan.mjs <asset_plan.md> [--allow-model <name>]... [--delegated "<human phrase>"]
 *
 * Writes `asset_plan.approved.json` next to the plan, recording the plan hash,
 * the estimated total, the approved model set and any `--allow-model` overrides.
 *
 * Approval is a HUMAN act, confirmed by the plan hash. Two equivalent routes:
 *   1. In-chat delegation (the standard cognNNitive flow): the agent asks the human
 *      to reply with the exact phrase `approve the plan <plan-hash-8>`; the human
 *      sends it in the conversation; the agent runs this script with
 *      `--delegated "<that exact phrase>"`. The phrase MUST contain the plan hash,
 *      and is stored verbatim in the approval file for audit. No external terminal.
 *   2. Interactive TTY: no `--delegated` — the human types the hash prefix at the
 *      prompt (there is deliberately no `--yes` flag).
 * Delegated approvals are honored by compile / synthesize-avatar when
 * `video-guard.json: { "allowDelegatedApproval": true }` (default true). A workspace
 * may set it to false to require the TTY route.
 * (A process with file-write access can still hand-write the JSON; see
 * references/cost-guardrails.md for the residual risk.)
 *
 * Zero external dependencies. ESM module.
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { APPROVAL_FILENAME, parsePlanMarkdown, writeApproval, delegatedPhraseIsValid } from './lib/plan-approval.mjs';
import { parseArgs, CliUsageError } from './lib/cli-args.mjs';

/**
 * @param {string} planPath
 * @param {{ allowModels?: string[], delegatedPhrase?: string }} [opts]
 * @returns {{ approvalPath: string, planHash: string, totalUsd: number, models: string[] }}
 */
export function approvePlan(planPath, { allowModels = [], delegatedPhrase = '' } = {}) {
  const resolved = path.resolve(planPath);
  if (!fs.existsSync(resolved)) throw new Error('Plan file not found: ' + resolved);
  const { planHash, totalUsd, models } = parsePlanMarkdown(fs.readFileSync(resolved, 'utf8'));
  if (!planHash || totalUsd === null || !models) {
    throw new Error(
      resolved + ' has no valid plan stamp on its first line. Regenerate it with asset-cost-estimator.mjs --out.',
    );
  }
  const approvalPath = path.join(path.dirname(resolved), APPROVAL_FILENAME);
  writeApproval(approvalPath, {
    planHash,
    totalUsd,
    allowedModels: models,
    allowModels,
    delegated: delegatedPhrase.length > 0,
    delegatedPhrase,
  });
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
    parsed = parseArgs(process.argv.slice(2), { repeatable: ['allow-model'], value: ['delegated'] });
  } catch (err) {
    if (!(err instanceof CliUsageError)) throw err;
    console.error('Error: ' + err.message);
    process.exit(1);
  }
  const planPath = parsed._[0];
  if (!planPath) {
    console.error('Usage: node approve-plan.mjs <asset_plan.md> [--allow-model <name>]... [--delegated "<human phrase>"]   (human approval of the spend)');
    process.exit(1);
  }
  const delegatedPhrase = typeof parsed.flags['delegated'] === 'string' ? parsed.flags['delegated'].trim() : '';
  if (delegatedPhrase) {
    // Delegated (agent-relayed) approval: no TTY. The human's explicit chat phrase
    // is recorded verbatim for audit. It MUST carry the plan hash, so relaying it
    // still required the human to read and repeat the hash deliberately.
    try {
      const resolved = path.resolve(planPath);
      if (!fs.existsSync(resolved)) throw new Error('Plan file not found: ' + resolved);
      const stamp = parsePlanMarkdown(fs.readFileSync(resolved, 'utf8'));
      if (!stamp.planHash) throw new Error(resolved + ' has no valid plan stamp on its first line.');
      const expected = stamp.planHash.slice(0, 8);
      if (!delegatedPhraseIsValid(delegatedPhrase, stamp.planHash)) {
        throw new Error(
          'Delegated approval must contain the plan hash "' + expected + '". ' +
            'Ask the human to reply in chat with exactly: approve the plan ' + expected,
        );
      }
      const res = approvePlan(planPath, { allowModels: parsed.flags['allow-model'] || [], delegatedPhrase });
      console.log('Approved plan by delegation (est. $' + res.totalUsd.toFixed(4) + ' USD) -> ' + res.approvalPath);
      console.log('  recorded phrase: "' + delegatedPhrase + '"');
    } catch (err) {
      console.error('Error: ' + err.message);
      process.exit(1);
    }
    return;
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('Error: approve-plan must be run interactively by a human (a TTY is required). Agents must not run it — unless the human delegated explicitly via --delegated "<phrase>".');
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
