const test = require('../test/unit/test-provenance-knowledge');
module.exports = test;
if (require.main === module) {
  test.run().then(({ passed, failed }) => {
    console.log(`\nProvenance-knowledge tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
