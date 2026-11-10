/**
 * nn-conntent/scripts/lib/spend-gate.mjs
 *
 * Spend authorization is one mechanism: a plan within budget needs nothing; a plan over
 * budget is authorized by an applied preview (each scene's slice) or by the inserted
 * episode-level `budget` gate. No command-line flag exists (capability
 * conntent-review-gates; design D-P1, D-P7).
 *
 * Zero external dependencies. ESM module.
 */

export const EXIT_REVIEW = 10;
export const EXIT_SPEND = 11;

const finite = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

/**
 * Decide whether a run needs the inserted episode-level `budget` gate, or stops because
 * no verdict can satisfy it.
 *
 * @param {{ reviewGates?: string[], total?: number, budget?: number|null,
 *   prePreviewSubtotal?: number, planHash?: string }} input
 * @returns {{ stop: { code: string, exitCode: number, message: string, planHash?: string }|null,
 *   budgetGate: boolean }}
 */
export function spendPlan({ reviewGates = [], total = 0, budget = null, prePreviewSubtotal = 0, planHash }) {
  const gates = Array.isArray(reviewGates) ? reviewGates.map(String) : [];

  if (!finite(budget)) {
    if (Number(total) > 0) {
      return {
        stop: {
          code: 'budget-unset',
          exitCode: EXIT_SPEND,
          planHash,
          message:
            `No budget is declared for this episode, so the engine always asks. Estimate: $${Number(total).toFixed(4)} ` +
            `(plan ${String(planHash || '').slice(0, 8)}). Declare budget:: at the episode or Series level, then re-run.`,
        },
        budgetGate: false,
      };
    }
    return { stop: null, budgetGate: false };
  }

  const cap = Number(budget);
  const over = Number(total) > cap + 1e-9;
  // Before the preview verdict exists the spend is TTS and images. When that subtotal
  // alone exceeds the budget, the budget gate is inserted before them (Q1 default).
  const preOver = Number(prePreviewSubtotal) > cap + 1e-9;
  const previewOn = gates.includes('preview');
  return { stop: null, budgetGate: over && (!previewOn || preOver) };
}

/** The episode-level `budget` gate target: current hash and plan hash are the same. */
export function budgetGateTarget({ modelId, planHash }) {
  return { gate: 'budget', scene: null, currentHash: planHash, planHash, modelId };
}
