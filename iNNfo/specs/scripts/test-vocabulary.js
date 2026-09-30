const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Canonical vocabulary dictionary guard (nn-trannsform unit pattern).
// Validates iNNfo/specs/vocabulary.json: well-formed, case-sensitive terms,
// retired aliases (app & template -> bluepriNNt), level hierarchy terms,
// uncountable kNNowledge rules, domaiNN container semantics, and the
// retired-identifier alias table (documentation only, no runtime alias).
const SPECS_DIR = path.resolve(__dirname, '..');
const VOCAB_FILE = path.join(SPECS_DIR, 'vocabulary.json');
const REPO_ROOT = path.resolve(SPECS_DIR, '..', '..');

function run() {
  let passed = 0;
  let failed = 0;

  function assertEqual(actual, expected, msg) {
    try {
      assert.strictEqual(actual, expected);
      console.log(`  PASS: ${msg}`);
      passed++;
    } catch (e) {
      console.log(`  FAIL: ${msg}`);
      console.log(`    Expected: ${JSON.stringify(expected)}`);
      console.log(`    Actual:   ${JSON.stringify(actual)}`);
      failed++;
    }
  }

  function assertTrue(actual, msg) {
    assertEqual(actual, true, msg);
  }

  try {
    if (!fs.existsSync(VOCAB_FILE)) {
      console.error(`  ERROR: vocabulary.json not found at ${VOCAB_FILE}`);
      failed++;
      return { passed, failed };
    }

    const vocab = JSON.parse(fs.readFileSync(VOCAB_FILE, 'utf8'));

    // Well-formedness
    assertEqual(typeof vocab, 'object', 'vocabulary.json parses as an object');
    assertEqual(typeof vocab.terms, 'object', 'vocabulary.json has a terms map');
    assertTrue(Array.isArray(vocab.retired_identifiers) || typeof vocab.retired_identifiers === 'object', 'vocabulary.json has retired_identifiers table');

    // Case-sensitive exact keys test
    const terms = vocab.terms;

    // Level 0: defiNNition
    assertTrue(!!terms.defiNNition, 'defiNNition term entry exists');
    if (terms.defiNNition) {
      assertTrue(terms.defiNNition.canonical === true, 'defiNNition is marked canonical');
      assertTrue(Array.isArray(terms.defiNNition.aliases) && terms.defiNNition.aliases.includes('defiNNe'), 'defiNNe is a deprecated alias of defiNNition');
    }

    // Level 1: iNNfo and meta-bluepriNNt
    assertTrue(!!terms.iNNfo, 'iNNfo term entry exists');
    if (terms.iNNfo) {
      assertTrue(terms.iNNfo.canonical === true, 'iNNfo is marked canonical');
    }
    assertTrue(!!terms['meta-bluepriNNt'], 'meta-bluepriNNt term entry exists');
    if (terms['meta-bluepriNNt']) {
      assertTrue(terms['meta-bluepriNNt'].canonical === true, 'meta-bluepriNNt is marked canonical');
      assertTrue(Array.isArray(terms['meta-bluepriNNt'].aliases) && terms['meta-bluepriNNt'].aliases.includes('meta-template'), 'meta-template is a deprecated alias of meta-bluepriNNt');
    }

    // Level 2: bluepriNNt (app & template are deprecated aliases)
    assertTrue(!!terms.bluepriNNt, 'bluepriNNt term entry exists');
    if (terms.bluepriNNt) {
      assertTrue(terms.bluepriNNt.canonical === true, 'bluepriNNt is marked canonical');
      assertTrue(Array.isArray(terms.bluepriNNt.aliases), 'bluepriNNt declares an aliases array');
      assertTrue(terms.bluepriNNt.aliases.includes('app'), 'app is listed as a deprecated alias of bluepriNNt');
      assertTrue(terms.bluepriNNt.aliases.includes('template'), 'template is listed as a deprecated alias of bluepriNNt');
      assertTrue(Array.isArray(terms.bluepriNNt.excludes), 'bluepriNNt declares excludes array');
      assertTrue(terms.bluepriNNt.excludes.includes('vue-sfc-template'), 'bluepriNNt excludes vue-sfc-template');
    }
    // `app` as a top-level canonical term must NO LONGER be canonical
    assertTrue(!terms.app || terms.app.canonical !== true, 'app is NOT a canonical top-level term');

    // Level 3: kNNowledge (uncountable, distinct sense for knowledge unit, plural form)
    assertTrue(!!terms.kNNowledge, 'kNNowledge term entry exists');
    if (terms.kNNowledge) {
      assertTrue(terms.kNNowledge.canonical === true, 'kNNowledge is marked canonical');
      assertTrue(Array.isArray(terms.kNNowledge.aliases) && terms.kNNowledge.aliases.includes('model'), 'model is listed as a deprecated alias of kNNowledge');
      assertEqual(typeof terms.kNNowledge.plural_rule, 'string', 'kNNowledge declares plural_rule');
      assertTrue(terms.kNNowledge.plural_rule.includes('N kNNowledge documents'), 'plural rule specifies "N kNNowledge documents"');
      assertTrue(Array.isArray(terms.kNNowledge.distinct_senses), 'kNNowledge declares distinct_senses');
      assertTrue(terms.kNNowledge.distinct_senses.includes('knowledge unit'), 'knowledge unit is a distinct sense');
    }

    // Container: domaiNN
    assertTrue(!!terms.domaiNN, 'domaiNN term entry exists');
    if (terms.domaiNN) {
      assertTrue(terms.domaiNN.canonical === true, 'domaiNN is marked canonical');
      assertTrue(Array.isArray(terms.domaiNN.aliases) && terms.domaiNN.aliases.includes('workspace'), 'workspace is a deprecated alias of domaiNN');
      assertTrue(typeof terms.domaiNN.sense === 'string' && terms.domaiNN.sense.length > 0, 'domaiNN declares container sense');
      assertTrue(terms.domaiNN.self_knowledge_relation === true, 'domaiNN is defined as a kNNowledge document itself');
      assertTrue(Array.isArray(terms.domaiNN.excludes), 'domaiNN declares excludes array');
    }

    // `ageNNt` and `assistant`
    assertTrue(!!terms.ageNNt, 'ageNNt term entry exists');
    assertTrue(!!terms.assistant, 'assistant term entry exists');

    // Retired identifier alias table verification
    const retired = vocab.retired_identifiers;
    assertTrue(Array.isArray(retired) || typeof retired === 'object', 'retired_identifiers table exists');
    
    // Check key required entries in retired table
    const retiredList = Array.isArray(retired) ? retired : Object.entries(retired).map(([oldId, val]) => ({ old: oldId, ...val }));
    
    function findRetired(oldName) {
      return retiredList.find(e => e.old === oldName || (e.paths && e.paths.includes(oldName)) || e.id === oldName);
    }

    // INNFO_MODELS_DIR -> INNFO_DOMAIN_DIR with "no fallback"
    const envEntry = findRetired('INNFO_MODELS_DIR');
    assertTrue(!!envEntry, 'INNFO_MODELS_DIR is in retired_identifiers');
    if (envEntry) {
      assertEqual(envEntry.new, 'INNFO_DOMAIN_DIR', 'INNFO_MODELS_DIR replacement is INNFO_DOMAIN_DIR');
      assertTrue(typeof envEntry.notes === 'string' && envEntry.notes.toLowerCase().includes('no fallback'), 'INNFO_MODELS_DIR notes state "no fallback"');
    }

    // target_template -> target_blueprint
    const targetTemplateEntry = findRetired('target_template');
    assertTrue(!!targetTemplateEntry, 'target_template is in retired_identifiers');
    if (targetTemplateEntry) {
      assertEqual(targetTemplateEntry.new, 'target_blueprint', 'target_template replacement is target_blueprint');
    }

    // type:: model -> type:: knowledge
    const typeModelEntry = findRetired('type:: model');
    assertTrue(!!typeModelEntry, 'type:: model is in retired_identifiers');
    if (typeModelEntry) {
      assertEqual(typeModelEntry.new, 'type:: knowledge', 'type:: model replacement is type:: knowledge');
    }

    // nn-workspace-git -> nn-domain-git
    const skillEntry = findRetired('nn-workspace-git');
    assertTrue(!!skillEntry, 'nn-workspace-git is in retired_identifiers');
    if (skillEntry) {
      assertEqual(skillEntry.new, 'nn-domain-git', 'nn-workspace-git replacement is nn-domain-git');
    }

    // tag namespace: templates-v* -> blueprints-v*
    const tagEntry = findRetired('templates-v*');
    assertTrue(!!tagEntry, 'templates-v* is in retired_identifiers');
    if (tagEntry) {
      assertEqual(tagEntry.new, 'blueprints-v*', 'templates-v* replacement is blueprints-v*');
    }

    // entrypoint: workspace_NN.md -> domaiNN_NN.md
    const entrypointEntry = findRetired('workspace_NN.md');
    assertTrue(!!entrypointEntry, 'workspace_NN.md is in retired_identifiers');
    if (entrypointEntry) {
      assertEqual(entrypointEntry.new, 'domaiNN_NN.md', 'workspace_NN.md replacement is domaiNN_NN.md');
    }

    // Capability folders mapping recorded (names kept per D13)
    const capFoldersEntry = findRetired('capability_folders');
    assertTrue(!!capFoldersEntry, 'capability_folders mapping is recorded in retired_identifiers');

    // Documentation-only check: assert table has documentation_only: true or runtime_consumers: []
    assertTrue(vocab.documentation_only === true || (vocab.meta && vocab.meta.documentation_only === true), 'retired table is documentation only (no runtime aliases)');

    console.log(`\n  Vocabulary tests: ${passed} passed, ${failed} failed`);
  } catch (e) {
    console.error(`  ERROR: ${e.message}`);
    console.error(e.stack);
    failed++;
  }

  return { passed, failed };
}

module.exports = { run };

if (require.main === module) {
  const result = run();
  process.exit(result.failed > 0 ? 1 : 0);
}