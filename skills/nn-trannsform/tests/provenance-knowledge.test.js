const test = require('../test/unit/test-provenance-knowledge');
module.exports = test;
if (require.main === module) {
  const { passed, failed } = test.run();
  console.log(`\nProvenance-knowledge tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}
