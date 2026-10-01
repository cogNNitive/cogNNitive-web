const { slugifyHeading, normalizeName, slugifyUnitHeading } = require('../../scripts/markdown-utils');

/**
 * `markdown-utils` slug functions MUST produce byte-identical output to
 * `@cognnitive/innfo-core` (`src/sourceRef.ts`). The expected column below mirrors
 * that package's `sourceRef.spec.ts` + `sourceRef.unit.spec.ts` — keep all three
 * in sync when either side changes.
 */
const CASES = [
  ['Market Overview', 'market-overview'],
  ['## **Q3** _Milestones_', 'q3-milestones'],
  ['  a --- b  ', 'a-b'],
  ['Visión Estratégica', 'vision-estrategica'],
  ['Café résumé', 'cafe-resume'],
  ['métricas Q3 — año 2026', 'metricas-q3-ano-2026'],
  ['Q3 → Q4 (100%)', 'q3-q4-100'],
  ['さくら 桜', 'さくら-桜'],
  ['NN Person: Dr. Egon Spengler', 'nn-person-dr-egon-spengler'],
  ['a--b', 'a--b'],
];

const NAME_CASES = [
  ['mrr_usd', 'mrr_usd'],
  ['  Relationship Model ', 'relationship_model'],
  ['MRR USD', 'mrr_usd'],
];

const UNIT_CASES = [
  [2, 'NN Person: Dr. Egon Spengler', 'nn-person--dr-egon-spengler'],
  [1, 'Summary Statistics', 'summary-statistics'],
];

function run() {
  let passed = 0;
  let failed = 0;
  const check = (label, actual, expected) => {
    if (actual === expected) {
      console.log(`  PASS: ${label} -> ${expected}`);
      passed++;
    } else {
      console.log(`  FAIL: ${label} -> ${JSON.stringify(actual)} (expected ${expected})`);
      failed++;
    }
  };
  for (const [input, expected] of CASES) {
    check(JSON.stringify(input), slugifyHeading(input), expected);
  }
  for (const [input, expected] of NAME_CASES) {
    check(`normalizeName(${JSON.stringify(input)})`, normalizeName(input), expected);
  }
  for (const [level, input, expected] of UNIT_CASES) {
    const { slug, level: gotLevel } = slugifyUnitHeading(level, input);
    check(`slugifyUnitHeading(${level}, ${JSON.stringify(input)})`, `${gotLevel}:${slug}`, `${level}:${expected}`);
  }
  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const r = run();
  process.exit(r.failed > 0 ? 1 : 0);
}
