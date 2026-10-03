const test = require('../test/unit/test-lineage-check');
module.exports = test;
if (require.main === module) {
  test.run().then(({ passed, failed }) => {
    console.log(`\nLineage-check tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
