/**
 * Shared fixture helpers for the lineage suites: build a domaiNN on disk and
 * cognitivize files through the one core operation (no hand-written sidecars).
 */
const fs = require('fs');
const path = require('path');
const { cognitivize } = require('../../scripts/lib/innfo-core.generated.cjs');

/** Stub normalizer: binary subjects get a small citable body. */
const stubNormalizer = async ({ path: rel }) => ({
  body: `# ${path.basename(rel)}\n\n## Overview\nNormalized body.\n`,
  normalizedBy: 'test',
});

function put(root, rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

/** Cognitivize each workspace-relative path in `rels` and return the results. */
async function cognitivizeAll(root, rels, options = {}) {
  const results = [];
  for (const rel of rels) {
    results.push(await cognitivize(root, rel, { normalizer: stubNormalizer, ...options }));
  }
  return results;
}

module.exports = { put, cognitivizeAll, stubNormalizer };
