/**
 * Deterministic source-to-element scorer (scored matching pipeline step).
 *
 * Bulk scoring runs OUTSIDE the hot reasoning loop: confident pairs
 * (score at or above threshold) link automatically, everything else enters
 * the review queue — never silent exclusion. Reviewer attention is spent on
 * doubtful pairs only.
 *
 * Scoring is a pure token-set Jaccard similarity over lowercased
 * alphanumeric tokens: |A ∩ B| / |A ∪ B|. Deterministic by construction
 * (same inputs → same score, no randomness, no model calls).
 *
 * THRESHOLD (task 3.5): `DEFAULT_THRESHOLD = 0.7`, calibrated on the
 * node-runner fixtures — a 5-of-6 token overlap scores 0.83 (links) while an
 * unrelated pair scores 0.0 (queues), and an exact 7-of-10 overlap scores
 * 0.70 (links on the ≥ boundary). Keep 0.7; change only with measured
 * fixture evidence showing systematic misclassification.
 *
 * Dependency-free: no imports.
 */

const DEFAULT_THRESHOLD = 0.7;
const MAX_QUEUE_CANDIDATES = 3;

/**
 * Lowercased alphanumeric token set for a text value.
 * @param {any} text
 * @returns {Set<string>}
 */
function tokenize(text) {
  const words =
    String(text || "")
      .toLowerCase()
      .match(/[a-z0-9]+/g) || [];
  return new Set(words);
}

/**
 * Deterministic similarity between two texts in [0, 1].
 * Both-empty yields 0 so vacuous pairs never link.
 * @param {any} a
 * @param {any} b
 * @returns {number}
 */
function scorePair(a, b) {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function sourceIdOf(item) {
  return item.id !== undefined ? item.id : item.sourceId;
}

function elementIdOf(item) {
  return item.id !== undefined ? item.id : item.elementId;
}

function textOf(item) {
  const text =
    item.text !== undefined
      ? item.text
      : item.title !== undefined
        ? item.title
        : item.name;
  return text || "";
}

/**
 * Score every source against every element.
 * @param {Array<{ id?: string, sourceId?: string, text?: string, title?: string, name?: string }>} sources
 * @param {Array<{ id?: string, elementId?: string, text?: string, title?: string, name?: string }>} elements
 * @param {{ threshold?: number }} [options]
 * @returns {{ links: Array<{ sourceId: string, elementId: string, score: number }>, queue: Array<{ sourceId: string, candidates: Array<{ elementId: string, score: number }>, reason: string, status: string }> }}
 */
function scorePairs(sources, elements, { threshold = DEFAULT_THRESHOLD } = {}) {
  const sourceList = Array.isArray(sources) ? sources : [];
  const elementList = Array.isArray(elements) ? elements : [];
  const links = [];
  const queue = [];

  for (const source of sourceList) {
    const sourceId = sourceIdOf(source);
    const scored = elementList.map((element) => ({
      elementId: elementIdOf(element),
      score: scorePair(textOf(source), textOf(element)),
    }));
    scored.sort(
      (x, y) =>
        y.score - x.score ||
        String(x.elementId).localeCompare(String(y.elementId)),
    );

    const best = scored[0];
    if (best && best.score >= threshold) {
      links.push({ sourceId, elementId: best.elementId, score: best.score });
      continue;
    }
    const candidates = scored
      .filter((c) => c.score > 0)
      .slice(0, MAX_QUEUE_CANDIDATES);
    queue.push({
      sourceId,
      candidates,
      reason:
        elementList.length === 0
          ? "no-elements"
          : candidates.length === 0
            ? "no-overlap"
            : "below-threshold",
      status: "pending",
    });
  }

  return { links, queue };
}

/**
 * Apply a reviewer decision to a queued source item.
 * @param {{ links: Array, queue: Array }} result - current scorePairs result
 * @param {string} sourceId - source id being reviewed
 * @param {'confirm' | 'reject' | 'undecided'} decision
 * @param {{ elementId?: string }} [options]
 * @returns {{ links: Array, queue: Array }} updated links and queue
 */
function applyReviewDecision(result, sourceId, decision, { elementId } = {}) {
  const links = [...result.links];
  const queue = [...result.queue];
  const queueIndex = queue.findIndex((q) => q.sourceId === sourceId);
  if (queueIndex === -1) return { links, queue };

  const item = queue[queueIndex];

  if (decision === "confirm") {
    const targetElementId = elementId || item.candidates[0]?.elementId;
    if (targetElementId) {
      const candidate = item.candidates.find((c) => c.elementId === targetElementId);
      const score = candidate ? candidate.score : 1.0;
      links.push({ sourceId, elementId: targetElementId, score });
      queue.splice(queueIndex, 1);
    }
  } else if (decision === "reject") {
    queue.splice(queueIndex, 1);
  } else if (decision === "undecided") {
    item.status = "pending";
  }

  return { links, queue };
}

module.exports = {
  DEFAULT_THRESHOLD,
  MAX_QUEUE_CANDIDATES,
  tokenize,
  scorePair,
  scorePairs,
  applyReviewDecision,
};
