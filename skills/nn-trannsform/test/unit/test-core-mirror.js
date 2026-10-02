const assert = require('assert');
const fs = require('fs');
const path = require('path');

function run() {
  let passed = 0;
  let failed = 0;
  const ok = (cond, msg) => {
    if (cond) {
      console.log(`  PASS: ${msg}`);
      passed++;
    } else {
      console.log(`  FAIL: ${msg}`);
      failed++;
    }
  };

  const mirrorPath = path.join(__dirname, '../../scripts/lib/innfo-core.generated.cjs');

  ok(fs.existsSync(mirrorPath), 'innfo-core.generated.cjs exists');

  let mirror = {};
  try {
    mirror = require(mirrorPath);
  } catch (err) {
    console.log(`  FAIL: require(innfo-core.generated.cjs) threw: ${err.message}`);
    failed++;
  }

  // 1. Export assertions
  const requiredFunctions = [
    'parseCitation',
    'createFsSourceResolver',
    'validateCitations',
    'projectLineage',
    'renderLineageSections',
    'readLineageSnapshot',
    'slugifyHeading',
    'slugifyUnitHeading',
    'normalizeName',
    'headingSlugParts',
  ];

  for (const fn of requiredFunctions) {
    ok(typeof mirror[fn] === 'function', `mirror exports ${fn}`);
  }

  // 2. Slug parity check
  const slugCases = [
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

  if (typeof mirror.slugifyHeading === 'function') {
    for (const [input, expected] of slugCases) {
      ok(mirror.slugifyHeading(input) === expected, `slugifyHeading(${JSON.stringify(input)}) -> ${expected}`);
    }
  }

  if (typeof mirror.normalizeName === 'function') {
    ok(mirror.normalizeName('MRR USD') === 'mrr_usd', 'normalizeName("MRR USD") -> mrr_usd');
    ok(mirror.normalizeName('  Relationship Model ') === 'relationship_model', 'normalizeName("  Relationship Model ") -> relationship_model');
  }

  // 3. Mirror determinism check
  if (fs.existsSync(mirrorPath)) {
    const text = fs.readFileSync(mirrorPath, 'utf8');
    const hasAbsolutePaths = /(?:[A-Za-z]:[\\\/]Users|(?:\/|\\)home(?:\/|\\)|\/Users\/)/i.test(text);
    ok(!hasAbsolutePaths, 'no absolute or user-junction paths embedded in mirror');

    const hasRelativeNodeModules = /(?:\.\.\/)+node_modules\//.test(text);
    ok(!hasRelativeNodeModules, '(?:\.\./)+node_modules/ paths are normalized');
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const { passed, failed } = run();
  console.log(`\nCore-mirror tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
