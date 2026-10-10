const test = require('../test/unit/test-impact-checker');
module.exports = test;
if (require.main === module) {
  test.run().then(({ passed, failed }) => {
    console.log(`\nImpact-checker tests: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  });
}
